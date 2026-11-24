import test from 'node:test';
import assert from 'node:assert/strict';
import {FIVE_CASES} from './render/five-by-five.mjs';
import {HISTORICAL_TARGET,planMissingWindows,planFiveByFive}
  from './historical-backfill-plan.mjs';
import {fetchBitunixDataPilot} from './bitunix-data-pilot.mjs';
import {VERIFIED_INTERVALS} from './research-batch.mjs';

test('2-year 5x5 planner is exact, immutable in source, and read-only',()=>{
  const result=planFiveByFive();
  assert.equal(result.totals.pairs,25);
  assert.equal(result.totals.expectedBars,638750);
  assert.equal(result.totals.verifiedExistingBars,0);
  assert.equal(result.totals.missingBars,638750);
  assert.equal(result.items.length,25);
  assert.equal(result.writeOperations,0);
  assert.equal(result.ordersPlaced,0);
  assert.equal(result.target.startTime,Date.UTC(2024,10,24));
  assert.equal(result.target.endTime,Date.UTC(2026,10,24));
  for(const x of result.items){
    assert.ok(FIVE_CASES.some(y=>y.symbol===x.symbol&&y.timeframe===x.timeframe));
    assert.equal(x.windows.reduce((n,w)=>n+w.closedBars,0),x.expectedBars);
    assert.equal(x.windows[0].startTime,HISTORICAL_TARGET.startTime);
    assert.equal(x.windows.at(-1).endTime,HISTORICAL_TARGET.endTime);
    for(let i=1;i<x.windows.length;i++)
      assert.equal(x.windows[i-1].endTime,x.windows[i].startTime);
    assert.ok(x.windows.every(w=>w.closedBars<=480&&w.hasExistingOverlap===false));
  }
});
test('verified bars become skipped windows, no overlapping API fetch requested',()=>{
  const step=VERIFIED_INTERVALS['15m'],base=HISTORICAL_TARGET.startTime,end=base+16*step;
  const rows=[base+0*step,base+1*step,base+2*step,base+7*step,base+8*step,base+9*step,
    base+10*step,base+15*step];
  const plan=planMissingWindows({symbol:'BTCUSDT',timeframe:'15m',startTime:base,
    endTime:end,existingOpenTimes:[...rows,rows[0]],chunkBars:4});
  assert.equal(plan.expectedBars,16);
  assert.equal(plan.existingUniqueBars,8);
  assert.equal(plan.missingBars,8);
  assert.deepEqual(plan.windows.map(x=>[x.startTime,x.endTime,x.closedBars,x.autoFetchEligible]),[
    [base+3*step,base+7*step,4,true],
    [base+11*step,base+15*step,4,true]
  ]);
});
test('short isolated gaps require bounded re-query; never force invalid 1..3-bar historical pilot',()=>{
  const b=HISTORICAL_TARGET.startTime,step=VERIFIED_INTERVALS['1h'];
  const p=planMissingWindows({symbol:'BTCUSDT',timeframe:'1h',startTime:b,
    endTime:b+8*step,existingOpenTimes:[b,b+step,b+5*step,b+6*step,b+7*step]});
  assert.equal(p.windows.length,1);
  assert.equal(p.windows[0].closedBars,3);
  assert.equal(p.windows[0].autoFetchEligible,false);
  assert.equal(p.windows[0].reason,'NARROW_GAP_REQUIRES_BOUNDED_REQUERY');
});
test('planner rejects unverified, future, non-causal or unaligned windows',()=>{
  const b=HISTORICAL_TARGET.startTime,e=HISTORICAL_TARGET.endTime;
  const run=x=>planMissingWindows({symbol:'BTCUSDT',timeframe:'1h',startTime:b,endTime:e,...x});
  assert.throws(()=>run({symbol:'XAUUSDT'}),/authorized/);
  assert.throws(()=>run({timeframe:'1w'}),/authorized/);
  assert.throws(()=>run({startTime:b+1}),/boundaries/);
  assert.throws(()=>run({endTime:e+1}),/boundaries/);
  assert.throws(()=>run({existingOpenTimes:[b+1]}),/aligned/);
  assert.throws(()=>run({existingOpenTimes:[e]}),/inside target/);
  assert.throws(()=>run({chunkBars:961}),/chunks/);
  assert.throws(()=>run({endTime:Date.UTC(2040,1,1)}),/boundaries/);
});
test('historical Bitunix fetch keeps TRUE fetchedAt UTC and a past, closed, aligned target',async()=>{
  const step=VERIFIED_INTERVALS['15m'],historicalEnd=Date.UTC(2025,0,5);
  const actualFetch=Date.UTC(2026,10,24,18,32);
  const closedBars=6,anchorBars=3;
  const first=historicalEnd-(closedBars+anchorBars)*step;
  const rows=Array.from({length:closedBars+anchorBars},(_,i)=>({
    time:first+i*step,open:100,high:101,low:99,close:100,volume:100+i
  }));
  const out=await fetchBitunixDataPilot({
    symbol:'BTCUSDT',timeframe:'15m',
    closedBars,anchorBars,nowMs:actualFetch,historicalEndExclusiveMs:historicalEnd,
    fetchPage:async({startTime,endTime})=>rows.filter(x=>x.time>=startTime&&x.time<endTime)
  });
  assert.equal(out.status,'DATA_READY_FOR_RESEARCH_ONLY');
  assert.equal(out.historyWindow.endTime,historicalEnd);
  assert.equal(out.provenance.historyWindowMode,'EXPLICIT_HISTORICAL_CLOSED_WINDOW');
  assert.equal(out.provenance.fetchedAtUtc,new Date(actualFetch).toISOString());
  assert.equal(out.acceptedCandles.length,6);
  assert.equal(out.acceptedCandles.at(-1).time,historicalEnd-step);
  await assert.rejects(fetchBitunixDataPilot({
    symbol:'BTCUSDT',timeframe:'15m',nowMs:actualFetch,
    historicalEndExclusiveMs:actualFetch+step*10,closedBars,
    fetchPage:async()=>[]}),/Invalid or future historical/);
  await assert.rejects(fetchBitunixDataPilot({
    symbol:'BTCUSDT',timeframe:'15m',nowMs:actualFetch,
    historicalEndExclusiveMs:historicalEnd+1,closedBars,
    fetchPage:async()=>[]}),/Invalid or future historical/);
});
