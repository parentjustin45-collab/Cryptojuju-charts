import test from 'node:test';
import assert from 'node:assert/strict';
import {studySpeedEmaRiskHoldout} from './speed-ema-risk-holdout.mjs';
const make=(start,n=260)=>Array.from({length:n},(_,i)=>({time:start+i*900000,open:100,high:102,low:98,close:100,volume:i%11===0?1000:100}));
test('reports long/short and train/test with fixed risk assumptions',()=>{
 const a=make(0),b=make(400*900000);
 const r=studySpeedEmaRiskHoldout([{candles:a},{candles:b}],{cutoffTime:300*900000,minTrades:1});
 assert.equal(r.diagnostics.usableWindows,2);
 assert.ok(r.strategies.speed_long.train);
 assert.ok(r.strategies.ema50_breakout_short.test);
 assert.equal(r.assumptions.intrabarTie,'stop-first');
 assert.equal(r.assumptions.execution,'next-bar-open');
});
test('short windows are excluded rather than silently evaluated without EMA200',()=>{
 const r=studySpeedEmaRiskHoldout([{candles:make(0,100)}],{cutoffTime:200*900000});
 assert.equal(r.diagnostics.excludedShort,1);
 assert.equal(r.strategies.speed_long.test.status,'insufficient_trades');
});
