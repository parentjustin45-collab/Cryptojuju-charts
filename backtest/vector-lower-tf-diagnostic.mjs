/* Lower-timeframe RESEARCH DIAGNOSTIC ONLY: no orders, returns or optimization.
 * 45 days BTC 1H/30M/15M signals; causal 4H & 1H context from CLOSED bars.
 * Separate from all frozen V1.2 1H SHORT prospective protocols. */
import {pathToFileURL} from 'node:url';
import {makeCryptoJujuFetchPage} from './cryptojuju-adapter.mjs';
import {planCleanBacktestWindows} from './quarantine.mjs';
import {vectorAIT} from './vector-ait-v1.mjs';
import {applyVectorConfirmation} from './vector-antiwhipsaw-v12.mjs';

const H=3600000,D=24*H;
const INTERVALS=Object.freeze({'15m':900000,'30m':1800000,'1h':H,'4h':4*H,'1d':D});
const signalModes=['baseline_v11','break_extreme_2'];
export const LTF_LOCK=Object.freeze({
 name:'vector-ltf-feasibility-btc-v1',symbol:'BTCUSDT',historyDays:45,
 entries:['15m','30m','1h'],context:['1h','4h','1d'],
 modes:signalModes,rapidReversalHours:3,minBars:22,
 intent:'Signal density and direction-alignment feasibility ONLY; no profitability comparison.'
});
const direction=v=>v===1?'bull':v===-1?'bear':'neutral';
const sigDir=side=>side==='short'?'bear':'bull';
export function completedContextIndex(windows,step){
 if(![H,4*H,D].includes(step))throw Error('Unsupported context step');
 const byClose=new Map();
 for(const w of windows){
  const bars=w.candles??w;
  if(!Array.isArray(bars)||bars.length<LTF_LOCK.minBars)continue;
  if(bars.some((b,i)=>i>0&&b.time-bars[i-1].time!==step))throw Error('Discontinuous context');
  const v=vectorAIT(bars);
  for(let i=0;i<bars.length;i++)byClose.set(bars[i].time+step,direction(v[i].direction));
 }
 return {step,byClose};
}
export function lastCompletedContext(index,entryTime){
 if(!index)return null;
 const closeTime=Math.floor(entryTime/index.step)*index.step;
 return index.byClose.get(closeTime)??null;
}
const newSide=()=>({signals:0,rapidOppositePairs:0,oppositePairs:0,
 context:Object.fromEntries(['1h','4h','1d'].map(k=>[k,{aligned:0,opposed:0,neutral:0,unknown:0}]))});
