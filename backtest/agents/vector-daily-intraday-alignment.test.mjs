import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compareBitunixReadbacks} from './bitunix-readback-consistency.mjs';
import {
 indexCompletedDaily,lastKnownDaily,filterVectorAgainstCompletedDaily,
 compareDailyAlignedVector,DAILY_ALIGNMENT_LOCK
} from './vector-daily-intraday-alignment.mjs';
const D=86400000,H=3600000,midnight=Date.UTC(2026,10,19);
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function source(symbol,timeframe,start,step,count,priceFn){
 const acceptedCandles=Array.from({length:count},(_,i)=>{
   const c=priceFn(i);
   return {time:start+i*step,open:c,close:c+.05,
     high:c+1,low:c-1,volume:100+i};
 });
 const rawRows=acceptedCandles.map(x=>({...x}));
 return {
  status:'DATA_READY_FOR_RESEARCH_ONLY',
  market:{exchange:'Bitunix',symbol,timeframe,priceType:'LAST_PRICE'},
  historyWindow:{startTime:start,endTime:start+step*count,intervalMs:step},
  provenance:{source:'Bitunix public Futures REST',priceType:'LAST_PRICE',
   formingBarExcluded:true,anchorBars:0,
   rawSha256:sha(rawRows),derivedSha256:sha(acceptedCandles),
   normalizationVersion:'bitunix-open-envelope-v1'},
  acceptedCandles,rawRows
 };
}
const daily=source('BTCUSDT','1d',midnight-365*D,D,365,
 i=>100+i*.45+Math.sin(i/9)*2);
const lower=source('BTCUSDT','1h',midnight+16*H-960*H,H,960,
 i=>200+i*.05+Math.sin(i/8)*3);
const contract={symbol:'BTCUSDT',quotePrecision:1,priceStep:.1,
 source:'BITUNIX_PUBLIC_TRADING_PAIRS',
 stepStatus:'RESEARCH_PRICE_PRECISION_NOT_TV_MINTICK'};
const makeReadback=x=>compareBitunixReadbacks(x,structuredClone(x));
const dailyReadback=makeReadback(daily),intradayReadback=makeReadback(lower);
const run=x=>compareDailyAlignedVector({
 intraday:lower,intradayReadback,daily,dailyReadback,contract,...x
});
test('Daily 1D context is unknown before warmup and only available after close plus 120 seconds',()=>{
 const idx=indexCompletedDaily(daily);
 assert.equal(idx.length,365);
 assert.equal(idx[10].regime,'unknown');
 assert.equal(lastKnownDaily(idx,midnight).closedAt,midnight-D);
 assert.equal(lastKnownDaily(idx,midnight+119_999).closedAt,midnight-D);
 assert.equal(lastKnownDaily(idx,midnight+120_000).closedAt,midnight);
 assert.equal(lastKnownDaily(idx,midnight-365*D),null);
});
test('opposed reversals emit FLAT rather than leaving a long exposure in place',()=>{
 const bars=Array.from({length:5},(_,i)=>({
   time:midnight+3*H+i*H,close:100,open:100,high:101,low:99,volume:5
 }));
 const events=bars.map((x,i)=>({time:x.time,signal:i===0?'long':i===2?'short':null}));
 const idx=[{closedAt:midnight,regime:'bull_stack',side:'long'}];
 const result=filterVectorAgainstCompletedDaily({
   lowerBars:bars,events,dailyIndex:idx,intervalMs:H
 });
 assert.deepEqual(result.signals.map(x=>x.side),['long','flat']);
 assert.equal(result.stats.accepted,1);
 assert.equal(result.stats.rejectedOpposed,1);
 assert.equal(result.stats.flattenOnRejectedReversal,1);
 assert.ok(result.observations.every(o=>
   o.dailyClosedAtMs+120000<=o.signalConfirmedAtMs));
});
test('BTC one-hour 960 bars and 365 closed Daily bars: strict source gates and baseline preserved',()=>{
 assert.equal(DAILY_ALIGNMENT_LOCK.intradayDepth,960);
 const r=run();
 assert.equal(r.status,'RESEARCH_COMPARISON_ONLY');
 assert.equal(r.causal.baselineReproduced,true);
 assert.equal(r.causal.noFutureDailyBarUsed,true);
 assert.equal(r.data.dailyDoubleRead,'STABLE_TWO_READS');
 assert.equal(r.data.intradayDoubleRead,'STABLE_TWO_READS');
 assert.equal(r.training.baseline_v11.returnPct!==undefined,true);
 assert.equal(r.holdout.v11_daily_aligned!==undefined,true);
 assert.equal(r.holdout.break_daily_aligned!==undefined,true);
 assert.equal(r.promotedVariant,null);
 assert.equal(r.tradingEnabled,false);
});
test('blocked source, stale readback, wrong market or time window cannot fake alignment',()=>{
 assert.throws(()=>run({daily:{...daily,status:'BLOCKED'}}),/Vector requires/);
 assert.throws(()=>run({dailyReadback:{...dailyReadback,status:'BLOCKED'}}),/Vector requires/);
 assert.throws(()=>run({intraday:{...lower,market:{...lower.market,symbol:'ETHUSDT'}}}),/Unsupported/);
 const damaged=structuredClone(daily);damaged.acceptedCandles.at(-1).close+=1;
 assert.throws(()=>run({daily:damaged}),/Vector requires|mismatch|blocked/i);
});
test('adding future daily data cannot change earlier aligned Vector decisions',()=>{
 const full=run();
 const idx=indexCompletedDaily(daily);
 const events=[{time:lower.acceptedCandles[0].time,signal:'long'}];
 const base=filterVectorAgainstCompletedDaily({
    lowerBars:lower.acceptedCandles.slice(0,1),events,dailyIndex:idx,
    intervalMs:H
 });
 const extended=[...idx,{closedAt:midnight+2*D,regime:'bear_stack',side:'short'}];
 const again=filterVectorAgainstCompletedDaily({
    lowerBars:lower.acceptedCandles.slice(0,1),events,
    dailyIndex:extended,intervalMs:H
 });
 assert.deepEqual(base.signals,again.signals);
 assert.deepEqual(base.observations,again.observations);
 assert.equal(full.causal.noFutureDailyBarUsed,true);
});
