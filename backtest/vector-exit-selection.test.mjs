import test from 'node:test';import assert from 'node:assert/strict';import {studyVectorExits} from './vector-exit-selection.mjs';
const bars=Array.from({length:300},(_,i)=>({time:i*900000,open:100,high:101,low:99,close:100,volume:100}));
test('Vector exits include fixed and opposite, and selection is train-only',()=>{const r=studyVectorExits([{candles:bars}],{cutoffTime:150*900000});assert.equal(r.configs.length,4);assert.ok(r.bySide.long.candidates.opposite_vector.test);assert.equal(r.bySide.long.selectedOnTrain,null);assert.equal(r.bySide.long.validation.status,'insufficient_train_trades');});
test('missing cutoff rejected',()=>assert.throws(()=>studyVectorExits([{candles:bars}]),/cutoffTime/));
