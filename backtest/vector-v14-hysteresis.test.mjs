import test from 'node:test';
import assert from 'node:assert/strict';
import {applyVectorV14,vectorAtr,VECTOR_V14_LOCK} from './vector-v14-hysteresis.mjs';
const H=3600000;
function bars(n=65){
 return Array.from({length:n},(_,i)=>({
  time:i*H,open:100,high:100.3,low:99.7,close:100,volume:100
 }));
}
function raw(b,positions){
 return b.map((c,i)=>({time:c.time,bullishVector:positions[i]==='long',
  bearishVector:positions[i]==='short',signal:null,direction:0}));
}
const emitted=(r)=>r.events.flatMap((e,i)=>e.signal?[{i,side:e.signal,source:e.sourceIndex,why:e.why}]:[]);
test('Experimental mode preserves documented fixed thresholds',()=>{
 assert.equal(VECTOR_V14_LOCK.lookbackStructure,4);
 assert.equal(VECTOR_V14_LOCK.pendingBars,3);
 assert.equal(VECTOR_V14_LOCK.impulseBodyAtr,1.25);
 assert.equal(VECTOR_V14_LOCK.minBarsAfterFlip,3);
});
test('Initial SHORT stays active across unconfirmed upward spike and expires',()=>{
 const b=bars();
 b[20]={...b[20],open:100.2,high:100.3,low:99.6,close:99.7};
 b[23]={...b[23],open:99.7,high:100.35,low:99.65,close:100.28};
 const p=raw(b,{20:'short',23:'long'});
 const result=applyVectorV14(b,{rawVector:p});
 assert.deepEqual(emitted(result),[{i:20,side:'short',source:20,why:'initial'}]);
 assert.equal(result.events[27].direction,-1);
 assert.equal(result.audit.expired,1);
 assert.equal(p[23].bullishVector,true);
});
test('Strong bullish counterimpulse can reverse early with two-bar break',()=>{
 const b=bars();
 b[30]={...b[30],open:99.8,high:100,low:99.4,close:99.55};
 b[36]={...b[36],open:100,high:102.3,low:99.9,close:102.1};
 const out=applyVectorV14(b,{rawVector:raw(b,{30:'short',36:'long'})});
 assert.deepEqual(emitted(out),[{i:30,side:'short',source:30,why:'initial'},
  {i:36,side:'long',source:36,why:'impulse_reversal'}]);
});
test('Four-bar structural breakthrough can confirm a non-impulsive reversal later',()=>{
 const b=bars();
 b[27]={...b[27],open:99.8,close:99.65};
 b[31]={...b[31],open:100,high:100.31,low:99.7,close:100.2};
 b[32]={...b[32],open:100.2,high:100.45,low:99.9,close:100.4};
 const out=applyVectorV14(b,{rawVector:raw(b,{27:'short',31:'long'})});
 assert.deepEqual(emitted(out),[{i:27,side:'short',source:27,why:'initial'},
  {i:32,side:'long',source:31,why:'structure_break'}]);
});
test('Symmetric sharp SHORT reverses LONG without requiring EMA bullish/bearish',()=>{
 const b=bars();
 b[30]={...b[30],open:99.9,high:100.4,low:99.9,close:100.35};
 b[36]={...b[36],open:100,high:100.2,low:97.5,close:97.7};
 const out=applyVectorV14(b,{rawVector:raw(b,{30:'long',36:'short'})});
 assert.deepEqual(emitted(out),[{i:30,side:'long',source:30,why:'initial'},
  {i:36,side:'short',source:36,why:'impulse_reversal'}]);
});
test('Prior candlestick histories never use a future price to decide entry',()=>{
 const b=bars();
 b[20]={...b[20],open:100.1,close:99.7};
 b[25]={...b[25],open:100,high:101.8,low:99.8,close:101.6};
 const p=raw(b,{20:'short',25:'long'});
 const x=applyVectorV14(b,{rawVector:p});
 const changed=b.map((c,i)=>i<40?{...c}:{...c,open:98,high:106,low:91,close:104});
 const y=applyVectorV14(changed,{rawVector:p});
 assert.deepEqual(x.events.slice(0,40),y.events.slice(0,40));
 assert.equal(JSON.stringify(b),JSON.stringify(bars().map((c,i)=>{
  if(i===20)return {...c,open:100.1,close:99.7};
  if(i===25)return {...c,open:100,high:101.8,low:99.8,close:101.6};
  return c;
 })));
});
test('Missing/gapped input is blocked; no implicit cross-gap holding',()=>{
 const b=bars();b[33].time+=H;
 assert.throws(()=>applyVectorV14(b,{rawVector:raw(b,{20:'short'})}),/discontinuous/);
});
test('ATR warms up with Wilder seed on completed bars',()=>{
 const b=bars(),a=vectorAtr(b);
 assert.equal(a[12],null);
 assert.ok(Math.abs(a[13]-.6)<1e-9);
 assert.ok(Math.abs(a[40]-.6)<1e-9);
});
