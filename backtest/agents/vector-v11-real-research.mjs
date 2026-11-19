/*
 * Vector AIT V1.1 — causal research-only adapter for Bitunix CLOSED candles.
 * OHLC must already pass provenance/correction/continuity and double-read gates.
 * Price step must be EXPLICIT official Bitunix contract metadata; note that
 * this is not independently verified against TradingView syminfo.mintick.
 * No orders, no trading keys, no production deployment.
 */
import {classifyHistory,requireCleanHistory} from '../quality-gate.mjs';
import {vectorAIT} from '../vector-ait-v1.mjs';
import {runFixedHoldout} from './fixed-holdout.mjs';

const DEFAULT_COSTS=Object.freeze({initialCapital:1000,feeRate:0.0006,
  slippageRate:0.0005,allocation:1});
const CORE_FIELDS=Object.freeze(['signal','direction','bullishVector','bearishVector','exit']);

export function auditRealVectorV11({
  source,repeatability,contract,
  costs=DEFAULT_COSTS
}={}){
 if(source?.status!=='DATA_READY_FOR_RESEARCH_ONLY' ||
    repeatability?.status!=='STABLE_TWO_READS' ||
    repeatability.checkedDerived!==24 ||
    !source.provenance?.formingBarExcluded ||
    source.provenance.priceType!=='LAST_PRICE')
   throw Error('Vector requires stable, closed, provenanced Bitunix OHLC');
 const market=source.market,window=source.historyWindow,bars=source.acceptedCandles;
 if(!market||!window||!Array.isArray(bars)||bars.length<160 ||
    !contract||contract.symbol!==market.symbol ||
    contract.source!=='BITUNIX_PUBLIC_TRADING_PAIRS' ||
    contract.stepStatus!=='RESEARCH_PRICE_PRECISION_NOT_TV_MINTICK' ||
    !Number.isInteger(contract.quotePrecision) ||
    contract.priceStep!==10**(-contract.quotePrecision) ||
    !Number.isFinite(contract.priceStep)||contract.priceStep<=0)
   throw Error('Missing/unsupported verified-price-precision research contract or candles');
 const clean=requireCleanHistory(classifyHistory(bars,window));
 if(clean.length!==bars.length)throw Error('Inconsistent Vector historical data');
 const events=vectorAIT(clean,{minTick:contract.priceStep});
 if(events.length!==clean.length)throw Error('Incomplete Vector observations');
 const cuts=new Set([20,40,80,120,160,240,360,clean.length-1]);
 for(let i=0;i<events.length;i++)if(events[i].signal!==null)cuts.add(i+1);
 let prefixChecks=0;
 for(const cut of [...cuts].sort((a,b)=>a-b)){
   if(cut<20||cut>clean.length)continue;
   const prefix=vectorAIT(clean.slice(0,cut),{minTick:contract.priceStep});
   const expected=events[cut-1],observed=prefix.at(-1);
   if(CORE_FIELDS.some(f=>observed[f]!==expected[f])||observed.time!==expected.time)
     throw Error('Vector non-causal/repaint result at closed bar '+String(cut-1));
   prefixChecks++;
 }
 const allEvents=events.filter(x=>x.signal==='long'||x.signal==='short')
   .map(x=>({
     confirmationBarOpenMs:x.time,
     confirmedAtCloseMs:x.time+window.intervalMs,
     actionAllowedAtNextOpenMs:x.time+window.intervalMs,
     side:x.signal,
     executionPossible:x.time+window.intervalMs<window.endTime
   }));
 const executable=allEvents.filter(x=>x.executionPossible)
  .map(x=>({time:x.confirmationBarOpenMs,side:x.side}));
 const droppedFinal=allEvents.filter(x=>!x.executionPossible);
 const holdoutStartTime=window.startTime+
    Math.floor(clean.length*0.7)*window.intervalMs;
 const evaluation=runFixedHoldout({
   market,historyWindow:window,candles:clean,holdoutStartTime,
   experiments:[{id:'vector_v11',signalTimeConvention:'confirmation-bar-open',
     indicatorParity:'UNVERIFIED',signals:executable}],
   costs
 });
 return {
   protocol:'CJ_BITUNIX_VECTOR_V11_RESEARCH_V1',
   status:'RESEARCH_ONLY_UNVERIFIED_TV_PARITY',
   market,evaluatedClosedBars:clean.length,
   dataProvenance:{
     rawSha256:source.provenance.rawSha256,
     derivedSha256:source.provenance.derivedSha256,
     normalizationVersion:source.provenance.normalizationVersion,
     repeatability:repeatability.status,
     metadataSource:contract.source,
     quotePrecision:contract.quotePrecision,
     assumedPineMinTick:contract.priceStep,
     tvMinTickIndependentlyVerified:false
   },
   noLookaheadSampledPrefixes:prefixChecks,
   signalCount:allEvents.length,
   executableSignalCount:executable.length,
   finalBarSignalsNotExecutable:droppedFinal.length,
   signalEvents:allEvents,
   researchSimulation:{
     costs,indicatorParity:'UNVERIFIED',
     periodSplit:holdoutStartTime,
     training:evaluation.training.vector_v11,
     holdout:evaluation.holdout.vector_v11,
     droppedAtBoundary:evaluation.droppedAtBoundary
   },
   warning:[
     'Vector V1.1 is a local JavaScript port, not TradingView runtime-verified.',
     'Bitunix quotePrecision is not independently verified as TradingView syminfo.mintick.',
     'Historical closed-candle causality sampled; no forward/lifecycle/backtest profitability proof.',
     'Fixed 70/30 split and simulated fees/slippage are research assumptions, not trading results.',
     'Never use this report as investment advice or live trading permission.'
   ]
 };
}
