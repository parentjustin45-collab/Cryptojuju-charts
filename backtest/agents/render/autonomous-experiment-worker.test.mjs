import test from 'node:test';import assert from 'node:assert/strict';
import {planJobs,reviewResult,runAutonomousExperiment} from './autonomous-experiment-worker.mjs';
import {experimentChannel,generate,CHANNELS} from './autonomous-rule-candidates.mjs';
const bars=Array.from({length:900},(_,i)=>{const c=100+10*Math.sin(i*Math.PI/20)+Math.sin(i*1.9),o=c+Math.sin(i*2);return {time:Date.UTC(2025,0,1)+i*900000,open:o,close:c,high:Math.max(c,o)+1,low:Math.min(c,o)-1,volume:10+i%23*5};});
test('150 distinct stable hypotheses, no duplication',()=>{const a=planJobs();assert.equal(a.length,150);assert.equal(new Set(a.map(x=>x.id)).size,150);assert.deepEqual(a,planJobs());});
for(const channel of CHANNELS)test(channel+' causal candidate training parity',()=>{const original=generate(channel,bars,.01,false);const z=experimentChannel(channel,bars,{priceStep:.01,indicators:{[channel]:{signals:original.signals}}});assert.equal(z.prefixChecks,2);assert.equal(z.trainingBars,630);assert.equal(reviewResult(z).noPromotion,true);});
test('storage pause before writes',async()=>{let n=0;const db={query:async()=>{n++;return {rows:[{bytes:'10000000000'}]}}};assert.equal((await runAutonomousExperiment(db)).status,'PAUSED_STORAGE');assert.equal(n,1);});
