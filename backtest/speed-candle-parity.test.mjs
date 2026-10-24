import test from 'node:test';
import assert from 'node:assert/strict';
import {classifySpeedCandleV3} from './speed-candle-v3.mjs';
test('SPEED volume SMA matches chart warmup fallback before 20 candles',()=>{
 const rows=Array.from({length:20},(_,i)=>({time:i*900000,open:100,high:102,low:99,close:101,volume:i===0?1000:100}));
 const colors=classifySpeedCandleV3(rows);
 assert.equal(colors[0].volumePercent,100);
 assert.equal(colors[0].color,null);
 assert.equal(colors[1].volumePercent,100);
 assert.equal(colors[1].color,null);
 assert.ok(colors[19].volumePercent<150);
});
