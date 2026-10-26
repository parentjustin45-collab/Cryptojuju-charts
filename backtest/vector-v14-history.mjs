/* Historical exploratory V1.4 state-machine comparison. Never alters frozen
   V1.1/V1.2/V1.3 results or tomorrow's pre-registered prospective controls.
   Compares two distinct objectives: 12h fixed-exit trades and actual flip-to-flip
   direction holding with NO STOP (diagnostic, NOT suitable for live trading).
 */
import {pathToFileURL} from 'node:url';
import {makeCryptoJujuFetchPage} from './cryptojuju-adapter.mjs';
import {planCleanBacktestWindows} from './quarantine.mjs';
import {vectorAIT} from './vector-ait-v1.mjs';
import {applyVectorConfirmation} from './vector-antiwhipsaw-v12.mjs';
import {applyVectorV13} from './vector-v13-regime.mjs';
import {applyVectorV14,VECTOR_V14_LOCK} from './vector-v14-hysteresis.mjs';
import {simulateVectorExitTrade,VECTOR_EXIT_CONFIGS} from './vector-exit-selection.mjs';
const H=3600000,D=24*H,round=x=>x==null?null:Number(x.toFixed(6));
export const V14_HISTORICAL_LOCK=Object.freeze({
 protocol:'v14-regime-hysteresis-180day-exploration-20261025',
 symbols:['BTCUSDT','ETHUSDT','SOLUSDT'],timeframe:'1h',historyDays:180,
 modes:['baseline_v11','break_extreme_2','v13_ema50_slope',VECTOR_V14_LOCK.id],
 sides:['short','long'],exit:'fixed_1_5_3_12',feeRate:0.0006,
 commonSlippageRate:0.0005,harshSlippageRate:0.001,
 rapidFlipHours:3,minClosedPerHalf:30,minimumCleanBars:55,
 reviewStart:'2026-10-10T00:00:00Z',reviewEnd:'2026-10-15T00:00:00Z',
 warning:'User visual examples are October 2026 BTCUSDT 1h Bitunix; exact label timestamps not independently verified. 180d data has been used in earlier research, NOT holdout.'
});
const fixed=VECTOR_EXIT_CONFIGS.find(x=>x.id===V14_HISTORICAL_LOCK.exit);
if(!fixed)throw Error('Unknown frozen fixed-exit model');
function getEvents(bars,raw,mode){
 if(mode===VECTOR_V14_LOCK.id)return applyVectorV14(bars,{rawVector:raw}).events;
 if(mode==='v13_ema50_slope')return applyVectorV13(bars,{mode,rawVector:raw}).events;
 return applyVectorConfirmation(bars,raw,mode).events;
}
function empty(){return {signalCount:0,closed:0,wins:0,sumNetPct:0,
 censored:0,splitCensored:0,windowCensored:0,pending:0,
 reasons:{stop:0,take:0,timeout:0,opposite:0},rapidOppositePairs:0,oppositePairs:0,
 holdBars:0,maximumAdversePct:null,netWorstPct:null};}
