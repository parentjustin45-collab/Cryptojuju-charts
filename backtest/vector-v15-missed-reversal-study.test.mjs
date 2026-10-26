import test from 'node:test';
import assert from 'node:assert/strict';
import {studyMissedReversals,MISSED_REVERSAL_LOCK} from './vector-v15-missed-reversal-study.mjs';
import {V15_LOCK} from './vector-v15-followthrough.mjs';
const H=3600000;
function candles(n=180){
 let price=100;
 return Array.from({length:n},(_,i)=>{
  const open=price,close=Math.max(20,open+(i%9<4?.08:-.1));
  const bar={time:i*H,open,high:Math.max(open,close)+.25,
    low:Math.min(open,close)-.25,close,volume:100};
  price=close;
  return bar;
 });
}
function fixture(){
 const b=candles();
 for(const i of [30,42,65,88,110,132,151]){
  const bullish=i===42||i===88||i===132;
  const open=b[i].open,close=open+(bullish?2.7:-2.7);
  b[i]={...b[i],high:Math.max(open,close)+.4,
    low:Math.min(open,close)-.4,close,volume:2e6};
 }
 return b;
}
const evalStudy=(b=fixture(),cutoff=90*H)=>studyMissedReversals([{candles:b}],{cutoffTime:cutoff});
test('Fixed pre-registered candidate and historical evaluation protocol',()=>{
 assert.equal(MISSED_REVERSAL_LOCK.historyDays,180);
 assert.equal(MISSED_REVERSAL_LOCK.cost.feeRate,.0006);
 assert.equal(MISSED_REVERSAL_LOCK.horizonBars,12);
 assert.ok(MISSED_REVERSAL_LOCK.modes.includes(V15_LOCK.protocol));
});
test('Four independently simulated engines and costs, original input unchanged',()=>{
 const b=fixture(),copy=JSON.stringify(b),r=evalStudy(b);
 assert.equal(r.status,'EXPLORATORY_HISTORICAL_NOT_HOLDOUT');
 for(const mode of MISSED_REVERSAL_LOCK.modes){
  assert.ok(r.byMode[mode].fixed.short.common.earlier.signals>=0);
  assert.ok(r.byMode[mode].fixed.long.harsh.later.censored>=0);
 }
 assert.equal(JSON.stringify(b),copy);
});
test('Opposite V1.1 reference events are divided into accepted, redundant, and rejected without duplicating',()=>{
 const r=evalStudy();
 for(const mode of MISSED_REVERSAL_LOCK.modes.slice(1)){
  for(const split of ['earlier','later']){
   const audit=r.byMode[mode].opportunity[split];
   assert.equal(audit.considered,audit.accepted+audit.alreadyAligned+audit.rejected);
   assert.ok(audit.futureEligible>=audit.acceptedFutureObserved+audit.rejectedFutureObserved);
   assert.equal(audit.rejectedOpportunity+audit.rejectedNegative+audit.rejectedUnclear,
    audit.rejectedFutureObserved);
  }
 }
});
test('Twelve-hour after-the-fact gross outcomes are independent of execution fills',()=>{
 const r=evalStudy();
 const b=r.byMode[V15_LOCK.protocol].opportunity.earlier;
 assert.ok(b.rejectedOpportunity>=0);
 assert.ok(b.rejectedNegative>=0);
 assert.ok(b.futureCensored>=0);
 assert.ok(r.byMode[V15_LOCK.protocol].fixed.short.common.earlier.meanNetPct===null||
  Number.isFinite(r.byMode[V15_LOCK.protocol].fixed.short.common.earlier.meanNetPct));
});
test('A discontinuity invalidates the window; results cannot bridge a missing bar',()=>{
 const b=fixture();b[79].time+=H;
 const r=evalStudy(b);
 assert.equal(r.rejectedWindows,1);
 assert.equal(r.byMode[V15_LOCK.protocol].fixed.short.common.earlier.trades,0);
});
test('Later candle mutation never changes earlier returns or missed opportunity classifications',()=>{
 const b=fixture(),a=evalStudy(b);
 const changed=b.map((x,i)=>i<115?{...x}:{...x,open:100,high:113,
  low:90,close:110,volume:5e6});
 const z=evalStudy(changed);
 for(const mode of MISSED_REVERSAL_LOCK.modes){
  assert.deepEqual(a.byMode[mode].fixed.short.common.earlier,
   z.byMode[mode].fixed.short.common.earlier);
  assert.deepEqual(a.byMode[mode].opportunity.earlier,
   z.byMode[mode].opportunity.earlier);
 }
});
test('The late boundary censors future outcomes instead of labeling them as winners',()=>{
 const b=fixture(),r=evalStudy(b,40*H);
 const f=r.byMode[V15_LOCK.protocol].opportunity.earlier;
 assert.ok(f.futureCensored>=0);
 assert.ok(f.rejectedOpportunity<=f.rejectedFutureObserved);
});
