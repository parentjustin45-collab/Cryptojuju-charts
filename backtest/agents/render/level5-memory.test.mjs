import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {feedbackFromStructured,readFeedback,auditFeedback,ruleId,validateNewRule} from './level5-rule-contract.mjs';
import {requestWithMemory,MAX_REQUEST_BYTES} from './llm-research.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const rule={kind:'DIAGNOSTIC_TAG',feature:'DIRECTIONAL_CLOSE',operator:'GT_PREVIOUS'};
const scope={channel:'momentum',symbol:'BTCUSDT',timeframe:'1d',sourceSha256:'a'.repeat(64)};
function fixture(p=scope,positive=false){
 const id=ruleId(rule,p),packet=JSON.stringify({...p,source:'Bitunix'}),packet_sha=hash(packet),attempt_id='b'.repeat(64);
 const result=JSON.stringify({source:'Bitunix',channel:p.channel,packetSha256:packet_sha,status:'HUMAN_REVIEW_ONLY',noExecution:true,noTrading:true,noPromotion:true,proposal:{kind:'DIAGNOSTIC_ONLY'},experimentRule:rule,ruleReview:{ruleId:id}});
 const proposal_sha=hash(result),g=(n,m)=>({eligible:n,early:0,on:m,late:0,precision:m/n,meanNet20Bps:20});
 const z={pooled:{tagged:g(8,positive?7:4),untagged:g(4,3)},foldWins:positive?2:0,pass:positive};
 const report=JSON.stringify({version:'CJ_L5_STRUCTURED_EXECUTION_V1',attemptId:attempt_id,proposalSha256:proposal_sha,packetSha256:packet_sha,source:'Bitunix',...p,ruleId:id,rule,holdoutUsed:false,noTrading:true,noPromotion:true,noSignalChanges:true,evaluation:{systems:{original:z,parent:z},decision:positive?'EXPLORATORY_SUPPORT_ONLY':'REJECT_OR_INSUFFICIENT_EVIDENCE',holdoutUsed:false,noTrading:true,noPromotion:true}});
 return {attempt_id,rule_id:id,sha:hash(report),report,result,proposal_sha,packet,packet_sha};
}
test('real report shape yields compact negative and positive evidence; reject corruption',()=>{
 const row=fixture(),x=feedbackFromStructured(row,scope);
 assert.equal(x.sameScope,true);assert.equal(x.metrics.original.taggedPrecision,.5);assert.equal(x.metrics.original.untaggedPrecision,.75);
 assert.throws(()=>feedbackFromStructured({...row,report:row.report+' '},scope),/MEMORY_SHA/);
 assert.equal(feedbackFromStructured(row,{...scope,channel:'vector'}),null);
 const p=feedbackFromStructured(fixture(scope,true),scope);assert.equal(p.decision,'EXPLORATORY_SUPPORT_ONLY');assert.throws(()=>validateNewRule(rule,scope,[p]),/REPEATED_COMPLETED_RULE/);
});
test('same specialist can learn across scopes, but duplicates only block exact scope',()=>{
 const row=fixture(),other={...scope,symbol:'ETHUSDT'};
 const x=feedbackFromStructured(row,other);assert.equal(x.sameScope,false);assert.doesNotThrow(()=>validateNewRule(rule,other,[x]));assert.throws(()=>validateNewRule(rule,scope,[x]),/REPEATED_REJECTED_RULE/);
 const frank={...scope,channel:'frank_cross'},f=feedbackFromStructured(fixture(frank),{...frank,channel:'frank_divergence'});assert.equal(f.sameScope,false);
});
test('readback prioritizes exact scope and verifies duplicate gate',async()=>{
 const row=fixture(),cross=fixture({...scope,symbol:'ETHUSDT'});
 const db={query:async(sql,args)=>{
  if(sql.includes('to_regclass'))return {rows:[{t:'yes',structured:'yes'}]};
  if(sql.includes('AND NOT ('))return {rows:[cross],rowCount:1};
  if(sql.includes('LIMIT 9')||sql.includes('LIMIT 1'))return {rows:[row],rowCount:1};
  throw Error('unexpected query');
 }};
 const list=await readFeedback(db,scope);assert.equal(list.length,2);assert.equal(list[0].sameScope,true);
 const a=await auditFeedback(db);assert.equal(a.status,'MEMORY_READBACK_OK');assert.equal(a.duplicateBlocked,true);
});
test('memory export is bounded and preserves priority without mutating full memory',()=>{
 const memory=Array.from({length:8},(_,i)=>({ruleId:String(i),data:'x'.repeat(4000)}));
 const {body,feedback}=requestWithMemory({evidence:[{id:'E1'}]},memory);
 assert.ok(feedback.length<4&&feedback.length>0);assert.equal(feedback[0].ruleId,'0');assert.equal(memory.length,8);assert.ok(Buffer.byteLength(JSON.stringify(body))<=MAX_REQUEST_BYTES);assert.deepEqual(JSON.parse(body.input).feedback,feedback);
});
