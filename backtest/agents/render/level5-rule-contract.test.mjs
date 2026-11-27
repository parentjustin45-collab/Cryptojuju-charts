import test from 'node:test';
import assert from 'node:assert/strict';
import {compileRule,validateRule,ruleId,validateNewRule,feedbackFromPilot} from './level5-rule-contract.mjs';
import {requestBody,callModel,MODEL} from './llm-research.mjs';
const rule={kind:'DIAGNOSTIC_TAG',feature:'BODY_RATIO',operator:'LT_PREVIOUS'};
const scope={channel:'vector',symbol:'BTCUSDT',timeframe:'1d',sourceSha256:'a'.repeat(64)};
const none={kind:'NONE',feature:'NONE',operator:'NONE'};
test('reject unknown fields, code, unsupported operations and inconsistent no-op',()=>{
 for(const r of [{...rule,code:'return true'},{...rule,operator:'eval'},{...rule,feature:'FUTURE_CLOSE'},{...rule,kind:'NONE'},null])assert.throws(()=>validateRule(r),/RULE_/);
 assert.deepEqual(validateRule(none),none);
});
test('compiler uses current and previous only; excludes missing and zero-range bars',()=>{
 const bars=[{open:100,close:108,high:110,low:100,volume:20},{open:100,close:102,high:110,low:100,volume:10},{open:100,close:100,high:100,low:100,volume:5}];
 const fn=compileRule(rule);assert.equal(fn(bars,0,'long'),'unclassified');assert.equal(fn(bars,1,'long'),'tagged');assert.equal(fn(bars.slice(0,2),1,'long'),'tagged');assert.equal(fn(bars,2,'long'),'unclassified');assert.equal(compileRule(none)(bars,1,'long'),'unclassified');
});
test('reject identical failed rule only within same dataset and specialist',()=>{
 const feedback=[{ruleId:ruleId(rule,scope)}];
 assert.throws(()=>validateNewRule(rule,scope,feedback),/REPEATED_REJECTED_RULE/);
 assert.equal(validateNewRule(rule,{...scope,timeframe:'4h'},feedback).execution,'REVIEW_ONLY');
 assert.equal(validateNewRule({...rule,operator:'GT_PREVIOUS'},scope,feedback).execution,'REVIEW_ONLY');
 assert.throws(()=>feedbackFromPilot({sha:'bad',report:'{}'},scope),/FEEDBACK_SHA/);
});
test('structured provider response is strict, parsed as data, never executed',async()=>{
 const proposal={title:'Diagnostic body contraction',hypothesis:'Compare body ratios on closed bars',evidence_ids:['E1'],mechanism:'Potential signal timing difference',causal_rule:'Compare current to previous only',counterevidence:'Sparse training sample',test_plan:'Three chronological folds',rejection_criteria:'Reject if precision worsens',kind:'DIAGNOSTIC_ONLY'};
 const body=requestBody({evidence:[{id:'E1'}]},{structured:true,feedback:[{decision:'REJECTED'}]});
 assert.equal(body.text.format.schema.properties.experiment_rule.additionalProperties,false);
 assert.ok(body.text.format.schema.required.includes('experiment_rule'));
 assert.equal(JSON.parse(body.input).feedback.length,1);
 const mock=output=>async()=>new Response(JSON.stringify({id:'resp_fixture',model:MODEL,status:'completed',usage:{input_tokens:100,output_tokens:100},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(output)}]}]}));
 const out=await callModel(body,'fixture',mock({...proposal,experiment_rule:rule}));
 assert.deepEqual(out.experimentRule,rule);assert.equal(out.noExecution,true);
 await assert.rejects(()=>callModel(body,'fixture',mock({...proposal,experiment_rule:{...rule,code:'x'}})),/RULE_KEYS/);
 await assert.rejects(()=>callModel(body,'fixture',mock({...proposal,kind:'NEW_LOGIC',experiment_rule:rule})),/RULE_DIAGNOSTIC_ONLY/);
});
