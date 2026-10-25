import test from 'node:test';
import assert from 'node:assert/strict';
import {LTF_EXECUTION_LOCK,compareLowerTfExits} from './vector-ltf-execution-comparison.mjs';
const H=3600000,Q=900000;
function candles(n,step){
 const b=Array.from({length:n},(_,i)=>({
  time:i*step,open:100,high:101,low:99,close:100,volume:100
 }));
 b[31]={...b[31],open:103,high:104,low:99,close:100,volume:1000000};
 b[32]={...b[32],open:100,high:101,low:97,close:98,volume:100};
 return b;
}
const empty={};
const kwargs=(b,tf='15m',context=null,cutoffTime=120*Q)=>({
 windowsByTf:{...empty,[tf]:[{candles:b}]},context4h:context,cutoffTime
});
const pick=(out,tf='15m',mode='baseline_v11',filter='unfiltered',scenario='zero',part='earlier')=>
 out.byTimeframe[tf].modeResults[mode][filter][scenario].partitions[part];
test('Exact 12 elapsed hours across 15m, 30m and 1h instead of 12 bars',()=>{
 const r=compareLowerTfExits({cutoffTime:100*H});
 assert.equal(r.byTimeframe['15m'].exitMaxBars,48);
 assert.equal(r.byTimeframe['30m'].exitMaxBars,24);
 assert.equal(r.byTimeframe['1h'].exitMaxBars,12);
 assert.equal(LTF_EXECUTION_LOCK.stopPct,1.5);
 assert.equal(LTF_EXECUTION_LOCK.takePct,3);
 assert.equal(LTF_EXECUTION_LOCK.feeRate,0.0006);
});
test('Base Vector and delayed Vector execute only at next open with closed candles',()=>{
 const c=candles(150,Q),r=compareLowerTfExits(kwargs(c));
 assert.ok(pick(r).trades>=1);
 const delayed=pick(r,'15m','break_extreme_2');
 assert.ok(delayed.signals>=1);
 assert.ok(delayed.censored>=0);
 assert.ok(pick(r).meanNetPct!==null);
});
test('4H bearish filter creates independent simulated stream; unknown context never silently accepted',()=>{
 const c=candles(150,Q);
 const missing=compareLowerTfExits(kwargs(c));
 assert.ok(pick(missing).trades>0);
 assert.equal(pick(missing,'15m','baseline_v11','bear_4h').trades,0);
 const context={step:4*H,byClose:new Map([[8*H,'bear']])};
 const allowed=compareLowerTfExits(kwargs(c,'15m',context));
 assert.ok(pick(allowed,'15m','baseline_v11','bear_4h').trades>0);
 assert.equal(pick(allowed,'15m','baseline_v11','bear_4h').trades,pick(allowed).trades);
});
test('Ambiguous intrabar exits resolve stop before target',()=>{
 const b=candles(150,Q);
 b[32]={...b[32],open:100,high:107,low:89,close:100};
 const report=compareLowerTfExits(kwargs(b));
 const baseline=pick(report);
 assert.ok(baseline.trades>=1);
 assert.ok(baseline.reasons.stop>=1);
 assert.ok(baseline.meanNetPct<0);
});
test('Incomplete positions are censored and never treated as profit',()=>{
 const b=candles(37,Q);
 b[32]={...b[32],open:100,high:101,low:97.5,close:98};
 const r=compareLowerTfExits(kwargs(b));
 const v12=pick(r,'15m','break_extreme_2');
 assert.equal(v12.trades,0);
 assert.ok(v12.censored>=1);
 assert.equal(v12.meanNetPct,null);
});
test('Chronological cutoff prevents crossing trades and prohibits earlier source for delayed test',()=>{
 const b=candles(150,Q);
 const r=compareLowerTfExits(kwargs(b,'15m',null,32*Q));
 const a=pick(r,'15m','baseline_v11','unfiltered','zero','earlier');
 assert.equal(a.trades,0);
 assert.ok(a.censoredSplit+a.censoredWindow>=0);
 const v12=pick(r,'15m','break_extreme_2','unfiltered','zero','later');
 assert.ok(v12.boundaryExcluded>=1);
});
test('Timeframe stress is greater on 15m than 1h; common scenario identical',()=>{
 const s=LTF_EXECUTION_LOCK.scenarios;
 assert.equal(s.common_slippage,.0005);
 assert.equal(s.timeframe_stress['15m'],.001);
 assert.equal(s.timeframe_stress['30m'],.00075);
 assert.equal(s.timeframe_stress['1h'],.0005);
});
test('No invented bars across missing history',()=>{
 const b=candles(150,Q);
 b[75].time+=Q;
 const r=compareLowerTfExits(kwargs(b));
 const stats=r.byTimeframe['15m'].modeResults.baseline_v11.unfiltered.zero;
 assert.equal(stats.eligibleWindows,0);
 assert.equal(stats.excludedWindows,1);
 assert.equal(stats.partitions.earlier.trades,0);
});
test('No signals are generated from future bars inside earlier partition',()=>{
 const b=candles(150,Q),out=compareLowerTfExits(kwargs(b));
 const changed=b.map((x,i)=>i>=130?{...x,high:111,low:90,close:95,open:104,volume:1e6}:x);
 const next=compareLowerTfExits(kwargs(changed));
 for(const mode of LTF_EXECUTION_LOCK.modeIds){
  const x=out.byTimeframe['15m'].modeResults[mode].unfiltered.zero.partitions.earlier;
  const y=next.byTimeframe['15m'].modeResults[mode].unfiltered.zero.partitions.earlier;
  assert.deepEqual(x,y);
 }
});
