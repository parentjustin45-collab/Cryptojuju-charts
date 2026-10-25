import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateEmaSeries,vectorRegimeFeatures,applyVectorV13,VECTOR_V13_MODES}
 from './vector-v13-regime.mjs';
const H=3600000;
const candles=(n=110,down=true)=>Array.from({length:n},(_,i)=>{
 const close=down?150-i*.4:100+i*.4;
 return {time:i*H,open:close+.08,high:close+.25,low:close-.25,close,volume:100};
});
function fakeRaw(b,side='short',signalIdx=65){
 return b.map((c,i)=>({
  time:c.time,bullishVector:i===signalIdx&&side==='long',
  bearishVector:i===signalIdx&&side==='short',
  signal:i===signalIdx?side:null,
  direction:i>=signalIdx?(side==='short'?-1:1):0
 }));
}
test('EMAs use completed data and refuse insufficient history',()=>{
 const b=candles();
 const ema=calculateEmaSeries(b,50),f=vectorRegimeFeatures(b);
 assert.equal(ema[48],null);
 assert.ok(Number.isFinite(ema[49]));
 assert.equal(f[51].ema50SlopePct,null);
 assert.ok(f[52].ema50SlopePct<0);
 assert.equal(f[80].regime,'bear_stack');
 assert.throws(()=>calculateEmaSeries(b,1),/Invalid/);
});
test('Both original and V1.2 output preserved exactly in v1.3 module',()=>{
 const b=candles(),raw=fakeRaw(b);
 const v11=applyVectorV13(b,{mode:'baseline_v11',rawVector:raw});
 const v12=applyVectorV13(b,{mode:'break_extreme_2',rawVector:raw});
 assert.equal(v11.events[65].signal,'short');
 assert.equal(v12.events[65].signal,null);
 assert.equal(v12.events[66].signal,'short');
 assert.equal(v11.audit.rejected,0);
 assert.equal(v12.audit.rejected,0);
});
test('Strict bearish EMA stack allows a confirmed SHORT but no premature output',()=>{
 const b=candles(),raw=fakeRaw(b);
 const a=applyVectorV13(b,{mode:'v13_ema50_slope',rawVector:raw});
 const z=applyVectorV13(b,{mode:'v13_ema_stack',rawVector:raw});
 assert.equal(a.events[65].signal,null);
 assert.equal(a.events[66].signal,'short');
 assert.equal(z.events[66].signal,'short');
 assert.equal(z.audit.accepted,1);
 assert.equal(z.features[66].regime,'bear_stack');
});
test('A bullish trend never passes as confirmed bearish signal, symmetric long passes',()=>{
 const b=candles(110,false),rawShort=fakeRaw(b,'short');
 const denied=applyVectorV13(b,{mode:'v13_ema_stack',rawVector:rawShort});
 assert.equal(denied.audit.accepted,0);
 assert.equal(denied.audit.rejected,1);
 const rawLong=fakeRaw(b,'long');
 const long=applyVectorV13(b,{mode:'v13_ema_stack',rawVector:rawLong});
 assert.equal(long.events[66].signal,'long');
});
test('4H gate cannot use a future or absent 4H candle',()=>{
 const b=candles(),raw=fakeRaw(b),context4h={step:4*H,byClose:new Map([[68*H,'bear']])};
 const premature=applyVectorV13(b,{mode:'v13_ema_stack_4h',context4h,rawVector:raw});
 assert.equal(premature.audit.accepted,0);
 assert.equal(premature.audit.byReason['4h_context_missing'],1);
 context4h.byClose.set(64*H,'bear');
 const allowed=applyVectorV13(b,{mode:'v13_ema_stack_4h',context4h,rawVector:raw});
 assert.equal(allowed.audit.accepted,1);
 context4h.byClose.set(64*H,'bull');
 assert.equal(applyVectorV13(b,{mode:'v13_ema_stack_4h',context4h,rawVector:raw}).audit.accepted,0);
});
test('Future candles never rewrite earlier emitted signals or EMA features',()=>{
 const b=candles(),raw=fakeRaw(b);
 const initial=applyVectorV13(b,{mode:'v13_ema_stack',rawVector:raw});
 const changed=b.map((c,i)=>i<90?{...c}:{...c,close:180+i*.4,open:180+i*.4+.1,
  low:180+i*.4-.2,high:180+i*.4+.2});
 const later=applyVectorV13(changed,{mode:'v13_ema_stack',rawVector:raw});
 assert.deepEqual(initial.events.slice(0,90),later.events.slice(0,90));
 assert.deepEqual(initial.features.slice(0,90),later.features.slice(0,90));
});
test('Labels, rejection reasons and raw array integrity are consistent',()=>{
 const b=candles(100),raw=fakeRaw(b);
 const snap=JSON.stringify(raw);
 const m=applyVectorV13(b,{mode:'v13_ema_stack',rawVector:raw});
 assert.ok(VECTOR_V13_MODES.includes('v13_ema_stack_4h'));
 assert.equal(m.audit.candidates,m.audit.accepted+m.audit.rejected);
 assert.equal(JSON.stringify(raw),snap);
 assert.throws(()=>applyVectorV13(b,{mode:'auto_profit',rawVector:raw}),/Unknown/);
 assert.throws(()=>applyVectorV13(b,{mode:'baseline_v11',rawVector:raw.slice(1)}),/Unaligned/);
});
