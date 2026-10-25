/* Vector V1.3 anti-whipsaw regime experiment, historical exploratory ONLY.
 * No production indicators, order execution, future leak, or strategy promotion.
 * Same frozen exits and costs per mode, no selection or optimization loop.
 */
import {pathToFileURL} from 'node:url';
import {vectorAIT} from './vector-ait-v1.mjs';
import {VECTOR_V13_MODES,applyVectorV13} from './vector-v13-regime.mjs';
import {VECTOR_EXIT_CONFIGS,simulateVectorExitTrade} from './vector-exit-selection.mjs';
import {completedContextIndex} from './vector-lower-tf-diagnostic.mjs';
import {planCleanBacktestWindows} from './quarantine.mjs';
import {makeCryptoJujuFetchPage} from './cryptojuju-adapter.mjs';

const H=3600000,D=24*H;
export const V13_STUDY_LOCK=Object.freeze({
 protocol:'vector-v13-ema-regime-research-v1',historyDays:365,
 symbols:['BTCUSDT','ETHUSDT','SOLUSDT'],timeframe:'1h',
 context:'4h',sides:['long','short'],
 modes:VECTOR_V13_MODES,exit:'fixed_1_5_3_12',
 feeRate:0.0006,slippage:0,stressSlippage:0.0005,
 harshSlippage:0.001,minPartitionTrades:30,minBars:22,
 note:'Existing historical data previously inspected. Both chronological halves are exploratory; no untouched holdout.'
});
const EXIT=VECTOR_EXIT_CONFIGS.find(v=>v.id===V13_STUDY_LOCK.exit);
if(!EXIT)throw Error('Missing research exit');
const count=()=>({signals:0,closed:0,wins:0,sumNetPct:0,
 censored:0,censoredSplit:0,censoredWindow:0,boundaryExcluded:0,
 reasons:{stop:0,take:0,timeout:0}});
const round=n=>n==null?null:Number(n.toFixed(6));
const finish=b=>({
 signals:b.signals,trades:b.closed,wins:b.wins,
 winRatePct:b.closed?round(100*b.wins/b.closed):null,
 meanNetPct:b.closed?round(b.sumNetPct/b.closed):null,
 censored:b.censored,censoredSplit:b.censoredSplit,censoredWindow:b.censoredWindow,
 boundaryExcluded:b.boundaryExcluded,reasons:b.reasons,
 sufficientSample:b.closed>=V13_STUDY_LOCK.minPartitionTrades
});
const scenarios=Object.freeze([['baseline',0],['stress',V13_STUDY_LOCK.stressSlippage],
 ['harsh',V13_STUDY_LOCK.harshSlippage]]);
