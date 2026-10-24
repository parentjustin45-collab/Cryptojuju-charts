import test from 'node:test';
import assert from 'node:assert/strict';
import {runBacktest} from './engine.mjs';
import {makeBitunixFetchPage} from './bitunix-adapter.mjs';

const bars=[
 {time:1000,open:100,high:102,low:99,close:101},
 {time:2000,open:110,high:115,low:108,close:112},
 {time:3000,open:120,high:125,low:118,close:121},
 {time:4000,open:130,high:135,low:128,close:131}
];
test('LONG enters only at next bar open and exits on next open',()=>{
 const r=runBacktest(bars,[{time:1000,side:'long'},{time:2000,side:'flat'}],{feeRate:0,slippageRate:0});
 assert.equal(r.tradeCount,1);
 assert.equal(r.trades[0].entry,110);
 assert.equal(r.trades[0].exit,120);
 assert.ok(Math.abs(r.netProfit-(100*10/110))<1e-8);
});
test('SHORT profits from falling price',()=>{
 const b=[bars[0],{...bars[1],open:100,high:101,low:89,close:90},{...bars[2],open:80,high:81,low:79,close:80}];
 const r=runBacktest(b,[{time:1000,side:'short'},{time:2000,side:'flat'}],{feeRate:0});
 assert.ok(r.netProfit>0);
 assert.equal(r.trades[0].entry,100);
 assert.equal(r.trades[0].exit,80);
});
test('reject duplicate and unsorted candles',()=>{
 assert.throws(()=>runBacktest([bars[0],bars[0]],[]),/Invalid/);
 assert.throws(()=>runBacktest([bars[1],bars[0]],[]),/Invalid/);
});
test('fee reduces net profit',()=>{
 const signals=[{time:1000,side:'long'},{time:2000,side:'flat'}];
 assert.ok(runBacktest(bars,signals,{feeRate:0.0006}).netProfit<runBacktest(bars,signals,{feeRate:0}).netProfit);
});
test('Bitunix adapter uses official origin, limit, and converts seconds',async()=>{
 let requested;
 const fetchPage=makeBitunixFetchPage({fetchImpl:async(url,options)=>{
  requested=new URL(url);
  assert.equal(options.credentials,'omit');
  return {ok:true,json:async()=>({code:0,data:[{time:'1700000000',open:'100',high:'110',low:'90',close:'105',baseVol:'42'}]})};
 }});
 const rows=await fetchPage({symbol:'BTCUSDT',interval:'15m',startTime:1700000000000,endTime:1700000900000});
 assert.equal(requested.origin,'https://fapi.bitunix.com');
 assert.equal(requested.searchParams.get('limit'),'200');
 assert.equal(rows[0].time,1700000000000);
 assert.equal(Number(rows[0].close),105);
});
test('Bitunix refuses unexpected origin',()=>{
 assert.throws(()=>makeBitunixFetchPage({baseUrl:'https://example.com'}),/Only official/);
});
test('empty candles should return a stable report',()=>{
 const r=runBacktest([],[]);
 assert.equal(r.tradeCount,0);
 assert.equal(r.finalCapital,100);
 assert.ok(Number.isFinite(r.maxDrawdownPct));
});
