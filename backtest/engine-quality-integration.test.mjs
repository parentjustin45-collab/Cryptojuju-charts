import test from 'node:test';
import assert from 'node:assert/strict';
import {runBacktest} from './engine.mjs';
const bar=(time,overrides={})=>({time,open:100,high:105,low:95,close:102,volume:2,...overrides});
const window={startTime:0,endTime:2700000,intervalMs:900000};
const signals=[{time:0,side:'long'},{time:900000,side:'flat'}];
test('strict mode runs on complete clean candles',()=>{
 const result=runBacktest([bar(0),bar(900000),bar(1800000)],signals,{historyWindow:window});
 assert.equal(result.tradeCount,1);
 assert.equal(result.trades[0].entryTime,900000);
});
test('strict mode blocks missing candle before any trade',()=>{
 assert.throws(()=>runBacktest([bar(0),bar(1800000)],signals,{historyWindow:window}),/blocked/);
});
test('strict mode blocks source high below open without repair',()=>{
 const bad=bar(900000,{high:99.9});
 assert.throws(()=>runBacktest([bar(0),bad,bar(1800000)],signals,{historyWindow:window}),/blocked/);
 assert.equal(bad.high,99.9);
});
test('strict mode blocks duplicates even when identical',()=>{
 assert.throws(()=>runBacktest([bar(0),bar(900000),bar(900000),bar(1800000)],signals,{historyWindow:window}),/blocked/);
});
