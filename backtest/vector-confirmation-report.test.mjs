import test from 'node:test';import assert from 'node:assert/strict';
import {buildVectorConfirmationAudit} from './vector-confirmation-report.mjs';
test('confirmation audit carries immutable V1.1 baseline, holdout decisions and censoring',()=>{
 const v={signals:5,trades:2,wins:1,meanNetPct:-0.2,winRatePct:50,
  censored:3,censoredSplit:2,censoredWindow:1,rapidReversals:1,
  reverseIntervals:2,rapidReversalPct:50,meanReverseBars:4};
 const candidate={train:v,test:v,stress:{train:v,test:v}};
 const s={configurations:[3,4,5],
  assumptions:{slippageRate:0,stressSlippageRate:0.0005},
  diagnostics:{minTrainTrades:30,minTestTrades:30,usableWindows:2,rejectedGaps:1},
  bySide:{long:{selectedOnTrain:4,holdout:{status:'baseline_selected',researchPass:false},
   candidates:{3:candidate,4:candidate,5:candidate}},
   short:{selectedOnTrain:3,holdout:{status:'review_candidate',researchPass:false},
   candidates:{3:candidate,4:candidate,5:candidate}}}};
 const audit=buildVectorConfirmationAudit([{symbol:'ETHUSDT',interval:'1h',periodDays:365,
  coveragePct:99,excludedBars:10,cleanWindows:2,vectorConfirmationStudy:s}]);
 assert.equal(audit.rows.length,24);
 assert.equal(audit.decisions.length,2);
 const row=audit.rows.find(x=>x.side==='long'&&x.threshold===4&&x.scenario==='stress'&&x.split==='test');
 assert.equal(row.baselineV11,true);assert.equal(row.selectedOnTrain,true);
 assert.equal(row.slippageRate,0.0005);assert.equal(row.censoredSplit,2);
 assert.equal(row.eligible,false);
});
