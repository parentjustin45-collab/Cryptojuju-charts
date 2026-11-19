/*
 * Isolated DAILY Vector research admission (five diversified watchlist contracts).
 * Never revises historic OHLC, never adds forming day, never executes orders.
 * A shorter history is allowed ONLY after explicit evidence that missing
 * candles are an older prefix, never for intermittent gaps or revisions.
 */
import {DAILY_RESEARCH_SYMBOLS,fetchBitunixDataPilot} from './bitunix-data-pilot.mjs';
import {compareBitunixReadbacks} from './bitunix-readback-consistency.mjs';
import {auditRealVectorV11} from './vector-v11-real-research.mjs';
import {compareVectorV12Candidates} from './vector-v12-real-comparison.mjs';
import {diagnoseVectorV12Timing} from './vector-v12-timing-diagnostics.mjs';
import {diagnoseVectorMarketRegimes} from './vector-market-regimes.mjs';

export const DAILY_DEPTH_CANDIDATES=Object.freeze([365,180]);
const step=86400000;
function fallbackAvailable(source,nextDepth){
 if(source?.status==='DATA_READY_FOR_RESEARCH_ONLY'||
    source?.reason!=='OHLC_PROVENANCE_OR_CONTINUITY_FAILED'||
    !Array.isArray(source.rawRows)||source.rawRows.length<nextDepth+3||
    source.historyWindow?.intervalMs!==step||
    !Number.isSafeInteger(source.historyWindow?.endTime))
   return false;
 const observed=new Set();
 for(const c of source.rawRows){
   const t=Number(c.time);
   if(!Number.isSafeInteger(t)||observed.has(t))return false;
   observed.add(t);
 }
 const end=source.historyWindow.endTime;
 for(let i=1;i<=nextDepth+3;i++)
   if(!observed.has(end-i*step))return false;
 // Missing candles are ALL before the shorter requested window.
 // The shorter window is independently re-ingested and double-read.
 return true;
}
export async function auditDailyVectorMarket({
 symbol,contract,fetchPage,nowMs=Date.now(),depthCandidates=DAILY_DEPTH_CANDIDATES
}={}){
 if(!DAILY_RESEARCH_SYMBOLS.includes(symbol)||
   !contract||contract.symbol!==symbol||
   contract.source!=='BITUNIX_PUBLIC_TRADING_PAIRS'||
   contract.stepStatus!=='RESEARCH_PRICE_PRECISION_NOT_TV_MINTICK'||
   !Number.isInteger(contract.quotePrecision)||
   contract.quotePrecision<0||contract.quotePrecision>12||
   contract.priceStep!==10**(-contract.quotePrecision)||
   !Array.isArray(depthCandidates)||depthCandidates.length<1||
   depthCandidates.some(n=>!Number.isSafeInteger(n)||n<160||n>960)||
   depthCandidates.some((n,i)=>i>0&&n>=depthCandidates[i-1]))
    throw Error('Missing official OPEN metadata or invalid Daily depth policy');
 const attempts=[];
 let accepted=null;
 for(let i=0;i<depthCandidates.length;i++){
   const depth=depthCandidates[i];
   const first=await fetchBitunixDataPilot({
     symbol,timeframe:'1d',closedBars:depth,anchorBars:3,
     nowMs,fetchPage
   });
   if(first.status==='DATA_READY_FOR_RESEARCH_ONLY'){
     accepted={first,depth};
     attempts.push({depth,status:'FIRST_READ_READY',first});
     break;
   }
   const shorter=depthCandidates[i+1];
   const eligible=shorter!==undefined&&fallbackAvailable(first,shorter);
   attempts.push({depth,status:'BLOCKED',first,eligibleShorterDepth:eligible?shorter:null});
   if(!eligible)break;
 }
 if(!accepted)return {status:'BLOCKED',reason:'NO_VERIFIED_DAILY_HISTORY',
   symbol,attempts,source:null,readback:null,baseline:null,comparison:null,
   timing:null,regimes:null};
 const {first,depth}=accepted;
 const second=await fetchBitunixDataPilot({
   symbol,timeframe:'1d',closedBars:depth,anchorBars:3,
   nowMs,fetchPage
 });
 const readback=compareBitunixReadbacks(first,second);
 if(second.status!=='DATA_READY_FOR_RESEARCH_ONLY'||
    readback.status!=='STABLE_TWO_READS'||
    readback.checkedDerived!==depth||
    first.historyWindow.endTime!==second.historyWindow?.endTime)
  return {status:'BLOCKED',reason:'DAILY_REPEATABILITY_FAILED',
    symbol,depth,attempts,source:first,second,readback,
    baseline:null,comparison:null,timing:null,regimes:null};
 try{
   const baseline=auditRealVectorV11({source:first,repeatability:readback,contract});
   const comparison=compareVectorV12Candidates({source:first,repeatability:readback,contract});
   const timing=diagnoseVectorV12Timing({source:first,comparison,contract});
   const regimes=diagnoseVectorMarketRegimes({
     source:first,comparison,contract,
     blockBars:Math.ceil(depth/4)
   });
   return {
     status:'DAILY_RESEARCH_COMPLETE',symbol,depth,
     historyDepthStatus:depth===depthCandidates[0]?'FULL_REQUESTED_DEPTH':
       'EXPLICIT_SHORT_HISTORY_NOT_EQUIVALENT_TO_FULL_DEPTH',
     timeCloseUtc:new Date(first.historyWindow.endTime).toISOString(),
     attempts,source:first,second,readback,baseline,comparison,timing,regimes,
     assumedFeeAndSlippageNotIndividuallyVerified:true,
     futureDailyCandleUsed:false,
     tradingEnabled:false,autoPromote:false,
     warnings:[
       'A DAILY bar is allowed only after its UTC close; the current daily candle is excluded.',
       'Daily is research-only; these contracts have different liquidity, sessions, spread and funding costs.',
       'A 70/30 historical split previously inspected is not an independent future validation.',
       'No cross-timeframe signal filter or indicator winner is deployed.',
       'No TradingView comparison, live trading, subscriptions or public-site changes.'
     ]
   };
 }catch(e){
   return {status:'BLOCKED',reason:'DAILY_VECTOR_COMPARISON_FAILED',
     symbol,depth,attempts,source:first,second,readback,
     error:String(e?.message??e),baseline:null,comparison:null,timing:null,regimes:null};
 }
}
