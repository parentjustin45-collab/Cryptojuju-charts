import test from 'node:test';
import assert from 'node:assert/strict';
import {MTF_AUDIT_LOCK,studyHistoricalMtf,runHistoricalMtf} from './vector-mtf-history.mjs';
import {buildCompletedVectorContext,contextAtEntry} from './vector-prospective-v12.mjs';
const H=3600000,D=24*H;
const hourly=(n=150)=>Array.from({length:n},(_,i)=>{
 const b={time:i*H,open:100,high:101,low:99,close:100,volume:100};
 if(i===31)return {...b,open:103,high:104,low:99,close:100,volume:1000000};
 if(i===32)return {...b,open:100,high:101,low:97.5,close:98};
 return b;
});
const flat=(n,step)=>Array.from({length:n},(_,i)=>({
 time:i*step,open:100,high:101,low:99,close:100,volume:100
}));
const hourWindows=[{candles:hourly()}],h4Windows=[{candles:flat(50,4*H)}],
 d1Windows=[{candles:flat(50,D)}];
test('V1.1 baseline and V1.2 confirmation are frozen, 24H and 4H are descriptive',()=>{
 assert.deepEqual(MTF_AUDIT_LOCK.modes,['baseline_v11','break_extreme_2']);
 assert.deepEqual(MTF_AUDIT_LOCK.contextIntervals,['4h','1d']);
 assert.equal(MTF_AUDIT_LOCK.exitId,'fixed_1_5_3_12');
 assert.equal(MTF_AUDIT_LOCK.symbol,'BTCUSDT');
 assert.equal(MTF_AUDIT_LOCK.side,'short');
});
test('Cohorts of identical unfiltered trade stream do not create phantom new trades',()=>{
 const out=studyHistoricalMtf({hourWindows,h4Windows,d1Windows,cutoffTime:75*H});
 for(const mode of MTF_AUDIT_LOCK.modes){
  const result=out.modes[mode],earlier=result.splits.earlier.baseline;
  assert.ok(earlier.all.trades>=1,mode);
  assert.ok(earlier.unknown_context.trades<=earlier.all.trades);
  assert.ok(earlier.bear_4h.trades<=earlier.all.trades);
  assert.ok(earlier.bear_1d.trades<=earlier.all.trades);
  assert.ok(earlier.bear_both.trades<=earlier.bear_4h.trades);
  assert.ok(earlier.bear_both.trades<=earlier.bear_1d.trades);
  assert.equal(result.splits.earlier.baseline.all.trades,result.splits.earlier.stress.all.trades);
  assert.ok(result.splits.earlier.stress.all.meanNetPct < earlier.all.meanNetPct);
 }
});
test('1D direction is unavailable before the first completed daily candle and after a gap',()=>{
 const c=buildCompletedVectorContext([{candles:flat(30,D)}],D);
 assert.equal(contextAtEntry(c,0),null);
 assert.equal(contextAtEntry(c,12*H),null);
 assert.equal(contextAtEntry(c,D),'neutral');
 c.byClose.delete(D);
 assert.equal(contextAtEntry(c,D+H),null);
});
test('Later candles cannot change earlier historical results',()=>{
 const initial=studyHistoricalMtf({hourWindows,h4Windows,d1Windows,cutoffTime:75*H});
 const changed=hourly().map((b,i)=>i>=110?{...b,open:104,high:112,low:97,close:98,volume:1000000}:b);
 const next=studyHistoricalMtf({hourWindows:[{candles:changed}],h4Windows,d1Windows,cutoffTime:75*H});
 for(const mode of MTF_AUDIT_LOCK.modes){
  assert.deepEqual(initial.modes[mode].splits.earlier,next.modes[mode].splits.earlier);
 }
});
test('No signal at a missing-window boundary and no censored profit counted',()=>{
 const all=hourly(),w=[{candles:all.slice(0,37)},{candles:all.slice(39)}];
 const s=studyHistoricalMtf({hourWindows:w,h4Windows,d1Windows,cutoffTime:75*H});
 assert.equal(s.modes.baseline_v11.splits.earlier.baseline.all.trades,0);
 assert.ok(s.modes.baseline_v11.diagnostics.censored>=1);
});
test('No network calls from pure historical audit, reports insufficient sample honestly',()=>{
 const out=studyHistoricalMtf({hourWindows:[],h4Windows:[],d1Windows:[],cutoffTime:75*H});
 assert.equal(out.modes.baseline_v11.splits.earlier.stress.all.sampleSufficient,false);
 assert.equal(out.modes.break_extreme_2.splits.later.baseline.all.meanNetPct,null);
});
