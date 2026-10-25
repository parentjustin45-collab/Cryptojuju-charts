/* Research-only comparable SHORT Vector 15m/30m/1h execution study.
   Identical SL/TP and 12 CLOCK HOURS max exposure, not 12 candles on every TF.
   A 4h-bear-only strategy is simulated separately, with its own occupied state.
   Historical data was previously viewed: later split is NOT untouched holdout. */
import {pathToFileURL} from 'node:url';
import {makeCryptoJujuFetchPage} from './cryptojuju-adapter.mjs';
import {planCleanBacktestWindows} from './quarantine.mjs';
import {vectorAIT} from './vector-ait-v1.mjs';
import {applyVectorConfirmation} from './vector-antiwhipsaw-v12.mjs';
import {simulateVectorExitTrade} from './vector-exit-selection.mjs';
import {completedContextIndex,lastCompletedContext} from './vector-lower-tf-diagnostic.mjs';

const H=3600000, D=24*H;
export const LTF_EXECUTION_LOCK=Object.freeze({
 protocol:'vector-ltf-btc-short-equal-12h-exits-v1',
 symbol:'BTCUSDT',side:'short',historyDays:90,
 intervals:Object.freeze({'15m':900000,'30m':1800000,'1h':H}),
 modeIds:['baseline_v11','break_extreme_2'],
 filters:['unfiltered','bear_4h'],
 scenarios:Object.freeze({zero:0,common_slippage:0.0005,
  timeframe_stress:Object.freeze({'15m':0.001,'30m':0.00075,'1h':0.0005})}),
 feeRate:0.0006, stopPct:1.5,takePct:3,maxHoldingHours:12,
 minClosedTradesPerPartition:30,minBars:22,
 note:'45-90 day earlier Vector explorations already informed this work. No true untouched holdout, no deployment.'
});
const N=n=>n===null?null:Number(n.toFixed(6));
const configFor=tf=>{
 const step=LTF_EXECUTION_LOCK.intervals[tf];
 if(!step)throw Error('Invalid timeframe');
 return {id:'equal_12h_exit',family:'fixed',stopPct:1.5,takePct:3,
  maxBars:LTF_EXECUTION_LOCK.maxHoldingHours*H/step};
};
const newCount=()=>({signals:0,closed:0,wins:0,sumNetPct:0,censored:0,
 censoredSplit:0,censoredWindow:0,filteredOut:0,contextUnknown:0,boundaryExcluded:0,
 reasons:{stop:0,take:0,timeout:0},sumBarsHeld:0});
