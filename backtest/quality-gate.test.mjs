import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyHistory,requireCleanHistory} from './quality-gate.mjs';
const base={time:0,open:100,high:105,low:95,close:102,volume:5};
const window={startTime:0,endTime:2700000,intervalMs:900000};
test('clean continuous history is ready',()=>{
 const rows=[base,{...base,time:900000},{...base,time:1800000}];
 const result=classifyHistory(rows,window);
 assert.equal(result.status,'READY');assert.equal(result.quality.valid,3);
 assert.equal(requireCleanHistory(result).length,3);
});
test('missing candles block strict backtest',()=>{
 const result=classifyHistory([base,{...base,time:1800000}],window);
 assert.equal(result.quality.missing,1);assert.deepEqual(result.missing,[900000]);
 assert.throws(()=>requireCleanHistory(result),/blocked/);
});
test('high and low anomalies stay raw and are rejected',()=>{
 const bad={...base,time:900000,high:99,low:101};
 const result=classifyHistory([base,bad,{...base,time:1800000}],window);
 assert.equal(result.quality.invalid,1);assert.equal(result.quality.missing,0);
 assert.equal(result.issues[0].raw,bad);
 assert.ok(result.issues[0].reasons.includes('HIGH_BELOW_OPEN_OR_CLOSE'));
 assert.ok(result.issues[0].reasons.includes('LOW_ABOVE_OPEN_OR_CLOSE'));
 assert.throws(()=>requireCleanHistory(result));
});
test('duplicate conflicting raw candles cannot silently overwrite',()=>{
 const result=classifyHistory([base,{...base,time:900000},{...base,time:900000,high:99},{...base,time:1800000}],window);
 assert.equal(result.quality.duplicates,1);assert.equal(result.canBacktest,false);
});
test('out of range candles are excluded',()=>{
 const result=classifyHistory([base,{...base,time:900000},{...base,time:1800000},{...base,time:2700000}],window);
 assert.equal(result.quality.outOfRange,1);assert.equal(result.canBacktest,true);
});
