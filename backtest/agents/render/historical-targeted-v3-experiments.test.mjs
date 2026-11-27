import test from 'node:test';import assert from 'node:assert/strict';
import {generate,experimentChannel,CHANNELS,SPEC} from './historical-targeted-v3-experiments.mjs';
const bars=Array.from({length:900},(_,i)=>{const c=100+10*Math.sin(i*Math.PI/20)+Math.sin(i*1.9),o=c+Math.sin(i*2);return {time:Date.UTC(2025,0,1)+i*900000,open:o,close:c,high:Math.max(c,o)+1,low:Math.min(c,o)-1,volume:10+i%23*5};});
for(const ch of CHANNELS)test(ch+' fixed candidate causal and fold reconciliation',()=>{
 const base=generate(ch,bars,.01,false);
 const report={priceStep:.01,indicators:{[ch]:{signals:base.signals}}};
 const z=experimentChannel(ch,bars,report);assert.equal(z.prefixChecks,2);assert.equal(z.folds.length,3);
 assert.equal(z.trainingBars,630);
 for(const f of z.folds)for(const s of ['long','short'])for(const v of [f.baseline[s],f.candidate[s]]){assert.equal(v.events,v.excluded+v.eligible);assert.equal(v.eligible,v.early+v.on+v.late+v.redundant+v.outside);assert.ok(v.positive20<=v.positive10&&v.positive10<=v.positive0);}
 assert.equal(z.folds.reduce((n,f)=>n+f.baseline.long.events+f.baseline.short.events,0),z.baselineEvents);
});
test('SPEED only removes same-side clusters, never adds an event',()=>{
 const a=generate('speed',bars,.01,false).signals,b=generate('speed',bars,.01,true).signals;
 assert.ok(b.every(e=>a.some(x=>JSON.stringify(x)===JSON.stringify(e))));assert.ok(b.length<=a.length);
});
test('experiment rejects archived signal mismatch',()=>{
 const a=generate('cipher',bars,.01,false).signals.slice(1);assert.throws(()=>experimentChannel('cipher',bars,{priceStep:.01,indicators:{cipher:{signals:a}}}),/PARITY/);
});

test('Frank provisional warnings never backdate and confirmed events stay original',()=>{
 const a=generate('frank_divergence',bars,.01,false),b=generate('frank_divergence',bars,.01,true);
 assert.ok(a.signals.every(x=>!x.tag.startsWith('prealert_')));
 assert.ok(b.signals.every(x=>x.tag.startsWith('prealert_')));
 assert.equal(b.signals.length,b.warningStats.tested+b.warningStats.unresolved);
 assert.ok(b.warningStats.confirmed<=b.warningStats.tested);
});
test('Cipher warnings are measured independently of generating earlier events',()=>{
 const a=generate('cipher',bars,.01,true);
 assert.equal(a.signals.filter(x=>x.tag==='cipher_prealert').length,a.warningStats.tested+a.warningStats.unresolved);
 assert.ok(a.warningStats.confirmed<=a.warningStats.tested);
});

import {generate as v2} from './historical-targeted-experiments.mjs';
test('V3 EMA exceptions preserve original events and are subset of V2',()=>{
 for(const ch of ['momentum','frank_cross']){
  const a=generate(ch,bars,.01,false).signals,b=generate(ch,bars,.01,true).signals,c=v2(ch,bars,.01,true).signals;
  const key=x=>JSON.stringify(x);const bs=new Set(b.map(key)),cs=new Set(c.map(key));
  assert.ok(a.every(x=>bs.has(key(x))));assert.ok(b.every(x=>cs.has(key(x))));
 }
});
test('V3 Frank warnings subset of V2, original confirmed events unchanged',()=>{
 const a=generate('frank_divergence',bars,.01,true).signals,b=new Set(v2('frank_divergence',bars,.01,true).signals.map(x=>JSON.stringify(x)));
 assert.ok(a.every(x=>b.has(JSON.stringify(x))));
 assert.deepEqual(generate('frank_divergence',bars,.01,false),v2('frank_divergence',bars,.01,false));
});
