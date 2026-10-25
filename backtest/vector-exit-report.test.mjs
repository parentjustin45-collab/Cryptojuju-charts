import test from 'node:test';import assert from 'node:assert/strict';
import {buildVectorExitAudit} from './vector-exit-report.mjs';
test('Vector exit audit preserves direction, exit family, split and censoring',()=>{
 const bucket={trades:2,censored:1,censoredSplit:1,censoredWindow:0,wins:1,winRatePct:50,meanNetPct:-0.1,
 reasons:{stop:1,take:0,opposite:1,timeout:0}};
 const candidate={train:bucket,test:bucket,stress:{train:bucket,test:bucket}};
 const report={symbol:'BTCUSDT',interval:'4h',periodDays:365,coveragePct:99,excludedBars:1,cleanWindows:2,
 vectorExitSelection:{
  diagnostics:{minTrainTrades:30,minTestTrades:30},
  assumptions:{slippageRate:0,stressSlippageRate:0.0005},
  configs:[{id:'hybrid_1_5_3_12',family:'hybrid'}],
  bySide:{long:{selectedOnTrain:'hybrid_1_5_3_12',candidates:{hybrid_1_5_3_12:candidate}},
   short:{selectedOnTrain:null,candidates:{hybrid_1_5_3_12:candidate}}}
 }};
 const audit=buildVectorExitAudit([report]);
 assert.equal(audit.rows.length,8);
 const row=audit.rows.find(x=>x.side==='long'&&x.split==='test'&&x.caseName==='stress');
 assert.equal(row.slippageRate,0.0005);
 assert.equal(row.selectedOnTrain,true);
 assert.equal(row.family,'hybrid');
 assert.equal(row.censoredSplit,1);
 assert.equal(row.sampleStatus,'insufficient_trades');
 assert.equal(audit.diagnostics[0].selected.short,null);
});