function done(v){return {signals:v.signalCount,trades:v.closed,wins:v.wins,
 winRatePct:v.closed?round(100*v.wins/v.closed):null,
 meanNetPct:v.closed?round(v.sumNetPct/v.closed):null,
 meanHoldBars:v.closed?round(v.holdBars/v.closed):null,
 maximumAdversePct:round(v.maximumAdversePct),
 worstNetPct:round(v.netWorstPct),
 rapidOppositePairs:v.rapidOppositePairs,oppositePairs:v.oppositePairs,
 rapidFlipPct:v.oppositePairs?round(100*v.rapidOppositePairs/v.oppositePairs):null,
 censored:v.censored,splitCensored:v.splitCensored,windowCensored:v.windowCensored,
 pending:v.pending,reasons:v.reasons,
 sufficient:v.closed>=V14_HISTORICAL_LOCK.minClosedPerHalf};
}
const addResult=(bin,net,held,adverse=null)=>{
 bin.closed++;bin.wins+=Number(net>0);bin.sumNetPct+=net;bin.holdBars+=held;
 bin.netWorstPct=bin.netWorstPct===null?net:Math.min(bin.netWorstPct,net);
 if(adverse!==null)bin.maximumAdversePct=bin.maximumAdversePct===null?
  adverse:Math.min(adverse,bin.maximumAdversePct);
};
function flipToFlip(bars,events,{cutoffTime,slippageRate}){
 const bins={earlier:empty(),later:empty()};
 const list=[];
 for(let i=0;i<events.length;i++){
  if(events[i].signal&&i+1<bars.length)list.push(i);
 }
 // Only consecutive OPPOSITE accepted signals; abstain if duplicate side or
 // a boundary intervenes. Never pretend the position closed at window end.
 for(let k=0;k<list.length;k++){
  const i=list[k],first=events[i],start=i+1,partition=
   bars[start].time<cutoffTime?'earlier':'later',b=bins[partition];
  if(bars[first.sourceIndex??i].time<cutoffTime&&partition==='later')continue;
  b.signalCount++;
  const j=list[k+1];
  if(j===undefined){b.censored++;b.windowCensored++;continue;}
  const next=events[j],exitIndex=j+1;
  if(next.signal===first.signal||exitIndex>=bars.length){b.censored++;b.windowCensored++;continue;}
  if(partition==='earlier'&&bars[exitIndex].time>=cutoffTime){
   b.censored++;b.splitCensored++;continue;
  }
  const dir=first.signal==='long'?1:-1;
  const entry=Number(bars[start].open)*(1+dir*slippageRate);
  const exit=Number(bars[exitIndex].open)*(1-dir*slippageRate);
  const net=100*(dir*(exit-entry)/entry-
   V14_HISTORICAL_LOCK.feeRate*(1+exit/entry));
  let worst=0;
  for(let h=start;h<exitIndex;h++){
   const adverse=dir===1?Number(bars[h].low):Number(bars[h].high);
   worst=Math.min(worst,100*dir*(adverse-entry)/entry);
  }
  addResult(b,net,exitIndex-start,worst);
  b.reasons.opposite++; // closed only by a confirmed opposite signal, not by a timeout.
  b.oppositePairs++;
  if(exitIndex-start<=V14_HISTORICAL_LOCK.rapidFlipHours)b.rapidOppositePairs++;
 }
 return Object.fromEntries(Object.entries(bins).map(([split,b])=>[split,done(b)]));
}
function fixedBySide(bars,events,{cutoffTime,slippageRate,side}){
 const bins={earlier:empty(),later:empty()};
 let occupied=-1;
 const sigs=[];
 for(let i=0;i<events.length-1;i++)if(events[i].signal)sigs.push(i);
 for(let z=1;z<sigs.length;z++){
  const earlier=sigs[z-1],later=sigs[z];
  if(events[earlier].signal===events[later].signal)continue;
  if(bars[earlier+1].time<cutoffTime!== (bars[later+1].time<cutoffTime))continue;
  const partition=bars[later+1].time<cutoffTime?'earlier':'later';
  const b=bins[partition];b.oppositePairs++;
  if(bars[later].time-bars[earlier].time<=V14_HISTORICAL_LOCK.rapidFlipHours*H)
   b.rapidOppositePairs++;
 }
 for(let i=0;i<events.length-1;i++){
  if(events[i].signal!==side)continue;
  const start=i+1,source=events[i].sourceIndex??i,
   partition=bars[start].time<cutoffTime?'earlier':'later',b=bins[partition];
  if(partition==='later'&&bars[source].time<cutoffTime)continue;
  if(start<=occupied)continue;
  b.signalCount++;
  const result=simulateVectorExitTrade(bars,events,i,side,fixed,{
   cutoffTime,feeRate:V14_HISTORICAL_LOCK.feeRate,slippageRate});
  if(result.status==='closed'){
   addResult(b,result.netPct,result.exitIndex-start+1);
   b.reasons[result.reason]++;occupied=result.exitIndex;
  }else{
   b.censored++;
   if(result.censorReason==='split_boundary')b.splitCensored++;
   else b.windowCensored++;
   occupied=bars.length-1;
   if(partition==='earlier'){
    const t=bars.findIndex(x=>x.time>=cutoffTime);
    if(t>=0)occupied=t-1;
   }
  }
 }
 return Object.fromEntries(Object.entries(bins).map(([split,b])=>[split,done(b)]));
}
export function studyV14History(windows,{cutoffTime,symbol='BTCUSDT'}={}){
 if(!Number.isSafeInteger(cutoffTime)||!Array.isArray(windows))throw Error('Invalid study');
 const accum={};let cleanWindows=0,skippedWindows=0;
 for(const mode of V14_HISTORICAL_LOCK.modes){
  accum[mode]={
   events:[],fixed:Object.fromEntries(V14_HISTORICAL_LOCK.sides.map(side=>[
    side,Object.fromEntries(['common','harsh'].map(cost=>[
     cost,{earlier:empty(),later:empty()}]))])),
   holding:{common:{earlier:empty(),later:empty()},harsh:{earlier:empty(),later:empty()}},
   rapidFlipCount:0,totalOppositePairs:0
  };
 }
 const combine=(d,s)=>{for(const k of ['signalCount','closed','wins','sumNetPct','censored',
  'splitCensored','windowCensored','pending','rapidOppositePairs','oppositePairs','holdBars']){
   d[k]+=s[k];
  }
  for(const k of Object.keys(d.reasons))d.reasons[k]+=s.reasons[k]??0;
  for(const k of ['maximumAdversePct','netWorstPct']){
   if(s[k]!=null)d[k]=d[k]===null?s[k]:Math.min(d[k],s[k]);
  }
 };
 // Helpers produce summarized (not mutable) output. Convert to canonical sums
 // using explicit mean * count; rounding is limited to 6 dp only at output.
 const sumSummary=(dst,s)=>{
  dst.signalCount+=s.signals;dst.closed+=s.trades;dst.wins+=s.wins;
  dst.sumNetPct+=(s.meanNetPct??0)*s.trades;
  dst.censored+=s.censored;dst.splitCensored+=s.splitCensored;
  dst.windowCensored+=s.windowCensored;dst.rapidOppositePairs+=s.rapidOppositePairs;
  dst.oppositePairs+=s.oppositePairs;dst.holdBars+=(s.meanHoldBars??0)*s.trades;
  if(s.maximumAdversePct!=null)dst.maximumAdversePct=dst.maximumAdversePct===null?
   s.maximumAdversePct:Math.min(dst.maximumAdversePct,s.maximumAdversePct);
  if(s.worstNetPct!=null)dst.netWorstPct=dst.netWorstPct===null?
   s.worstNetPct:Math.min(dst.netWorstPct,s.worstNetPct);
  for(const k of Object.keys(dst.reasons))dst.reasons[k]+=s.reasons[k]??0;
 };
 for(const w of windows){
  const bars=w.candles??w;
  if(!Array.isArray(bars)||bars.length<V14_HISTORICAL_LOCK.minimumCleanBars
    ||bars.some((b,i)=>i>0&&b.time-bars[i-1].time!==H)){
   skippedWindows++;continue;
  }
  cleanWindows++;
  const raw=vectorAIT(bars);
  for(const mode of V14_HISTORICAL_LOCK.modes){
   const target=accum[mode],events=getEvents(bars,raw,mode);
   const obs=events.flatMap((e,i)=>e.signal?[{time:bars[i].time,
    side:e.signal,sourceTime:bars[e.sourceIndex??i].time,
    reason:e.why??null}]:[]);
   const reviewStart=Date.parse(V14_HISTORICAL_LOCK.reviewStart),
    reviewEnd=Date.parse(V14_HISTORICAL_LOCK.reviewEnd);
   if(symbol==='BTCUSDT')target.events.push(...obs.filter(v=>v.time>=reviewStart&&v.time<reviewEnd));
   for(const side of V14_HISTORICAL_LOCK.sides)
    for(const [cost,slippageRate] of [['common',V14_HISTORICAL_LOCK.commonSlippageRate],
      ['harsh',V14_HISTORICAL_LOCK.harshSlippageRate]]){
     const bySplit=fixedBySide(bars,events,{cutoffTime,slippageRate,side});
     for(const split of ['earlier','later'])sumSummary(target.fixed[side][cost][split],bySplit[split]);
    }
   for(const [cost,slippageRate] of [['common',V14_HISTORICAL_LOCK.commonSlippageRate],
    ['harsh',V14_HISTORICAL_LOCK.harshSlippageRate]]){
    const bySplit=flipToFlip(bars,events,{cutoffTime,slippageRate});
    for(const split of ['earlier','later'])
     sumSummary(target.holding[cost][split],bySplit[split]);
   }
  }
 }
 return {status:'EXPLORATORY_HISTORY_ONLY',symbol,cutoffTime,
  cleanWindows,skippedWindows,lock:V14_HISTORICAL_LOCK,
  byMode:Object.fromEntries(Object.entries(accum).map(([mode,v])=>[
   mode,{caseReviewEvents:v.events,
    fixed:Object.fromEntries(Object.entries(v.fixed).map(([side,results])=>[
     side,Object.fromEntries(Object.entries(results).map(([cost,splits])=>[
      cost,Object.fromEntries(Object.entries(splits).map(([p,b])=>[p,done(b)]))]))])),
    holding:Object.fromEntries(Object.entries(v.holding).map(([cost,splits])=>[
     cost,Object.fromEntries(Object.entries(splits).map(([p,b])=>[p,done(b)]))]))
   }])),
  warnings:['User screenshots are subjective qualitative evidence; exact bar times require crosshair export.',
   'Hysteresis is predeclared and not chosen using these results. No untouched historical holdout.',
   'Holding exits at NEXT OPEN after opposite closed-bar signal with NO protective stop. Risk can be very large. This is NOT a recommendation or live-executable strategy.',
   'Fixed risk exits at 1.5% SL, 3% TP and max 12 candles are a DIFFERENT strategy than uninterrupted directional holding.',
   'Open, boundary-spanning and gap-crossing episodes are censored and never credited as a win.',
   'Different modes can trade at different times; average trade profit alone does not compare total portfolio performance.']
 };
}
export async function runV14History({now=Date.now(),fetchPage=makeCryptoJujuFetchPage()}={}){
 const lock=V14_HISTORICAL_LOCK,endTime=Math.floor(now/H)*H,
  startTime=endTime-lock.historyDays*D,
  cutoffTime=startTime+Math.floor((endTime-startTime)/2/H)*H;
 const reports=[];
 for(const symbol of lock.symbols){
  try{
   const rows=[];
   for(let a=startTime;a<endTime;a+=180*H){
    const b=Math.min(a+180*H,endTime);
    const page=await fetchPage({symbol,interval:'1h',startTime:a,endTime:b,limit:200});
    rows.push(...page.filter(x=>Number(x.time)>=a&&Number(x.time)<b));
   }
   const q=planCleanBacktestWindows(rows,{startTime,endTime,intervalMs:H},
    {minBars:lock.minimumCleanBars});
   reports.push({symbol,status:q.eligibleWindows.length?'STUDIED':'BLOCKED_HISTORY',
    coverage:{status:q.status,coveragePct:round(q.quality.coveragePct),
     expected:q.quality.expected,rows:rows.length,
     cleanWindows:q.eligibleWindows.length,excludedBars:q.excludedBars},
    study:studyV14History(q.eligibleWindows,{cutoffTime,symbol})});
  }catch(e){reports.push({symbol,status:'ERROR',error:String(e.message??e)});}
 }
 const summary=[];
 for(const r of reports){
  if(r.status!=='STUDIED')continue;
  for(const [mode,v] of Object.entries(r.study.byMode))for(const side of lock.sides){
   const a=v.fixed[side].common.earlier,b=v.fixed[side].common.later,
    h=v.holding.common;
   summary.push({symbol:r.symbol,mode,side,
    fixedEarlierTrades:a.trades,fixedEarlierNetPct:a.meanNetPct,
    fixedLaterTrades:b.trades,fixedLaterNetPct:b.meanNetPct,
    fixedLaterWinPct:b.winRatePct,
    fixedLaterHarshNetPct:v.fixed[side].harsh.later.meanNetPct,
    fixedEarlierSufficient:a.sufficient,fixedLaterSufficient:b.sufficient,
    holdingEarlierEpisodes:h.earlier.trades,holdingEarlierNetPct:h.earlier.meanNetPct,
    holdingLaterEpisodes:h.later.trades,holdingLaterNetPct:h.later.meanNetPct,
    holdingLaterWorstAdversePct:h.later.maximumAdversePct});
  }
 }
 const status=reports.some(x=>x.status==='ERROR')?'PARTIAL_ERROR':
  reports.every(x=>x.status==='BLOCKED_HISTORY')?'BLOCKED_HISTORY':'HISTORICAL_COMPLETE';
 return {schemaVersion:1,status,generatedAt:new Date(now).toISOString(),
  branch:process.env.GITHUB_REF_NAME??null,commit:process.env.GITHUB_SHA??null,
  runId:process.env.GITHUB_RUN_ID??null,period:{startTime,endTime,cutoffTime},
  lock,source:'Bitunix readonly klines via CryptoJuju proxy',summary,reports};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const result=await runV14History();console.log(JSON.stringify(result,null,2));
 if(result.status!=='HISTORICAL_COMPLETE')process.exitCode=1;
}
