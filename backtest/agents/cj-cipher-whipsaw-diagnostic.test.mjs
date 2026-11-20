import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateCjCipherWaveTrend,cjCipherConfirmedCommands}
 from './cj-cipher-wavetrend-v1.mjs';
import {diagnoseCjCipherPhase,CIPHER_DIAGNOSIS_LOCK}
 from './cj-cipher-whipsaw-diagnostic.mjs';
const H=3600000,T=Date.UTC(2026,8,1);
function fixture(n=960){
 let previous=100;
 return Array.from({length:n},(_,i)=>{
  const open=previous,delta=.65*Math.sin(i*.3)+.4*Math.sin(i*.091)+
   (i%73===0?2.5:0);
  const close=Math.max(40,open+delta);
  const high=Math.max(open,close)+.15;
  const low=Math.min(open,close)-.15;
  previous=close;
  return {time:T+i*H,open,high,low,close,volume:1000+i};
 });
}
const bars=fixture(),wave=calculateCjCipherWaveTrend(bars);
const commands=cjCipherConfirmedCommands(wave),market={
 exchange:'Bitunix',priceType:'LAST_PRICE',
 symbol:'BTCUSDT',timeframe:'1h'
};
const base={initialCapital:1000,feeRate:.0006,slippageRate:.0005,allocation:1};
const study=({phase='training',prices=bars,signals=commands,costs=base}={})=>{
 const waves=calculateCjCipherWaveTrend(prices);
 const offset=phase==='training'?0:672;
 const part=phase==='training'?prices.slice(0,672):prices.slice(672);
 return diagnoseCjCipherPhase({
  bars:part,wholeSourceSignals:signals,
  phase,market,costs,sourceWarmup:waves.slice(offset,offset+part.length)
 });
};
test('locked signal diagnosis is fixed, observational and not a new strategy',()=>{
 assert.equal(CIPHER_DIAGNOSIS_LOCK.selectionOfNewParameters,false);
 assert.deepEqual(CIPHER_DIAGNOSIS_LOCK.rapidReversalBars,[3,6]);
 assert.equal(CIPHER_DIAGNOSIS_LOCK.runId,44656240484);
});
test('replays a full one-position portfolio, including end-of-phase exit',()=>{
 const out=study();
 assert.equal(out.phase,'training');
 assert.equal(out.realizedTradeCount,out.details.length);
 assert.ok(out.realizedTradeCount>0);
 assert.ok(out.sourceSignals>=out.realizedTradeCount);
 assert.ok(out.netWinners+out.netLosers<=out.realizedTradeCount);
 assert.equal(out.directionalGroups.long.count+out.directionalGroups.short.count,
  out.realizedTradeCount);
 assert.equal(out.waveReferenceGroups.favorableExtreme.count+
  out.waveReferenceGroups.otherZone.count,out.realizedTradeCount);
 assert.equal(out.finalBarForcedExits,1);
 assert.ok(out.details.every(x=>x.holdBars>=0&&
  Date.parse(x.entryUtc)>Date.parse(x.signalUtc)));
 assert.ok(out.details.every(x=>x.exitUtc>=x.entryUtc));
 assert.equal(out.rapidOpposite3<=out.rapidOpposite6,true);
 assert.equal(out.rapidOpposite6<=out.realizedTradeCount,true);
 assert.equal(out.tradingEnabled,undefined);
});
test('no future bars in confirmation and holdout starts flat by itself',()=>{
 const out=study({phase:'holdout'});
 assert.equal(out.sourceLastBarTimeUtc,
  new Date(bars.at(-1).time).toISOString());
 assert.ok(out.details.every(x=>Date.parse(x.entryUtc)>bars[672].time));
 const modified=bars.map((x,i)=>i<930?{...x}:
  {...x,close:x.open+2,high:Math.max(x.open,x.open+2)+.3,
   low:x.open-.3});
 const left=study({prices:bars});
 const right=study({
  prices:modified,
  signals:cjCipherConfirmedCommands(calculateCjCipherWaveTrend(modified))
 });
 assert.deepEqual(left.details,right.details);
});
test('friction scenario can be changed without changing raw crossing times',()=>{
 const a=study(),b=study({costs:{
  ...base,feeRate:.001,slippageRate:.002
 }});
 assert.equal(a.sourceSignals,b.sourceSignals);
 assert.equal(a.realizedTradeCount,b.realizedTradeCount);
 assert.deepEqual(a.details.map(x=>x.signalUtc),
  b.details.map(x=>x.signalUtc));
 assert.deepEqual(a.details.map(x=>x.rawDirectionalPct),
  b.details.map(x=>x.rawDirectionalPct));
 assert.ok(b.simulatedReturnPct<=a.simulatedReturnPct);
});
test('malformed evidence and duplicate command timestamps fail closed',()=>{
 assert.throws(()=>study({signals:[...commands,commands[0]]}),/Noncausal/);
 assert.throws(()=>study({phase:'unknown'}),/Invalid fixed/);
 const invalid=structuredClone(bars);
 invalid[200].time+=H;
 assert.throws(()=>study({prices:invalid}),/Non-continuous|Invalid or unordered/);
 assert.throws(()=>diagnoseCjCipherPhase({
  bars:bars.slice(0,672),wholeSourceSignals:commands,phase:'training',
  market:{...market,exchange:'Unverified'},costs:base
 }),/Invalid fixed/);
});
