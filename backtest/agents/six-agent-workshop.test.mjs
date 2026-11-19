import test from 'node:test';
import assert from 'node:assert/strict';
import {SIX_AGENT_ROLES,runSixAgentWorkshop,formatWorkshopMarkdown} from './six-agent-workshop.mjs';

const step=900000;
const candles=[100,103,104,101,99,102,105,104,100,101,98].map((open,i)=>({
 time:i*step,open,high:open+2,low:open-2,close:open+1,volume:5
}));
const input={
 market:{exchange:'Bitunix',priceType:'LAST_PRICE',symbol:'BTCUSDT',timeframe:'15m'},
 historyWindow:{startTime:0,endTime:candles.length*step,intervalMs:step},
 candles,
 holdoutStartTime:6*step,
 costs:{initialCapital:1000,feeRate:0.0006,slippageRate:0.0005,allocation:1},
 experiments:[{id:'holdout_test',signalTimeConvention:'confirmation-bar-open',
  signals:[{time:step,side:'long'},{time:3*step,side:'flat'},
           {time:7*step,side:'short'},{time:9*step,side:'flat'}]}]
};
test('all six roles run on valid historical fixture with independent holdout',()=>{
  const result=runSixAgentWorkshop(input);
  assert.equal(SIX_AGENT_ROLES.length,6);
  assert.equal(result.status,'RESEARCH_READY');
  assert.deepEqual(result.agents.map(a=>a.id),SIX_AGENT_ROLES.map(a=>a.id));
  assert.equal(result.agents[0].status,'PASS');
  assert.equal(result.agents[1].status,'PASS');
  assert.equal(result.agents[3].status,'PROPOSALS_ONLY');
  assert.equal(result.agents[4].status,'PASS_RESEARCH_ONLY');
  assert.equal(result.agents[3].details.writesToRepository,false);
  assert.equal(result.agents[3].details.requiresHumanApproval,true);
  assert.match(formatWorkshopMarkdown(result),/RESEARCH_READY/);
});

test('missing candles lead to BLOCKED without backtest profits',()=>{
 const result=runSixAgentWorkshop({...input,candles:candles.filter(c=>c.time!==step)});
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.agents[0].status,'BLOCKED');
 assert.equal(result.agents[1].status,'BLOCKED');
 assert.equal(result.agents[4].status,'BLOCKED');
 assert.equal(result.agents[1].details.result,undefined);
});

test('no fabricated candles allowed to rescue raw Bitunix OHLC anomalies',()=>{
 const bad=candles.map(c=>({...c}));bad[3].high=bad[3].open-1;
 const result=runSixAgentWorkshop({...input,candles:bad});
 assert.equal(result.status,'BLOCKED');
 assert.ok(result.agents[2].details.findings.some(f=>f.code==='SOURCE_DATA'));
 assert.ok(result.agents[3].details.proposals.some(p=>p.code==='DATA_PROVENANCE'));
});

test('unexpected or out-of-window OHLC rows block the six-role pipeline',()=>{
 const stray={...candles[0],time:candles.length*step};
 const result=runSixAgentWorkshop({...input,candles:[...candles,stray]});
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.agents[0].status,'BLOCKED');
 assert.equal(result.agents[0].details.quality.outOfRange,1);
 assert.equal(result.agents[1].status,'BLOCKED');
 assert.equal(result.agents[4].status,'BLOCKED');
 assert.ok(result.agents[2].details.findings.some(f=>f.code==='SOURCE_DATA'));
});

test('unaligned timestamps cannot be silently ignored',()=>{
 const stray={...candles[0],time:step+1000};
 const result=runSixAgentWorkshop({...input,candles:[...candles,stray]});
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.agents[0].details.quality.outOfRange,1);
});

test('invalid signal confirmation conventions are BLOCKED, not silently traded',()=>{
 const bad={...input,experiments:[{...input.experiments[0],signalTimeConvention:'pivot-bar'}]};
 const result=runSixAgentWorkshop(bad);
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.agents[1].status,'BLOCKED');
 assert.ok(result.agents[2].details.findings.some(f=>f.code==='BACKTEST_BLOCKED'));
});

test('unverified indicators trigger cautionary parity diagnosis',()=>{
 const result=runSixAgentWorkshop(input);
 assert.ok(result.agents[2].details.findings.some(f=>f.code==='PARITY_UNVERIFIED'));
 assert.ok(result.agents[3].details.proposals.some(p=>p.code==='PINE_PARITY'));
});

test('no TradingView, Render or GitHub permissions are needed for six-role offline pipeline',()=>{
 const result=runSixAgentWorkshop(input);
 assert.equal(result.agents[5].details.noAutomaticTrades,true);
 assert.equal(result.agents[5].details.noMainChanges,true);
 assert.equal(result.agents[3].details.writesToRepository,false);
});
