import test from 'node:test';
import assert from 'node:assert/strict';
import {auditDailyVectorMarket,DAILY_DEPTH_CANDIDATES} from './daily-vector-research.mjs';
const step=86400000,end=Date.UTC(2026,10,19);
const nowMs=end+3600000;
const size=368,start=end-size*step;
const bars=Array.from({length:size},(_,i)=>{
 const price=100+i*.02+Math.sin(i/7)*2;
 return {time:start+i*step,open:price,high:price+2,
   low:price-2,close:price+.15,volume:500+i};
});
const contract={symbol:'BTCUSDT',quotePrecision:1,priceStep:.1,
 source:'BITUNIX_PUBLIC_TRADING_PAIRS',
 stepStatus:'RESEARCH_PRICE_PRECISION_NOT_TV_MINTICK'};
const mock=(rows,reviseCall=Infinity)=>{
 let calls=0;
 return async({startTime,endTime})=>{
   calls++;
   return rows.filter(c=>c.time>=startTime&&c.time<endTime)
      .map(c=>(calls>=reviseCall&&c.time===end-step)?
         {...c,close:c.close+.01}:c);
 };
};
const run=(x={})=>auditDailyVectorMarket({
 symbol:'BTCUSDT',contract,fetchPage:mock(bars),nowMs,...x
});
test('Daily 365 bars: two full reads, confirmed signal timing and no future day',async()=>{
 const r=await run();
 assert.deepEqual(DAILY_DEPTH_CANDIDATES,[365,180]);
 assert.equal(r.status,'DAILY_RESEARCH_COMPLETE');
 assert.equal(r.depth,365);
 assert.equal(r.source.acceptedCandles.length,365);
 assert.equal(r.readback.status,'STABLE_TWO_READS');
 assert.equal(r.readback.checkedDerived,365);
 assert.equal(r.source.historyWindow.endTime,end);
 assert.equal(r.source.acceptedCandles.at(-1).time,end-step);
 assert.equal(r.baseline.evaluatedClosedBars,365);
 assert.equal(r.comparison.modes.length,3);
 assert.equal(r.regimes.status,'DESCRIPTIVE_ONLY_NO_WINNER');
 assert.equal(r.regimes.blocks.length,4);
 assert.equal(r.autoPromote,false);
 assert.ok(r.baseline.signalEvents.every(x=>x.actionAllowedAtNextOpenMs===x.confirmedAtCloseMs));
});
test('history retained only for recent 180 days is flagged and separately re-read',async()=>{
 const short=bars.slice(90);
 const r=await run({fetchPage:mock(short)});
 assert.equal(r.status,'DAILY_RESEARCH_COMPLETE');
 assert.equal(r.depth,180);
 assert.equal(r.attempts[0].status,'BLOCKED');
 assert.equal(r.attempts[0].eligibleShorterDepth,180);
 assert.equal(r.historyDepthStatus,'EXPLICIT_SHORT_HISTORY_NOT_EQUIVALENT_TO_FULL_DEPTH');
 assert.equal(r.readback.checkedDerived,180);
});
test('missing candle in most recent 180 blocks instead of inventing data',async()=>{
 const missing=bars.filter((_,i)=>i!==310);
 const r=await run({fetchPage:mock(missing)});
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.reason,'NO_VERIFIED_DAILY_HISTORY');
 assert.equal(r.attempts[0].eligibleShorterDepth,null);
 assert.equal(r.baseline,null);
});
test('revised closed Daily OHLC on second read blocks signal research',async()=>{
 const r=await run({fetchPage:mock(bars,4)});
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.reason,'DAILY_REPEATABILITY_FAILED');
 assert.equal(r.readback.status,'BLOCKED');
 assert.ok(r.readback.differenceCount>0);
 assert.equal(r.comparison,null);
});
test('invalid contract or unknown Daily market fails without REST requests',async()=>{
 await assert.rejects(run({symbol:'UNKNOWNUSDT'}),/Missing official/);
 await assert.rejects(run({contract:{...contract,priceStep:.001}}),/Missing official/);
 await assert.rejects(run({depthCandidates:[120]}),/Missing official/);
});
