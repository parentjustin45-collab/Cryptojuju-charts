import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBitunixHistory} from './history-validation.mjs';
const step=900000;
const candle=i=>({time:i*step,open:100,high:102,low:99,close:101,volume:10});
const base={symbol:'BTCUSDT',interval:'15m',startTime:0,endTime:5*step,limit:2};
test('complete 15m Bitunix history passes quality gate',async()=>{
 const all=[0,1,2,3,4].map(candle);
 const r=await validateBitunixHistory({...base,fetchPage:async({startTime,limit})=>all.filter(x=>x.time>=startTime).slice(0,limit)});
 assert.equal(r.status,'PASS');
 assert.equal(r.received,5);
 assert.equal(r.pages,3);
});
test('missing candle fails before signal backtest',async()=>{
 const all=[0,1,3,4].map(candle);
 const r=await validateBitunixHistory({...base,fetchPage:async({startTime,limit})=>all.filter(x=>x.time>=startTime).slice(0,limit)});
 assert.equal(r.status,'FAIL');
 assert.ok(r.issues.includes('GAPS'));
});
test('incomplete history fails quality gate',async()=>{
 const all=[0,1,2].map(candle);
 const r=await validateBitunixHistory({...base,fetchPage:async({startTime,limit})=>all.filter(x=>x.time>=startTime).slice(0,limit)});
 assert.equal(r.status,'FAIL');
 assert.ok(r.issues.includes('MISSING_END'));
});
test('duplicate candles fail quality gate',async()=>{
 const r=await validateBitunixHistory({...base,limit:200,fetchPage:async()=>[candle(0),candle(1),candle(1),candle(2),candle(3),candle(4)]});
 assert.equal(r.status,'FAIL');
 assert.ok(r.issues.includes('DUPLICATES'));
});
test('page cap fails quality gate',async()=>{
 const all=[0,1,2,3,4].map(candle);
 const r=await validateBitunixHistory({...base,maxPages:1,fetchPage:async({startTime,limit})=>all.filter(x=>x.time>=startTime).slice(0,limit)});
 assert.equal(r.status,'FAIL');
 assert.ok(r.issues.includes('PAGE_LIMIT'));
});
