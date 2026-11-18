import test from 'node:test';
import assert from 'node:assert/strict';
import {runBacktest} from './engine.mjs';
const STEP=900000;
const bars=[
 {time:0,open:100,high:105,low:95,close:100,volume:10},
 {time:STEP,open:100,high:99.9,low:95,close:97,volume:12},
 {time:2*STEP,open:97,high:101,low:96,close:100,volume:13}
];
const historyWindow={startTime:0,endTime:3*STEP,intervalMs:STEP};
test('Default strict historical engine STILL rejects malformed Bitunix OHLC',()=>{
 assert.throws(()=>runBacktest(bars,[],{historyWindow}),/blocked/);
});
test('Explicit Bitunix research mode can derive auditable OHLC without mutating source',()=>{
 const raw=JSON.stringify(bars);
 const r=runBacktest(bars,[],{historyWindow,sourceExchange:'Bitunix',
  bitunixOpenEnvelopeResearch:true});
 assert.equal(r.tradeCount,0);
 assert.equal(r.assumptions.derivedOhlcResearch.correctedBars,1);
 assert.equal(r.assumptions.derivedOhlcResearch.researchOnly,true);
 assert.equal(JSON.stringify(bars),raw);
});
test('Derivation cannot be silently switched on for other exchanges',()=>{
 for(const option of [
  {bitunixOpenEnvelopeResearch:true,historyWindow},
  {bitunixOpenEnvelopeResearch:true,sourceExchange:'Bitunix'},
  {bitunixOpenEnvelopeResearch:true,sourceExchange:'Binance',historyWindow}
 ]) assert.throws(()=>runBacktest(bars,[],option),/requires/);
});
test('Invalid opening continuity still blocks even when research option is set',()=>{
 const wrong=[bars[0],{...bars[1],open:101},bars[2]];
 assert.throws(()=>runBacktest(wrong,[],{historyWindow,sourceExchange:'Bitunix',
  bitunixOpenEnvelopeResearch:true}),/blocked/);
});
test('Live trading is never enabled by OHLC research option',()=>{
 const r=runBacktest(bars,[],{historyWindow,sourceExchange:'Bitunix',
  bitunixOpenEnvelopeResearch:true});
 assert.equal(r.assumptions.derivedOhlcResearch.researchOnly,true);
 assert.equal(r.finalCapital,100);
});
