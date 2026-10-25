import test from 'node:test';
import assert from 'node:assert/strict';
import {buildVectorAntiWhipsawAudit} from './vector-antiwhipsaw-report.mjs';

test('anti-whipsaw report retains V1.1 baseline, holdout, slippage and delay',()=>{
 const b={signals:4,trades:2,wins:1,sumNetPct:-0.2,winRatePct:50,
  meanNetPct:-0.1,censored:1,censoredSplit:1,censoredWindow:0,boundaryExcluded:2,
  delayedSignals:2,meanDelayBars:1,reversalPairs:2,rapidReversals:1,
  rapidReversalPct:50,meanReversalBars:4};
 const candidate={train:b,test:b,stress:{train:b,test:b},
  counts:{candidates:10,confirmed:5,expired:4,cancelledOpposite:1,pendingAtEnd:0}};
 const c={diagnostics:{minTrainTrades:30,minTestTrades:30,usableWindows:5,rejectedGaps:1,excludedShort:0},
  assumptions:{slippageRate:0,stressSlippageRate:0.0005},
  modes:[{id:'baseline_v11',label:'Original'},{id:'follow_close_1',label:'Confirm close'}],
  bySide:{long:{selectedOnTrain:'baseline_v11',holdout:{status:'baseline_selected'},
   candidates:{baseline_v11:candidate,follow_close_1:candidate}},
  short:{selectedOnTrain:null,holdout:{status:'insufficient_train_trades'},
   candidates:{baseline_v11:candidate,follow_close_1:candidate}}}};
 const audit=buildVectorAntiWhipsawAudit([{symbol:'SOLUSDT',interval:'4h',periodDays:365,
  coveragePct:98,excludedBars:3,cleanWindows:8,vectorAntiWhipsawStudy:c}]);
 assert.equal(audit.rows.length,16);
 assert.equal(audit.decisions.length,2);
 const row=audit.rows.find(r=>r.side==='long'&&r.mode==='baseline_v11'&&r.split==='test'&&r.scenario==='stress');
 assert.equal(row.v11Reference,true);
 assert.equal(row.selectedOnTrain,true);
 assert.equal(row.slippageRate,0.0005);
 assert.equal(row.boundaryExcluded,2);
 assert.equal(row.censoredSplit,1);
 assert.equal(row.sampleStatus,'insufficient_trades');
});
