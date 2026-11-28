import test from 'node:test';
import assert from 'node:assert/strict';
import {THRESHOLD_LEVELS,THRESHOLD_OPS,thresholdFor,advancedSeries} from './level6-advanced-features.mjs';
import {compileRule,validateRule,ruleId,RULE_SCHEMA_V2,RULE_SCHEMA_V3} from './level5-rule-contract.mjs';
import {requestBody,callModel,MODEL} from './llm-research.mjs';
import {boundedTrainingWindow} from './level6-bounded-window.mjs';
import {generate} from './autonomous-rule-candidates.mjs';
const makeBars=(n,step=900000)=>Array.from({length:n},(_,i)=>{const open=100+Math.sin(i/7)*10+i*.003,close=open+Math.sin(i/3)*2;return {time:1700000000000+i*step,open,close,high:Math.max(open,close)+1,low:Math.min(open,close)-1,volume:100+(i%17)*10};});
const rule=(feature,operator)=>({kind:'DIAGNOSTIC_TAG',feature,operator});
const scope={channel:'momentum',symbol:'BTCUSDT',timeframe:'1d',sourceSha256:'a'.repeat(64)};
test('all 30 new threshold rules are unique, fixed, causal and unavailable under V2',()=>{
 const bars=makeBars(200),ids=new Set();
 for(const [feature,levels] of Object.entries(THRESHOLD_LEVELS)){
  const values=advancedSeries(feature,bars);
  for(const op of THRESHOLD_OPS){
   const r=rule(feature,op),tag=compileRule(r),v=thresholdFor(r);
   assert.equal(v,levels[['LOW','MID','HIGH'].indexOf(op.split('_')[1])]);
   ids.add(ruleId(r,scope));assert.throws(()=>validateRule(r,{advanced:true,thresholds:false}),/RULE_ENUM/);
   for(let i=30;i<100;i++){assert.equal(tag(bars,i,'long'),(op.startsWith('LT_')?values[i]<v:values[i]>v)?'tagged':'untagged');assert.equal(tag(bars.slice(0,100),i,'long'),tag(bars,i,'long'));}
  }
 }
 assert.equal(ids.size,30);assert.throws(()=>validateRule(rule('VOLUME','GT_MID')),/RULE_ENUM/);
 assert.throws(()=>validateRule({...rule('RSI14','GT_MID'),threshold:51}),/RULE_KEYS/);
});
test('V3 request is explicit, older schemas cannot accept threshold output',async()=>{
 const packet={timeframe:'15m',evidence:[{id:'E1'}]};
 const v2=requestBody(packet,{structured:true,advanced:true}),v3=requestBody(packet,{structured:true,advanced:true,thresholds:true});
 assert.equal(v2.text.format.schema.properties.experiment_rule,RULE_SCHEMA_V2);
 assert.equal(v3.text.format.schema.properties.experiment_rule,RULE_SCHEMA_V3);assert.match(v3.instructions,/first 12000 candles/);
 const proposal={title:'Diagnostic RSI threshold',hypothesis:'Compare RSI on closed bars',evidence_ids:['E1'],mechanism:'Potential signal timing difference',causal_rule:'Compare current to fixed 50',counterevidence:'Sparse training sample',test_plan:'Three chronological folds',rejection_criteria:'Reject if precision worsens',kind:'DIAGNOSTIC_ONLY'};
 const mock=async()=>new Response(JSON.stringify({id:'resp_fixture',model:MODEL,status:'completed',usage:{input_tokens:100,output_tokens:100},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({...proposal,experiment_rule:rule('RSI14','GT_MID')})}]}]}));
 await assert.rejects(()=>callModel(v2,'fixture',mock),/RULE_ENUM/);assert.deepEqual((await callModel(v3,'fixture',mock)).experimentRule,rule('RSI14','GT_MID'));
});
test('bounded 15m and 30m windows preserve first 70% boundary, exclude extra training and holdout, check original signals',()=>{
 for(const [timeframe,step] of [['15m',900000],['30m',1800000]]){
  const candles=makeBars(20000,step),n=14000;
  const source={barCount:candles.length,candles,market:{timeframe}};
  const archive={holdoutStartTime:candles[n].time,priceStep:.1,indicators:{momentum:{signals:generate('momentum',candles.slice(0,12000),.1,false).signals}}};
  const r=boundedTrainingWindow(source,archive,'momentum');
  assert.equal(r.bars.length,12000);assert.equal(r.window.unusedTrainingBars,2000);assert.equal(r.holdoutBars,6000);assert.equal(r.bars.at(-1).time,candles[11999].time);assert.match(r.window.windowSha256,/^[a-f0-9]{64}$/);
  assert.throws(()=>boundedTrainingWindow(source,{...archive,holdoutStartTime:candles[n+1].time},'momentum'),/WINDOW_TRAIN_BOUNDARY/);
  assert.throws(()=>boundedTrainingWindow(source,{...archive,indicators:{momentum:{signals:[{time:candles[1].time,side:'long'}]}}},'momentum'),/WINDOW_BASELINE_SIGNAL_PARITY/);
 }
});
