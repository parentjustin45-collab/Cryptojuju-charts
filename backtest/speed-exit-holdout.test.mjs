import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeExitHoldout} from './speed-exit-holdout.mjs';
test('chronological split excludes crossing windows and preserves trade-weighted win rate',()=>{
 const windows=[{startTime:100,endTime:200},{startTime:200,endTime:350},{startTime:350,endTime:450}];
 const results={mid_both_fixed:[{returnPercent:2,tradeCount:2,winRatePercent:50,maxDrawdownPercent:3},{returnPercent:10,tradeCount:1,winRatePercent:100,maxDrawdownPercent:5},{returnPercent:-4,tradeCount:4,winRatePercent:25,maxDrawdownPercent:7}]};
 const x=summarizeExitHoldout(windows,results,{cutoffTime:300});
 assert.deepEqual([x.train.mid_both_fixed.windows,x.holdout.mid_both_fixed.windows],[1,1]);
 assert.equal(x.train.mid_both_fixed.meanWindowReturnPct,2);
 assert.equal(x.holdout.mid_both_fixed.meanWindowReturnPct,-4);
 assert.equal(x.holdout.mid_both_fixed.winRatePct,25);
});
test('empty cohort does not invent performance',()=>{
 const x=summarizeExitHoldout([{startTime:100,endTime:200}],{mid_long_fixed:[{returnPercent:1,tradeCount:1,winRatePercent:100,maxDrawdownPercent:2}]},{cutoffTime:300});
 assert.equal(x.holdout.mid_long_fixed.meanWindowReturnPct,null);
 assert.equal(x.holdout.mid_long_fixed.winRatePct,null);
});
test('rejects mismatched data',()=>assert.throws(()=>summarizeExitHoldout([{startTime:1,endTime:2}],{x:[]},{cutoffTime:3})));
