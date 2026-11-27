import test from 'node:test';
import assert from 'node:assert/strict';
import {bodyTag,stratifyFold,evaluate} from './level5-vector-diagnostic.mjs';
test('body contraction uses only the current and preceding closed candle, excludes zero range',()=>{
 const bars=[{open:100,close:108,high:110,low:100},{open:100,close:102,high:110,low:100},{open:100,close:100,high:100,low:100}];
 assert.equal(bodyTag(bars,0),'unclassified');assert.equal(bodyTag(bars,1),'tagged');assert.equal(bodyTag(bars,2),'unclassified');
 assert.equal(bodyTag(bars.slice(0,2),1),bodyTag(bars,1));
});
test('competing signals retain full-system one-to-one pivot matching before tagging',()=>{
 const bars=Array.from({length:60},(_,i)=>({time:i,open:100,close:i===20?101:108,high:110,low:100}));
 const atr=bars.map(()=>10),positions=new Map(bars.map((b,i)=>[b.time,i])),pivots=[{side:'long',index:21}];
 const generated={signals:[{time:20,side:'long'},{time:21,side:'long'}],direction:bars.map(()=>0)};
 const r=stratifyFold(bars,atr,positions,pivots,generated,0,60);
 assert.equal(r.groups.tagged.redundant,1);assert.equal(r.groups.untagged.on,1);assert.equal(r.groups.tagged.precision,0);assert.equal(r.groups.untagged.precision,1);
 assert.equal(r.full.long.missed,0);assert.equal(r.groups.tagged.meanNet20Bps,r.groups.tagged.meanGrossBps-20);
});
test('strict pooled and two-fold gate, sparse samples rejected',()=>{
 const g=(a,b)=>({tagged:{events:a,eligible:a,early:a,on:0,late:0,excluded:0,redundant:0,outside:0,samples:a,positive0:0,positive10:0,positive20:0,sumGrossBps:0,precision:a?1:null},untagged:{events:b,eligible:b,early:0,on:0,late:0,excluded:0,redundant:0,outside:b,samples:b,positive0:0,positive10:0,positive20:0,sumGrossBps:0,precision:b?0:null},unclassified:{events:0,eligible:0,early:0,on:0,late:0,excluded:0,redundant:0,outside:0,samples:0,positive0:0,positive10:0,positive20:0,sumGrossBps:0,precision:null}});
 const fold=(a,b)=>({original:{groups:g(a,b)},parent:{groups:g(a,b)}});
 assert.equal(evaluate([fold(2,2),fold(2,2),fold(2,2)]).decision,'EXPLORATORY_SUPPORT_ONLY');
 assert.equal(evaluate([fold(1,2),fold(1,2),fold(1,2)]).decision,'REJECT_OR_INSUFFICIENT_EVIDENCE');
});
