import test from 'node:test';
import assert from 'node:assert/strict';
import {runResearchBatch} from './research-batch.mjs';

const step=900000;
const candles=[100,102,105,103,101,104].map((open,i)=>({
  time:i*step,open,high:open+3,low:open-3,close:open+1,volume:10+i
}));
const market={exchange:'Bitunix',priceType:'LAST_PRICE',symbol:'BTCUSDT',timeframe:'15m'};
const historyWindow={startTime:0,endTime:candles.length*step,intervalMs:step};
const costs={feeRate:0.0006,slippageRate:0.0005,initialCapital:1000,allocation:1};
const experiments=[
  {id:'baseline',signalTimeConvention:'confirmation-bar-open',signals:[{time:step,side:'long'},{time:3*step,side:'flat'}]}
];
const run=(patch={})=>runResearchBatch({market,historyWindow,candles,experiments,costs,...patch});

test('research batch invokes existing causal next-open engine for clean closed history',()=>{
  const result=run();
  assert.equal(result.status,'RESEARCH_ONLY');
  assert.equal(result.dataGate.checkedClosedBars,6);
  assert.equal(result.results[0].indicatorParity,'UNVERIFIED');
  assert.equal(result.results[0].report.trades[0].entryTime,2*step);
  assert.equal(result.results[0].report.trades[0].exitTime,4*step);
  assert.equal(result.results[0].report.assumptions.feeRate,costs.feeRate);
});

test('separate strategies have independent starting capital and no combined PnL',()=>{
  const result=run({experiments:[...experiments,
    {id:'flat_case',signalTimeConvention:'confirmation-bar-open',signals:[]}]});
  assert.equal(result.results.length,2);
  assert.equal(result.results[1].report.tradeCount,0);
  assert.equal(result.results[1].report.finalCapital,1000);
  assert.equal(result.totalProfit,undefined);
});

test('missing or raw-invalid Bitunix history is rejected before any backtest',()=>{
  assert.throws(()=>run({candles:candles.filter(x=>x.time!==2*step)}),/blocked/i);
  const bad=candles.map(x=>({...x}));
  bad[1].high=bad[1].open-1;
  assert.throws(()=>run({candles:bad}),/blocked/i);
});

test('unsupported timeframe and mismatched bar intervals fail closed',()=>{
  assert.throws(()=>run({market:{...market,timeframe:'1d'}}),/only Bitunix/i);
  assert.throws(()=>run({historyWindow:{...historyWindow,intervalMs:3600000}}),/Timeframe/i);
});

test('unconfirmed/backdated metadata and future signals are rejected',()=>{
  assert.throws(()=>run({experiments:[{...experiments[0],signalTimeConvention:'pivot-bar'}]}),/confirmed candle/i);
  assert.throws(()=>run({experiments:[{...experiments[0],signals:[{time:99*step,side:'long'}]}]}),/validated closed candle/i);
  assert.throws(()=>run({experiments:[{...experiments[0],signals:[{time:5*step,side:'long'}]}]}),/no next open/i);
});

test('duplicate signals and duplicate experiment identifiers fail',()=>{
  assert.throws(()=>run({experiments:[{...experiments[0],signals:[{time:step,side:'long'},{time:step,side:'short'}]}]}),/Duplicate strategy signal/i);
  assert.throws(()=>run({experiments:[experiments[0],experiments[0]]}),/duplicate experiment id/i);
});