function updateMatch(bucket,dir,v){
 const label=v===null?'unknown':v==='neutral'?'neutral':v===dir?'aligned':'opposed';
 bucket[label]++;
}
export function scanLowerTfSignals({entryWindows=[],interval,contexts={}}={}){
 const step=INTERVALS[interval];
 if(!['15m','30m','1h'].includes(interval)||!Array.isArray(entryWindows))
  throw Error('Unsupported lower timeframe');
 const out=Object.fromEntries(signalModes.map(mode=>[mode,{bySide:{long:newSide(),short:newSide()},
  eligibleBars:0,signals:0,rapidOppositePairs:0,oppositePairs:0,rejectedWindows:0}]));
 for(const w of entryWindows){
  const bars=w.candles??w;
  if(!Array.isArray(bars)||bars.length<LTF_LOCK.minBars){
   for(const r of Object.values(out))r.rejectedWindows++;
   continue;
  }
  if(bars.some((b,i)=>i>0&&b.time-bars[i-1].time!==step))throw Error('Discontinuous entry window');
  const raw=vectorAIT(bars);
  for(const mode of signalModes){
   const output=out[mode],events=applyVectorConfirmation(bars,raw,mode).events;
   output.eligibleBars+=bars.length;
   let prior=null;
   for(let i=0;i<events.length-1;i++){
    const signal=events[i].signal;
    if(signal!=='long'&&signal!=='short')continue;
    // Only events having an actual next open inside the continuous window count.
    const entryTime=bars[i+1].time,side=output.bySide[signal],wanted=sigDir(signal);
    output.signals++;side.signals++;
    if(prior&&prior.side!==signal){
     side.oppositePairs++;output.oppositePairs++;
     if(entryTime-prior.entryTime<=LTF_LOCK.rapidReversalHours*H){
      side.rapidOppositePairs++;output.rapidOppositePairs++;
     }
    }
    prior={side:signal,entryTime};
    for(const tf of ['1h','4h','1d']){
     if(tf===interval)continue; // never use current 1h as its own higher TF
     updateMatch(side.context[tf],wanted,lastCompletedContext(contexts[tf],entryTime));
    }
   }
  }
 }
 for(const result of Object.values(out)){
  result.rapidOppositePct=result.oppositePairs?
   Number((100*result.rapidOppositePairs/result.oppositePairs).toFixed(4)):null;
  result.signalsPer1000Bars=result.eligibleBars?
   Number((1000*result.signals/result.eligibleBars).toFixed(4)):null;
 }
 return {interval,step,modes:out,warning:'Signal occurrence only. NOT trades, win rate or returns. Opposite flips are descriptive, not necessarily false signals. Different timeframes have different trade opportunity counts.'};
}
async function readPages(fetchPage,symbol,interval,startTime,endTime){
 const step=INTERVALS[interval],rows=[];
 for(let a=startTime;a<endTime;a+=180*step){
  const b=Math.min(endTime,a+180*step),page=await fetchPage({
   symbol,interval,startTime:a,endTime:b,limit:200
  });
  rows.push(...page.filter(v=>Number(v.time)>=a&&Number(v.time)<b));
 }
 return rows;
}
export async function runLowerTfDiagnostic({now=Date.now(),fetchPage=makeCryptoJujuFetchPage()}={}){
 const endTime=Math.floor(now/H)*H,startTime=endTime-LTF_LOCK.historyDays*D;
 const plans={},coverage={};
 for(const interval of ['1d','4h','1h','30m','15m']){
  const step=INTERVALS[interval],start=Math.floor(startTime/step)*step,end=Math.floor(endTime/step)*step;
  const rows=await readPages(fetchPage,LTF_LOCK.symbol,interval,start,end);
  const plan=planCleanBacktestWindows(rows,{startTime:start,endTime:end,intervalMs:step},{minBars:LTF_LOCK.minBars});
  plans[interval]=plan;
  coverage[interval]={status:plan.status,expectedBars:plan.quality.expected,
   receivedRows:rows.length,excludedBars:plan.excludedBars,
   cleanWindows:plan.eligibleWindows.length,
   coveragePct:Number(plan.quality.coveragePct.toFixed(4))};
 }
 const contexts=Object.fromEntries(['1h','4h','1d'].map(tf=>[
  tf,completedContextIndex(plans[tf].eligibleWindows,INTERVALS[tf])]));
 const comparison=Object.fromEntries(LTF_LOCK.entries.map(tf=>[
  tf,scanLowerTfSignals({interval:tf,entryWindows:plans[tf].eligibleWindows,contexts})]));
 const blocked=LTF_LOCK.entries.some(tf=>coverage[tf].cleanWindows===0);
 return {schemaVersion:1,lock:LTF_LOCK,status:blocked?'INSUFFICIENT_HISTORY':'HISTORICAL_DIAGNOSTIC',
  generatedAt:new Date(now).toISOString(),branch:process.env.GITHUB_REF_NAME??null,
  commit:process.env.GITHUB_SHA??null,coverage,comparison,
  warning:'Historical 45 days have been seen by other experiments and cannot validate profitability. 15M/30M signals and rapid-reversal rates are NOT evidence of precision. No modification to prospective BTC 1H SHORT research.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const report=await runLowerTfDiagnostic();
  console.log(JSON.stringify(report,null,2));
  if(report.status==='INSUFFICIENT_HISTORY')process.exitCode=1;
 }catch(err){console.error(JSON.stringify({status:'ERROR',error:String(err.message??err)}));process.exitCode=1;}
}
