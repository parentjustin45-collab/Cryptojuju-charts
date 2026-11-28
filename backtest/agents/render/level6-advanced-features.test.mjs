import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ADVANCED_FEATURES,advancedSeries} from './level6-advanced-features.mjs';
import {compileRule,validateRule,ruleId,validateNewRule,RULE_SCHEMA,RULE_SCHEMA_V2} from './level5-rule-contract.mjs';
import {requestBody,callModel,MODEL} from './llm-research.mjs';
import {runDiagnostic} from './level5-structured-execution.mjs';
const bars=Array.from({length:510},(_,i)=>{const open=100+Math.sin(i/7)*10+i*.03,close=open+Math.sin(i/3)*2;return {time:1700000000000+i*86400000,open,close,high:Math.max(open,close)+1,low:Math.min(open,close)-1,volume:100+(i%17)*10};});
const rule=feature=>({kind:'DIAGNOSTIC_TAG',feature,operator:'GT_PREVIOUS'});
const scope={channel:'momentum',symbol:'BTCUSDT',timeframe:'1d',sourceSha256:'a'.repeat(64)};
test('V1 grammar and rule identities stable, V2 adds only five bounded features',()=>{
 assert.equal(RULE_SCHEMA.properties.feature.enum.length,5);assert.equal(RULE_SCHEMA_V2.properties.feature.enum.length,10);
 const old=rule('VOLUME'),oldId=createHash('sha256').update(JSON.stringify(['CJ_L5_RULE_CONTRACT_V1',scope.channel,scope.symbol,scope.timeframe,scope.sourceSha256,old])).digest('hex');
 assert.equal(ruleId(old,scope),oldId);
 for(const f of ADVANCED_FEATURES){assert.throws(()=>validateRule(rule(f),{advanced:false}),/RULE_ENUM/);assert.deepEqual(validateRule(rule(f)),rule(f));assert.throws(()=>validateNewRule(rule(f),scope,[{ruleId:ruleId(rule(f),scope)}]),/REPEATED_REJECTED_RULE/);}
 assert.throws(()=>validateRule({...rule('RSI14'),period:100}),/RULE_KEYS/);
});
test('all advanced series and tags are prefix-causal with warm-up exclusion',()=>{
 for(const f of ADVANCED_FEATURES){
  const full=advancedSeries(f,bars),tag=compileRule(rule(f));assert.equal(full[0],null);assert.equal(tag(bars,1,'long'),'unclassified');
  for(const n of [100,170,340]){const prefix=bars.slice(0,n);assert.deepEqual(advancedSeries(f,prefix),full.slice(0,n));for(let i=0;i<n;i++)assert.equal(tag(prefix,i,'long'),tag(bars,i,'long'));}
  assert.ok(full.some(Number.isFinite));
 }
});
test('flat/zero-volume inputs and prior-volume reference handled explicitly',()=>{
 const flat=bars.slice(0,50).map(b=>({...b,open:100,close:100,high:100,low:100,volume:0}));
 assert.equal(advancedSeries('RSI14',flat)[14],50);assert.equal(advancedSeries('ATR14_PCT',flat)[13],0);
 assert.equal(advancedSeries('VOLUME_RATIO20',flat)[20],null);
 const vols=flat.map((b,i)=>({...b,volume:i===20?200:100}));
 assert.equal(advancedSeries('VOLUME_RATIO20',vols)[20],2);
 assert.equal(advancedSeries('VOLUME_RATIO20',vols)[21],100/105);
});
test('versioned provider request cannot accept advanced rule under V1',async()=>{
 const packet={evidence:[{id:'E1'}]},v1=requestBody(packet,{structured:true}),v2=requestBody(packet,{structured:true,advanced:true});
 assert.equal(v1.text.format.name,'cryptojuju_structured_hypothesis');assert.equal(v2.text.format.name,'cryptojuju_structured_hypothesis_v2');
 const proposal={title:'Diagnostic RSI rise',hypothesis:'Compare RSI on closed bars',evidence_ids:['E1'],mechanism:'Potential signal timing difference',causal_rule:'Compare current to previous only',counterevidence:'Sparse training sample',test_plan:'Three chronological folds',rejection_criteria:'Reject if precision worsens',kind:'DIAGNOSTIC_ONLY'};
 const mock=async()=>new Response(JSON.stringify({id:'resp_fixture',model:MODEL,status:'completed',usage:{input_tokens:100,output_tokens:100},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({...proposal,experiment_rule:rule('RSI14')})}]}]}));
 await assert.rejects(()=>callModel(v1,'fixture',mock),/RULE_ENUM/);assert.deepEqual((await callModel(v2,'fixture',mock)).experimentRule,rule('RSI14'));
});
test('all five features execute three folds without modifying signals or accessing holdout',()=>{
 for(const f of ADVANCED_FEATURES){const d=runDiagnostic({channel:'momentum',bars,priceStep:.1,rule:rule(f)});assert.equal(d.folds.length,3);assert.equal(d.holdoutUsed,false);assert.equal(d.noSignalChanges,true);assert.equal(d.noTrading,true);assert.equal(d.noPromotion,true);}
});
