/*
 * Vector AIT V1.2 experimental comparison, no TradingView dependencies.
 * Uses only CLOSED/provenanced Bitunix research candles, metadata and stable
 * repeatability verification already required by V1.1.
 *
 * Original V1.1 remains unchanged. V1.2 modes are candidate entry filters;
 * they may delay or reject entries, and are NOT proven superior.
 * Shared 70/30 chronological split; baseline and variants use identical
 * costs and independent fresh capital for each period. No auto-promotion.
 */
import {vectorAIT} from '../vector-ait-v1.mjs';
import {applyVectorConfirmation,VECTOR_CONFIRMATION_MODES} from '../vector-antiwhipsaw-v12.mjs';
import {runFixedHoldout} from './fixed-holdout.mjs';
import {auditRealVectorV11} from './vector-v11-real-research.mjs';

const COSTS=Object.freeze({initialCapital:1000,feeRate:0.0006,slippageRate:0.0005,allocation:1});
const FIELDS=Object.freeze(['time','signal','direction','sourceIndex','delayBars']);

export function compareVectorV12Candidates({
 source,repeatability,contract,costs=COSTS
}={}){
 // Includes strict source identity, CLOSED times, SHA-256 provenance,
 // double-read match, valid OHLC and V1.1 sampled causality checks.
 const reference=auditRealVectorV11({source,repeatability,contract,costs});
 const bars=source.acceptedCandles,window=source.historyWindow,market=source.market;
 const tick=contract.priceStep;
 const baseline=vectorAIT(bars,{minTick:tick});
 const splitAt=window.startTime+Math.floor(bars.length*0.7)*window.intervalMs;
 const experiments=[],modes=[],prefixCuts=new Set([25,60,120,180,240,360,bars.length]);
 for(const cfg of VECTOR_CONFIRMATION_MODES){
   const transformed=applyVectorConfirmation(bars,baseline,cfg.id);
   const events=transformed.events;
   if(events.length!==bars.length)throw Error('V1.2 candidate did not preserve bar count');
   if(cfg.id==='baseline_v11'){
     for(let i=0;i<events.length;i++)
       if(events[i].signal!==baseline[i].signal||events[i].time!==baseline[i].time)
         throw Error('V1.1 reference changed unexpectedly');
   }
   const signals=[],delayed=[];
   for(let i=0;i<events.length;i++){
     const event=events[i];
     if(!event.signal)continue;
     if(!['long','short'].includes(event.signal)||
        !Number.isInteger(event.sourceIndex)||event.sourceIndex>i||
        !Number.isInteger(event.delayBars)||event.delayBars!==i-event.sourceIndex||
        event.delayBars<0||event.delayBars>cfg.window||event.time!==bars[i].time)
       throw Error('Invalid V1.2 confirmation time or delayed signal');
     prefixCuts.add(i+1);
     delayed.push({
       side:event.signal,
       detectedBarOpenMs:bars[event.sourceIndex].time,
       confirmedBarOpenMs:event.time,
       confirmedAtCloseMs:event.time+window.intervalMs,
       hypotheticalEntryOpenMs:event.time+window.intervalMs,
       delayBars:event.delayBars,
       executable:i<bars.length-1
     });
     if(i<bars.length-1)signals.push({time:event.time,side:event.signal});
   }
   modes.push({mode:cfg.id,signalCount:delayed.length,
     signalsNotExecutable:delayed.length-signals.length,
     confirmationDiagnostics:transformed.diagnostics,
     preview:delayed.slice(0,8)});
   experiments.push({
     id:cfg.id,signalTimeConvention:'confirmation-bar-open',
     indicatorParity:'UNVERIFIED',signals
   });
 }
 // Full-series outputs must be invariant when future candles are removed.
 // Samples include every event confirmation and several fixed positions.
 let prefixChecks=0;
 const full=Object.fromEntries(VECTOR_CONFIRMATION_MODES.map(c=>[
   c.id,applyVectorConfirmation(bars,baseline,c.id).events
 ]));
 for(const cut of [...prefixCuts].sort((a,b)=>a-b)){
   if(cut<22||cut>bars.length)continue;
   const shorter=bars.slice(0,cut),raw=vectorAIT(shorter,{minTick:tick});
   for(const cfg of VECTOR_CONFIRMATION_MODES){
     const sliced=applyVectorConfirmation(shorter,raw,cfg.id).events.at(-1);
     const original=full[cfg.id][cut-1];
     if(FIELDS.some(field=>sliced[field]!==original[field]))
       throw Error('V1.2 signal changed with future candles at prefix '+cut+' in '+cfg.id);
     prefixChecks++;
   }
 }
 const evaluation=runFixedHoldout({
   market,historyWindow:window,candles:bars,
   experiments,costs,holdoutStartTime:splitAt
 });
 const baselineId='baseline_v11';
 const one=evaluation.training[baselineId],two=reference.researchSimulation.training;
 const three=evaluation.holdout[baselineId],four=reference.researchSimulation.holdout;
 for(const key of ['signalCount','tradeCount','returnPct','netProfit','maxDrawdownPct','finalCapital']){
   if(one[key]!==two[key]||three[key]!==four[key])
     throw Error('Vector V1.1 reproducibility mismatch: '+key);
 }
 return {
   protocol:'CJ_VECTOR_V12_BITUNIX_ISOLATED_COMPARISON_V1',
   status:'CANDIDATES_EVALUATED_RESEARCH_ONLY',
   market,
   reference:'Vector V1.1 unchanged',
   sourceRawSha256:source.provenance.rawSha256,
   sourceDerivedSha256:source.provenance.derivedSha256,
   repeatedRead:repeatability.status,
   priceStep:tick,
   splitAtUtc:new Date(splitAt).toISOString(),
   closedBars:bars.length,
   noLookaheadPrefixChecks:prefixChecks,
   modes,
   results:{
     training:evaluation.training,
     holdout:evaluation.holdout,
     droppedAtBoundary:evaluation.droppedAtBoundary
   },
   baselineReproduced:true,
   promotedVariant:null,
   checks:{
     noAutomaticSelection:true,
     independentTradingViewParity:false,
     researchOnly:true,
     noRealTrades:true,
     fixedCapitalPerCandidate:true,
     sameSimulationCostsForAll:true
   },
   warnings:[
     'Entry confirmation modes are V1.2 EXPLORATORY, not established improvements.',
     'Do not rank or promote variants using this already-inspected 70/30 history as a fresh independent holdout.',
     'Several variants may have too few holdout trades; future prospective time windows are needed.',
     'Closed-bar/next-open backtest with modeled fees and slippage; no TradingView accuracy target.',
     'A side-only strategy may remain idle, and delayed entries can miss valid moves.',
     'Zero trading, zero deploys, no payment required.'
   ]
 };
}
