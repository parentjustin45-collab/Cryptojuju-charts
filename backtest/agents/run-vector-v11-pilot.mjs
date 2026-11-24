/*
 * After read-only Bitunix ingestion, observe actual Vector V1.1 signals
 * on accepted closed candles and simulate next-open historical fills.
 * Zero orders, zero tokens, zero production effects.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {PILOT_SYMBOLS,PILOT_TIMEFRAMES} from './bitunix-data-pilot.mjs';
import {FIVE_CRYPTO_SYMBOLS,FIVE_TIMEFRAMES,isFiveByFive} from './render/five-by-five.mjs';
import {readBitunixContractPrecision} from './bitunix-contract-precision.mjs';
import {auditRealVectorV11} from './vector-v11-real-research.mjs';
import {compareVectorV12Candidates} from './vector-v12-real-comparison.mjs';
import {summarizeVectorV12Comparison,renderVectorV12ScoreboardMarkdown} from './vector-v12-scoreboard.mjs';
import {diagnoseVectorV12Timing,renderVectorTimingDiagnosticsMarkdown} from './vector-v12-timing-diagnostics.mjs';
import {diagnoseVectorMarketRegimes,formatVectorRegimesMarkdown} from './vector-market-regimes.mjs';

const folder=resolve(process.argv[2]??'bitunix-data-pilot-report');
const expanded=isFiveByFive();
const symbols=expanded?FIVE_CRYPTO_SYMBOLS:PILOT_SYMBOLS;
const timeframes=expanded?FIVE_TIMEFRAMES:PILOT_TIMEFRAMES;
const summary={
 protocol:'CJ_REAL_BITUNIX_VECTOR_V11_UNVERIFIED_RESEARCH_V1',
 runUtc:new Date().toISOString(),
 cohort:expanded?'FIVE_BY_FIVE':'LEGACY_3X3',
 expectedCases:symbols.length*timeframes.length,
 officialExchangeMetadata:true,
 independentTradingViewParity:false,
 tradingEnabled:false,
 continuousService:false,
 cases:[]
};
const scorecards=[];
const timingReports=[];
const regimeReports=[];
let contracts;
try {
 const metadata=await readBitunixContractPrecision({symbols});
 contracts=metadata.contracts;
 await writeFile(resolve(folder,'vector-v11-contract-precision.json'),
  JSON.stringify(metadata,null,2)+'\n');
}catch(e){
 summary.metadataError=String(e?.message??e);
 contracts=[];
}
for(const symbol of symbols){
 for(const timeframe of timeframes){
   const id=`${symbol}-${timeframe}`;
   let result;
   try{
     const source=JSON.parse(await readFile(resolve(folder,`${id}.json`),'utf8'));
     const repeatability=JSON.parse(await readFile(resolve(folder,`${id}-repeatability.json`),'utf8'));
     const contract=contracts.find(x=>x.symbol===symbol);
     result=auditRealVectorV11({source,repeatability,contract});
   }catch(e){
     result={protocol:'CJ_BITUNIX_VECTOR_V11_RESEARCH_V1',
       status:'BLOCKED',market:{symbol,timeframe},
       reason:String(e?.message??e),signalEvents:[],
       warning:'No Vector research signals are authorized on this blocked configuration.'};
   }
   await writeFile(resolve(folder,`${id}-vector-v11.json`),JSON.stringify(result,null,2)+'\n');
   // Native CryptoJuju V1.2 research candidates, same validated historical
   // window and simulation costs as V1.1. No TradingView comparison required.
   let candidate;
   try{
     if(result.status!=='RESEARCH_ONLY_UNVERIFIED_TV_PARITY')
       throw Error('Baseline Vector V1.1 not accepted');
     const source=JSON.parse(await readFile(resolve(folder,`${id}.json`),'utf8'));
     const repeatability=JSON.parse(await readFile(resolve(folder,`${id}-repeatability.json`),'utf8'));
     candidate=compareVectorV12Candidates({
       source,repeatability,contract:contracts.find(x=>x.symbol===symbol)
     });
   }catch(e){
     candidate={
       protocol:'CJ_VECTOR_V12_BITUNIX_ISOLATED_COMPARISON_V1',
       status:'BLOCKED',reason:String(e?.message??e),
       promotedVariant:null, noRealTrades:true
     };
   }
   await writeFile(resolve(folder,`${id}-vector-v12-comparison.json`),
     JSON.stringify(candidate,null,2)+'\n');
   // Descriptive-only CryptoJuju scoreboard. Never elect a winner.
   let scorecard;
   try{
     scorecard=summarizeVectorV12Comparison(candidate);
   }catch(err){
     scorecard={protocol:'BLOCKED',symbol,timeframe,
       reason:String(err?.message??err)};
   }
   scorecards.push(scorecard);
   let timing;
   try{
     if(candidate.status!=='CANDIDATES_EVALUATED_RESEARCH_ONLY')
       throw Error('V1.2 candidate not validated');
     const source=JSON.parse(await readFile(resolve(folder,`${id}.json`),'utf8'));
     timing=diagnoseVectorV12Timing({
       source,comparison:candidate,contract:contracts.find(x=>x.symbol===symbol)
     });
   }catch(e){
     timing={status:'BLOCKED',symbol,timeframe,reason:String(e?.message??e)};
   }
   timingReports.push(timing);
   // Causal CLOSED-candle regimes: research-only descriptive classification.
   let regime;
   try{
     if(candidate.status!=='CANDIDATES_EVALUATED_RESEARCH_ONLY')
       throw Error('V1.2 comparison not approved for diagnostics');
     const source=JSON.parse(await readFile(resolve(folder,`${id}.json`),'utf8'));
     regime=diagnoseVectorMarketRegimes({
       source,comparison:candidate,
       contract:contracts.find(x=>x.symbol===symbol)
     });
   }catch(e){
     regime={status:'BLOCKED',symbol,timeframe,
       reason:String(e?.message??e)};
   }
   regimeReports.push(regime);
   await writeFile(resolve(folder,`${id}-vector-market-regimes.json`),
     JSON.stringify(regime,null,2)+'\n');
   console.log('VECTOR_REGIMES '+JSON.stringify({
     symbol,timeframe,status:regime.status,
     blocks:regime.blocks?.length??0,
     composition:regime.blocks?.map(b=>b.marketComposition)??[],
     reason:regime.reason??null
   }));

   await writeFile(resolve(folder,`${id}-vector-v12-timing.json`),
     JSON.stringify(timing,null,2)+'\n');
   console.log('VECTOR_TIMING '+JSON.stringify({symbol,timeframe,
     status:timing.status,
     holdout:Object.fromEntries(Object.entries(timing.modes??{}).map(([mode,x])=>
       [mode,{quickFlips:x.phases.holdout.rapidFlipPairs,
         oppositePairs:x.phases.holdout.oppositeFlipPairs,
         meanDelayBars:x.phases.holdout.meanConfirmationDelayBars,
         matchedBaselineOrigins:x.phases.holdout.matchedBaselineOrigins}]))}));

   if(scorecard.protocol==='CJ_VECTOR_V12_NATIVE_SCOREBOARD_V1'){
     console.log('VECTOR_SCORECARD '+JSON.stringify({
       symbol,timeframe,
       holdout:scorecard.variants.map(x=>({
         mode:x.mode,trades:x.holdout.tradeCount,
         returnPct:x.holdout.returnPct,drawdownPct:x.holdout.maxDrawdownPct,
         deltaReturnPp:x.holdoutReturnDifferencePp,
         deltaDrawdownPp:x.holdoutDrawdownDifferencePp,
         sampleStatus:x.sampleStatus
       }))
     }));
   }
   console.log('VECTOR_V12 '+JSON.stringify({symbol,timeframe,
     status:candidate.status,modes:candidate.modes?.map(x=>x.mode)??[],
     prefixChecks:candidate.noLookaheadPrefixChecks??0,
     reason:candidate.reason??null}));
   const entry={symbol,timeframe,status:result.status,
     signals:result.signalCount??0,
     trainingTrades:result.researchSimulation?.training.tradeCount??null,
     holdoutTrades:result.researchSimulation?.holdout.tradeCount??null,
     noLookaheadPrefixChecks:result.noLookaheadSampledPrefixes??0,
     v12Status:candidate.status,
     v12Modes:candidate.modes?.length??0,
     reason:result.reason??candidate.reason??null};
   summary.cases.push(entry);
   console.log('VECTOR_V11 '+JSON.stringify(entry));
 }
}
await writeFile(resolve(folder,'vector-v12-scoreboard.json'),
  JSON.stringify({status:'DESCRIPTIVE_RESEARCH_NO_PROMOTION',scorecards},null,2)+'\n');
await writeFile(resolve(folder,'vector-v12-scoreboard.md'),
  renderVectorV12ScoreboardMarkdown(scorecards));
await writeFile(resolve(folder,'vector-v12-timing-summary.json'),
  JSON.stringify({protocol:'CJ_NATIVE_VECTOR_V12_TIMING_BATCH_V1',
    reports:timingReports,autoPromotion:false,source:'Bitunix LAST_PRICE'},null,2)+'\n');
await writeFile(resolve(folder,'vector-v12-timing-summary.md'),
  renderVectorTimingDiagnosticsMarkdown(timingReports));
await writeFile(resolve(folder,'vector-market-regimes-summary.json'),
  JSON.stringify({
    protocol:'CJ_VECTOR_MARKET_REGIMES_BATCH_V1',
    researchOnly:true,autoPromotion:false,
    source:'Bitunix public LAST_PRICE',reports:regimeReports
  },null,2)+'\n');
await writeFile(resolve(folder,'vector-market-regimes-summary.md'),
  formatVectorRegimesMarkdown(regimeReports));
summary.marketRegimesReady=regimeReports.filter(x=>x.status==='DESCRIPTIVE_ONLY_NO_WINNER').length;
summary.timingDiagnosticsReady=timingReports.filter(x=>x.status==='RESEARCH_DIAGNOSTIC_ONLY').length;
summary.nativeScorecardsReady=scorecards.filter(x=>x.protocol==='CJ_VECTOR_V12_NATIVE_SCOREBOARD_V1').length;
summary.passed=summary.cases.filter(x=>x.status==='RESEARCH_ONLY_UNVERIFIED_TV_PARITY').length;
summary.blocked=summary.cases.length-summary.passed;
summary.candidateComparisonsPassed=summary.cases.filter(x=>x.v12Status==='CANDIDATES_EVALUATED_RESEARCH_ONLY').length;
summary.candidateComparisonsBlocked=summary.cases.length-summary.candidateComparisonsPassed;
summary.status=summary.blocked?'BLOCKED_OR_PARTIAL':'RESEARCH_SIGNAL_REPLAY_COMPLETE';
if(summary.candidateComparisonsBlocked)
  summary.status='BLOCKED_VECTOR_V12_CANDIDATES';
if(summary.nativeScorecardsReady!==summary.cases.length)
  summary.status='BLOCKED_VECTOR_SCORECARD';
if(summary.timingDiagnosticsReady!==summary.cases.length)
  summary.status='BLOCKED_VECTOR_TIMING_DIAGNOSTICS';
if(summary.marketRegimesReady!==summary.cases.length)
  summary.status='BLOCKED_VECTOR_MARKET_REGIMES';
summary.warning='Actual Bitunix closed OHLC with a JS Vector V1.1 port. No independent TradingView parity, profitability certification, future prediction or autonomous trading.';
await writeFile(resolve(folder,'vector-v11-summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log('VECTOR_SUMMARY '+JSON.stringify({status:summary.status,passed:summary.passed,blocked:summary.blocked,metadataError:summary.metadataError??null}));
if(summary.blocked||summary.candidateComparisonsBlocked||
   summary.nativeScorecardsReady!==summary.cases.length||
   summary.timingDiagnosticsReady!==summary.cases.length||
   summary.marketRegimesReady!==summary.cases.length)process.exitCode=2;
