import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyStructuredResult,runDiagnostic,PILOT_TIMEFRAMES} from './level5-structured-execution.mjs';
import {validateNewRule} from './level5-rule-contract.mjs';
import {requestBody} from './llm-research.mjs';
import {stratifyFold} from './level5-vector-diagnostic.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const packet={source:'Bitunix',channel:'vector',symbol:'BTCUSDT',timeframe:'1d',sourceSha256:'a'.repeat(64),evidence:[{id:'E1'}]};
const rule={kind:'DIAGNOSTIC_TAG',feature:'VOLUME',operator:'GT_PREVIOUS'};
const proposal={title:'Diagnostic volume expansion',hypothesis:'Compare volume on closed candles',evidence_ids:['E1'],mechanism:'Possible signal timing difference',causal_rule:'Compare volume to previous only',counterevidence:'Small training sample',test_plan:'Three chronological folds',rejection_criteria:'Reject if precision worsens',kind:'DIAGNOSTIC_ONLY'};
function fixture(){
 const p=JSON.stringify(packet),r={proposal,experimentRule:rule,ruleReview:validateNewRule(rule,packet),feedback:[],requestSha256:hash(JSON.stringify(requestBody(packet,{structured:true}))),packetSha256:hash(p),source:packet.source,channel:packet.channel,status:'HUMAN_REVIEW_ONLY',noExecution:true,noPromotion:true,noTrading:true};
 const result=JSON.stringify(r);return {packet:p,packet_sha:hash(p),result,result_sha:hash(result)};
}
test('validated persisted result, request and packet hashes required',()=>{
 const row=fixture(),v=verifyStructuredResult(row,packet);assert.deepEqual(v.rule,rule);assert.equal(v.duplicate,false);
 assert.equal(verifyStructuredResult(row,packet,[{ruleId:v.ruleId}]).duplicate,true);
 assert.throws(()=>verifyStructuredResult({...row,result:row.result+' '},packet),/RESULT_PROVENANCE/);
 assert.throws(()=>verifyStructuredResult(row,{...packet,symbol:'ETHUSDT'}),/RESULT_PROVENANCE/);
 const r=JSON.parse(row.result);r.noTrading=false;const result=JSON.stringify(r);assert.throws(()=>verifyStructuredResult({...row,result,result_sha:hash(result)},packet),/RESULT_POLICY/);
});
test('stratifier accepts causal tags and rejects unexpected output',()=>{
 const bars=Array.from({length:60},(_,i)=>({time:i,open:100,close:101,high:110,low:100,volume:i+1}));
 const atr=bars.map(()=>10),positions=new Map(bars.map((b,i)=>[b.time,i])),pivots=[{side:'long',index:20}],generated={signals:[{time:20,side:'long'}]};
 const r=stratifyFold(bars,atr,positions,pivots,generated,0,60,()=> 'tagged');
 assert.equal(r.groups.tagged.on,1);assert.equal(r.groups.untagged.events,0);
 assert.throws(()=>stratifyFold(bars,atr,positions,pivots,generated,0,60,()=> 'unsafe'),/INVALID_DIAGNOSTIC_TAG/);
});
test('bounded pilot and all six channels can be measured without changing signals',()=>{
 assert.deepEqual(PILOT_TIMEFRAMES,['1d','4h','1h']);
 assert.throws(()=>runDiagnostic({channel:'vector',bars:[],priceStep:.01,rule}),/TRAINING_SIZE/);
 const bars=Array.from({length:510},(_,i)=>{const open=100+Math.sin(i/7)*10+i*.03,close=open+Math.sin(i/3)*2;return {time:1700000000000+i*86400000,open,close,high:Math.max(open,close)+1,low:Math.min(open,close)-1,volume:100+(i%17)*10};});
 for(const channel of ['vector','momentum','speed','cipher','frank_cross','frank_divergence']){
  const x=runDiagnostic({channel,bars,priceStep:.01,rule});assert.equal(x.folds.length,3);assert.equal(x.noSignalChanges,true);assert.equal(x.holdoutUsed,false);assert.equal(x.noPromotion,true);
 }
});
