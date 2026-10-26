import test from 'node:test';
import assert from 'node:assert/strict';
import {studyV14History,V14_HISTORICAL_LOCK} from './vector-v14-history.mjs';
import {VECTOR_V14_LOCK} from './vector-v14-hysteresis.mjs';
const H=3600000;
function candles(n=160){
 const rows=Array.from({length:n},(_,i)=>({time:i*H,open:100,high:100.3,low:99.7,
  close:100,volume:100}));
 rows[35]={...rows[35],open:100,high:100.2,low:96.6,close:96.9,volume:1e7};
 rows[58]={...rows[58],open:97.2,high:102.4,low:97.1,close:102.2,volume:1e7};
 rows[91]={...rows[91],open:102.1,high:102.2,low:97.1,close:97.3,volume:1e7};
 rows[125]={...rows[125],open:97.3,high:103.2,low:97.2,close:103,volume:1e7};
 return rows;
}
function study(b=candles(),cutoffTime=100*H){
 return studyV14History([{candles:b}],{cutoffTime,symbol:'BTCUSDT'});
}
test('Preset is research only; original V1.1, V1.2, V1.3 remain comparisons',()=>{
 assert.deepEqual(V14_HISTORICAL_LOCK.modes,[
  'baseline_v11','break_extreme_2','v13_ema50_slope',VECTOR_V14_LOCK.id]);
 assert.equal(V14_HISTORICAL_LOCK.exit,'fixed_1_5_3_12');
 assert.equal(V14_HISTORICAL_LOCK.feeRate,.0006);
 assert.equal(V14_HISTORICAL_LOCK.commonSlippageRate,.0005);
 assert.equal(V14_HISTORICAL_LOCK.historyDays,180);
});
test('The experimental study runs with four independent engines and no change to source candles',()=>{
 const b=candles(),snapshot=JSON.stringify(b),r=study(b);
 assert.equal(r.status,'EXPLORATORY_HISTORY_ONLY');
 assert.equal(r.cleanWindows,1);
 for(const mode of V14_HISTORICAL_LOCK.modes){
  assert.ok(r.byMode[mode].fixed.short.common.earlier.signals>=0);
  assert.ok(r.byMode[mode].holding.common.later.censored>=0);
 }
 assert.equal(JSON.stringify(b),snapshot);
});
test('Harsh slippage never improves net when fixed fill/exit cohort matches',()=>{
 const r=study();
 for(const mode of V14_HISTORICAL_LOCK.modes)for(const side of ['long','short']){
  const common=r.byMode[mode].fixed[side].common.earlier;
  const harsh=r.byMode[mode].fixed[side].harsh.earlier;
  if(common.trades&&common.trades===harsh.trades)
   assert.ok(harsh.meanNetPct<=common.meanNetPct+.000001);
 }
});
test('No-gap policy refuses a contaminated interval without an invented return',()=>{
 const b=candles();b[50].time+=H;
 const r=study(b);
 assert.equal(r.cleanWindows,0);
 assert.equal(r.skippedWindows,1);
 for(const mode of V14_HISTORICAL_LOCK.modes)
  assert.equal(r.byMode[mode].fixed.short.common.earlier.trades,0);
});
test('Existing first chronological half does not change if future market bars are rewritten',()=>{
 const base=candles(),x=study(base);
 const altered=base.map((b,i)=>i<110?{...b}:{
  ...b,open:100,high:115,low:90,close:110,volume:1e6});
 const y=study(altered);
 for(const mode of V14_HISTORICAL_LOCK.modes){
  for(const side of ['long','short']){
   assert.deepEqual(x.byMode[mode].fixed[side].common.earlier,
    y.byMode[mode].fixed[side].common.earlier);
  }
  assert.deepEqual(x.byMode[mode].holding.common.earlier,
   y.byMode[mode].holding.common.earlier);
 }
});
test('Opposite flip-to-flip study never fakes a stop-loss or an exit before opposite signal',()=>{
 const r=study();
 const mode=r.byMode.baseline_v11;
 assert.equal(mode.holding.common.earlier.reasons.stop,0);
 assert.equal(mode.holding.common.earlier.reasons.take,0);
 assert.ok(mode.holding.common.earlier.signals>=mode.holding.common.earlier.trades);
 assert.ok(mode.holding.common.later.censored>=0);
});
test('Censored positions never contribute positive net profit',()=>{
 const b=candles(60),r=study(b,40*H);
 for(const mode of V14_HISTORICAL_LOCK.modes){
  const z=r.byMode[mode].holding.common.later;
  assert.equal(z.trades,0);
  assert.equal(z.meanNetPct,null);
 }
});
