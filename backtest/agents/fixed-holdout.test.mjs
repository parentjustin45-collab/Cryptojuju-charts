import test from 'node:test';
import assert from 'node:assert/strict';
import {runFixedHoldout} from './fixed-holdout.mjs';

const step=900000;
const candles=[100,103,104,101,99,102,105,104,100,101,98].map((open,i)=>({
  time:i*step,open,high:open+2,low:open-2,close:open+1,volume:5
}));
const market={exchange:'Bitunix',priceType:'LAST_PRICE',symbol:'BTCUSDT',timeframe:'15m'};
const historyWindow={startTime:0,endTime:11*step,intervalMs:step};
const experiment={
  id:'strategy_1',signalTimeConvention:'confirmation-bar-open',
  signals:[
    {time:step,side:'long'},{time:4*step,side:'flat'},
    {time:5*step,side:'long'}, // cannot carry into holdout
    {time:7*step,side:'short'},{time:9*step,side:'flat'}
  ]
};
const args={market,historyWindow,candles,experiments:[experiment],
 costs:{feeRate:0.0006,slippageRate:0.0005,allocation:1,initialCapital:1000},
 holdoutStartTime:6*step};

test('fixed split uses independent training and holdout prices and capital',()=>{
  const res=runFixedHoldout(args);
  assert.equal(res.status,'RESEARCH_ONLY');
  assert.equal(res.windows.training.bars,6);
  assert.equal(res.windows.holdout.bars,5);
  assert.equal(res.training.strategy_1.tradeCount,1);
  assert.equal(res.holdout.strategy_1.tradeCount,1);
  assert.equal(res.training.strategy_1.signalCount,2);
  assert.equal(res.holdout.strategy_1.signalCount,2);
  assert.equal(res.droppedAtBoundary.length,1);
  assert.deepEqual(res.droppedAtBoundary[0],{id:'strategy_1',time:5*step,reason:'no-position-carryover'});
  assert.equal(res.totalNetProfit,undefined);
});

test('holdout with no signals does not inherit a training position',()=>{
  const noHoldout={...experiment,signals:[{time:step,side:'long'},{time:5*step,side:'short'}]};
  const res=runFixedHoldout({...args,experiments:[noHoldout]});
  assert.equal(res.training.strategy_1.tradeCount,1); // end of training liquidated
  assert.equal(res.holdout.strategy_1.tradeCount,0);
  assert.equal(res.holdout.strategy_1.finalCapital,1000);
  assert.equal(res.holdout.strategy_1.winRatePct,null);
});

test('unaligned or undersized split is refused',()=>{
  assert.throws(()=>runFixedHoldout({...args,holdoutStartTime:6*step+5}),/aligned/);
  assert.throws(()=>runFixedHoldout({...args,holdoutStartTime:2*step}),/three candles/);
  assert.throws(()=>runFixedHoldout({...args,holdoutStartTime:9*step}),/three candles/);
});

test('full history must be clean BEFORE splitting',()=>{
  assert.throws(()=>runFixedHoldout({...args,candles:candles.slice(1)}),/blocked/);
  const bad=candles.map(x=>({...x}));
  bad[7].low=bad[7].open+3;
  assert.throws(()=>runFixedHoldout({...args,candles:bad}),/blocked/);
});

test('timestamps outside verified data and final-bar signals are rejected',()=>{
  assert.throws(()=>runFixedHoldout({...args,experiments:[{...experiment,signals:[{time:11*step,side:'long'}]}]}),/non-executable/);
  assert.throws(()=>runFixedHoldout({...args,experiments:[{...experiment,signals:[{time:10*step,side:'long'}]}]}),/non-executable/);
});

test('same timestamp cannot have conflicting or duplicated signals',()=>{
  assert.throws(()=>runFixedHoldout({...args,experiments:[{...experiment,signals:[{time:step,side:'long'},{time:step,side:'short'}]}]}),/duplicated/);
});
