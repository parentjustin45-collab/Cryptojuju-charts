import test from 'node:test';
import assert from 'node:assert/strict';
import {auditRealVectorV11} from './vector-v11-real-research.mjs';
const step=900000,time0=Date.UTC(2026,10,1);
const bars=Array.from({length:180},(_,i)=>({
  time:time0+i*step,
  open:100,close:100,high:101,low:99,volume:100
}));
bars[30]={...bars[30],open:100,close:109,high:110,low:99,volume:10000};
bars[45]={...bars[45],open:109,close:99,high:110,low:98,volume:10000};
const window={startTime:time0,endTime:time0+bars.length*step,intervalMs:step};
const source={
 status:'DATA_READY_FOR_RESEARCH_ONLY',
 market:{exchange:'Bitunix',symbol:'BTCUSDT',priceType:'LAST_PRICE',timeframe:'15m'},
 historyWindow:window,acceptedCandles:bars,
 provenance:{formingBarExcluded:true,priceType:'LAST_PRICE',rawSha256:'a',derivedSha256:'b',
   normalizationVersion:'bitunix-open-envelope-v1'}
};
const repeatability={
 status:'STABLE_TWO_READS',checkedDerived:bars.length,
 market:{exchange:'Bitunix',symbol:'BTCUSDT',timeframe:'15m'},
 historyWindow:{startTime:window.endTime-bars.length*step,endTime:window.endTime,intervalMs:step},
 firstRawSha256:'a',overlapRawSha256First:'matching',overlapRawSha256Second:'matching',
 differenceCount:0
};
const contract={symbol:'BTCUSDT',quotePrecision:1,priceStep:0.1,
 source:'BITUNIX_PUBLIC_TRADING_PAIRS',
 stepStatus:'RESEARCH_PRICE_PRECISION_NOT_TV_MINTICK'};
const run=(p={})=>auditRealVectorV11({source,repeatability,contract,...p});
test('known Vector V1.1 closed-candle signals are timed for next OPEN, not backdated',()=>{
 const a=run();
 assert.equal(a.status,'RESEARCH_ONLY_UNVERIFIED_TV_PARITY');
 assert.equal(a.evaluatedClosedBars,180);
 assert.ok(a.noLookaheadSampledPrefixes>=7);
 assert.ok(a.signalEvents.some(s=>s.side==='long'&&s.confirmationBarOpenMs===bars[30].time));
 assert.ok(a.signalEvents.some(s=>s.side==='short'&&s.confirmationBarOpenMs===bars[45].time));
 assert.ok(a.signalEvents.every(s=>s.confirmedAtCloseMs===s.confirmationBarOpenMs+step));
 assert.equal(a.dataProvenance.tvMinTickIndependentlyVerified,false);
 assert.equal(a.researchSimulation.holdout.indicatorParity,'UNVERIFIED');
});
test('last closed signal is logged but never ordered without a next candle',()=>{
 const last=bars.map(x=>({...x}));
 last[last.length-1]={...last.at(-1),open:100,close:109,high:110,low:99,volume:10000};
 const a=run({source:{...source,acceptedCandles:last}});
 assert.equal(a.finalBarSignalsNotExecutable,1);
 assert.equal(a.signalEvents.at(-1).executionPossible,false);
 assert.ok(a.signalEvents.every(s=>s.executionPossible||s.actionAllowedAtNextOpenMs===window.endTime));
 assert.equal(a.executableSignalCount,a.signalEvents.filter(s=>s.executionPossible).length);
});
test('blocked, unchecked or incomplete Bitunix source cannot emit Vector signals',()=>{
 assert.throws(()=>run({source:{...source,status:'BLOCKED'}}),/requires stable/);
 assert.throws(()=>run({repeatability:{...repeatability,status:'BLOCKED'}}),/requires stable/);
 assert.throws(()=>run({source:{...source,acceptedCandles:bars.slice(0,100)}}),/requires stable/);
 const invalid=bars.map(x=>({...x}));invalid[110].low=invalid[110].open+10;
 assert.throws(()=>run({source:{...source,acceptedCandles:invalid}}),/Backtest blocked/);
});
test('Bitunix price precision must be explicit and cannot claim Pine mintick parity',()=>{
 assert.throws(()=>run({contract:undefined}),/price-precision/);
 assert.throws(()=>run({contract:{...contract,priceStep:0.001}}),/price-precision/);
 assert.throws(()=>run({contract:{...contract,source:'GUESS'}}),/price-precision/);
});

test('readback evidence from another symbol, price series or time window is refused',()=>{
 assert.throws(()=>run({repeatability:{...repeatability,
   market:{...repeatability.market,symbol:'ETHUSDT'}}}),/does not belong/);
 assert.throws(()=>run({repeatability:{...repeatability,
   firstRawSha256:'not-the-source-sha'}}),/does not belong/);
 assert.throws(()=>run({repeatability:{...repeatability,
   historyWindow:{...repeatability.historyWindow,endTime:repeatability.historyWindow.endTime+step}}}),/does not belong/);
 assert.throws(()=>run({repeatability:{...repeatability,
   overlapRawSha256Second:'different'}}),/does not belong/);
});
