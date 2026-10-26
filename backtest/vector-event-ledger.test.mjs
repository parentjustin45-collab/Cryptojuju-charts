import test from 'node:test';
import assert from 'node:assert/strict';
import {auditReversalWindows,LEDGER_LOCK} from './vector-event-ledger.mjs';
const H=3600000;
function sample(n=125){
 const c=Array.from({length:n},(_,i)=>({
  time:i*H,open:100,high:101,low:99,close:100,volume:100
 }));
 c[30]={...c[30],open:100,high:100.2,low:96.2,close:96.5,volume:800000};
 c[32]={...c[32],open:96.3,high:100.9,low:96,close:100.6,volume:900000};
 c[50]={...c[50],open:100,high:100.2,low:96,close:96.4,volume:800000};
 if(n>73)c[73]={...c[73],open:100,high:104,low:99.8,close:103.8,volume:900000};
 return c;
}
const evaluate=(candles=sample(),cutoffTime=80*H)=>
 auditReversalWindows([{candles}],{symbol:'BTCUSDT',cutoffTime});
test('Only four immutable known modes, with frozen identical trade costs',()=>{
 assert.deepEqual(LEDGER_LOCK.modes,['baseline_v11','break_extreme_2',
 'v14_hysteresis_structure_momentum_v1',
 'vector-v15-two-closed-bar-recovery-exploratory-v1']);
 assert.equal(LEDGER_LOCK.days,90);
 assert.equal(LEDGER_LOCK.slippageRate,.0005);
 assert.equal(LEDGER_LOCK.exit,'fixed_1_5_3_12');
});
test('Every raw V1.1 reversal has exactly one mutually exclusive classification',()=>{
 const r=evaluate();
 for(const m of LEDGER_LOCK.modes){
  const x=r.byMode[m],v=x.classification;
  assert.equal(v.accepted+v.rejected+v.already_aligned,x.signalLedger.length);
  assert.equal(v.rejectedWith12h+v.rejectedCensored12h,v.rejected);
  assert.ok(v.rejectedStrong12h===undefined);
  assert.equal(x.fixedTrades.every(t=>t.status!=='closed'||Number.isFinite(t.netPct)),true);
 }
 assert.ok(r.byMode.baseline_v11.signalLedger.length>=2);
 assert.equal(r.byMode.baseline_v11.classification.rejected,0);
});
test('No artificial profit from an event needing 12 future candles',()=>{
 const r=evaluate(sample(56),42*H);
 for(const m of LEDGER_LOCK.modes){
  const x=r.byMode[m];
  for(const e of x.signalLedger){
   if(e.time+13*H>sample(56).at(-1).time)
    assert.equal(e.next12h,null);
  }
  assert.equal(x.fixedTrades.filter(t=>t.status==='censored').every(t=>t.netPct===null),true);
 }
});
test('Future mutation cannot rewrite earlier classifications, risk or 12h retrospective labels',()=>{
 const b=sample(),a=evaluate(b,80*H);
 const mutated=b.map((x,i)=>i<98?{...x}:{...x,open:100,high:112,low:88,close:106,volume:800000});
 const z=evaluate(mutated,80*H);
 for(const m of LEDGER_LOCK.modes){
  assert.deepEqual(a.byMode[m].risk.long.earlier,z.byMode[m].risk.long.earlier);
  assert.deepEqual(a.byMode[m].risk.short.earlier,z.byMode[m].risk.short.earlier);
  assert.deepEqual(a.byMode[m].signalLedger.filter(x=>x.time<75*H),
   z.byMode[m].signalLedger.filter(x=>x.time<75*H));
 }
});
test('Direction episodes are censored until an opposite signal, never sold as a return',()=>{
 const r=evaluate();
 for(const m of LEDGER_LOCK.modes){
  for(const t of r.byMode[m].episodes){
   if(t.status==='censored')assert.equal(t.netPct,null);
   else {assert.ok(t.exitTime>t.entryTime);assert.ok(Number.isFinite(t.adversePct));}
  }
  assert.ok(r.byMode[m].episodeSummary.censored>=0);
 }
});
test('Quality policy rejects any discontinuous window before indicator processing',()=>{
 const b=sample();b[62].time+=H;const r=evaluate(b);
 assert.equal(r.cleanWindows,0);assert.equal(r.skippedWindows,1);
 for(const m of LEDGER_LOCK.modes)assert.equal(r.byMode[m].fixedTrades.length,0);
});
test('Original OHLC and synthetic input are never mutated by the audit',()=>{
 const b=sample(),snap=JSON.stringify(b);
 assert.deepEqual(evaluate(b),evaluate(b));
 assert.equal(JSON.stringify(b),snap);
});
