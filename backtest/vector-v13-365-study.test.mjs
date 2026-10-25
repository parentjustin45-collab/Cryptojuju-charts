import test from 'node:test';
import assert from 'node:assert/strict';
import {V13_STUDY_LOCK,studyVectorV13} from './vector-v13-365-study.mjs';
const H=3600000;
function bars(n=160){
 const b=Array.from({length:n},(_,i)=>{
  const close=150-i*.4;
  return {time:i*H,open:close+.08,high:close+.25,low:close-.25,close,volume:100};
 });
 b[65]={...b[65],open:b[65].close+3,high:b[65].close+3.2,
  low:b[65].close-.3,volume:1e7};
 return b;
}
const ctx={step:4*H,byClose:new Map([[64*H,'bear']])};
const result=(b=bars(),context4h=ctx,cutoffTime=120*H)=>
 studyVectorV13([{candles:b}],{context4h,cutoffTime});
const slot=(r,mode,scenario='baseline',split='earlier')=>
 r.bySide.short[mode][scenario].partitions[split];
test('Frozen V1.3 research compares unchanged baseline V1.1 and V1.2',()=>{
 assert.equal(V13_STUDY_LOCK.historyDays,365);
 assert.deepEqual(V13_STUDY_LOCK.symbols,['BTCUSDT','ETHUSDT','SOLUSDT']);
 assert.deepEqual(V13_STUDY_LOCK.modes,['baseline_v11','break_extreme_2',
  'v13_ema50_slope','v13_ema_stack','v13_ema_stack_4h']);
 assert.equal(V13_STUDY_LOCK.exit,'fixed_1_5_3_12');
 assert.equal(V13_STUDY_LOCK.feeRate,.0006);
});
test('EMA regime and original signal cases execute independently with 4H already CLOSED',()=>{
 const r=result();
 assert.ok(slot(r,'baseline_v11').trades>=1);
 assert.ok(slot(r,'break_extreme_2').trades>=1);
 assert.ok(slot(r,'v13_ema50_slope').trades>=1);
 assert.ok(slot(r,'v13_ema_stack').trades>=1);
 assert.ok(slot(r,'v13_ema_stack_4h').trades>=1);
 assert.equal(slot(r,'v13_ema_stack_4h').wins,1);
});
test('Missing context prevents the 4H strategy but not the unfiltered variants',()=>{
 const r=result(bars(),null);
 assert.ok(slot(r,'v13_ema_stack').trades>=1);
 assert.equal(slot(r,'v13_ema_stack_4h').trades,0);
 assert.ok(r.bySide.short.v13_ema_stack_4h.baseline.rejections.rejected>=1);
});
test('Higher stress slippage decreases trade profits, not a false probability',()=>{
 const r=result();
 const a=slot(r,'v13_ema_stack_4h','baseline').meanNetPct;
 const b=slot(r,'v13_ema_stack_4h','harsh').meanNetPct;
 assert.ok(Number.isFinite(a));assert.ok(Number.isFinite(b));
 assert.ok(b<a);
});
test('Trade outside complete horizon is censored and not treated as a profit',()=>{
 const r=result(bars(75));
 const b=slot(r,'break_extreme_2');
 assert.equal(b.trades,0);
 assert.ok(b.censored>0);
 assert.equal(b.meanNetPct,null);
});
test('Later market candles cannot change earlier observed returns',()=>{
 const b=bars(),r=result(b);
 const later=b.map((x,i)=>i<130?{...x}:{...x,open:160,high:163,low:155,close:157,volume:2e6});
 const q=result(later);
 for(const mode of V13_STUDY_LOCK.modes){
  assert.deepEqual(slot(r,mode,'stress'),slot(q,mode,'stress'));
 }
});
test('Repeated runs yield same transparent statistics and no side mutation',()=>{
 const b=bars();const snapshot=JSON.stringify(b),a=result(b),z=result(b);
 assert.deepEqual(a,z);assert.equal(JSON.stringify(b),snapshot);
 assert.equal(a.status,'EXPLORATORY_RESEARCH');
 assert.equal(a.bySide.long.baseline_v11.baseline.partitions.later.trades,0);
});
test('Gap-contaminated windows are refused and not connected artificially',()=>{
 const b=bars();b[110].time+=H;
 const r=result(b);
 assert.equal(slot(r,'baseline_v11').trades,0);
 assert.equal(r.bySide.short.baseline_v11.baseline.diagnostics.skippedWindows,1);
});
