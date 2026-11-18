import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBitunixOpenEnvelope} from './ohlc-bitunix-open-envelope.mjs';
import {classifyHistory} from './quality-gate.mjs';
import {vectorAIT} from './vector-ait-v1.mjs';
const S=900000;
const prev=(close=65014.6)=>({time:0,open:65000,high:65100,low:64900,close,volume:15});
const bad=(change={})=>({time:S,open:65014.6,high:65010.4,low:64765.6,close:64799.9,volume:10,...change});
test('Screenshot verified 15m 4.20 high deficit derives high=open but preserves raw',()=>{
 const data=[prev(),bad()],snapshot=JSON.stringify(data);
 const r=normalizeBitunixOpenEnvelope(data,{intervalMs:S});
 assert.equal(r.status,'READY_DERIVED_WITH_PROVENANCE');
 assert.equal(r.changes.length,1);
 assert.equal(r.candles[1].high,65014.6);
 assert.equal(r.candles[1].open,65014.6);
 assert.equal(r.changes[0].original.high,65010.4);
 assert.equal(r.changes[0].previousClose,65014.6);
 assert.equal(JSON.stringify(data),snapshot);
 assert.equal(classifyHistory(data,{startTime:0,endTime:2*S,intervalMs:S}).canBacktest,false);
 assert.equal(classifyHistory(r.candles,{startTime:0,endTime:2*S,intervalMs:S}).canBacktest,true);
});
test('0.10 deficit in screenshots derives high=open for 15m and 1h',()=>{
 for(const step of [S,3600000]){
  const rows=[{...prev(64768.2),time:0},
   {...bad({time:step,open:64768.2,high:64768.1,low:64547.1,close:64602.6})}];
  const r=normalizeBitunixOpenEnvelope(rows,{intervalMs:step});
  assert.equal(r.status,'READY_DERIVED_WITH_PROVENANCE');
  assert.equal(r.candles[1].high,64768.2);
 }
});
test('Lower than open 9.60 low excess is preserved as evidence',()=>{
 const r=normalizeBitunixOpenEnvelope([
  {...prev(64319.5)},bad({open:64319.5,high:64833,low:64329.1,close:64746.1})
 ],{intervalMs:S});
 assert.equal(r.status,'READY_DERIVED_WITH_PROVENANCE');
 assert.equal(r.candles[1].low,64319.5);
 assert.equal(r.changes[0].original.low,64329.1);
});
test('Reject invalid highs from CLOSE, not just OPEN',()=>{
 const r=normalizeBitunixOpenEnvelope([
  prev(100),bad({open:100,high:110,low:90,close:111})
 ],{intervalMs:S});
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.changes.length,0);
 assert.equal(r.candles[1].high,110);
});
test('Reject absent or nonmatching preceding close',()=>{
 const cases=[[bad()],[prev(65013.3),bad()]];
 for(const rows of cases){
  const r=normalizeBitunixOpenEnvelope(rows,{intervalMs:S});
  assert.equal(r.status,'BLOCKED');
  assert.equal(r.changes.length,0);
 }
});
test('Reject duplicate or missing intervals without guessing bars',()=>{
 const a=normalizeBitunixOpenEnvelope([prev(),prev(),bad()],{intervalMs:S});
 const b=normalizeBitunixOpenEnvelope([prev(),bad({time:2*S})],{intervalMs:S});
 assert.equal(a.status,'BLOCKED');assert.equal(b.status,'BLOCKED');
 assert.ok(a.issues.some(x=>x.reason==='DUPLICATE'));
 assert.ok(b.issues.some(x=>x.reason==='GAP_OR_ORDER'));
});
test('Derived series can be evaluated by Vector, raw invalid series cannot',()=>{
 const rows=Array.from({length:35},(_,i)=>({
  time:i*S,open:100,high:101,low:99,close:100,volume:100
 }));
 rows[30]={...rows[30],open:100,high:99.9,low:96,close:97,volume:100};
 const r=normalizeBitunixOpenEnvelope(rows,{intervalMs:S});
 assert.equal(r.status,'READY_DERIVED_WITH_PROVENANCE');
 assert.throws(()=>vectorAIT(rows),/Invalid OHLC/);
 assert.equal(vectorAIT(r.candles).length,35);
});
test('Clean data remains unchanged and conversion is idempotent',()=>{
 const rows=[prev(),{...bad(),high:65014.6}];
 const r=normalizeBitunixOpenEnvelope(rows,{intervalMs:S});
 assert.equal(r.status,'READY_UNMODIFIED');assert.equal(r.changes.length,0);
 assert.deepEqual(r.candles,rows);
 const first=normalizeBitunixOpenEnvelope([prev(),bad()],{intervalMs:S});
 const second=normalizeBitunixOpenEnvelope(first.candles,{intervalMs:S});
 assert.equal(second.status,'READY_UNMODIFIED');
 assert.equal(second.changes.length,0);
});
