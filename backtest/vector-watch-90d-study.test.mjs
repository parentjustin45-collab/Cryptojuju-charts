import test from 'node:test';
import assert from 'node:assert/strict';
import {auditShadowWindows,WATCH_AUDIT_LOCK} from './vector-watch-90d-study.mjs';
import {applyVectorV14} from './vector-v14-hysteresis.mjs';
import {vectorAIT} from './vector-ait-v1.mjs';
const H=3600000;
function fixture(){
 let prev=100,rng=592;
 return Array.from({length:130},(_,i)=>{
  rng=(Math.imul(rng,1664525)+1013904223)>>>0;
  const u=rng/4294967296,open=prev,
   close=Math.max(4,open+((u-.5)*(i%13===0?6:1.4))),
   high=Math.max(open,close)+.3,low=Math.min(open,close)-.3;
  prev=close;
  return {time:i*H,open,high,low,close,volume:i%13===0?100000:120};
 });
}
const analyze=(bars=fixture(),cutoffTime=65*H)=>
 auditShadowWindows([{candles:bars}],{symbol:'BTCUSDT',cutoffTime});
test('Window and future prospective start are locked without changing V1.4',()=>{
 assert.equal(WATCH_AUDIT_LOCK.end-WATCH_AUDIT_LOCK.start,90*24*H);
 assert.equal(WATCH_AUDIT_LOCK.forwardObservationNotBefore,Date.parse('2026-10-28T00:00:00Z'));
});
test('All WATCH outcomes partition into confirmed, canceled, expired, censored or superseded',()=>{
 const r=analyze();
 assert.equal(r.confirmedExact,true);
 for(const p of ['earlier','later'])for(const side of ['long','short']){
  const x=r.summary[p][side];
  assert.equal(x.count,x.confirmed+x.canceled+x.expired+x.censoredEnd+x.superseded);
  assert.equal(x.outcomeObserved+x.censored12h,x.count);
  assert.equal(x.outcomeObserved,x.missedMovePotential+x.negativeMove+x.ambiguous);
 }
});
test('WATCH never injects a new V1.4 confirmation: same signal times and sides',()=>{
 const b=fixture(),r=analyze(b),v=applyVectorV14(b,{rawVector:vectorAIT(b)});
 assert.deepEqual(r.referenceSignalTimes,v.events.flatMap(e=>e.signal?
  [{time:e.time,side:e.signal}]:[]));
 assert.ok(r.watches.every(w=>['long','short'].includes(w.side)));
});
test('Nonexistent future twelve-hour OHLC labels are CENSORED, not wins',()=>{
 const r=analyze(),byIdx=new Map(fixture().map((c,i)=>[c.time,i]));
 for(const watch of r.watches){
  const i=byIdx.get(watch.watchTime);
  if(i+12>=130||watch.period==='earlier'&&i+12>=65){
   assert.equal(watch.status,'censored');
   assert.equal(watch.gross12hPct,null);
  }
 }
});
test('V1.4 confirmed signals and historical WATCH emissions do not use future prices',()=>{
 const b=fixture(),early=analyze(b);
 const changed=b.map((x,i)=>i<90?{...x}:{...x,
  open:100,close:102,high:107,low:95,volume:2e6});
 const r=analyze(changed);
 const emission=w=>w.watches.filter(x=>x.watchTime<80*H).map(x=>
  ({time:x.watchTime,side:x.side,held:x.heldDirection}));
 assert.deepEqual(emission(early),emission(r));
 assert.deepEqual(early.referenceSignalTimes.filter(e=>e.time<80*H),
  r.referenceSignalTimes.filter(e=>e.time<80*H));
});
test('Refuse gaps and short windows rather than carrying open WATCH over unknown prices',()=>{
 const b=fixture();b[63].time+=H;
 const q=analyze(b);
 assert.equal(q.cleanWindows,0);
 assert.equal(q.skippedWindows,1);
 assert.equal(q.watches.length,0);
});
