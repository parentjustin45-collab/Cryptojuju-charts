/* Pre-registered, observation-only Vector V1.2 BTC 1h SHORT experiment.
   NEVER places orders; NEVER changes V1.1, production HTML or main.
   Higher timeframe context is DESCRIPTIVE and does NOT change entry rules. */
import {pathToFileURL} from 'node:url';
import {vectorAIT} from './vector-ait-v1.mjs';
import {applyVectorConfirmation} from './vector-antiwhipsaw-v12.mjs';
import {simulateVectorExitTrade,VECTOR_EXIT_CONFIGS} from './vector-exit-selection.mjs';
import {planCleanBacktestWindows} from './quarantine.mjs';
import {makeCryptoJujuFetchPage} from './cryptojuju-adapter.mjs';

const HOUR=3600000,DAY=24*HOUR;
export const VECTOR_PROSPECTIVE_LOCK=Object.freeze({
 protocol:'vector-v12-btc1h-short-2026-10-26',
 startTime:Date.parse('2026-10-26T00:00:00Z'),
 symbol:'BTCUSDT',interval:'1h',intervalMs:HOUR,side:'short',
 baseline:'baseline_v11',candidate:'break_extreme_2',minimumConfirmations:4,
 exit:'fixed_1_5_3_12',feeRate:0.0006,baselineSlippageRate:0,
 stressSlippageRate:0.0005,minimumCompletedTrades:30,
 warmupDays:35,contextIntervals:['4h','1d'],
});
const EXIT=VECTOR_EXIT_CONFIGS.find(c=>c.id===VECTOR_PROSPECTIVE_LOCK.exit);
if(!EXIT)throw Error('Frozen Vector exit configuration missing');
const STEP=Object.freeze({'1h':HOUR,'4h':4*HOUR,'1d':DAY});
const round=n=>n==null?null:Number(n.toFixed(6));
const direction=d=>d===1?'bull':d===-1?'bear':'neutral';

// A higher-TF observation becomes visible at the END of its bar, never at its opening.
export function buildCompletedVectorContext(windows,intervalMs){
 if(![4*HOUR,DAY].includes(intervalMs))throw Error('Unsupported context interval');
 const byClose=new Map();
 for(const w of windows){
  const bars=w.candles??w;
  if(bars.length<22)continue;
  const vector=vectorAIT(bars);
  for(let i=0;i<bars.length;i++)byClose.set(bars[i].time+intervalMs,direction(vector[i].direction));
 }
 return {intervalMs,byClose};
}
export function contextAtEntry(index,entryTime){
 if(!index)return null;
 const {intervalMs,byClose}=index;
 if(!Number.isSafeInteger(entryTime))throw Error('Invalid entry timestamp');
 // The most recent higher-TF candle is complete only on an aligned boundary.
 const lastClose=Math.floor(entryTime/intervalMs)*intervalMs;
 return byClose.get(lastClose)??null; // missing last candle => UNKNOWN, never stale fallback
}

function scoreMode(windows,mode,{asOfTime,startTime,context={}}){
 const scenarios={baseline:{},stress:{}};
 for(const [scenario,slippageRate] of [['baseline',0],['stress',VECTOR_PROSPECTIVE_LOCK.stressSlippageRate]]){
  const stats={signals:0,completedTrades:0,wins:0,sumNetPct:0,censoredPositions:0,
   pendingNextOpen:0,unobservedBoundarySignals:0,excludedWarmupSignals:0,
   trades:[],slippageRate};
  for(const w of windows){
   const bars=(w.candles??w).filter(b=>b.time+HOUR<=asOfTime);
   if(bars.length<22)continue;
   const raw=vectorAIT(bars);
   const events=applyVectorConfirmation(bars,raw,mode).events;
   let occupiedUntil=-1;
   for(let i=0;i<events.length;i++){
    const e=events[i];
    if(e.signal!=='short')continue;
    const sourceTime=e.sourceIndex==null?bars[i].time:bars[e.sourceIndex].time;
    // Both the Vector source and the confirmation MUST belong to the new future sample.
    if(sourceTime<startTime||bars[i].time<startTime){stats.excludedWarmupSignals++;continue;}
    const fillIndex=i+1;
    if(fillIndex<=occupiedUntil)continue;
    if(fillIndex>=bars.length){stats.pendingNextOpen++;continue;}
    if(bars[fillIndex].time<startTime){stats.unobservedBoundarySignals++;continue;}
    stats.signals++;
    const trade=simulateVectorExitTrade(bars,events,i,'short',EXIT,{
      cutoffTime:startTime,feeRate:VECTOR_PROSPECTIVE_LOCK.feeRate,slippageRate
    });
    if(trade.status==='closed'){
     stats.completedTrades++;stats.wins+=Number(trade.netPct>0);stats.sumNetPct+=trade.netPct;
     stats.trades.push({signalTime:bars[i].time,sourceTime,entryTime:bars[fillIndex].time,
      exitTime:bars[trade.exitIndex].time,entry:round(trade.entry),exit:round(trade.exit),
      reason:trade.reason,netPct:round(trade.netPct),
      context:{h4:contextAtEntry(context.h4,bars[fillIndex].time),
       d1:contextAtEntry(context.d1,bars[fillIndex].time)}});
     occupiedUntil=trade.exitIndex;
    }else{
     stats.censoredPositions++;
     occupiedUntil=bars.length-1; // incomplete future is never treated as a closed trade
    }
   }
  }
  stats.winRatePct=stats.completedTrades?round(100*stats.wins/stats.completedTrades):null;
  stats.meanNetPct=stats.completedTrades?round(stats.sumNetPct/stats.completedTrades):null;
  stats.sampleSufficient=stats.completedTrades>=VECTOR_PROSPECTIVE_LOCK.minimumCompletedTrades;
  delete stats.sumNetPct;
  scenarios[scenario]=stats;
 }
 return scenarios;
}

