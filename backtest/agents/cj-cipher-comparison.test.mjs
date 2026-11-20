import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCjCipherComparison,CIPHER_COMPARISON_LOCK}
 from './cj-cipher-comparison.mjs';
import {calculateCjCipherWaveTrend}
 from './cj-cipher-wavetrend-v1.mjs';
import {vectorAIT} from '../vector-ait-v1.mjs';
const H=3600000,T=Date.UTC(2026,8,1);
const bars=Array.from({length:960},(_,i)=>{
 const price=100+i*.015+4*Math.sin(i*.15)+3*Math.sin(i*.03);
 return {time:T+i*H,open:price,close:price+Math.sin(i*.25)*.4,
  high:price+1,low:price-1,volume:1000+i};
});
const run=x=>buildCjCipherComparison(x??bars,{priceStep:.01});
test('preregistered comparison is exactly three independent sources',()=>{
 assert.deepEqual(CIPHER_COMPARISON_LOCK.strategyIds,[
  'cj_cipher_wt_v1','vector_v11','vector_v11_cipher_agreement']);
 assert.equal(CIPHER_COMPARISON_LOCK.optimizationPerformed,false);
 assert.equal(CIPHER_COMPARISON_LOCK.tradingViewPineParity,'NOT_VERIFIED');
});
test('Cipher alone is exactly original crossover events with next open',()=>{
 const r=run();
 const original=calculateCjCipherWaveTrend(bars).slice(0,-1).flatMap(x=>
   x.signal?[{time:x.time,side:x.signal}]:[]);
 assert.deepEqual(r.signals.cj_cipher_wt_v1,original);
 assert.ok(original.length>0);
 assert.equal(r.ordersPlaced,false);
});
test('Vector alone stays identical and combined only gates or FLATs',()=>{
 const r=run();
 const raw=vectorAIT(bars,{minTick:.01}).slice(0,-1).flatMap(x=>
  x.signal?[{time:x.time,side:x.signal}]:[]);
 assert.deepEqual(r.signals.vector_v11,raw);
 const sources=new Map(raw.map(x=>[x.time,x.side]));
 for(const item of r.signals.vector_v11_cipher_agreement){
  assert.ok(sources.has(item.time));
  assert.ok(item.side===sources.get(item.time)||item.side==='flat');
 }
 assert.equal(r.signalCounts.vectorAll,
  r.signalCounts.vectorAgreement+r.signalCounts.vectorDisagreement);
 for(const x of r.comparisons){
  assert.equal(x.entryOnlyAt,x.time+H);
  assert.equal(x.decision==='AGREE',
   x.side==='long'?x.wt1>x.wt2:x.wt1<x.wt2);
 }
});
test('future OHLC cannot change past Cipher or gated Vector commands',()=>{
 const o=run();
 const changed=bars.map((x,i)=>i<900?{...x}:{
  ...x,open:160,high:170,low:150,close:163});
 const n=run(changed);
 for(const name of CIPHER_COMPARISON_LOCK.strategyIds){
  const earlier=r=>r.signals[name].filter(x=>x.time<T+899*H);
  assert.deepEqual(earlier(o),earlier(n));
 }
});
test('invalid OHLC and unknown precision cannot silently pass',()=>{
 assert.throws(()=>buildCjCipherComparison(bars,{priceStep:0}),/verified research price step/);
 const invalid=bars.map(x=>({...x}));
 invalid[330].high=invalid[330].low-1;
 assert.throws(()=>run(invalid),/Invalid or unordered/);
});
