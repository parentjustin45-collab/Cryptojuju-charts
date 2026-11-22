import test from 'node:test';
import assert from 'node:assert/strict';
import {SPECIALISTS,utcSlot,dueSpecialists,assessBitunixData,summarizeDiagnostics} from './render/plan.mjs';
test('six distinct specialists with staggered hourly slots',()=>{
 assert.equal(SPECIALISTS.length,6);
 assert.equal(new Set(SPECIALISTS.map(x=>x.id)).size,6);
 assert.deepEqual(SPECIALISTS.map(x=>x.minute),[4,14,24,34,44,54]);
 assert.equal(utcSlot(new Date('2026-11-22T15:41:30Z')),'2026-11-22T15:00:00.000Z');
 assert.equal(dueSpecialists(new Date('2026-11-22T15:41:30Z')).length,4);
});
test('Bitunix audit blocks incomplete data, even if process exited successfully',()=>{
 const valid={status:'PASS_PUBLIC_BITUNIX_DATA_WINDOWS',passed:9,blocked:0,
 checks:Array.from({length:9},()=>({status:'DATA_READY_FOR_RESEARCH_ONLY',
 consistencyStatus:'STABLE_TWO_READS',acceptedBars:480,requestedBars:480,sha256:'a'.repeat(64)}))};
 assert.equal(assessBitunixData(valid).status,'DATA_READY_FOR_RESEARCH_ONLY');
 assert.equal(assessBitunixData({...valid,passed:8}).status,'BLOCKED');
 assert.equal(assessBitunixData({...valid,checks:valid.checks.slice(1)}).status,'BLOCKED');
 assert.equal(assessBitunixData({...valid,checks:[{...valid.checks[0],acceptedBars:479},...valid.checks.slice(1)]}).status,'BLOCKED');
});
test('review detects absent and blocked specialists but never modifies code',()=>{
 const r=summarizeDiagnostics([{agent:'bitunix-data',status:'BLOCKED'}]);
 assert.equal(r.status,'REVIEW_REQUIRED');
 assert.equal(r.concerns.length,5);
 assert.equal(r.automaticCodeChanges,false);
 assert.equal(r.automaticPromotion,false);
});
