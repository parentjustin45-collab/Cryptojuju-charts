/* Vector V1.5 research: compare baseline / V1.2 / V1.4 / V1.5 and
   explicitly measure opportunity COST of rejected opposite signals.
   After-signal prices are for RETROSPECTIVE DIAGNOSTICS ONLY, not features.
   The same 180d history was previously inspected: never label holdout.
 */
import {pathToFileURL} from 'node:url';
import {vectorAIT} from './vector-ait-v1.mjs';
import {applyVectorConfirmation} from './vector-antiwhipsaw-v12.mjs';
import {applyVectorV14,VECTOR_V14_LOCK} from './vector-v14-hysteresis.mjs';
import {applyVectorV15,V15_LOCK} from './vector-v15-followthrough.mjs';
import {simulateVectorExitTrade,VECTOR_EXIT_CONFIGS} from './vector-exit-selection.mjs';
import {planCleanBacktestWindows} from './quarantine.mjs';
import {makeCryptoJujuFetchPage} from './cryptojuju-adapter.mjs';
const H=3600000,D=24*H,round=n=>n==null?null:Number(n.toFixed(6));
export const MISSED_REVERSAL_LOCK=Object.freeze({
 protocol:'v15-btc-eth-sol-opportunity-cost-v1',historyDays:180,
 symbols:['BTCUSDT','ETHUSDT','SOLUSDT'],timeframe:'1h',
 modes:['baseline_v11','break_extreme_2',VECTOR_V14_LOCK.id,V15_LOCK.protocol],
 sides:['short','long'],exit:'fixed_1_5_3_12',
 cost:{feeRate:.0006,commonSlippagePerSide:.0005,harshSlippagePerSide:.001},
 horizonBars:12,missedReturnThresholdPct:.4,
 missedMfeThresholdPct:.8,minTradesPerHalf:30,minBars:55,
 qualitativeReviewStart:'2026-10-10T00:00:00Z',
 qualitativeReviewEnd:'2026-10-15T00:00:00Z',
 warning:'User-selected screenshot dates are retrospectively chosen. Historical years already researched, NEVER use as new holdout.'
});
const exit=VECTOR_EXIT_CONFIGS.find(v=>v.id===MISSED_REVERSAL_LOCK.exit);
if(!exit)throw Error('Frozen simulator config unavailable');
const bucket=()=>({signals:0,trades:0,wins:0,sumNet:0,
 censored:0,stop:0,take:0,timeout:0,
 worstNet:null,delayed:0});
function add(a,b){
 for(const field of ['signals','trades','wins','sumNet','censored','stop','take','timeout','delayed'])a[field]+=b[field];
 if(b.worstNet!==null)a.worstNet=a.worstNet===null?b.worstNet:Math.min(a.worstNet,b.worstNet);
}
const finish=b=>({signals:b.signals,trades:b.trades,wins:b.wins,
 winRatePct:b.trades?round(100*b.wins/b.trades):null,
 meanNetPct:b.trades?round(b.sumNet/b.trades):null,
 worstNetPct:round(b.worstNet),delayed:b.delayed,censored:b.censored,
 stops:b.stop,takes:b.take,timeouts:b.timeout,
 sampleSufficient:b.trades>=MISSED_REVERSAL_LOCK.minTradesPerHalf});
