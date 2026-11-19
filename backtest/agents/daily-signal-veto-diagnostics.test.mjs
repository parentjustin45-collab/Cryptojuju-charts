import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnoseDailyVetoedSignals,FORWARD_SIGNAL_HORIZONS}
 from './daily-signal-veto-diagnostics.mjs';
import {filterVectorAgainstCompletedDaily}
 from './vector-daily-intraday-alignment.mjs';
const H=3600000,T=Date.UTC(2026,10,19,2);
const closes=[100,101,102,104,106,108,109,111];
const candles=closes.map((c,i)=>({
 time:T+i*H,open:c-1,close:c,high:c+1,low:c-2,volume:100
}));
const signal=(i,vectorSide,reason,accepted,neutralPolicy='block')=>({
 neutralPolicy,confirmedBarOpenMs:candles[i].time,
 signalConfirmedAtMs:candles[i].time+H,entryAllowedAtMs:candles[i+1].time,
 dailyClosedAtMs:Date.UTC(2026,10,19),vectorSide,reason,accepted
});
test('rejected opposite LONG can have positive future movement, not automatically a bad signal',()=>{
 const obs=[signal(0,'long','daily_opposed',false)];
 const r=diagnoseDailyVetoedSignals({
  bars:candles,observations:obs,intervalMs:H,horizons:[3,6]
 });
 assert.equal(r.observedSignalCount,1);
 const first=r.groupsByHorizon[3].rejected_opposed;
 assert.equal(first.eligibleOutcomeBars,1);
 assert.equal(first.positiveDirectionalCloseMoves,1);
 assert.ok(first.meanDirectionalCloseChangePct>0);
 assert.ok(first.meanMaxFavorableExcursionPct>0);
 assert.ok(first.meanMaxAdverseExcursionPct>=0);
 assert.equal(first.sampleGate,'INSUFFICIENT_SAMPLE');
 assert.equal(r.simulationPnl,false);
 assert.equal(r.feesApplied,false);
 assert.equal(r.futureUsedForDecisions,false);
});
test('short and long directional outcomes differ, censoring stays explicit',()=>{
 const obs=[
  signal(0,'long','daily_opposed',false),
  signal(2,'short','aligned',true),
  signal(4,'long','mixed_allowed',true,'allow_mixed'),
  signal(6,'long','daily_mixed_or_warmup',false)
 ];
 const r=diagnoseDailyVetoedSignals({
  bars:candles,observations:obs,intervalMs:H,horizons:[3,6]
 });
 assert.deepEqual(FORWARD_SIGNAL_HORIZONS,[3,6,12]);
 assert.equal(r.groupsByHorizon[3].accepted_aligned.negativeDirectionalCloseMoves,1);
 assert.equal(r.groupsByHorizon[3].accepted_mixed.positiveDirectionalCloseMoves,1);
 assert.equal(r.groupsByHorizon[3].rejected_neutral.censoredNearEnd,1);
 assert.equal(r.groupsByHorizon[3].rejected_neutral.eligibleOutcomeBars,0);
 assert.equal(r.groupsByHorizon[3].rejected_neutral.meanDirectionalCloseChangePct,null);
 assert.equal(r.groupsByHorizon[6].accepted_mixed.censoredNearEnd,1);
 assert.equal(r.groupsByHorizon[6].rejected_opposed.eligibleOutcomeBars,1);
});
test('causal production gate observations flow into outcomes without changing decisions',()=>{
 const events=candles.map((b,i)=>({time:b.time,
   signal:i===0?'long':i===2?'short':i===4?'long':null}));
 const dailyIndex=[{closedAt:Date.UTC(2026,10,19),side:'long',regime:'bull_stack'}];
 const opts={lowerBars:candles,events,dailyIndex,intervalMs:H};
 const filtered=filterVectorAgainstCompletedDaily(opts);
 const before=JSON.stringify(filtered.signals);
 const r=diagnoseDailyVetoedSignals({
  bars:candles,observations:filtered.observations,intervalMs:H,horizons:[3]
 });
 assert.equal(r.observedSignalCount,3);
 assert.equal(JSON.stringify(filtered.signals),before);
 assert.equal(r.groupsByHorizon[3].rejected_opposed.observedSignals,1);
 assert.equal(r.groupsByHorizon[3].accepted_aligned.observedSignals,2);
});
test('unsafe timestamps, duplicate events, malformed OHLC and future Daily are blocked',()=>{
 const original=signal(0,'long','daily_opposed',false);
 const args={bars:candles,observations:[original],intervalMs:H,horizons:[3]};
 assert.throws(()=>diagnoseDailyVetoedSignals({
  ...args,observations:[original,original]
 }),/Unsafe/);
 assert.throws(()=>diagnoseDailyVetoedSignals({
  ...args,observations:[{...original,entryAllowedAtMs:original.entryAllowedAtMs+H}]
 }),/Unsafe/);
 assert.throws(()=>diagnoseDailyVetoedSignals({
  ...args,observations:[{...original,dailyClosedAtMs:original.signalConfirmedAtMs}]
 }),/Unsafe/);
 assert.throws(()=>diagnoseDailyVetoedSignals({
  ...args,bars:[...candles.slice(0,4),{...candles[4],time:candles[4].time+H},...candles.slice(5)]
 }),/Malformed/);
 assert.throws(()=>diagnoseDailyVetoedSignals({
  ...args,horizons:[6,3]
 }),/Invalid/);
});
