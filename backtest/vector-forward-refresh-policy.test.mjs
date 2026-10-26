import test from 'node:test';
import assert from 'node:assert/strict';
import {REFRESH_INTERVAL_MS,ONE_HOUR_MS,createBitunixFreshnessLedger,dueForRefresh}
 from './vector-forward-refresh-policy.mjs';
const START=Date.parse('2026-10-26T18:17:00Z');
test('Interval exactly 15 min, no hidden-tab/background or concurrent reentry',()=>{
 assert.equal(REFRESH_INTERVAL_MS,900000);
 assert.equal(dueForRefresh({nowMs:START,lastAttemptMs:START-899999}),false);
 assert.equal(dueForRefresh({nowMs:START,lastAttemptMs:START-900000}),true);
 assert.equal(dueForRefresh({nowMs:START,lastAttemptMs:0}),true);
 assert.equal(dueForRefresh({nowMs:START,lastAttemptMs:START-900000,hidden:true}),false);
 assert.equal(dueForRefresh({nowMs:START,lastAttemptMs:START-900000,pending:true}),false);
 assert.equal(dueForRefresh({nowMs:START,lastAttemptMs:START+ONE_HOUR_MS}),false);
});
function makeBars(asOf,num=60){
 const end=Math.floor(asOf/ONE_HOUR_MS)*ONE_HOUR_MS-ONE_HOUR_MS;
 return Array.from({length:num},(_,i)=>({
  time:end-(num-1-i)*ONE_HOUR_MS,
  open:100,high:101,low:99,close:100,volume:10
 }));
}
test('All three Bitunix sources require 55 recent consecutive closed hours',()=>{
 const feed=createBitunixFreshnessLedger(),bars=makeBars(START);
 for(const symbol of ['BTCUSDT','ETHUSDT','SOLUSDT'])
  feed.acceptPage({symbol},bars);
 const result=feed.inspect(START);
 assert.equal(result.ok,true);
 assert.equal(result.markets.length,3);
 assert.ok(result.markets.every(r=>r.lastClosedContinuousBars===55));
 assert.ok(result.markets.every(r=>r.lagHours===0));
});
test('A delayed feed is rejected even when 60 older bars appear valid',()=>{
 const feed=createBitunixFreshnessLedger(),rows=makeBars(START);
 for(const symbol of ['BTCUSDT','ETHUSDT'])
  feed.acceptPage({symbol},rows);
 feed.acceptPage({symbol:'SOLUSDT'},rows.slice(0,-1));
 const r=feed.inspect(START);
 assert.equal(r.ok,false);
 assert.equal(r.markets[2].lagHours,1);
 assert.equal(r.markets[2].lastClosedContinuousBars,0);
});
test('The old ETH 54 bad candles can be quarantined while recent 55 stay intact',()=>{
 const feed=createBitunixFreshnessLedger(),rows=makeBars(START,180);
 for(const symbol of ['BTCUSDT','SOLUSDT'])
  feed.acceptPage({symbol},rows);
 const eth=rows.map((r,i)=>i<54?{...r,open:102,high:101}:r);
 feed.acceptPage({symbol:'ETHUSDT'},eth);
 const r=feed.inspect(START);
 assert.equal(r.ok,true);
 assert.equal(r.markets[1].lastClosedContinuousBars,55);
});
test('Latest malformed OHLC and exact duplicate CLOSED bars are never fixed',()=>{
 const rows=makeBars(START);
 const feed=createBitunixFreshnessLedger();
 feed.acceptPage({symbol:'BTCUSDT'},rows);
 feed.acceptPage({symbol:'BTCUSDT'},[rows.at(-1)]);
 feed.acceptPage({symbol:'ETHUSDT'},rows.map((b,i)=>i===59?{...b,high:90}:b));
 feed.acceptPage({symbol:'SOLUSDT'},rows);
 const r=feed.inspect(START);
 assert.equal(r.ok,false);
 assert.equal(r.markets[0].lastClosedContinuousBars,0);
 assert.equal(r.markets[1].lastClosedContinuousBars,0);
});
test('An actively building current candle must not be counted as closed',()=>{
 const feed=createBitunixFreshnessLedger(),rows=makeBars(START);
 const open=Math.floor(START/ONE_HOUR_MS)*ONE_HOUR_MS;
 for(const symbol of ['BTCUSDT','ETHUSDT','SOLUSDT'])
  feed.acceptPage({symbol},[...rows,{...rows.at(-1),time:open,close:99}]);
 const r=feed.inspect(START);
 assert.equal(r.ok,true);
 assert.equal(r.expectedLastClosedOpen,open-ONE_HOUR_MS);
});
