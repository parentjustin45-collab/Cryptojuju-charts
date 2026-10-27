import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateMomentumFusion,MOMFUSION_DEFAULTS} from './momentum-fusion-v1.mjs';
const H=3600000,BEGIN=Date.UTC(2026,8,1);
function bars(n=450,{oscillation=1}={}){
 return Array.from({length:n},(_,i)=>{
  const mid=105+i*.011+oscillation*(3.1*Math.sin(i*.16)+1.4*Math.sin(i*.047));
  const open=mid-.18,close=mid+.18*Math.sin(i*.26);
  return {time:BEGIN+i*H,open,high:Math.max(open,close)+.7,
   low:Math.min(open,close)-.7,close,volume:1000+i%17};
 });
}
test('All original user Pine defaults are preserved without optimization',()=>{
 assert.deepEqual(MOMFUSION_DEFAULTS,{
  rsiLen:14,stochLen:14,stochSmooth:3,momLen:10,momNormLen:100,
  smoothLen:3,wRsi:1,wStoch:1,wMom:1,obLevel:70,osLevel:30,
  extremeHigh:90,extremeLow:10,useEmaFilter:true,emaFastLen:21,
  emaSlowLen:55,showDivergences:true,pivotLeft:5,pivotRight:5,
  maxPivotLookback:60,alertsOn:true
 });
});
test('Warmup respects 10-period momentum and 100-period lookback; no early signals',()=>{
 const out=calculateMomentumFusion(bars(150));
 assert.equal(out.length,150);
 for(let i=0;i<109;i++){
  assert.equal(out[i].composite,null);
  assert.equal(out[i].bullSignal,false);
  assert.equal(out[i].bearSignal,false);
 }
 assert.ok(out.slice(109).some(r=>Number.isFinite(r.composite)));
 assert.ok(out.every(r=>r.composite===null||
  r.composite>=0&&r.composite<=100));
});
test('Pine percentrank includes ties, returning 100 on a repeating momentum series',()=>{
 const data=bars(160,{oscillation:0}).map((b,i)=>{
  const price=100+i*.1;
  return {...b,open:price,high:price+.5,low:price-.5,close:price};
 });
 const result=calculateMomentumFusion(data);
 assert.ok(result[145].momentumRank>=99);
});
test('Pine ta.sma ignores na stochastic samples without resetting all later composite values',()=>{
 // Long flat trend causes multiple zero-range RSI stochastic values.
 // After volatility resumes, the 3-period stochastic SMA resumes once
 // THREE VALID stochastic readings have occurred, even with gaps.
 const data=bars(240);
 for(let i=120;i<165;i++){
  data[i]={...data[i],open:100,close:100,high:100.5,low:99.5};
 }
 const o=calculateMomentumFusion(data);
 assert.ok(o.some(x=>x.stochRsi===null));
 assert.ok(o.slice(180).some(x=>Number.isFinite(x.stochRsi)));
 assert.ok(o.slice(180).some(x=>Number.isFinite(x.composite)));
 for(const row of o) if(row.composite!==null)
  assert.ok(row.composite>=0&&row.composite<=100);
});
test('Missing stochastic values cannot create a future-aware pivot or early signal',()=>{
 const data=bars(240);
 for(let i=120;i<180;i++)data[i]={
  ...data[i],open:100,close:100,high:100.5,low:99.5};
 const o=calculateMomentumFusion(data);
 for(const row of o)for(const d of row.divergences){
  assert.equal(d.confirmationIndex-d.pivotIndex,5);
  assert.ok(d.confirmationTime>d.pivotTime);
 }
 const changed=data.map((c,i)=>i<195?{...c}:{...c,open:120,high:123,low:111,close:122});
 assert.deepEqual(o.slice(0,195),calculateMomentumFusion(changed).slice(0,195));
});
test('Every divergence is emitted only at confirmation, not moved back to pivot',()=>{
 const o=calculateMomentumFusion(bars());
 let count=0;
 for(const r of o)for(const d of r.divergences){
  count++;
  assert.equal(d.confirmationIndex,r.barIndex);
  assert.equal(d.confirmationIndex-d.pivotIndex,MOMFUSION_DEFAULTS.pivotRight);
  assert.equal(d.confirmationTime,r.time);
  assert.ok(d.pivotTime<d.confirmationTime);
  assert.ok(['regBull','regBear','hiddenBull','hiddenBear'].includes(d.type));
  assert.ok(d.previousPivotIndex<d.pivotIndex);
  assert.ok(d.pivotIndex-d.previousPivotIndex<=60);
 }
 assert.ok(count>0,'Synthetic oscillating market should generate pivot divergences');
});
test('Future candle mutations never alter older oscillator, signal or confirmed divergence',()=>{
 const xs=bars(),ys=xs.map((v,i)=>i<350?{...v}:{...v,
  open:80,high:85,low:70,close:74,volume:120000});
 const original=calculateMomentumFusion(xs),changed=calculateMomentumFusion(ys);
 assert.deepEqual(original.slice(0,350),changed.slice(0,350));
});
test('Trend filter changes only directional zone crossings, not oscillator or pivots',()=>{
 const c=bars(),a=calculateMomentumFusion(c),b=calculateMomentumFusion(c,{useEmaFilter:false});
 for(let i=0;i<c.length;i++){
  assert.equal(a[i].composite,b[i].composite);
  assert.deepEqual(a[i].divergences,b[i].divergences);
  if(a[i].bullSignal)assert.equal(b[i].bullSignal,true);
  if(a[i].bearSignal)assert.equal(b[i].bearSignal,true);
 }
});
test('Visual switches never erase underlying research events or alarms',()=>{
 const c=bars(),a=calculateMomentumFusion(c),
  b=calculateMomentumFusion(c,{showDivergences:false,alertsOn:false});
 assert.deepEqual(a.map(x=>x.divergences),b.map(x=>x.divergences));
 assert.deepEqual(a.map(x=>x.bullSignal),b.map(x=>x.bullSignal));
 assert.ok(b.every(x=>x.alerts===null));
});
test('Changing pivotRight changes timestamp of confirmation, never emits backdated alert',()=>{
 const c=bars(),b=calculateMomentumFusion(c,{pivotRight:3});
 for(const x of b)for(const d of x.divergences)
  assert.equal(d.confirmationIndex-d.pivotIndex,3);
});
test('Overlapping equal/single-value zones are deterministic and never fake trades',()=>{
 const c=bars(),o=calculateMomentumFusion(c,{wRsi:0,wStoch:0,wMom:0});
 assert.ok(o.some(x=>x.composite===0));
 assert.ok(o.every(x=>!('order' in x)&&!('trade' in x)));
});
test('Invalid data and impossible parameters are blocked, never silently filled',()=>{
 const b=bars();
 const c=b.map(x=>({...x}));c[23].high=c[23].open-.01;
 assert.throws(()=>calculateMomentumFusion(c),/Invalid or unordered/);
 assert.throws(()=>calculateMomentumFusion(b,{pivotRight:0}),/Invalid length/);
 assert.throws(()=>calculateMomentumFusion(b,{wMom:-1}),/nonnegative/);
});
