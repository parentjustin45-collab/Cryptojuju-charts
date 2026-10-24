import test from 'node:test';
import assert from 'node:assert/strict';
import {classifySpeedCandleV3,speedCandleResearchSignals} from './speed-candle-v3.mjs';
const candle=(i,volume=100,open=100,close=101)=>({time:i*900000,open,close,high:Math.max(open,close)+1,low:Math.min(open,close)-1,volume});
test('normal volume produces no color or trading command',()=>{
 const rows=Array.from({length:30},(_,i)=>candle(i));
 assert.equal(classifySpeedCandleV3(rows)[29].color,null);
 assert.deepEqual(speedCandleResearchSignals(rows),[]);
});
test('confirmed bullish and bearish high volume classify exactly and next-bar research signals',()=>{
 const rows=Array.from({length:24},(_,i)=>candle(i));
 rows[21]=candle(21,500,100,102);
 rows[22]=candle(22,500,103,100);
 const colors=classifySpeedCandleV3(rows);
 assert.equal(colors[21].color,'bullHigh');
 assert.equal(colors[22].color,'bearHigh');
 assert.deepEqual(speedCandleResearchSignals(rows).map(x=>x.side),['long','short']);
});
test('doji is not directional and invalid candles cannot be silently traded',()=>{
 const rows=Array.from({length:21},(_,i)=>candle(i));
 rows[20]=candle(20,900,100,100);
 assert.equal(classifySpeedCandleV3(rows)[20].color,null);
 rows[20].high=99;
 assert.throws(()=>classifySpeedCandleV3(rows),/Invalid OHLC/);
});
test('historical classification is prefix stable (no future look-ahead)',()=>{
 const rows=Array.from({length:35},(_,i)=>candle(i,i===25?1000:100));
 assert.deepEqual(classifySpeedCandleV3(rows).slice(0,26),classifySpeedCandleV3(rows.slice(0,26)));
});
