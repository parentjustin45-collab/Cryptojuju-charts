import test from 'node:test';
import assert from 'node:assert/strict';
import {planCleanBacktestWindows} from './quarantine.mjs';
import {runBacktest} from './engine.mjs';
const intervalMs=900000,window={startTime:0,endTime:7*intervalMs,intervalMs};
const candle=(i,extra={})=>({time:i*intervalMs,open:100,high:105,low:95,close:102,volume:10,...extra});
test('quarantine isolates invalid source candles without editing OHLC',()=>{
 const rows=Array.from({length:7},(_,i)=>candle(i));
 rows[3]=candle(3,{high:99});
 const p=planCleanBacktestWindows(rows,window);
 assert.equal(p.status,'PARTIAL_QUARANTINED');
 assert.equal(p.quality.invalid,1);
 assert.deepEqual(p.eligibleWindows.map(x=>x.bars),[3,3]);
 assert.equal(p.excludedBars,1);
 assert.equal(rows[3].high,99);
 for(const segment of p.eligibleWindows){
  const result=runBacktest(segment.candles,[],{historyWindow:{startTime:segment.startTime,endTime:segment.endTime,intervalMs}});
  assert.equal(result.tradeCount,0);
 }
});
test('no segment may bridge missing history',()=>{
 const p=planCleanBacktestWindows([candle(0),candle(1),candle(2),candle(4),candle(5),candle(6)],window);
 assert.equal(p.quality.missing,1);
 assert.equal(p.eligibleWindows.length,2);
 assert.equal(p.eligibleWindows[0].endTime,3*intervalMs);
 assert.equal(p.eligibleWindows[1].startTime,4*intervalMs);
});
test('duplicate timestamps quarantine entire timestamp',()=>{
 const rows=Array.from({length:7},(_,i)=>candle(i));
 rows.push(candle(3));
 const p=planCleanBacktestWindows(rows,window);
 assert.deepEqual(p.duplicateTimes,[3*intervalMs]);
 assert.equal(p.eligibleWindows.length,2);
 assert.equal(p.excludedBars,1);
});
test('short isolated sections are not eligible',()=>{
 const p=planCleanBacktestWindows([candle(0),candle(2),candle(4),candle(6)],window);
 assert.equal(p.status,'BLOCKED');
 assert.equal(p.eligibleWindows.length,0);
});
