/*
 * CryptoJuju research: use the LAST COMPLETED 1D Bitunix bar as a causal
 * direction gate on lower-timeframe Vector signals. NO TradingView, trading
 * keys, orders, parameter fitting, production changes or auto-promotion.
 *
 * Crucial: filtering a reversal must NOT leave the old position open
 * indefinitely. When a rejected opposite Vector signal arrives, the
 * research engine sends FLAT at the NEXT lower-timeframe open.
 */
import {createHash} from 'node:crypto';
import {vectorAIT} from '../vector-ait-v1.mjs';
import {vectorRegimeFeatures} from '../vector-v13-regime.mjs';
import {applyVectorConfirmation} from '../vector-antiwhipsaw-v12.mjs';
import {auditRealVectorV11} from './vector-v11-real-research.mjs';
import {runFixedHoldout} from './fixed-holdout.mjs';
import {diagnoseDailyVetoedSignals} from './daily-signal-veto-diagnostics.mjs';

const D=86400000;
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export const DAILY_ALIGNMENT_LOCK=Object.freeze({
  symbol:'BTCUSDT',
  symbols:['BTCUSDT','HYPEUSDT','1000PEPEUSDT','XAUUSDT','NVDAUSDT'],
  timeframes:['15m','1h','4h'],
  dailyDepth:365,allowedDailyDepths:[365,180],
  intradayDepth:960,dailyCloseSafetyDelayMs:120000,
  dailyRegimes:['bull_stack','bear_stack','mixed','unknown'],
  modes:['baseline_v11','v11_daily_aligned','break_extreme_2','break_daily_aligned']
});
const defaultCosts=Object.freeze({
  initialCapital:1000,feeRate:0.0006,slippageRate:0.0005,allocation:1
});
function assertBars(bars,step){
 if(!Array.isArray(bars)||!bars.length||bars.some((b,i)=>
   !Number.isSafeInteger(b?.time)||b.time%step!==0||
   (i>0&&b.time!==bars[i-1].time+step)))
   throw Error('Missing, unordered or unaligned closed candles');
}
export function indexCompletedDaily(dailySource){
 const bars=dailySource?.acceptedCandles,window=dailySource?.historyWindow;
 if(dailySource?.status!=='DATA_READY_FOR_RESEARCH_ONLY'||
    dailySource.market?.timeframe!=='1d'||
    window?.intervalMs!==D||
    !dailySource.provenance?.formingBarExcluded||
    !bars||bars.length<60||
    window.startTime!==bars[0].time||
    window.endTime!==bars.at(-1).time+D)
   throw Error('Daily source is unverified, incomplete or contains forming days');
 assertBars(bars,D);
 const regimes=vectorRegimeFeatures(bars);
 return regimes.map((f,i)=>({
   openTime:bars[i].time,closedAt:bars[i].time+D,
   regime:f.regime,side:f.regime==='bull_stack'?'long':
     f.regime==='bear_stack'?'short':null,
   close:bars[i].close
 }));
}
export function lastKnownDaily(dailyIndex,decisionTime,{safetyDelayMs=120000}={}){
 if(!Array.isArray(dailyIndex)||!Number.isSafeInteger(decisionTime)||
    !Number.isSafeInteger(safetyDelayMs)||safetyDelayMs<0||safetyDelayMs>3600000)
  throw Error('Invalid causal Daily context input');
 // Exact daily CLOSE + optional historical feed-availability buffer.
 // At a midnight entry, do not use the just-closed Daily prematurely.
 const cutoff=decisionTime-safetyDelayMs;
 let low=0,high=dailyIndex.length-1,answer=null;
 while(low<=high){
   const mid=(low+high)>>1;
   if(dailyIndex[mid].closedAt<=cutoff){answer=dailyIndex[mid];low=mid+1}
   else high=mid-1;
 }
 if(answer&&answer.closedAt>cutoff)throw Error('Daily lookahead detected');
 return answer;
}
export function filterVectorAgainstCompletedDaily({
 lowerBars,events,dailyIndex,intervalMs,safetyDelayMs=120000,
 neutralPolicy='block'
}={}){
 if(!['block','allow_mixed'].includes(neutralPolicy))
   throw Error('Invalid Daily neutral policy');
 if(!Number.isSafeInteger(intervalMs)||intervalMs<=0||
    !Array.isArray(events)||events.length!==lowerBars?.length)
  throw Error('Vector signal and lower bar alignment required');
 assertBars(lowerBars,intervalMs);
 const allowed=[],observations=[];
 let target=null;
 const stats={seen:0,accepted:0,rejectedOpposed:0,rejectedNeutral:0,
   rejectedUnavailable:0,flattenOnRejectedReversal:0,
   noNextOpen:0,acceptedLong:0,acceptedShort:0,acceptedMixed:0};
 for(let i=0;i<events.length;i++){
   const e=events[i];
   if(!e?.signal)continue;
   if(!['long','short'].includes(e.signal)||e.time!==lowerBars[i].time)
     throw Error('Invalid closed-bar Vector signal timestamp');
   stats.seen++;
   if(i===lowerBars.length-1){stats.noNextOpen++;continue}
   const confirmationClose=lowerBars[i].time+intervalMs;
   const executionTime=lowerBars[i+1].time;
   if(confirmationClose!==executionTime)throw Error('Unverified next-open alignment');
   const daily=lastKnownDaily(dailyIndex,confirmationClose,{safetyDelayMs});
   const aligned=daily?.side===e.signal;
   // A genuinely mixed, previously CLOSED day may be permissive.
   // Unknown/warmup or unavailable days are never used to permit entries.
   const mixedAllowed=neutralPolicy==='allow_mixed'&&daily?.regime==='mixed';
   const permitted=aligned||mixedAllowed;
   const reason=aligned?'aligned':mixedAllowed?'mixed_allowed':
     !daily?'daily_not_yet_available':
     daily.side!==null?'daily_opposed':'daily_mixed_or_warmup';
   const obs={neutralPolicy,confirmedBarOpenMs:e.time,
      signalConfirmedAtMs:confirmationClose,
      entryAllowedAtMs:executionTime,
      dailyClosedAtMs:daily?.closedAt??null,
      dailyRegime:daily?.regime??'unavailable',
      vectorSide:e.signal,accepted:permitted,reason};
   if(permitted){
     stats.accepted++;
     if(mixedAllowed)stats.acceptedMixed++;
     if(e.signal==='long')stats.acceptedLong++;else stats.acceptedShort++;
     allowed.push({time:e.time,side:e.signal});
     target=e.signal;
   }else{
     if(reason==='daily_opposed')stats.rejectedOpposed++;
     else if(reason==='daily_not_yet_available')stats.rejectedUnavailable++;
     else stats.rejectedNeutral++;
     // Prevent long exposure persisting when a short reversal is vetoed.
     if(target&&target!==e.signal){
       allowed.push({time:e.time,side:'flat'});
       stats.flattenOnRejectedReversal++;
       target=null;
       obs.flatExit=true;
     }
   }
   observations.push(obs);
 }
 return {signals:allowed,observations,stats,warning:
   'FLAT on a vetoed reversal; same next-open timing, no intrabar fills.'};
}
const same=(a,b)=>['signalCount','tradeCount','returnPct',
 'netProfit','maxDrawdownPct','finalCapital'].every(k=>a?.[k]===b?.[k]);