// Pure deterministic analysis: safe to test offline with synthetic closed OHLC.
export function evaluateProspectiveVector({hourWindows,context={},asOfTime,startTime=VECTOR_PROSPECTIVE_LOCK.startTime}={}){
 if(!Array.isArray(hourWindows)||!Number.isSafeInteger(asOfTime)||!Number.isSafeInteger(startTime))throw Error('Invalid prospective input');
 if(asOfTime<=startTime)return {status:'NOT_STARTED',asOfTime,baseline:null,candidate:null};
 const baseline=scoreMode(hourWindows,VECTOR_PROSPECTIVE_LOCK.baseline,{asOfTime,startTime,context});
 const candidate=scoreMode(hourWindows,VECTOR_PROSPECTIVE_LOCK.candidate,{asOfTime,startTime,context});
 const b=baseline.stress,c=candidate.stress;
 return {status:c.sampleSufficient&&b.sampleSufficient?'OBSERVATION_SUFFICIENT':'INSUFFICIENT_TRADES',
  asOfTime,baseline,candidate,
  comparison:{stressMeanDeltaPp:c.meanNetPct==null||b.meanNetPct==null?null:round(c.meanNetPct-b.meanNetPct),
   note:'Descriptive non-paired average over separately executed trades; NOT portfolio return'},
  warning:'No strategy promotion. History is re-fetched for each run, not an immutable live-tick capture. No Pine parity established.'};
}

async function fetchClosed(fetchPage,symbol,interval,startTime,endTime){
 const step=STEP[interval];if(!step)throw Error('Unknown interval');
 const rows=[];
 for(let start=startTime;start<endTime;start+=step*180){
  const end=Math.min(endTime,start+step*180);
  const page=await fetchPage({symbol,interval,startTime:start,endTime:end,limit:200});
  rows.push(...page.filter(x=>Number(x.time)>=start&&Number(x.time)<end));
 }
 return rows;
}
export async function runVectorProspective({now=Date.now(),fetchPage=makeCryptoJujuFetchPage()}={}){
 const lock=VECTOR_PROSPECTIVE_LOCK,asOfTime=Math.floor(now/HOUR)*HOUR;
 const metadata={schemaVersion:1,locked:lock,asOf:new Date(now).toISOString(),asOfTime,
  source:'Bitunix futures klines via CryptoJuju proxy',
  branch:process.env.GITHUB_REF_NAME??null,commit:process.env.GITHUB_SHA??null,
  runId:process.env.GITHUB_RUN_ID??null,
  policy:'closed bars only; no invented OHLC; no cross-gap trade; read-only; no automatic strategy selection'};
 if(asOfTime<=lock.startTime)return {...metadata,status:'NOT_STARTED',results:null};
 const fetchStart=lock.startTime-lock.warmupDays*DAY;
 const loaded={};
 for(const interval of ['1h','4h','1d']){
  const step=STEP[interval],end=Math.floor(now/step)*step;
  // Align to exact UTC candle grid for a valid quality audit.
  const start=Math.floor(fetchStart/step)*step;
  const rows=await fetchClosed(fetchPage,lock.symbol,interval,start,end);
  const plan=planCleanBacktestWindows(rows,{startTime:start,endTime:end,intervalMs:step},{minBars:22});
  loaded[interval]={plan,rows:rows.length,end};
 }
 const h4=buildCompletedVectorContext(loaded['4h'].plan.eligibleWindows,4*HOUR);
 const d1=buildCompletedVectorContext(loaded['1d'].plan.eligibleWindows,DAY);
 const results=evaluateProspectiveVector({hourWindows:loaded['1h'].plan.eligibleWindows,
  context:{h4,d1},asOfTime});
 const coverage=Object.fromEntries(Object.entries(loaded).map(([tf,x])=>[tf,{
  status:x.plan.status,receivedRows:x.rows,expectedBars:x.plan.quality.expected,
  excludedBars:x.plan.excludedBars,eligibleWindows:x.plan.eligibleWindows.length,
  coveragePct:round(x.plan.quality.coveragePct)}]));
 return {...metadata,status:loaded['1h'].plan.eligibleWindows.length===0?'BLOCKED_HISTORY':results.status,
  coverage,results,
  note:'1D and 4H directions are measured only after their candles close and DO NOT filter the locked 1H SHORT experiment. 30m and 15m are out of scope until their own preregistered study.'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const report=await runVectorProspective();
  console.log(JSON.stringify(report,null,2));
  if(report.status==='BLOCKED_HISTORY')process.exitCode=1;
 }catch(error){console.error(JSON.stringify({status:'ERROR',message:String(error.message??error)}));process.exitCode=1;}
}
