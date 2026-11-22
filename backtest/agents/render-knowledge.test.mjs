import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSpecialistFinding,rememberFinding,recallFindings} from './render/knowledge.mjs';
const sample=()=>({
 agent:'vector',stage:'HYPOTHESIS',title:'Delay after direction change',
 hypothesis:'Vector might be late in choppy periods because its confirmation filters are slow.',
 counterEvidence:'Unexamined historical periods may show the opposite effect.',
 nextTest:'Run time-ordered holdout on unchanged 1h and 4h baseline',
 codeCommit:'a'.repeat(40),sourceSha256:'b'.repeat(64),
 observedAtUtc:'2026-11-22T15:00:00Z',
 evidenceKnownAtUtc:'2026-11-22T14:00:00Z',
 markets:['BTCUSDT'],holdoutTradeCount:12
});
test('specialist memory is idempotent, evidence-linked and always no-promotion',()=>{
 const a=normalizeSpecialistFinding(sample()),b=normalizeSpecialistFinding(sample());
 assert.deepEqual(a,b);
 assert.equal(a.id.length,64);
 assert.equal(a.automaticPromotion,false);
 assert.equal(a.canPlaceOrders,false);
 assert.equal(a.reviewStatus,'INSUFFICIENT_EVIDENCE');
});
test('reject forged source hash, forward-looking knowledge and unsupported agents',()=>{
 assert.throws(()=>normalizeSpecialistFinding({...sample(),sourceSha256:'x'}));
 assert.throws(()=>normalizeSpecialistFinding({...sample(),evidenceKnownAtUtc:'2026-11-23T15:00:00Z'}));
 assert.throws(()=>normalizeSpecialistFinding({...sample(),agent:'random-agent'}));
 assert.throws(()=>normalizeSpecialistFinding({...sample(),stage:'REVIEW_ONLY',sourceSha256:null}));
});
test('even well-sampled review candidate needs a person, never automatic deployment',()=>{
 const a=normalizeSpecialistFinding({...sample(),stage:'REVIEW_ONLY',holdoutTradeCount:30});
 assert.equal(a.reviewStatus,'HUMAN_REVIEW_ONLY');
 assert.equal(a.automaticPromotion,false);
});
test('parameterized database persistence/recall, duplicate proof',async()=>{
 const saved=[],db={async query(sql,values){
   if(sql.startsWith('INSERT')){saved.push(values);return {rowCount:saved.length===1?1:0};}
   assert.match(sql,/WHERE agent=\$1/);
   return {rows:[{content:{id:'test'}}]};
 }};
 const one=await rememberFinding(db,sample());
 assert.equal(one.inserted,true);
 assert.equal(saved[0][1],'vector');
 assert.equal(saved[0][5],'a'.repeat(40));
 const notes=await recallFindings(db,'vector');
 assert.equal(notes[0].id,'test');
 await assert.rejects(()=>recallFindings(db,'vector',{limit:101}));
});
