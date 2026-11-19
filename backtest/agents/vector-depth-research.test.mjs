import test from 'node:test';
import assert from 'node:assert/strict';
import {runVectorDepthResearch,DEPTH_PILOT} from './vector-depth-research.mjs';
const intervalMs=900000,end=Date.UTC(2026,10,19,15,15);
const nowMs=end+10_000,start=end-(DEPTH_PILOT.closedBars+DEPTH_PILOT.anchorBars)*intervalMs;
const candles=Array.from({length:963},(_,i)=>{
 const rise=i%40===0,fall=i%40===15;
 return {time:start+i*intervalMs,open:100,high:110,low:90,
   close:rise?109:fall?91:100,volume:rise||fall?10000:100};
});
const contract={symbol:'BTCUSDT',quotePrecision:1,priceStep:0.1,
 source:'BITUNIX_PUBLIC_TRADING_PAIRS',stepStatus:'RESEARCH_PRICE_PRECISION_NOT_TV_MINTICK'};
const read=(source,revisionAtCall=Infinity)=>{
 let calls=0;
 return async ({startTime,endTime,limit})=>{
   assert.ok(limit<=150);
   calls++;
   return source.filter(c=>c.time>=startTime&&c.time<endTime).map(c=>
     calls>=revisionAtCall && c.time===end-intervalMs ?
       {...c,close:c.close+.1}:c);
 };
};
test('960-bar read-only depth replay compares baseline and variants without promoting',async()=>{
 const result=await runVectorDepthResearch({nowMs,contract,fetchPage:read(candles)});
 assert.equal(result.status,'COMPLETE_RESEARCH_ONLY');
 assert.equal(result.first.acceptedCandles.length,960);
 assert.equal(result.repeatability.checkedDerived,960);
 assert.equal(result.repeatability.differenceCount,0);
 assert.equal(result.comparison.modes.length,3);
 assert.equal(result.scorecard.variants.length,3);
 assert.equal(result.comparison.promotedVariant,null);
 assert.equal(result.scorecard.promotionAuthorized,false);
 assert.equal(result.baseline.status,'RESEARCH_ONLY_UNVERIFIED_TV_PARITY');
 assert.ok(result.comparison.modes.every(x=>x.timingDiagnostics.signalCount===x.signalCount));
});
test('missing interior closed bar fails before producing any Vector research',async()=>{
 const result=await runVectorDepthResearch({nowMs,contract,
   fetchPage:read(candles.filter((_,i)=>i!==320))});
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.reason,'INITIAL_HISTORY_NOT_VERIFIED');
 assert.equal(result.baseline,null);
 assert.equal(result.comparison,null);
});
test('same closed bar revision on independent second read blocks all signals',async()=>{
 // Seven pages in first read, then seven in second read.
 const result=await runVectorDepthResearch({nowMs,contract,
   fetchPage:read(candles,8)});
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.reason,'HISTORY_REPEATABILITY_NOT_VERIFIED');
 assert.equal(result.repeatability.status,'BLOCKED');
 assert.ok(result.repeatability.differenceCount>=1);
 assert.equal(result.baseline,null);
});
