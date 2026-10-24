import test from 'node:test';
import assert from 'node:assert/strict';
import {backtestSpeedCandleV3} from './speed-candle-backtest.mjs';
const ms=900000;
const bar=i=>({time:i*ms,open:100,high:102,low:99,close:101,volume:i===23?700:100});
test('SPEED research runs on clean history with next-bar execution',()=>{
 const rows=Array.from({length:30},(_,i)=>bar(i));
 const r=backtestSpeedCandleV3({rows,historyWindow:{startTime:0,endTime:30*ms,intervalMs:ms}});
 assert.equal(r.status,'READY');
 assert.equal(r.segments.length,1);
 assert.equal(r.segments[0].result.trades[0].entryTime,24*ms);
 assert.equal(r.summary.tradeCount,1);
});
test('invalid OHLC is quarantined; no trade crosses gap',()=>{
 const rows=Array.from({length:60},(_,i)=>bar(i));
 rows[30]={...rows[30],high:90};
 const r=backtestSpeedCandleV3({rows,historyWindow:{startTime:0,endTime:60*ms,intervalMs:ms}});
 assert.equal(r.status,'PARTIAL_QUARANTINED');
 assert.equal(r.segments.length,2);
 assert.equal(r.excludedBars,1);
 assert.equal(r.segments[0].result.trades[0].exitTime,29*ms);
 assert.equal(r.segments[1].signalCount,0);
});
test('short clean history cannot be backtested',()=>{
 const rows=Array.from({length:15},(_,i)=>bar(i));
 const r=backtestSpeedCandleV3({rows,historyWindow:{startTime:0,endTime:15*ms,intervalMs:ms}});
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.summary.winRatePct,null);
});
