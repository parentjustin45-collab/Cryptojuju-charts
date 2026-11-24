/*
 * CryptoJuju historical backfill PLANNER v1 — deliberately read-only.
 * NEVER infer complete coverage from summary labels or archive references.
 * Input: canonical UTC open times from verified raw Bitunix candle rows.
 * Output: ONLY missing, time-bounded, non-overlapping fetch windows.
 * No networking, PostgreSQL mutation, trades or main-branch changes.
 */
import {FIVE_CASES} from './render/five-by-five.mjs';
import {VERIFIED_INTERVALS} from './research-batch.mjs';

export const HISTORICAL_TARGET=Object.freeze({
  startTime:Date.UTC(2024,10,24),endTime:Date.UTC(2026,10,24),
  target:'TWO_YEAR_CLOSED_UTC',source:'Bitunix LAST_PRICE'
});
export const BACKFILL_CHUNK_BARS=480;
const eq=(a,b)=>a.symbol===b.symbol&&a.timeframe===b.timeframe;

export function planMissingWindows({symbol,timeframe,existingOpenTimes=[],
  startTime=HISTORICAL_TARGET.startTime,endTime=HISTORICAL_TARGET.endTime,
  chunkBars=BACKFILL_CHUNK_BARS}={}){
  if(!FIVE_CASES.some(x=>eq(x,{symbol,timeframe})))
    throw Error('Only the authorized five-crypto × five-timeframe cohort');
  const step=VERIFIED_INTERVALS[timeframe];
  if(!Number.isSafeInteger(startTime)||!Number.isSafeInteger(endTime)||
    startTime<1e12||endTime<=startTime||
    startTime%step!==0||endTime%step!==0||endTime>Date.now()+step||
    (endTime-startTime)/step>300000)
    throw Error('Invalid two-year closed UTC history boundaries');
  if(!Number.isInteger(chunkBars)||chunkBars<4||chunkBars>960)
    throw Error('Backfill chunks must contain 4..960 closed bars');
  if(!Array.isArray(existingOpenTimes)||
    existingOpenTimes.some(t=>!Number.isSafeInteger(t)||t%step!==0||
      t<startTime||t>=endTime))
    throw Error('Existing coverage must be trusted, aligned and inside target');
  const have=new Set(existingOpenTimes),expected=(endTime-startTime)/step;
  const windows=[];
  let start=null,count=0;
  function flush(){
    if(count>=1){windows.push(Object.freeze({
      symbol,timeframe,startTime:start,endTime:start+count*step,
      closedBars:count,intervalMs:step,hasExistingOverlap:false,
      needsPreWindowAnchors:true,reason:'VERIFIED_CLOSED_BARS_ABSENT'}));}
    start=null;count=0;
  }
  for(let n=0;n<expected;n++){
    const t=startTime+n*step;
    if(have.has(t)){flush();continue;}
    if(start===null)start=t;
    count++;
    if(count===chunkBars)flush();
  }
  flush();
  return Object.freeze({
    symbol,timeframe,startTime,endTime,
    expectedBars:expected,existingUniqueBars:have.size,
    missingBars:expected-have.size,chunkBars,windows:Object.freeze(windows),
    coverageStatus:have.size===expected?'COMPLETE':'INCOMPLETE',
    warning:'Only validated closed Bitunix OHLC count as existing. Windows must be double-read and SHA verified before database insert; no auto repair or live trading.'
  });
}
export function planFiveByFive(verifiedTimesByPair=new Map(),options={}){
  if(!(verifiedTimesByPair instanceof Map))throw Error('Expected Map of validated open timestamps');
  const items=FIVE_CASES.map(({symbol,timeframe})=>planMissingWindows({
    symbol,timeframe,
    existingOpenTimes:verifiedTimesByPair.get(symbol+'|'+timeframe)??[],
    ...options
  }));
  const totals={
    pairs:items.length,
    expectedBars:items.reduce((n,x)=>n+x.expectedBars,0),
    verifiedExistingBars:items.reduce((n,x)=>n+x.existingUniqueBars,0),
    missingBars:items.reduce((n,x)=>n+x.missingBars,0),
    windows:items.reduce((n,x)=>n+x.windows.length,0)
  };
  return {protocol:'CJ_2Y_HISTORICAL_BACKFILL_PLAN_V1',
    target:HISTORICAL_TARGET,totals,items,
    writeOperations:0,ordersPlaced:0,
    constraints:['NO_SYNTHETIC_GAP_FILL','NO_INDICATOR_REPLAY_UNTIL_SOURCE_VALIDATED',
      'INDEPENDENT_PRE_WINDOW_WARMUP','DEDUPLICATE_BY_SYMBOL_TIMEFRAME_UTC_OPEN',
      'RECHECK_DATABASE_BEFORE_COMMIT','OBSERVE_BITUNIX_RATE_LIMITS',
      'NO_HISTORICAL_FABRICATION_BEFORE_TOKEN_LISTING']};
}
