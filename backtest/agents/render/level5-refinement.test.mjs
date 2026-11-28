import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {followupIdentity,verifyFollowup,requirePriorFeedback,MAX_FOLLOWUP_ROUNDS} from './level5-refinement.mjs';
import {ruleId,feedbackFromStructured,validateNewRule} from './level5-rule-contract.mjs';
import {requestWithMemory,reserveAttempt} from './llm-research.mjs';
import {verifyStructuredResult} from './level5-structured-execution.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const packet={parentId:'c'.repeat(64),source:'Bitunix',channel:'momentum',symbol:'BTCUSDT',timeframe:'1d',sourceSha256:'a'.repeat(64),evidence:[{id:'E1'}]};
const rule={kind:'DIAGNOSTIC_TAG',feature:'DIRECTIONAL_CLOSE',operator:'GT_PREVIOUS'};
const newRule={kind:'DIAGNOSTIC_TAG',feature:'VOLUME',operator:'GT_PREVIOUS'};
const proposal={title:'Diagnostic volume expansion',hypothesis:'Compare volume on closed candles',evidence_ids:['E1'],mechanism:'Possible signal timing difference',causal_rule:'Compare volume to previous only',counterevidence:'Small training sample',test_plan:'Three chronological folds',rejection_criteria:'Reject if precision worsens',kind:'DIAGNOSTIC_ONLY'};
function prior(){
 const attempt_id='b'.repeat(64),id=ruleId(rule,packet),p=JSON.stringify(packet),packet_sha=hash(p);
 const result=JSON.stringify({source:packet.source,channel:packet.channel,packetSha256:packet_sha,status:'HUMAN_REVIEW_ONLY',noExecution:true,noTrading:true,noPromotion:true,proposal:{kind:'DIAGNOSTIC_ONLY'},experimentRule:rule,ruleReview:{ruleId:id}});
 const proposal_sha=hash(result),g=(n,m)=>({eligible:n,early:0,on:m,late:0,precision:m/n,meanNet20Bps:20}),z={pooled:{tagged:g(8,4),untagged:g(4,3)},foldWins:0,pass:false};
 const report=JSON.stringify({version:'CJ_L5_STRUCTURED_EXECUTION_V1',attemptId:attempt_id,proposalSha256:proposal_sha,packetSha256:packet_sha,source:packet.source,channel:packet.channel,symbol:packet.symbol,timeframe:packet.timeframe,sourceSha256:packet.sourceSha256,ruleId:id,rule,holdoutUsed:false,noTrading:true,noPromotion:true,noSignalChanges:true,evaluation:{systems:{original:z,parent:z},decision:'REJECT_OR_INSUFFICIENT_EVIDENCE',holdoutUsed:false,noTrading:true,noPromotion:true}});
 return {attempt_id,rule_id:id,sha:hash(report),report,result,proposal_sha,packet:p,packet_sha,cycle_round:0};
}
test('stable child reservation and hard round limit',()=>{
 const a=followupIdentity(packet.parentId,'b'.repeat(64),'d'.repeat(64),0);
 assert.deepEqual(a,followupIdentity(packet.parentId,'b'.repeat(64),'d'.repeat(64),0));assert.notEqual(a.reservationParentId,packet.parentId);
 assert.equal(followupIdentity(packet.parentId,'b'.repeat(64),'d'.repeat(64),1).round,2);
 assert.throws(()=>followupIdentity(packet.parentId,'b'.repeat(64),'d'.repeat(64),MAX_FOLLOWUP_ROUNDS),/FOLLOWUP_ROUND/);
});
test('prior completed report must be verified and present in transmitted memory',()=>{
 const row=prior(),memory=[feedbackFromStructured(row,packet)],v=verifyFollowup(row,packet,memory);
 assert.equal(v.identity.round,1);assert.equal(v.previous.sameScope,true);
 assert.throws(()=>verifyFollowup(row,packet,[]),/FOLLOWUP_MEMORY/);
 assert.throws(()=>requirePriorFeedback([],v.previous),/FOLLOWUP_EXPORT_REQUIRED/);
 assert.throws(()=>validateNewRule(rule,packet,memory),/REPEATED_REJECTED_RULE/);
 assert.doesNotThrow(()=>requirePriorFeedback(requestWithMemory(packet,memory).feedback,v.previous));
});
test('child execution must match prior completed report and exact reservation lineage',()=>{
 const row=prior(),memory=[feedbackFromStructured(row,packet)],{identity}=verifyFollowup(row,packet,memory),p=JSON.stringify(packet);
 const {body,feedback}=requestWithMemory(packet,memory);
 const result=JSON.stringify({proposal,experimentRule:newRule,ruleReview:validateNewRule(newRule,packet,memory),feedback,requestSha256:hash(JSON.stringify(body)),refinement:identity,packetSha256:hash(p),source:packet.source,channel:packet.channel,status:'HUMAN_REVIEW_ONLY',noExecution:true,noPromotion:true,noTrading:true});
 const child={packet:p,packet_sha:hash(p),result,result_sha:hash(result),cycle_round:1,reservation_parent_id:identity.reservationParentId,prior_attempt_id:identity.priorAttempt,prior_report_sha:identity.priorReportSha,prior_actual_sha:identity.priorReportSha,prior_rule_id:row.rule_id};
 assert.deepEqual(verifyStructuredResult(child,packet,memory).rule,newRule);
 assert.throws(()=>verifyStructuredResult({...child,prior_actual_sha:'0'.repeat(64)},packet,memory),/REFINEMENT_LINEAGE/);
});
test('follow-up uses existing budget ledger and stops before any insert when exhausted',async()=>{
 const queries=[],c={query:async(sql,args)=>{queries.push(sql);if(sql.includes('coalesce(sum'))return {rows:[{month:5000000,day:0}]};return {rowCount:1,rows:[]};},release(){}};
 const db={connect:async()=>c},identity=followupIdentity(packet.parentId,'b'.repeat(64),'d'.repeat(64),0);
 assert.equal((await reserveAttempt(db,packet,5000000,identity)).status,'BUDGET_LIMIT');
 assert.ok(!queries.some(s=>s.includes('INSERT')));
});