function evaluateRisk(bars,events,side,cutoffTime,slippageRate){
 const bins={earlier:bucket(),later:bucket()};let occupied=-1;
 for(let i=0;i<events.length-1;i++){
  const e=events[i];if(e.signal!==side)continue;
  const start=i+1,part=bars[start].time<cutoffTime?'earlier':'later',b=bins[part];
  if(part==='later'&&bars[e.sourceIndex??i].time<cutoffTime)continue;
  if(start<=occupied)continue;
  b.signals++;if((e.delayBars??0)>0)b.delayed++;
  const trade=simulateVectorExitTrade(bars,events,i,side,exit,{
   cutoffTime,feeRate:MISSED_REVERSAL_LOCK.cost.feeRate,slippageRate});
  if(trade.status==='closed'){
   b.trades++;b.wins+=Number(trade.netPct>0);b.sumNet+=trade.netPct;
   b.worstNet=b.worstNet===null?trade.netPct:Math.min(b.worstNet,trade.netPct);
   b[trade.reason]++;
   occupied=trade.exitIndex;
  }else{
   b.censored++;occupied=bars.length-1;
   if(part==='earlier'){
    const firstLater=bars.findIndex(x=>x.time>=cutoffTime);
    if(firstLater>=0)occupied=firstLater-1;
   }
  }
 }
 return bins;
}
function auditBucket(){return {
 considered:0,accepted:0,alreadyAligned:0,rejected:0,
 futureEligible:0,futureCensored:0,acceptedFutureObserved:0,rejectedFutureObserved:0,
 rejectedOpportunity:0,rejectedNegative:0,rejectedUnclear:0,
 rejectedGrossSum:0,acceptedGrossSum:0,
 rejectedMfeSum:0,acceptedMfeSum:0,
 extremeAdversePct:null
};}
function auditAdd(a,b){
 for(const key of Object.keys(a)){
  if(key==='extremeAdversePct'){
   if(b[key]!=null)a[key]=a[key]===null?b[key]:Math.min(a[key],b[key]);
  }else a[key]+=b[key];
 }
}
const finishAudit=b=>({...b,
 rejectedMeanGrossPct:b.rejectedFutureObserved?round(b.rejectedGrossSum/b.rejectedFutureObserved):null,
 acceptedMeanGrossPct:b.acceptedFutureObserved?round(b.acceptedGrossSum/b.acceptedFutureObserved):null,
 note:'12h gross next-open to future-close outcomes known only after the event; they are never used by any filter or live decision.'
});
function observedPath(bars,i,dir){
 const entry=Number(bars[i+1].open);
 const future=bars.slice(i+1,i+1+MISSED_REVERSAL_LOCK.horizonBars);
 const extreme=dir===1?Math.max(...future.map(x=>Number(x.high))):
  Math.min(...future.map(x=>Number(x.low)));
 const adverse=dir===1?Math.min(...future.map(x=>Number(x.low))):
  Math.max(...future.map(x=>Number(x.high)));
 return {
  grossPct:100*dir*(Number(future.at(-1).close)-entry)/entry,
  mfePct:100*dir*(extreme-entry)/entry,
  adversePct:100*dir*(adverse-entry)/entry
 };
}
function candidateDisposition(i,side,events){
 const wanted=side==='long'?1:-1;
 if(i>0&&events[i-1].direction===wanted)return 'alreadyAligned';
 for(let j=i;j<=Math.min(i+3,events.length-1);j++){
  if(events[j].signal===side && (events[j].sourceIndex??j)===i)return 'accepted';
 }
 return 'rejected';
}
function auditRejections(bars,baseline,filtered,cutoffTime,review){
 const bins={earlier:auditBucket(),later:auditBucket()};
 for(let i=0;i<baseline.length;i++){
  const b=baseline[i],side=b.signal;
  if(side!=='long'&&side!=='short')continue;
  const part=bars[i].time<cutoffTime?'earlier':'later',bucket=bins[part];
  if(!Number.isFinite(Number(bars[i].time)))continue;
  const disp=candidateDisposition(i,side,filtered);
  bucket.considered++;bucket[disp]++;
  const date=bars[i].time,reviewed=date>=review.start&&date<review.end;
  const futureEnd=i+MISSED_REVERSAL_LOCK.horizonBars;
  // DO NOT accept future after split or missing-window end.
  const canStudy=futureEnd<bars.length &&
    !(part==='earlier'&&bars[futureEnd].time>=cutoffTime);
  let outcome=null;
  if(!canStudy){bucket.futureCensored++;}
  else if(disp!=='alreadyAligned'){
   outcome=observedPath(bars,i,side==='long'?1:-1);
   bucket.futureEligible++;
   if(disp==='rejected'){
    bucket.rejectedFutureObserved++;
    bucket.rejectedGrossSum+=outcome.grossPct;
    bucket.rejectedMfeSum+=outcome.mfePct;
    if(outcome.grossPct>=MISSED_REVERSAL_LOCK.missedReturnThresholdPct &&
       outcome.mfePct>=MISSED_REVERSAL_LOCK.missedMfeThresholdPct)
      bucket.rejectedOpportunity++;
    else if(outcome.grossPct<=0)bucket.rejectedNegative++;
    else bucket.rejectedUnclear++;
   }else{
    bucket.acceptedFutureObserved++;
    bucket.acceptedGrossSum+=outcome.grossPct;
    bucket.acceptedMfeSum+=outcome.mfePct;
   }
   bucket.extremeAdversePct=bucket.extremeAdversePct===null?outcome.adversePct:
    Math.min(bucket.extremeAdversePct,outcome.adversePct);
  }
  if(reviewed)review.push({time:date,side,disposition:disp,
   gross12hPct:outcome?round(outcome.grossPct):null,
   mfe12hPct:outcome?round(outcome.mfePct):null,
   adverse12hPct:outcome?round(outcome.adversePct):null,
   futureCensored:!canStudy});
 }
 return bins;
}
export function studyMissedReversals(windows,{cutoffTime,symbol='BTCUSDT'}={}){
 if(!Array.isArray(windows)||!Number.isSafeInteger(cutoffTime))throw Error('Invalid comparative study');
 const result=Object.fromEntries(MISSED_REVERSAL_LOCK.modes.map(mode=>[mode,{
  fixed:Object.fromEntries(MISSED_REVERSAL_LOCK.sides.map(side=>[side,{
   common:{earlier:bucket(),later:bucket()},harsh:{earlier:bucket(),later:bucket()}}])),
  opportunity:{earlier:auditBucket(),later:auditBucket()},eventsInReview:[],
  usedWindows:0
 }]));
 let rejectedWindows=0;
 for(const w of windows){
  const bars=w.candles??w;
  if(bars.length<MISSED_REVERSAL_LOCK.minBars ||
    bars.some((x,i)=>i>0&&x.time-bars[i-1].time!==H)){
   rejectedWindows++;continue;
  }
  const raw=vectorAIT(bars),evs={
   baseline_v11:applyVectorConfirmation(bars,raw,'baseline_v11').events,
   break_extreme_2:applyVectorConfirmation(bars,raw,'break_extreme_2').events,
   [VECTOR_V14_LOCK.id]:applyVectorV14(bars,{rawVector:raw}).events,
   [V15_LOCK.protocol]:applyVectorV15(bars,{rawVector:raw}).events
  };
  const review={start:Date.parse(MISSED_REVERSAL_LOCK.qualitativeReviewStart),
   end:Date.parse(MISSED_REVERSAL_LOCK.qualitativeReviewEnd)};
  for(const mode of MISSED_REVERSAL_LOCK.modes){
   const d=result[mode],events=evs[mode];d.usedWindows++;
   if(symbol==='BTCUSDT')d.eventsInReview.push(...events.flatMap((x,i)=>
    x.signal&&bars[i].time>=review.start&&bars[i].time<review.end?
    [{time:bars[i].time,side:x.signal,reason:x.why??null,
     sourceTime:bars[x.sourceIndex??i].time}]:[]));
   for(const side of MISSED_REVERSAL_LOCK.sides)for(const [cost,rate] of [
    ['common',MISSED_REVERSAL_LOCK.cost.commonSlippagePerSide],
    ['harsh',MISSED_REVERSAL_LOCK.cost.harshSlippagePerSide]]){
    const bins=evaluateRisk(bars,events,side,cutoffTime,rate);
    for(const split of ['earlier','later'])add(d.fixed[side][cost][split],bins[split]);
   }
   if(mode!=='baseline_v11'){
    const bins=auditRejections(bars,evs.baseline_v11,events,cutoffTime,[]);
    for(const split of ['earlier','later'])auditAdd(d.opportunity[split],bins[split]);
   }
  }
 }
 return {status:'EXPLORATORY_HISTORICAL_NOT_HOLDOUT',
  symbol,cutoffTime,rejectedWindows,lock:MISSED_REVERSAL_LOCK,
  byMode:Object.fromEntries(Object.entries(result).map(([mode,x])=>[mode,{
   usedWindows:x.usedWindows,eventsInReview:x.eventsInReview,
   fixed:Object.fromEntries(Object.entries(x.fixed).map(([side,vals])=>[
    side,Object.fromEntries(Object.entries(vals).map(([cost,splits])=>[cost,
     Object.fromEntries(Object.entries(splits).map(([period,b])=>[period,finish(b)]))
    ]))])),
   opportunity:Object.fromEntries(Object.entries(x.opportunity).map(([split,v])=>[
    split,finishAudit(v)]))
  }])),
  warnings:[
   'Opportunity labels are after-the-fact, use only future 12h for RETROSPECTIVE validation, never generate signals with future data.',
   'A rejected signal aligned with the active direction is ALREADY_ALIGNED, not a missed reversal.',
   'A lower number of false flips does not guarantee higher trade returns or smaller drawdowns.',
   'Censored future 12h returns are excluded; remaining means can be biased.',
   'The compared strategies trade independently. Mean net return per closed trade is not portfolio yield.',
   'TradingView timezone/crosshair symbol and screenshots not validated at exact timestamps.']
 };
}
async function fetchRows(fetchPage,symbol,start,end){
 const rows=[];
 for(let a=start;a<end;a+=180*H){
  const b=Math.min(a+180*H,end);
  const page=await fetchPage({symbol,interval:'1h',startTime:a,endTime:b,limit:200});
  rows.push(...page.filter(v=>Number(v.time)>=a&&Number(v.time)<b));
 }
 return rows;
}
export async function runMissedReversals({now=Date.now(),fetchPage=makeCryptoJujuFetchPage()}={}){
 const end=Math.floor(now/H)*H,start=end-MISSED_REVERSAL_LOCK.historyDays*D,
  cutoff=start+MISSED_REVERSAL_LOCK.historyDays/2*D;
 const reports=[];
 for(const symbol of MISSED_REVERSAL_LOCK.symbols){
  try{
   const rows=await fetchRows(fetchPage,symbol,start,end);
   const q=planCleanBacktestWindows(rows,{startTime:start,endTime:end,intervalMs:H},
    {minBars:MISSED_REVERSAL_LOCK.minBars});
   const study=studyMissedReversals(q.eligibleWindows,{cutoffTime:cutoff,symbol});
   reports.push({symbol,status:q.eligibleWindows.length?'STUDIED':'BLOCKED_HISTORY',
    coverage:{status:q.status,expected:q.quality.expected,received:rows.length,
     validPct:round(q.quality.coveragePct),excluded:q.excludedBars,
     windows:q.eligibleWindows.length},study});
  }catch(e){reports.push({symbol,status:'ERROR',error:String(e.message??e)});}
 }
 const summary=[];
 for(const r of reports){
  if(r.status!=='STUDIED')continue;
  for(const mode of MISSED_REVERSAL_LOCK.modes){
   const it=r.study.byMode[mode];
   for(const side of MISSED_REVERSAL_LOCK.sides){
    const a=it.fixed[side].common.earlier,b=it.fixed[side].common.later,
     stress=it.fixed[side].harsh.later;
    summary.push({symbol:r.symbol,mode,side,earlierTrades:a.trades,
     earlierMeanNetPct:a.meanNetPct,laterTrades:b.trades,
     laterMeanNetPct:b.meanNetPct,laterWinRatePct:b.winRatePct,
     laterHarshNetPct:stress.meanNetPct,laterSufficient:b.sampleSufficient});
   }
  }
 }
 return {schemaVersion:1,status:reports.some(x=>x.status==='ERROR')?'PARTIAL_ERROR':
  reports.every(x=>x.status==='BLOCKED_HISTORY')?'BLOCKED_HISTORY':'HISTORICAL_COMPLETE',
  generatedAt:new Date(now).toISOString(),branch:process.env.GITHUB_REF_NAME??null,
  commit:process.env.GITHUB_SHA??null,runId:process.env.GITHUB_RUN_ID??null,
  history:{start,end,cutoff},source:'read-only Bitunix futures OHLC via CryptoJuju proxy',
  lock:MISSED_REVERSAL_LOCK,reports,summary,
  recommendationPolicy:'Never promote candidate on this over-researched history; review rejected good and bad outcomes across BTC ETH SOL and compare costs, then independent forward data.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const report=await runMissedReversals();
 console.log(JSON.stringify(report,null,2));
 if(report.status!=='HISTORICAL_COMPLETE')process.exitCode=1;
}
