import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluatePairedCleanWindows,runHistoricalMomentumVector,COMPARISON_LOCK}
 from './momentum-vector-paired-gate.mjs';
import {FORWARD_LOCK} from './vector-forward-v11-v14.mjs';
const H=3600000,END=Date.parse(FORWARD_LOCK.earliestSignalTime);
function historical(n=400,step=H,start=END-400*step){
 let prev=100;
 return Array.from({length:n},(_,i)=>{
  let change=0.18*Math.sin(i*.19)+0.15*Math.sin(i*.049);
  const impulse=i>25&&i%23===0;
  if(impulse)change+=i%46===0?3.7:-3.7;
  const open=prev,close=Math.max(15,open+change);
  const width=impulse?.08:.5;
  const b={time:start+i*step,open,close,
   high:Math.max(open,close)+width,
   low:Math.min(open,close)-width,
   volume:impulse?9000:200+(i%5)*10};
  prev=close;return b;
 });
}
test('Pre-registered gate and costs match locked risk; end excludes entire prospect',()=>{
 assert.deepEqual(COMPARISON_LOCK.models,['Vector V1.1','Vector V1.4']);
 assert.equal(COMPARISON_LOCK.gatesPresetBeforeData,true);
 assert.equal(COMPARISON_LOCK.mandatoryWarmupBars,168);
 assert.equal(COMPARISON_LOCK.minimumContinuousBars,180);
 assert.equal(COMPARISON_LOCK.feePerSide,FORWARD_LOCK.feePerSide);
 assert.equal(COMPARISON_LOCK.slippagePerSide,FORWARD_LOCK.slippagePerSide);
 assert.equal(COMPARISON_LOCK.endExclusive,FORWARD_LOCK.earliestSignalTime);
});
test('No post-forward OHLC or signal/exit accepted in historical branch',()=>{
 assert.throws(()=>evaluatePairedCleanWindows([],{endExclusive:END+H}),/post-forward/);
 const future=historical(210,H,END-190*H);
 const r=evaluatePairedCleanWindows([future],{endExclusive:END});
 assert.equal(r.usedWindows,0);
 assert.equal(r.skippedInvalid,1);
});
test('Signal pairing accounts for accepted/rejected and CENSORED outcomes without invented trades',()=>{
 const bars=historical(400,H,END-400*H);
 const r=evaluatePairedCleanWindows([bars],{endExclusive:END});
 assert.equal(r.usedWindows,1);
 for(const [name,model] of Object.entries(r.models)){
  assert.equal(model.all.events,
   model.accepted.events+model.rejected.events+model.unavailable.events,name);
  assert.equal(model.all.closed,
   model.accepted.closed+model.rejected.closed+model.unavailable.closed);
  assert.equal(model.all.events,model.events.length);
  assert.ok(model.events.every(e=>Date.parse(e.signalUtc)<END));
  assert.ok(model.events.every(e=>e.exitUtc===null||Date.parse(e.exitUtc)<END));
  assert.ok(model.events.every(e=>e.entryUtc===null||Date.parse(e.entryUtc)<END));
  assert.ok(model.events.every(e=>e.hypotheticalNetPct===null||
   Number.isFinite(e.hypotheticalNetPct)));
 }
 assert.ok(r.models['Vector V1.1'].all.events>0,
  'Oscillating synthetic impulses should create Vector V1.1 signals');
});
test('Changing subsequent candles never changes earlier Momentum decision or signal timing',()=>{
 const bars=historical(400,H,END-400*H);
 const original=evaluatePairedCleanWindows([bars],{endExclusive:END});
 const adjusted=bars.map((b,i)=>i<380?{...b}:
  {...b,volume:10000,close:b.open+3,high:b.open+3.2,low:b.open-.2});
 const changed=evaluatePairedCleanWindows([adjusted],{endExclusive:END});
 for(const model of COMPARISON_LOCK.models){
  const earlier=x=>x.models[model].events.filter(e=>Date.parse(e.signalUtc)<END-20*H)
   .map(({signalUtc,side,verdict,momentumComposite})=>
    ({signalUtc,side,verdict,momentumComposite}));
  assert.deepEqual(earlier(original),earlier(changed));
 }
});
test('No hidden exchange fallback and no future fetch past frozen start',async()=>{
 const seen=[];
 const provider=async({symbol,interval,startTime,endTime,limit})=>{
  seen.push({symbol,interval,startTime,endTime,limit});
  const step=interval==='1h'?H:4*H;
  const bars=historical((endTime-startTime)/step,step,startTime);
  return bars;
 };
 const result=await runHistoricalMomentumVector({fetchPage:provider,
  instruments:['BTCUSDT'],timeframes:['1h','4h']});
 assert.equal(result.status,'EXPLORATORY_HISTORICAL_READY');
 assert.equal(result.results.length,2);
 assert.ok(seen.length>0);
 assert.ok(seen.every(x=>x.endTime<=END&&x.limit===200));
 assert.ok(result.results.every(x=>x.status==='ANALYZED'));
 assert.ok(result.results.every(x=>x.report.cutoffUtc==='2026-10-28T00:00:00.000Z'));
});
test('Reject continuous-window stitching across invalid OHLC, preserve exclusions',async()=>{
 const provider=async({interval,startTime,endTime})=>{
  const step=interval==='1h'?H:4*H;
  return historical((endTime-startTime)/step,step,startTime).map(b=>
   Math.floor(b.time/step)%39===0?{...b,high:0}:{...b});
 };
 const result=await runHistoricalMomentumVector({fetchPage:provider,
  instruments:['ETHUSDT'],timeframes:['1h']});
 assert.equal(result.status,'NO_ELIGIBLE_HISTORY');
 assert.equal(result.results[0].status,'DATA_QUARANTINED');
 assert.ok(result.results[0].issues>0);
 assert.equal(result.results[0].report.usedWindows,0);
});