const finish=b=>({
 signals:b.signals,trades:b.closed,wins:b.wins,
 winRatePct:b.closed?N(100*b.wins/b.closed):null,
 meanNetPct:b.closed?N(b.sumNetPct/b.closed):null,
 tradesPerSignalPct:b.signals?N(100*b.closed/b.signals):null,
 censored:b.censored,censoredSplit:b.censoredSplit,censoredWindow:b.censoredWindow,
 filteredOut:b.filteredOut,contextUnknown:b.contextUnknown,boundaryExcluded:b.boundaryExcluded,
 reasons:b.reasons,meanBarsHeld:b.closed?N(b.sumBarsHeld/b.closed):null,
 sufficientSample:b.closed>=LTF_EXECUTION_LOCK.minClosedTradesPerPartition
});
function evaluateScenario(windows,{interval,mode,filter,slippage,cutoffTime,context4h}){
 const step=LTF_EXECUTION_LOCK.intervals[interval],cfg=configFor(interval);
 if(!Array.isArray(windows)||!Number.isSafeInteger(cutoffTime)
   ||!LTF_EXECUTION_LOCK.modeIds.includes(mode)
   ||!LTF_EXECUTION_LOCK.filters.includes(filter)
   ||!Number.isFinite(slippage)||slippage<0)throw Error('Invalid experiment arguments');
 const counts={earlier:newCount(),later:newCount()};
 let rejectedWindows=0,eligibleWindows=0;
 for(const w of windows){
  const bars=w.candles??w;
  if(!Array.isArray(bars)||bars.length<LTF_EXECUTION_LOCK.minBars){rejectedWindows++;continue;}
  if(bars.some((b,i)=>!Number.isSafeInteger(b.time)||
    (i>0&&b.time-bars[i-1].time!==step))){rejectedWindows++;continue;}
  eligibleWindows++;
  const raw=vectorAIT(bars),events=applyVectorConfirmation(bars,raw,mode).events;
  let occupiedUntil=-1;
  for(let i=0;i<events.length-1;i++){
   const event=events[i];if(event.signal!=='short')continue;
   const start=i+1,entryTime=bars[start].time,
    split=entryTime<cutoffTime?'earlier':'later',bucket=counts[split];
   // Original V1.1 or delayed Vector must be sourced in same chronological partition.
   const source=event.sourceIndex??i;
   if(split==='later'&&bars[source].time<cutoffTime){bucket.boundaryExcluded++;continue;}
   if(start<=occupiedUntil)continue;
   const h4=lastCompletedContext(context4h,entryTime);
   if(filter==='bear_4h'&&h4!=='bear'){
    if(h4===null)bucket.contextUnknown++;
    bucket.filteredOut++;continue;
   }
   if(h4===null&&filter==='unfiltered')bucket.contextUnknown++;
   bucket.signals++;
   const trade=simulateVectorExitTrade(bars,events,i,'short',cfg,{
    cutoffTime,feeRate:LTF_EXECUTION_LOCK.feeRate,slippageRate:slippage
   });
   if(trade.status==='closed'){
    bucket.closed++;bucket.wins+=Number(trade.netPct>0);
    bucket.sumNetPct+=trade.netPct;bucket.reasons[trade.reason]++;
    bucket.sumBarsHeld+=trade.exitIndex-start+1;
    occupiedUntil=trade.exitIndex;
   }else{
    bucket.censored++;
    if(trade.censorReason==='split_boundary')bucket.censoredSplit++;
    else bucket.censoredWindow++;
    occupiedUntil=bars.length-1;
    if(split==='earlier'){
     const next=bars.findIndex(b=>b.time>=cutoffTime);
     if(next>=0)occupiedUntil=next-1;
    }
   }
  }
 }
 return {partitions:Object.fromEntries(Object.entries(counts).map(([key,b])=>[key,finish(b)])),
  excludedWindows:rejectedWindows,eligibleWindows};
}
export function compareLowerTfExits({windowsByTf={},context4h=null,cutoffTime}={}){
 if(!Number.isSafeInteger(cutoffTime))throw Error('cutoffTime required');
 const out={};
 for(const tf of Object.keys(LTF_EXECUTION_LOCK.intervals)){
  const windows=windowsByTf[tf]??[];
  out[tf]={exitMaxBars:configFor(tf).maxBars,modeResults:{}};
  for(const mode of LTF_EXECUTION_LOCK.modeIds){
   out[tf].modeResults[mode]={};
   for(const filter of LTF_EXECUTION_LOCK.filters){
    const results={};
    for(const [scenario,rate] of Object.entries(LTF_EXECUTION_LOCK.scenarios)){
     const slip=typeof rate==='number'?rate:rate[tf];
     results[scenario]={slippagePerSide:slip,...evaluateScenario(windows,{
      interval:tf,mode,filter,slippage:slip,cutoffTime,context4h})};
    }
    out[tf].modeResults[mode][filter]=results;
   }
  }
 }
 return {status:'HISTORICAL_RESEARCH_ONLY',cutoffTime,lock:LTF_EXECUTION_LOCK,byTimeframe:out,
  warnings:[
   'A 12h horizon is 48x 15m, 24x 30m, 12x 1h, not identical 12-candle exits.',
   'Each timeframe calculates independent signals; a same-day trade count or capital return is not directly comparable.',
   'The 4h filtered strategy has independent non-overlap/position occupancy; skipping trades changes subsequent opportunities.',
   'Half-period later data is not an untouched out-of-sample validation: historical research already examined this market.',
   'Samples with fewer than 30 CLOSED trades per partition are insufficient; censored trades excluded.',
   'Closed-bar signals enter next open; gap fills use actual open; ambiguous intrabar stop first; no Pine Script parity verified.',
   'Mean returns are net % per closed trade, NOT compounded portfolio performance or trade recommendations.'
  ]};
}
async function getRows(fetchPage,symbol,interval,step,startTime,endTime){
 const output=[];
 for(let start=startTime;start<endTime;start+=180*step){
  const end=Math.min(start+180*step,endTime);
  const page=await fetchPage({symbol,interval,startTime:start,endTime:end,limit:200});
  output.push(...page.filter(b=>Number(b.time)>=start&&Number(b.time)<end));
 }
 return output;
}
export async function runLowerTfExits({now=Date.now(),fetchPage=makeCryptoJujuFetchPage()}={}){
 const lock=LTF_EXECUTION_LOCK,endTime=Math.floor(now/H)*H,
 startTime=endTime-lock.historyDays*D,cutoffTime=startTime+(endTime-startTime)/2;
 const plans={},coverage={};
 for(const [tf,step] of [['4h',4*H],...Object.entries(lock.intervals)]){
  const from=Math.floor(startTime/step)*step,to=Math.floor(endTime/step)*step;
  const rows=await getRows(fetchPage,lock.symbol,tf,step,from,to);
  const plan=planCleanBacktestWindows(rows,{startTime:from,endTime:to,intervalMs:step},{minBars:lock.minBars});
  plans[tf]=plan;
  coverage[tf]={status:plan.status,expectedBars:plan.quality.expected,
   receivedBars:rows.length,excludedBars:plan.excludedBars,
   coveragePct:N(plan.quality.coveragePct),eligibleWindows:plan.eligibleWindows.length};
 }
 const context4h=completedContextIndex(plans['4h'].eligibleWindows,4*H);
 const study=compareLowerTfExits({windowsByTf:Object.fromEntries(Object.keys(lock.intervals)
  .map(tf=>[tf,plans[tf].eligibleWindows])),context4h,cutoffTime});
 const ok=Object.keys(lock.intervals).every(tf=>plans[tf].eligibleWindows.length);
 return {schemaVersion:1,status:ok?'HISTORICAL_COMPLETE':'INSUFFICIENT_HISTORY',
  generatedAt:new Date(now).toISOString(),source:'Bitunix read-only futures klines through CryptoJuju proxy',
  branch:process.env.GITHUB_REF_NAME??null,commit:process.env.GITHUB_SHA??null,
  runId:process.env.GITHUB_RUN_ID??null,startTime,endTime,coverage,...study,
  status:ok?'HISTORICAL_COMPLETE':'INSUFFICIENT_HISTORY'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const v=await runLowerTfExits();console.log(JSON.stringify(v,null,2));
  if(v.status==='INSUFFICIENT_HISTORY')process.exitCode=1;
 }catch(e){console.error(JSON.stringify({status:'ERROR',message:String(e.message??e)}));process.exitCode=1;}
}
