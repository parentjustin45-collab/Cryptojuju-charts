import test from 'node:test';
import assert from 'node:assert/strict';
import {auditData} from './roles/01-bitunix-data.mjs';
import {executeBacktests} from './roles/02-backtests.mjs';
import {diagnose} from './roles/03-diagnostics.mjs';
import {prepareCorrections} from './roles/04-corrections.mjs';
import {validateWorkshop} from './roles/05-validation.mjs';
import {coordinate,SIX_AGENT_ROLES} from './roles/06-coordination.mjs';
import {runSixAgentWorkshop} from './six-agent-workshop.mjs';

const intervalMs=900000;
const opens=[100,103,104,101,99,102,105,104,100,101,98];
const candles=opens.map((open,i)=>({
  time:i*intervalMs,open,high:open+2,low:open-2,close:open+1,volume:5+i
}));
const input={
  market:{exchange:'Bitunix',priceType:'LAST_PRICE',symbol:'BTCUSDT',timeframe:'15m'},
  historyWindow:{startTime:0,endTime:candles.length*intervalMs,intervalMs},
  candles,holdoutStartTime:6*intervalMs,
  costs:{initialCapital:1000,feeRate:0.0006,slippageRate:0.0005,allocation:1},
  experiments:[{id:'fixture',signalTimeConvention:'confirmation-bar-open',
    signals:[{time:intervalMs,side:'long'},{time:3*intervalMs,side:'flat'},
             {time:7*intervalMs,side:'short'},{time:9*intervalMs,side:'flat'}]}]
};
test('six core role modules remain isolated and role seven fails closed without market evidence',()=>{
  const d=auditData(input);
  const b=executeBacktests(input,d);
  const a=diagnose(d,b);
  const f=prepareCorrections(a);
  const v=validateWorkshop(d,b,a,f);
  const result=coordinate(input,[d,b,a,f,v]);
  const full=runSixAgentWorkshop(input);
  assert.equal(SIX_AGENT_ROLES.length,6);
  assert.deepEqual(result.agents.map(a=>a.id),SIX_AGENT_ROLES.map(a=>a.id));
  assert.equal(result.status,'RESEARCH_READY');
  assert.equal(full.status,'BLOCKED');
  assert.deepEqual(full.agents.slice(0,6),result.agents);
  assert.equal(full.agents[6].id,'market-context');
  assert.equal(full.agents[6].status,'BLOCKED');
});
test('blocked OHLC propagates across six isolated modules, never to a trade',()=>{
  const d=auditData({...input,candles:[...candles,{...candles[0],time:500}]});
  const b=executeBacktests(input,d);
  const a=diagnose(d,b);
  const f=prepareCorrections(a);
  const v=validateWorkshop(d,b,a,f);
  assert.equal(d.status,'BLOCKED');
  assert.equal(b.status,'BLOCKED');
  assert.equal(v.status,'BLOCKED');
  assert.equal(coordinate(input,[d,b,a,f,v]).status,'BLOCKED');
});
test('corrections module only produces proposals and never writes',()=>{
  const plan=prepareCorrections({details:{findings:[
    {code:'SOURCE_DATA',severity:'BLOCKING'},
    {code:'LOW_HOLDOUT_SAMPLE',severity:'REVIEW'}
  ]}});
  assert.equal(plan.status,'PROPOSALS_ONLY');
  assert.equal(plan.details.writesToRepository,false);
  assert.equal(plan.details.requiresHumanApproval,true);
  assert.equal(plan.details.proposals.length,2);
});
