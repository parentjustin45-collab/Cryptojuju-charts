import test from 'node:test';
import assert from 'node:assert/strict';
import {compareSpeedEmaHoldout} from './speed-ema-holdout.mjs';
const candles=Array.from({length:500},(_,i)=>({time:i*900000,open:100,high:102,low:98,close:100,volume:i%17===0?1000:100}));
test('holdout uses chronological partitions and directional reports',()=>{
 const r=compareSpeedEmaHoldout(candles,{cutoffTime:350*900000});
 assert.equal(r.status,'ok');assert.equal(r.trainBars,350);assert.equal(r.testBars,150);
 assert.ok(r.results.ema50_breakout_long.test);assert.ok(r.results.ema13_bounce_short.test);
 assert.equal(r.assumptions.execution,'next-bar-open');
});
test('refuses splits with inadequate warmup or test bars',()=>{
 assert.equal(compareSpeedEmaHoldout(candles.slice(0,201),{cutoffTime:100*900000}).status,'insufficient_ema200_warmup');
 assert.equal(compareSpeedEmaHoldout(candles,{cutoffTime:100*900000}).status,'insufficient_split');
});
