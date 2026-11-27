import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchHourlyVerifiedWindow} from './hourly-bitunix-recovery.mjs';
import {fetchBitunixDataPilot} from './bitunix-data-pilot.mjs';
import {validateHistoricalSource} from './render/historical-library.mjs';
import {requireVerifiedInput} from './run-render-indicator-pilot.mjs';
const step=900000,end=Date.UTC(2026,10,24),closedBars=480,start=end-closedBars*step;
const opts={symbol:'BTCUSDT',timeframe:'15m',closedBars,nowMs:end+60000};
const normal=()=>Array.from({length:492},(_,i)=>({time:start+(i-12)*step,open:100,high:101,low:99,close:100,volume:10}));
const anomaly=(rows,anchor)=>{const x=rows.find(x=>x.time===start-anchor*step);x.high=99.9;x.close=99.8;const following=rows.find(y=>y.time===x.time+step);following.open=99.8;};
const run=(rows,mutate=()=>{})=>{
 let calls=[];
 return {calls,result:fetchHourlyVerifiedWindow(opts,{now:()=>end+60000,fetchWindow:async input=>{
  calls.push(input.anchorBars);const source=rows.map(x=>({...x}));mutate(source,calls.length,input);
  return fetchBitunixDataPilot({...input,retries:0,fetchPage:async({startTime,endTime})=>source.filter(x=>x.time>=startTime&&x.time<endTime)});
 }})};
};
test('clean input uses exactly two reads, same 480 candles',async()=>{
 const {result,calls}=run(normal());const r=await result;
 assert.deepEqual(calls,[3,3]);assert.equal(r.recovered,false);assert.equal(r.readback.status,'STABLE_TWO_READS');
 assert.equal(validateHistoricalSource(r.first,r.readback).rows.length,480);
});
test('oldest anchor repaired with actual predecessor and two identical full reads',async()=>{
 const rows=normal();anomaly(rows,3);const {result,calls}=run(rows);const r=await result;
 assert.deepEqual(calls,[3,4,4]);assert.equal(r.recovered,true);assert.equal(r.first.acceptedCandles[0].time,start);
 assert.equal(r.first.historyWindow.endTime,end);assert.equal(r.readback.checkedRaw,484);
 assert.equal(r.attempts[0].first.status,'BLOCKED');
 assert.equal(validateHistoricalSource(r.first,r.readback).rows.length,480);
 assert.equal(requireVerifiedInput(r.first,r.readback,opts).length,480);
});
test('multiple predecessor anomalies extend only real context',async()=>{
 const rows=normal();anomaly(rows,3);const x=rows.find(x=>x.time===start-4*step);x.high=99.9;x.close=100; // need valid close; use low-only-open next instead
 x.high=100.1;x.low=100.05;x.open=100;x.close=100.08;
 const y=rows.find(x=>x.time===start-3*step);y.open=100.08;
 const {result,calls}=run(rows);const r=await result;
 // A second unresolved anomaly after extending must be rejected rather than guessed.
 assert.equal(r.readback.status,'BLOCKED');assert.ok(calls.length<=7);
});
test('missing candle, duplicate, interior unconfirmed OHLC never auto-repaired',async()=>{
 for(const kind of ['missing','duplicate','interior']){
  let rows=normal();
  if(kind==='missing')rows=rows.filter(x=>x.time!==start+step);
  if(kind==='duplicate')rows.push({...rows.find(x=>x.time===start+step)});
  if(kind==='interior')rows.find(x=>x.time===start+step).high=98;
  const {result,calls}=run(rows);const r=await result;
  assert.equal(r.readback.status,'BLOCKED');assert.deepEqual(calls,[3]);assert.equal(r.recovered,false);
 }
});
test('raw revision during context extension cannot be masked',async()=>{
 const rows=normal();anomaly(rows,3);
 const {result,calls}=run(rows,(x,n)=>{if(n===2)x.find(v=>v.time===start+step).volume++;});
 const r=await result;assert.equal(r.readback.reason,'ANCHOR_EXTENSION_CHANGED_OR_MISSING_RAW_ROWS');assert.deepEqual(calls,[3,4]);
});
test('second read revision remains blocked, no acceptance retry',async()=>{
 const {result,calls}=run(normal(),(x,n)=>{if(n===2)x.find(v=>v.time===start+step).volume++;});
 const r=await result;assert.equal(r.readback.status,'BLOCKED');assert.equal(r.readback.reason,'CLOSED_CANDLE_REVISION_OR_MISMATCH');assert.deepEqual(calls,[3,3]);
});
