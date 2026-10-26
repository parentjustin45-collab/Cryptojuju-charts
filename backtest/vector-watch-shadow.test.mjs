import test from 'node:test';
import assert from 'node:assert/strict';
import {applyVectorWatch,VECTOR_WATCH_LOCK} from './vector-watch-shadow.mjs';
import {applyVectorV14} from './vector-v14-hysteresis.mjs';
const H=3600000;
const bars=()=>Array.from({length:70},(_,i)=>({
 time:i*H,open:100,high:100.3,low:99.7,close:100,volume:100
}));
const raw=(b,d)=>b.map((v,i)=>({
 time:v.time,bullishVector:d[i]==='long',bearishVector:d[i]==='short',
 signal:null,direction:0}));
test('WATCH is distinct from V1.4 trade signals, no orders or auto-flips',()=>{
 assert.equal(VECTOR_WATCH_LOCK.noOrder,true);
 assert.equal(VECTOR_WATCH_LOCK.noAutoFlip,true);
 assert.equal(VECTOR_WATCH_LOCK.pendingBars,3);
 const b=bars(),v=raw(b,{20:'short',25:'long'});
 const r=applyVectorWatch(b,{rawVector:v});
 assert.equal(r.unchangedConfirmed,true);
 assert.deepEqual(r.alerts.map(x=>({index:x.index,side:x.side,resolution:x.resolution})),[
  {index:25,side:'long',resolution:'expired_unconfirmed'}]);
 assert.equal(r.rows[25].direction,-1);
 assert.equal(r.rows[25].watch,'long');
 assert.equal(r.rows[25].confirmed,null);
 assert.equal(r.rows[28].direction,-1);
});
test('WATCH leads a genuine V1.4 structural confirmation by two CLOSED bars',()=>{
 const b=bars(),v=raw(b,{20:'short',25:'long'});
 b[25]={...b[25],open:100,high:100.3,low:99.7,close:100.17};
 b[26]={...b[26],open:100.1,high:100.4,low:99.75,close:100.10};
 b[27]={...b[27],open:100.1,high:100.8,low:99.9,close:100.66};
 const ref=applyVectorV14(b,{rawVector:v});
 assert.equal(ref.events[27].signal,'long');
 const r=applyVectorWatch(b,{rawVector:v,v14:ref});
 assert.equal(r.alerts.length,1);
 assert.equal(r.alerts[0].index,25);
 assert.equal(r.alerts[0].resolution,'confirmed');
 assert.equal(r.alerts[0].leadBars,2);
 assert.equal(r.rows[25].watch,'long');
 assert.equal(r.rows[27].confirmed,'long');
 assert.equal(r.rows[26].direction,-1);
 assert.ok(r.unchangedConfirmed);
});
test('Strong Vector impulse confirmed on the first bar should NOT produce a fake early WATCH',()=>{
 const b=bars(),v=raw(b,{20:'short',30:'long'});
 b[30]={...b[30],open:100,high:102.3,low:99.9,close:102.1};
 const r=applyVectorWatch(b,{rawVector:v});
 assert.equal(r.rows[30].confirmed,'long');
 assert.equal(r.rows[30].watch,null);
 assert.equal(r.alerts.length,0);
});
test('Opposite raw Vector candle cancels a pending WATCH without switching position',()=>{
 const b=bars(),v=raw(b,{20:'short',25:'long',26:'short'});
 const r=applyVectorWatch(b,{rawVector:v});
 assert.equal(r.alerts[0].resolution,'canceled_opposite_vector');
 assert.equal(r.alerts[0].resolvedIndex,26);
 assert.equal(r.rows[26].direction,-1);
 assert.equal(r.alerts.length,1);
});
test('Changes in later candles cannot change emitted earlier watch/confirmation rows',()=>{
 const b=bars(),v=raw(b,{20:'short',25:'long'});
 const r=applyVectorWatch(b,{rawVector:v});
 const alt=b.map((x,i)=>i<35?{...x}:{...x,open:100,high:113,low:95,close:111,volume:1e6});
 const rr=applyVectorWatch(alt,{rawVector:v});
 assert.deepEqual(r.rows.slice(0,35),rr.rows.slice(0,35));
});
test('Incomplete final watch is censored rather than retrospectively confirmed',()=>{
 const b=bars().slice(0,27),v=raw(b,{20:'short',25:'long'});
 const r=applyVectorWatch(b,{rawVector:v});
 assert.equal(r.alerts[0].resolution,'censored_end');
 assert.equal(r.alerts[0].leadBars,null);
});
test('A missing candle blocks rather than seamlessly carries alerts across gap',()=>{
 const b=bars(),v=raw(b,{20:'short',25:'long'});b[40].time+=H;
 assert.throws(()=>applyVectorWatch(b,{rawVector:v}),/noncontiguous/);
});