export function compareDailyAlignedVector({
 intraday,intradayReadback,daily,dailyReadback,contract,
 costs=defaultCosts,safetyDelayMs=DAILY_ALIGNMENT_LOCK.dailyCloseSafetyDelayMs
}={}){
 if(!DAILY_ALIGNMENT_LOCK.timeframes.includes(intraday?.market?.timeframe)||
    !DAILY_ALIGNMENT_LOCK.symbols.includes(intraday.market?.symbol)||
    daily?.market?.symbol!==intraday.market.symbol||
    intraday?.historyWindow?.endTime>daily?.historyWindow?.endTime+D||
    Math.floor(intraday.historyWindow.endTime/D)*D!==daily.historyWindow?.endTime||
    intraday.acceptedCandles?.length!==DAILY_ALIGNMENT_LOCK.intradayDepth||
    !DAILY_ALIGNMENT_LOCK.allowedDailyDepths.includes(daily.acceptedCandles?.length)||
    !Number.isSafeInteger(safetyDelayMs)||safetyDelayMs<0||
    safetyDelayMs>3600000)
  throw Error('Unsupported/mismatched Daily or intraday research windows');
 // The readback's hashes must match the actual byte-level content supplied
 // to this run, not only the provenance SHA fields in a report envelope.
 for(const series of [intraday,daily]){
   if(!Array.isArray(series?.rawRows)||!Array.isArray(series?.acceptedCandles)||
      digest(series.rawRows)!==series.provenance?.rawSha256||
      digest(series.acceptedCandles)!==series.provenance?.derivedSha256)
     throw Error('Bitunix OHLC content mismatch against attached provenance SHA256');
 }
 const validatedLower=auditRealVectorV11({
    source:intraday,repeatability:intradayReadback,contract,costs
 });
 const validatedDaily=auditRealVectorV11({
    source:daily,repeatability:dailyReadback,contract,costs
 });
 const dailyIndex=indexCompletedDaily(daily);
 const bars=intraday.acceptedCandles,intervalMs=intraday.historyWindow.intervalMs;
 const raw=vectorAIT(bars,{minTick:contract.priceStep});
 const eventsBaseline=applyVectorConfirmation(bars,raw,'baseline_v11').events;
 const eventsBreak=applyVectorConfirmation(bars,raw,'break_extreme_2').events;
 const dailyBase=filterVectorAgainstCompletedDaily({
   lowerBars:bars,events:eventsBaseline,dailyIndex,intervalMs,safetyDelayMs
 });
 const dailyBreak=filterVectorAgainstCompletedDaily({
   lowerBars:bars,events:eventsBreak,dailyIndex,intervalMs,safetyDelayMs
 });
 const dailyBaseSoft=filterVectorAgainstCompletedDaily({
   lowerBars:bars,events:eventsBaseline,dailyIndex,intervalMs,safetyDelayMs,
   neutralPolicy:'allow_mixed'
 });
 const dailyBreakSoft=filterVectorAgainstCompletedDaily({
   lowerBars:bars,events:eventsBreak,dailyIndex,intervalMs,safetyDelayMs,
   neutralPolicy:'allow_mixed'
 });
 // Forward data is used ONLY for retrospective fixed-horizon outcomes,
 // after the Daily gate and signal decisions are finalized.
 const opportunity={
   v11_daily_aligned:diagnoseDailyVetoedSignals({
     bars,observations:dailyBase.observations,intervalMs,dailySafetyDelayMs:safetyDelayMs
   }),
   v11_daily_soft:diagnoseDailyVetoedSignals({
     bars,observations:dailyBaseSoft.observations,intervalMs,dailySafetyDelayMs:safetyDelayMs
   }),
   break_daily_aligned:diagnoseDailyVetoedSignals({
     bars,observations:dailyBreak.observations,intervalMs,dailySafetyDelayMs:safetyDelayMs
   }),
   break_daily_soft:diagnoseDailyVetoedSignals({
     bars,observations:dailyBreakSoft.observations,intervalMs,dailySafetyDelayMs:safetyDelayMs
   })
 };
 const simple=e=>e.flatMap((v,i)=>v.signal&&i<bars.length-1?
   [{time:v.time,side:v.signal}]:[]);
 const labels=[
   ['baseline_v11',simple(eventsBaseline)],
   ['v11_daily_aligned',dailyBase.signals],
   ['v11_daily_soft',dailyBaseSoft.signals],
   ['break_extreme_2',simple(eventsBreak)],
   ['break_daily_aligned',dailyBreak.signals],
   ['break_daily_soft',dailyBreakSoft.signals]
 ];
 const holdoutStartTime=intraday.historyWindow.startTime+
   Math.floor(bars.length*0.7)*intervalMs;
 const evals=runFixedHoldout({
   market:intraday.market,historyWindow:intraday.historyWindow,
   candles:bars,holdoutStartTime,costs,
   experiments:labels.map(([id,signals])=>({
     id,signalTimeConvention:'confirmation-bar-open',
     indicatorParity:'UNVERIFIED',signals
   }))
 });
 if(!same(evals.training.baseline_v11,validatedLower.researchSimulation.training)||
    !same(evals.holdout.baseline_v11,validatedLower.researchSimulation.holdout))
   throw Error('Daily study did not reproduce original Vector V1.1 results');
 const allObs=[...dailyBase.observations,...dailyBreak.observations,
   ...dailyBaseSoft.observations,...dailyBreakSoft.observations];
 if(allObs.some(x=>x.dailyClosedAtMs!==null &&
    x.dailyClosedAtMs+safetyDelayMs>x.signalConfirmedAtMs))
   throw Error('LOOKAHEAD: Daily candle used before its safe closing time');
 return {
   protocol:'CJ_DAILY_CAUSAL_ALIGNMENT_WITH_VECTOR_V1',
   status:'RESEARCH_COMPARISON_ONLY',
   market:intraday.market,
   data:{
     intradayClosedBars:bars.length,dailyClosedBars:dailyIndex.length,
     lastDailyEndExclusiveMs:daily.historyWindow.endTime,
     originalIntradayRawSha256:intraday.provenance.rawSha256,
     originalDailyRawSha256:daily.provenance.rawSha256,
     intradayDoubleRead:intradayReadback.status,
     dailyDoubleRead:dailyReadback.status,
     dailyStrategyVectorSignals:validatedDaily.signalCount,
     latencySafetyAssumptionMs:safetyDelayMs
   },
   causal:{noFutureDailyBarUsed:true,
     lastDailyAvailabilityBufferIsAssumption:true,
     actualQuoteLatencyMeasured:false,
     baselineReproduced:true},
   filters:{
     v11_daily_aligned:dailyBase.stats,
     v11_daily_soft:dailyBaseSoft.stats,
     break_daily_aligned:dailyBreak.stats,
     break_daily_soft:dailyBreakSoft.stats
   },
   observationsPreview:{
     baseline:dailyBase.observations.slice(0,15),
     break:dailyBreak.observations.slice(0,15),
     baselineSoft:dailyBaseSoft.observations.slice(0,15),
     breakSoft:dailyBreakSoft.observations.slice(0,15)
   },
   splitAtUtc:new Date(holdoutStartTime).toISOString(),
   training:evals.training,holdout:evals.holdout,
   droppedAtBoundary:evals.droppedAtBoundary,
   signalOpportunity:opportunity,
   promotedVariant:null,tradingEnabled:false,
   warnings:[
     'A bullish Daily does not guarantee bullish 4H, 1H or 15M: pullbacks and reversals are possible.',
     'Daily bullish/bearish requires aligned EMA21/34/50 and EMA50 slope at completed UTC Daily CLOSE.',
     'Strict rejects neutral/unknown. Soft accepts only MIXED, never UNKNOWN/warmup/unavailable.',
     'Rejected opposite entries trigger FLAT on next open; results are not a pure signal deletion experiment.',
     '120s Daily post-close delay is a conservative assumption, not validated feed-latency evidence.',
     'Five-market 1h pilot and original BTC 15m/4h tests are exploratory, not prospective validation.',
     'Fixed fees/slippage, no funding/liquidity model; no production, trading or automatic selection.',
     'Missed-opportunity diagnostics are overlapping fixed-horizon price movements, NOT recoverable trade P&L or win rates.'
   ]
 };
}
