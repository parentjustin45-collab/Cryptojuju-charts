import test from 'node:test';
import assert from 'node:assert/strict';
import {studyVectorSpeed} from './vector-speed-comparison.mjs';
const bars=Array.from({length:300},(_,i)=>({time:i*900000,open:100,high:102,low:98,close:100,volume:100}));
test('four candidates, separate direction and chronological holdout',()=>{
 const r=studyVectorSpeed([{candles:bars}],{cutoffTime:150*900000});
 assert.equal(Object.keys(r.strategies).length,8);
 assert.ok(r.strategies.vector_entry_long.train);
 assert.ok(r.strategies.speed_vector_flip_short.test);
 assert.equal(r.assumptions.execution,'next-bar-open');
});
test('short windows do not create fictitious trades',()=>{
 const r=studyVectorSpeed([{candles:bars.slice(0,10)}],{cutoffTime:150*900000});
 assert.equal(r.diagnostics.usableWindows,0);
 assert.equal(r.strategies.speed_long.test.status,'insufficient_trades');
});