function evaluateOne(windows,{mode,side,cutoffTime,slippage,context4h}){
 const bins={earlier:count(),later:count()};
 const rejectionTotals={candidates:0,accepted:0,rejected:0,byReason:{}};
 const diagnostics={eligibleWindows:0,skippedWindows:0};
 for(const w of windows){
  const bars=w.candles??w;
  if(!Array.isArray(bars)||bars.length<V13_STUDY_LOCK.minBars){diagnostics.skippedWindows++;continue;}
  if(bars.some((b,i)=>!Number.isSafeInteger(b.time)||
     (i>0&&b.time-bars[i-1].time!==H))){diagnostics.skippedWindows++;continue;}
  diagnostics.eligibleWindows++;
  const raw=vectorAIT(bars);
  const result=applyVectorV13(bars,{mode,rawVector:raw,context4h});
  const a=result.audit.bySide[side];
  for(const field of ['candidates','accepted','rejected'])rejectionTotals[field]+=a[field];
  // Explanation codes are shared between sides, so keep them only as all-side diagnostics elsewhere.
  let occupied=-1;
  for(let i=0;i<result.events.length-1;i++){
   const event=result.events[i];if(event.signal!==side)continue;
   const start=i+1,partition=bars[start].time<cutoffTime?'earlier':'later',
     bucket=bins[partition],sourceIndex=event.sourceIndex??i;
   if(partition==='later'&&bars[sourceIndex].time<cutoffTime){
    bucket.boundaryExcluded++;continue;
   }
   if(start<=occupied)continue;
   bucket.signals++;
   const trade=simulateVectorExitTrade(bars,result.events,i,side,EXIT,{
    cutoffTime,feeRate:V13_STUDY_LOCK.feeRate,slippageRate:slippage
   });
   if(trade.status==='closed'){
    bucket.closed++;bucket.wins+=Number(trade.netPct>0);bucket.sumNetPct+=trade.netPct;
    bucket.reasons[trade.reason]++;
    occupied=trade.exitIndex;
   }else{
    bucket.censored++;
    if(trade.censorReason==='split_boundary')bucket.censoredSplit++;
    else bucket.censoredWindow++;
    occupied=bars.length-1;
    if(partition==='earlier'){
     const at=bars.findIndex(b=>b.time>=cutoffTime);
     if(at>=0)occupied=at-1;
    }
   }
  }
 }
 return {partitions:Object.fromEntries(Object.entries(bins).map(([name,b])=>[name,finish(b)])),
  rejections:rejectionTotals,diagnostics};
}
export function studyVectorV13(windows,{context4h=null,cutoffTime}={}){
 if(!Array.isArray(windows)||!Number.isSafeInteger(cutoffTime))throw Error('Invalid Vector V1.3 study input');
 const bySide={};
 for(const side of V13_STUDY_LOCK.sides){
  bySide[side]={};
  for(const mode of VECTOR_V13_MODES){
   bySide[side][mode]=Object.fromEntries(scenarios.map(([name,slippage])=>[
    name,{slippagePerSide:slippage,...evaluateOne(windows,{
     mode,side,cutoffTime,slippage,context4h})}
   ]));
  }
 }
 return {status:'EXPLORATORY_RESEARCH',cutoffTime,locks:V13_STUDY_LOCK,bySide,
  warning:'EMA filters and 4H alignment are unvalidated research candidates, NOT a calibrated signal quality probability. Zero changes to V1.1/V1.2. Insufficient samples must remain inconclusive. 365d history previously used, NO independent holdout.'};
}
async function fetchClosed(fetchPage,symbol,interval,step,startTime,endTime){
 const rows=[];
 for(let start=startTime;start<endTime;start+=180*step){
  const end=Math.min(start+180*step,endTime);
  const page=await fetchPage({symbol,interval,startTime:start,endTime:end,limit:200});
  rows.push(...page.filter(b=>Number(b.time)>=start&&Number(b.time)<end));
 }
 return rows;
}
export async function runVectorV13({now=Date.now(),fetchPage=makeCryptoJujuFetchPage()}={}){
 const endTime=Math.floor(now/H)*H,startTime=endTime-V13_STUDY_LOCK.historyDays*D,
  cutoffTime=startTime+Math.floor((endTime-startTime)/2/H)*H;
 const results=[];
 for(const symbol of V13_STUDY_LOCK.symbols){
  try{
   const plans={},coverage={};
   for(const [tf,step] of [['4h',4*H],['1h',H]]){
    const start=Math.floor(startTime/step)*step,end=Math.floor(endTime/step)*step;
    const rows=await fetchClosed(fetchPage,symbol,tf,step,start,end);
    const plan=planCleanBacktestWindows(rows,{startTime:start,endTime:end,intervalMs:step},
     {minBars:V13_STUDY_LOCK.minBars});
    plans[tf]=plan;
    coverage[tf]={status:plan.status,receivedBars:rows.length,
     expectedBars:plan.quality.expected,coveragePct:round(plan.quality.coveragePct),
     excludedBars:plan.excludedBars,cleanWindows:plan.eligibleWindows.length};
   }
   const context4h=completedContextIndex(plans['4h'].eligibleWindows,4*H);
   const study=studyVectorV13(plans['1h'].eligibleWindows,{context4h,cutoffTime});
   results.push({symbol,status:coverage['1h'].cleanWindows?'STUDIED':'INSUFFICIENT_HISTORY',
    coverage,study});
  }catch(error){
   results.push({symbol,status:'ERROR',message:String(error.message??error)});
  }
 }
 const summary=[];
 for(const r of results){
  if(r.status!=='STUDIED')continue;
  for(const side of V13_STUDY_LOCK.sides)for(const mode of VECTOR_V13_MODES){
   const variant=r.study.bySide[side][mode];
   const b=variant.stress.partitions.earlier,t=variant.stress.partitions.later;
   const hs=variant.harsh.partitions.later;
   summary.push({symbol:r.symbol,timeframe:'1h',side,mode,
    earlierTrades:b.trades,earlierMeanNetPct:b.meanNetPct,
    laterTrades:t.trades,laterWinRatePct:t.winRatePct,laterMeanNetPct:t.meanNetPct,
    harshLaterMeanNetPct:hs.meanNetPct,
    earlierSampleSufficient:b.sufficientSample,laterSampleSufficient:t.sufficientSample,
    status:b.sufficientSample&&t.sufficientSample?'DESCRIPTIVE_SAMPLE_MET':'TOO_FEW_TRADES'});
  }
 }
 const status=results.some(r=>r.status==='ERROR')?'PARTIAL_ERROR':
  results.every(r=>r.status==='INSUFFICIENT_HISTORY')?'BLOCKED_HISTORY':'HISTORICAL_COMPLETE';
 return {schemaVersion:1,status,asOf:new Date(now).toISOString(),period:{startTime,endTime,cutoffTime},
  branch:process.env.GITHUB_REF_NAME??null,commit:process.env.GITHUB_SHA??null,
  runId:process.env.GITHUB_RUN_ID??null,source:'Bitunix via read-only CryptoJuju proxy',
  lock:V13_STUDY_LOCK,summary,results,
  nextStep:'Evaluate independently on new forward period and check TradingView Pine parity before deployment. Never automatically select a historic winner.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const report=await runVectorV13();
 console.log(JSON.stringify(report,null,2));
 if(report.status==='BLOCKED_HISTORY'||report.status==='PARTIAL_ERROR')process.exitCode=1;
}
