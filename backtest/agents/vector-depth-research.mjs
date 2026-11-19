/*
 * BTCUSDT / 15m / 960 closed candles depth pilot.
 * Research-only: 2 distinct public Bitunix reads of the SAME full window.
 * No TradingView step, no keys, no trade routing, no live monitoring.
 */
import {fetchBitunixDataPilot} from './bitunix-data-pilot.mjs';
import {compareBitunixReadbacks} from './bitunix-readback-consistency.mjs';
import {auditRealVectorV11} from './vector-v11-real-research.mjs';
import {compareVectorV12Candidates} from './vector-v12-real-comparison.mjs';
import {summarizeVectorV12Comparison} from './vector-v12-scoreboard.mjs';

export const DEPTH_PILOT=Object.freeze({
 symbol:'BTCUSDT',timeframe:'15m',closedBars:960,
 anchorBars:3,pageBars:150
});
export async function runVectorDepthResearch({nowMs=Date.now(),fetchPage,contract}={}){
 const historyOptions={...DEPTH_PILOT,nowMs,...(fetchPage?{fetchPage}:{})};
 // Do not change the requested time or soften an OHLC rejection on readback.
 const first=await fetchBitunixDataPilot(historyOptions);
 if(first.status!=='DATA_READY_FOR_RESEARCH_ONLY')
   return {status:'BLOCKED',reason:'INITIAL_HISTORY_NOT_VERIFIED',
     first,second:null,repeatability:null,baseline:null,comparison:null,scorecard:null};
 const second=await fetchBitunixDataPilot(historyOptions);
 const repeatability=compareBitunixReadbacks(first,second);
 if(repeatability.status!=='STABLE_TWO_READS'||
    repeatability.checkedDerived!==DEPTH_PILOT.closedBars)
   return {status:'BLOCKED',reason:'HISTORY_REPEATABILITY_NOT_VERIFIED',
     first,second,repeatability,baseline:null,comparison:null,scorecard:null};
 try{
   const baseline=auditRealVectorV11({source:first,repeatability,contract});
   const comparison=compareVectorV12Candidates({source:first,repeatability,contract});
   const scorecard=summarizeVectorV12Comparison(comparison);
   return {
     status:'COMPLETE_RESEARCH_ONLY',reason:null,
     first,second,repeatability,baseline,comparison,scorecard,
     disclaimers:[
       'This 960-bar window includes earlier inspected bars, not an independent prospectively untouched test.',
       'Quick opposite reversals are descriptive, not automatically wrong signals.',
       'Delayed confirmations can suppress a good move; no variant promoted.',
       'This records research-only simulated trades with fixed costs, no real trading.',
       'No TradingView comparison required or claimed.'
     ]
   };
 }catch(e){
   return {status:'BLOCKED',reason:'VECTOR_DEPTH_RESEARCH_FAILED',
     error:String(e?.message??e),first,second,repeatability,
     baseline:null,comparison:null,scorecard:null};
 }
}
