import test from 'node:test';
import assert from 'node:assert/strict';
import {compareCounterFlips,analyzeLatencyWindows,runLatencyAudit,LATENCY_LOCK}
 from './vector-v14-confirmation-latency.mjs';
const H=3600000,E=Date.parse('2026-10-01T00:00:00Z');
function candles(n=100){
 return Array.from({length:n},(_,i)=>({
  time:E+i*H,open:100,high:101,low:99,close:100,volume:100}));
}
function mocked({end=100,confirm=63,revert=null}={}){
 const bars=candles(end);
 const v11=bars.map((b,i)=>({time:b.time,direction:i<60?-1:revert!==null&&i>=revert?-1:1,
  signal:i===60?'long':i===revert?'short':null}));
 const v14=bars.map((b,i)=>({time:b.time,direction:confirm!==null&&i>=confirm?1:-1,
  signal:i===confirm?'long':null,why:i===confirm?'structure_break':null}));
 return {bars,v11,v14};
}
const evalCase=(x,cutoffTime=Number.MAX_SAFE_INTEGER)=>
 compareCounterFlips(x.bars,x.v11,x.v14,{symbol:'ETHUSDT',cutoffTime});
test('Research lock fixes historical horizon, unchanged risk approximations, ETH focus',()=>{
 assert.equal(LATENCY_LOCK.days,90);
 assert.deepEqual(LATENCY_LOCK.symbols,['BTCUSDT','ETHUSDT','SOLUSDT']);
 assert.equal(LATENCY_LOCK.feePerSide,0.0006);
 assert.equal(LATENCY_LOCK.slippagePerSide,0.0005);
 assert.match(LATENCY_LOCK.notes,/no orders/);
});
test('Only V1.1 NEW countertrend flip can be classified as V1.4 delay',()=>{
 const x=mocked(),events=evalCase(x);
 assert.equal(events.length,1);
 const e=events[0];
 assert.equal(e.time,x.bars[60].time);
 assert.equal(e.resolution,'v14_confirmed_later');
 assert.equal(e.v11EntryTime,x.bars[61].time);
 assert.equal(e.v14ConfirmationTime,x.bars[63].time);
 assert.equal(e.v14EntryTime,x.bars[64].time);
 assert.equal(e.delayBars,3);
 assert.equal(e.v14ConfirmationReason,'structure_break');
 assert.equal(e.side,'LONG');
});
test('The price gap uses both NEXT opens and expresses directional entry disadvantage',()=>{
 const x=mocked();x.bars[64]={...x.bars[64],open:103,high:104};
 const e=evalCase(x)[0];
 assert.equal(e.entryGapPct,3);
 const y=mocked();y.bars[64]={...y.bars[64],open:97,low:96};
 assert.equal(evalCase(y)[0].entryGapPct,-3);
});
test('V1.1 reverting before V1.4 changes creates short-lived hypothetical two-fee net',()=>{
 const x=mocked({confirm:null,revert:62}),e=evalCase(x)[0];
 assert.equal(e.resolution,'v11_reverted_first');
 assert.equal(e.resolvedTime,x.bars[62].time);
 assert.equal(e.delayBars,2);
 assert.equal(e.entryGapPct,null);
 assert.ok(e.v11ShortLivedNetPct<-.2,'Cost includes fees and slippage at both ends');
});
test('Do not call a simultaneous contradictory engine change a delayed confirmation',()=>{
 const x=mocked({confirm:62,revert:62});
 assert.equal(evalCase(x)[0].resolution,'simultaneous_or_ambiguous');
 assert.equal(evalCase(x)[0].entryGapPct,null);
});
test('A boundary censors the unresolved flip instead of using future prices',()=>{
 const x=mocked({confirm:63}),boundary=x.bars[62].time;
 const e=evalCase(x,boundary)[0];
 assert.equal(e.resolution,'censored_split');
 assert.equal(e.entryGapPct,null);
 assert.equal(e.v11ShortLivedNetPct,null);
});
test('A confirmation at final candle without next OPEN is censored',()=>{
 const x=mocked({end:64,confirm:63});
 const e=evalCase(x)[0];
 assert.equal(e.resolution,'censored_window_end');
 assert.equal(e.v14EntryTime,null);
});
test('A gap/corrupt high is quarantined and never causes fabricated latency',()=>{
 const x=mocked(),broken=[...x.bars];broken[65]={...broken[65],time:broken[65].time+H};
 assert.throws(()=>compareCounterFlips(broken,x.v11,x.v14),/Invalid or discontinuous/);
 const report=analyzeLatencyWindows([{candles:broken}],{symbol:'ETHUSDT'});
 assert.equal(report.cleanWindows,0);
 assert.equal(report.events.length,0);
});
test('Future prices and raw signals after a resolved event cannot rewrite its outcome',()=>{
 const x=mocked();x.bars[64]={...x.bars[64],open:104,high:105};
 const a=evalCase(x)[0];
 const y=mocked();y.bars[64]={...y.bars[64],open:104,high:105};
 for(let j=70;j<y.bars.length;j++)y.bars[j]={...y.bars[j],open:105,high:108,low:95,close:107,volume:400000};
 for(let j=70;j<y.v11.length;j++)y.v11[j]={...y.v11[j],direction:-1};
 assert.deepEqual(evalCase(y)[0],a);
});
test('Zero events are reported as empty cohorts rather than success rates',()=>{
 const bars=candles();
 const r=analyzeLatencyWindows([{candles:bars}]);
 assert.equal(r.cleanWindows,1);
 assert.equal(r.events.length,0);
 assert.equal(r.cohorts['later|LONG'].counterFlips,0);
 assert.equal(r.cohorts['earlier|SHORT'].meanEntryGapPct,null);
});
test('Full Bitunix public fetch interface is injectible and never creates orders',async()=>{
 const calls=[];
 const provider=async({symbol,interval,startTime,endTime})=>{
  calls.push({symbol,interval});
  return Array.from({length:(endTime-startTime)/H},(_,i)=>({
   time:startTime+i*H,open:100,high:101,low:99,close:100,volume:100}));
 };
 const r=await runLatencyAudit({fetchPage:provider});
 assert.equal(r.status,'HISTORICAL_COMPLETE');
 assert.equal(r.results.length,3);
 assert.ok(r.results.every(x=>x.audit.events.length===0));
 assert.ok(calls.every(x=>x.interval==='1h'));
});
