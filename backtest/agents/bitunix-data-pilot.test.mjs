import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchBitunixDataPilot} from './bitunix-data-pilot.mjs';

const step=900000;
const boundary=1_800_000_000_000; // aligned quarter hour
const nowMs=boundary+20_000;
const closedBars=6,anchorBars=2,start=boundary-(closedBars+anchorBars)*step;
const bars=Array.from({length:closedBars+anchorBars},(_,i)=>({
  time:start+i*step,open:100,high:101,low:99,close:100,volume:11+i
}));
const run=({rows=bars, ...opts}={})=>fetchBitunixDataPilot({
  symbol:'BTCUSDT',timeframe:'15m',nowMs,closedBars,anchorBars,
  fetchPage:async({startTime,endTime})=>rows.filter(x=>x.time>=startTime&&x.time<endTime),
  ...opts
});
test('only closed candles accepted, real anchor excluded, raw rows retained',async()=>{
 const out=await run();
 assert.equal(out.status,'DATA_READY_FOR_RESEARCH_ONLY');
 assert.equal(out.acceptedCandles.length,closedBars);
 assert.equal(out.rawRows.length,closedBars+anchorBars);
 assert.equal(out.acceptedCandles[0].time,start+anchorBars*step);
 assert.equal(out.provenance.historyEndExclusiveUtc,new Date(boundary).toISOString());
 assert.equal(out.role1.status,'PASS');
 assert.equal(out.execution.backtests,'NOT_RUN_NO_VERIFIED_SIGNALS');
 assert.match(out.provenance.rawSha256,/^[a-f0-9]{64}$/);
});
test('a proven previous-close opening envelope is repaired with full provenance',async()=>{
 const rows=bars.map(x=>({...x}));rows[3].close=99.5;rows[3].high=99.8;
 const out=await run({rows});
 assert.equal(out.status,'DATA_READY_FOR_RESEARCH_ONLY');
 assert.equal(out.quality.rawInvalid,1);
 assert.equal(out.quality.corrected,1);
 assert.equal(out.corrections[0].original.high,99.8);
 assert.equal(out.acceptedCandles[1].high,100);
 assert.equal(out.rawRows[3].high,99.8);
});
test('unproven high/low error blocks and returns no approved candle array',async()=>{
 const rows=bars.map(x=>({...x}));rows[3].high=98;
 const out=await run({rows});
 assert.equal(out.status,'BLOCKED');
 assert.equal(out.reason,'OHLC_PROVENANCE_OR_CONTINUITY_FAILED');
 assert.equal(out.acceptedCandles.length,0);
 assert.ok(out.normalizationIssues.length);
});
test('missing closed candle blocks without synthetic interpolation',async()=>{
 const rows=bars.filter((_,i)=>i!==4);
 const out=await run({rows});
 assert.equal(out.status,'BLOCKED');
 assert.equal(out.quality.rawMissing,1);
 assert.equal(out.acceptedCandles.length,0);
});
test('duplicate timestamps remain blocking',async()=>{
 const rows=[...bars,bars[3]];
 const out=await run({rows});
 assert.equal(out.status,'BLOCKED');
 assert.ok(out.quality.rawDuplicates>0);
});
test('source request failure results in blocked provenance report',async()=>{
 const out=await run({fetchPage:async()=>{throw Error('network down')},retries:0});
 assert.equal(out.status,'BLOCKED');
 assert.equal(out.reason,'PUBLIC_REST_REQUEST_FAILED');
 assert.equal(out.requests[0].attempts,1);
 assert.equal(out.acceptedCandles.length,0);
});
test('forming candle never accepted even if adapter emits it',async()=>{
 // In normal operation adapter excludes it. A rogue adapter must be rejected.
 const rows=[...bars,{...bars[0],time:boundary}];
 const out=await run({fetchPage:async()=>rows});
 assert.equal(out.status,'BLOCKED');
 assert.equal(out.quality.rawOutOfRange,1);
});
test('pagination follows exclusive endTime without overlapping pages',async()=>{
 const windows=[];
 const result=await run({pageBars:3,fetchPage:async({startTime,endTime,limit})=>{
   windows.push({startTime,endTime,limit});
   return bars.filter(x=>x.time>=startTime&&x.time<endTime);
 }});
 assert.equal(result.status,'DATA_READY_FOR_RESEARCH_ONLY');
 assert.equal(windows.length,3);
 assert.equal(windows[0].endTime,windows[1].startTime);
 assert.equal(windows[1].endTime,windows[2].startTime);
});
test('unsupported markets and invalid windows do not silently downgrade',async()=>{
 await assert.rejects(run({symbol:'XRPUSDT'}),/Pilot restricted/);
 await assert.rejects(run({timeframe:'1d'}),/Pilot restricted/);
 await assert.rejects(run({closedBars:2}),/Unsafe pilot/);
});

test('longer 960-bar pilot paginates exactly and preserves all boundaries',async()=>{
 const size=960,anchor=3,base=boundary-(size+anchor)*step;
 const large=Array.from({length:size+anchor},(_,i)=>({
   time:base+i*step,open:100,high:101,low:99,close:100,volume:10+i
 }));
 const windows=[];
 const out=await run({rows:large,closedBars:size,anchorBars:anchor,pageBars:150,
   fetchPage:async({startTime,endTime,limit})=>{
     windows.push({startTime,endTime,limit});
     return large.filter(x=>x.time>=startTime&&x.time<endTime);
   }});
 assert.equal(out.status,'DATA_READY_FOR_RESEARCH_ONLY');
 assert.equal(out.acceptedCandles.length,960);
 assert.equal(out.rawRows.length,963);
 assert.equal(windows.length,7);
 assert.equal(windows[0].startTime,base);
 assert.equal(windows.at(-1).endTime,boundary);
 for(let i=1;i<windows.length;i++)
   assert.equal(windows[i-1].endTime,windows[i].startTime);
 await assert.rejects(run({closedBars:961}),/Unsafe pilot/);
});
test('960-bar pilot blocks missing interior bars rather than interpolating',async()=>{
 const size=960,anchor=3,base=boundary-(size+anchor)*step;
 const large=Array.from({length:size+anchor},(_,i)=>({
   time:base+i*step,open:100,high:101,low:99,close:100,volume:1
 }));
 large.splice(251,1);
 const out=await run({rows:large,closedBars:size,anchorBars:anchor});
 assert.equal(out.status,'BLOCKED');
 assert.equal(out.quality.rawMissing,1);
 assert.equal(out.acceptedCandles.length,0);
});
