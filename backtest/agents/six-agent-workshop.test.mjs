import test from 'node:test';
import assert from 'node:assert/strict';
import {SEVEN_AGENT_ROLES,runSevenAgentWorkshop,formatWorkshopMarkdown} from './six-agent-workshop.mjs';
import {fingerprintMarketCandles} from './roles/07-market-context.mjs';

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
const hour=3_600_000;
function syntheticSeries(symbol,scale=1){
  const candles=Array.from({length:25},(_,i)=>{
    const close=100+scale*(i+Math.sin(i/2));
    return {time:i*hour,open:close-0.2,high:close+1,low:close-1,close,volume:20+i};
  });
  return {market:{exchange:'SYNTHETIC',priceType:'LAST_PRICE',symbol,timeframe:'1h'},
    historyWindow:{startTime:0,endTime:25*hour,intervalMs:hour},acceptedCandles:candles,
    provenance:{acceptanceStatus:'FIXTURE_ONLY',source:'SYNTHETIC_FIXTURE',priceType:'LAST_PRICE',
      paginationComplete:true,repeatedFetchMatches:true,formingBarExcluded:true,ohlcAlignedToSource:true,
      candleFingerprint:fingerprintMarketCandles(candles)}};
}
const researchInput={...input,marketContext:{fixtureKind:'SYNTHETIC_CI_ONLY_NOT_BITUNIX',
  asOfTime:25*hour,lookbackBars:24,series:[syntheticSeries('SYNTH_BTC'),syntheticSeries('SYNTH_ETH',-0.5)]}};

test('all seven roles run on valid fixtures with independent holdout',()=>{
  const result=runSevenAgentWorkshop(researchInput);
  assert.equal(SEVEN_AGENT_ROLES.length,7);
  assert.equal(result.status,'RESEARCH_READY');
  assert.deepEqual(result.agents.map(a=>a.id),SEVEN_AGENT_ROLES.map(a=>a.id));
  assert.equal(result.agents[0].status,'PASS');
  assert.equal(result.agents[1].status,'PASS');
  assert.equal(result.agents[3].status,'PROPOSALS_ONLY');
  assert.equal(result.agents[4].status,'PASS_RESEARCH_ONLY');
  assert.equal(result.agents[3].details.writesToRepository,false);
  assert.equal(result.agents[3].details.requiresHumanApproval,true);
  assert.equal(result.agents[5].id,'coordination');
  assert.equal(result.agents[6].status,'PASS_SYNTHETIC_ONLY');
  assert.equal(result.agents[6].details.noTradeSignals,true);
  assert.match(formatWorkshopMarkdown(result),/Contexte multi-marchés/);
  assert.match(formatWorkshopMarkdown(result),/SYNTHETIC_ONLY/);
  assert.match(formatWorkshopMarkdown(result),/ne décrivent pas le marché réel/);
});

test('missing candles lead to BLOCKED without backtest profits',()=>{
 const result=runSevenAgentWorkshop({...researchInput,candles:candles.filter(c=>c.time!==step)});
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.agents[0].status,'BLOCKED');
 assert.equal(result.agents[1].status,'BLOCKED');
 assert.equal(result.agents[4].status,'BLOCKED');
 assert.equal(result.agents[1].details.result,undefined);
});

test('no fabricated candles allowed to rescue raw Bitunix OHLC anomalies',()=>{
 const bad=candles.map(c=>({...c}));bad[3].high=bad[3].open-1;
 const result=runSevenAgentWorkshop({...researchInput,candles:bad});
 assert.equal(result.status,'BLOCKED');
 assert.ok(result.agents[2].details.findings.some(f=>f.code==='SOURCE_DATA'));
 assert.ok(result.agents[3].details.proposals.some(p=>p.code==='DATA_PROVENANCE'));
});

test('unexpected or out-of-window OHLC rows block the six-role pipeline',()=>{
 const stray={...candles[0],time:candles.length*step};
 const result=runSevenAgentWorkshop({...researchInput,candles:[...candles,stray]});
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.agents[0].status,'BLOCKED');
 assert.equal(result.agents[0].details.quality.outOfRange,1);
 assert.equal(result.agents[1].status,'BLOCKED');
 assert.equal(result.agents[4].status,'BLOCKED');
 assert.ok(result.agents[2].details.findings.some(f=>f.code==='SOURCE_DATA'));
});

test('unaligned timestamps cannot be silently ignored',()=>{
 const stray={...candles[0],time:step+1000};
 const result=runSevenAgentWorkshop({...researchInput,candles:[...candles,stray]});
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.agents[0].details.quality.outOfRange,1);
});

test('invalid signal confirmation conventions are BLOCKED, not silently traded',()=>{
 const bad={...input,experiments:[{...input.experiments[0],signalTimeConvention:'pivot-bar'}]};
 const result=runSevenAgentWorkshop({...researchInput,experiments:bad.experiments});
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.agents[1].status,'BLOCKED');
 assert.ok(result.agents[2].details.findings.some(f=>f.code==='BACKTEST_BLOCKED'));
});

test('unverified indicators trigger cautionary parity diagnosis',()=>{
 const result=runSevenAgentWorkshop(researchInput);
 assert.ok(result.agents[2].details.findings.some(f=>f.code==='PARITY_UNVERIFIED'));
 assert.ok(result.agents[3].details.proposals.some(p=>p.code==='PINE_PARITY'));
});

test('no TradingView, Render or GitHub permissions are needed for six-role offline pipeline',()=>{
 const result=runSevenAgentWorkshop(researchInput);
 assert.equal(result.agents[5].details.noAutomaticTrades,true);
 assert.equal(result.agents[5].details.noMainChanges,true);
 assert.equal(result.agents[3].details.writesToRepository,false);
});

test('missing or tampered multi-market evidence blocks the seven-role report',()=>{
  const missing=runSevenAgentWorkshop(input);
  assert.equal(missing.status,'BLOCKED');
  assert.equal(missing.agents[6].status,'BLOCKED');
  const context=structuredClone(researchInput.marketContext);
  context.series[0].acceptedCandles[4].close+=1;
  const tampered=runSevenAgentWorkshop({...researchInput,marketContext:context});
  assert.equal(tampered.status,'BLOCKED');
  assert.match(tampered.agents[6].details.reason,/fingerprint/);
});
