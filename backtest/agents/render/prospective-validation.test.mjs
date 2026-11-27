import test from 'node:test';import assert from 'node:assert/strict';
import {simulate,evaluateFrozen,PROTOCOL,VARIANTS} from './prospective-validation.mjs';
const bars=Array.from({length:60},(_,i)=>({time:i*900000,open:100+i,close:100+i+.5,high:102+i,low:99+i,volume:10}));
const zero=PROTOCOL.costs[0],base=PROTOCOL.costs[1];
const sig=(i,side)=>({time:bars[i].time,side});
test('next open, 12 completed bars, no pre-evaluation signals',()=>{
 const a=simulate(bars,[sig(1,'short'),sig(4,'long')],{startIndex:4,cost:zero});
 assert.equal(a.trades,1);assert.equal(a.timeExits,1);assert.equal(a.eligibleEvents,1);assert.ok(Math.abs(a.meanNetBps-12/105*10000)<1e-8);assert.equal(a.openAtEnd,false);
});
test('opposite exits and reverses, same-side repetition ignored',()=>{
 const a=simulate(bars,[sig(4,'long'),sig(5,'long'),sig(7,'short')],{startIndex:4,cost:zero});assert.equal(a.trades,2);assert.equal(a.reversals,1);assert.equal(a.ignored,1);assert.equal(a.sides.long.trades,1);assert.equal(a.sides.short.trades,1);
});
test('costs reduce identical trade net and ambiguous signal does not enter',()=>{
 const sigs=[sig(4,'long'),sig(4,'short'),sig(6,'long')],a=simulate(bars,sigs,{startIndex:4,cost:zero}),b=simulate(bars,sigs,{startIndex:4,cost:base});assert.equal(a.conflicts,1);assert.equal(a.trades,1);assert.equal(b.trades,1);assert.ok(b.meanNetBps<a.meanNetBps);assert.ok(b.feesFractionOfInitial>0);
});
test('open position separately marked, last signal cannot be executed',()=>{
 const a=simulate(bars,[sig(57,'long'),sig(59,'short')],{startIndex:4,cost:base});assert.equal(a.trades,0);assert.equal(a.eligibleEvents,1);assert.equal(a.openAtEnd,true);assert.equal(a.realizedReturnPct,0);assert.equal(a.sampleStatus,'INSUFFICIENT_TRADES');
});
test('13 frozen variants causal with three costs each',()=>{
 const x=Array.from({length:600},(_,i)=>{const c=100+10*Math.sin(i*Math.PI/20)+Math.sin(i*1.9),o=c+Math.sin(i*2);return {time:Date.UTC(2025,0,1)+i*900000,open:o,close:c,high:Math.max(c,o)+1,low:Math.min(c,o)-1,volume:10+i%23*5};});
 const y=evaluateFrozen(x,.01,480);assert.equal(VARIANTS.length,13);assert.equal(y.length,13);assert.equal(y.reduce((n,x)=>n+x.results.length,0),39);
 assert.equal((PROTOCOL.endMs-PROTOCOL.startMs)/86400000,90);
 assert.equal((PROTOCOL.checkpointMs-PROTOCOL.startMs)/86400000,30);
});
