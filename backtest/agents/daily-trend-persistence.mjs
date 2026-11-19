/*
 * Causal Daily-vs-1H TREND persistence. Descriptive, no trades or tuning.
 * Measures:
 *  (A) how often a directional Daily remains directional the NEXT day;
 *  (B) how often a directional 1H EMA structure is aligned with the most
 *      recently COMPLETED Daily EMA structure;
 *  (C) how often an individual hourly close changes in that direction.
 * These are different denominators! None is a trade win rate.
 */
import {createHash} from 'node:crypto';
import {vectorRegimeFeatures} from '../vector-v13-regime.mjs';
import {indexCompletedDaily,lastKnownDaily}
 from './vector-daily-intraday-alignment.mjs';
const D=86400000,H=3600000;
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function bucket(){return {
 hourlyClosedBars:0,hoursWithDirectionalDaily:0,
 hourlyDirectionAligned:0,hourlyDirectionOpposed:0,hourlyMixedOrUnknown:0,
 hourlyPriceMovesWithDaily:0,hourlyPriceMovesAgainstDaily:0,
 hourlyPriceMovesFlat:0,unavailableOrMixedDaily:0
};}
const pct=(n,d)=>d?Math.round(10000*n/d)/100:null;
function finish(b){
 const dir=b.hourlyDirectionAligned+b.hourlyDirectionOpposed;
 const move=b.hourlyPriceMovesWithDaily+b.hourlyPriceMovesAgainstDaily;
 return {...b,
  directionalHourlyAlignmentPct:pct(b.hourlyDirectionAligned,dir),
  hourlyPriceDirectionAgreementPct:pct(b.hourlyPriceMovesWithDaily,move),
  dailyDirectionalCoveragePct:pct(b.hoursWithDirectionalDaily,b.hourlyClosedBars),
  explanation:'Directional 1H EMA alignment and 1H price-direction agreement are not the same quantity or a win rate.'
 };
}
export function measureCausalDailyTrendPersistence({
 dailySource,hourlySource,comparison,safetyDelayMs=120000
}={}){
 const a=dailySource?.acceptedCandles,b=hourlySource?.acceptedCandles;
 if(comparison?.status!=='RESEARCH_COMPARISON_ONLY'||
   comparison.data?.originalDailyRawSha256!==dailySource?.provenance?.rawSha256||
   comparison.data?.originalIntradayRawSha256!==hourlySource?.provenance?.rawSha256||
   comparison.data?.dailyDoubleRead!=='STABLE_TWO_READS'||
   comparison.data?.intradayDoubleRead!=='STABLE_TWO_READS'||
   dailySource?.status!=='DATA_READY_FOR_RESEARCH_ONLY'||
   hourlySource?.status!=='DATA_READY_FOR_RESEARCH_ONLY'||
   hourlySource.market?.timeframe!=='1h'||
   dailySource.market?.timeframe!=='1d'||
   hourlySource.market?.symbol!==dailySource.market?.symbol||
   comparison.market?.symbol!==hourlySource.market.symbol||
   comparison.market?.timeframe!=='1h'||
   !Number.isSafeInteger(safetyDelayMs)||safetyDelayMs<0||safetyDelayMs>3600000||
   !Array.isArray(a)||a.length<100||!Array.isArray(b)||b.length<160||
   digest(a)!==dailySource.provenance?.derivedSha256||
   digest(b)!==hourlySource.provenance?.derivedSha256||
   digest(dailySource.rawRows)!==dailySource.provenance?.rawSha256||
   digest(hourlySource.rawRows)!==hourlySource.provenance?.rawSha256)
  throw Error('No matching trusted 1D/1H double-read provenance for trend diagnostic');
 const index=indexCompletedDaily(dailySource);
 const features=vectorRegimeFeatures(b);
 const cut=Math.floor(b.length*.7);
 const phase={training:bucket(),holdout:bucket()};
 let directionalDayTransitions=0,dailyDirectionRetained=0;
 for(let i=1;i<index.length;i++){
   const prev=index[i-1],now=index[i];
   if(prev.closedAt+D!==now.closedAt)throw Error('Discontinuous Daily trend labels');
   if(prev.side!==null){
     directionalDayTransitions++;
     if(now.side===prev.side)dailyDirectionRetained++;
   }
 }
 let sampledDailyClosedAfterDecision=0;
 for(let i=1;i<b.length;i++){
   const bar=b[i],prev=b[i-1];
   if(bar.time!==prev.time+H)throw Error('Discontinuous 1H series');
   const time=bar.time+H,day=lastKnownDaily(index,time,{safetyDelayMs});
   if(day&&day.closedAt+safetyDelayMs>time)
     throw Error('Future Daily context used in hourly diagnostic');
   const current=phase[i<cut?'training':'holdout'];
   current.hourlyClosedBars++;
   if(day?.side===null||!day){current.unavailableOrMixedDaily++;continue}
   current.hoursWithDirectionalDaily++;
   const oneHour=features[i].regime;
   if(oneHour==='bull_stack'||oneHour==='bear_stack'){
     if((oneHour==='bull_stack'&&day.side==='long')||
        (oneHour==='bear_stack'&&day.side==='short'))current.hourlyDirectionAligned++;
     else current.hourlyDirectionOpposed++;
   }else current.hourlyMixedOrUnknown++;
   const movement=Math.sign(Number(bar.close)-Number(prev.close));
   if(movement===0)current.hourlyPriceMovesFlat++;
   else if((movement>0&&day.side==='long')||
           (movement<0&&day.side==='short'))current.hourlyPriceMovesWithDaily++;
   else current.hourlyPriceMovesAgainstDaily++;
 }
 return {
   protocol:'CJ_CAUSAL_DAILY_1H_TREND_PERSISTENCE_V1',
   status:'DESCRIPTIVE_NO_TRADING_PREDICTION',
   symbol:dailySource.market.symbol,
   inspectedDailyBars:a.length,inspectedHourlyBars:b.length,
   dailyTrendDayTransitions:directionalDayTransitions,
   dailyDirectionRetainedNextDay:dailyDirectionRetained,
   dailyDirectionRetainedNextDayPct:pct(dailyDirectionRetained,directionalDayTransitions),
   phases:{training:finish(phase.training),holdout:finish(phase.holdout)},
   noFutureDailyUsed:sampledDailyClosedAfterDecision===0,
   safetyDelayAssumptionMs:safetyDelayMs,
   warning:[
     '90% is a personal hypothesis, not a calibrated probability.',
     'Daily retention, 1H EMA agreement and 1H candle-by-candle direction use different denominators.',
     'Daily and hourly labels use already CLOSED bars; monthly/weekly trend not modeled.',
     'These windows were already inspected; results cannot demonstrate future performance.',
     'No indicator parameter tuning, trading, promotion, or production deployment.'
   ]
 };
}
