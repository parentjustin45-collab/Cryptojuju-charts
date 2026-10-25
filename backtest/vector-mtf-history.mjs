/* Historical exploratory top-down Vector audit: BTC 1H SHORT with 4H/1D CONTEXT.
   This is NOT the post-2026-10-26 prospective holdout, not a live strategy,
   not an optimization, and it never changes the locked experiment or production. */
import {pathToFileURL} from 'node:url';
import {vectorAIT} from './vector-ait-v1.mjs';
import {applyVectorConfirmation} from './vector-antiwhipsaw-v12.mjs';
import {simulateVectorExitTrade,VECTOR_EXIT_CONFIGS} from './vector-exit-selection.mjs';
import {buildCompletedVectorContext,contextAtEntry} from './vector-prospective-v12.mjs';
import {planCleanBacktestWindows} from './quarantine.mjs';
import {makeCryptoJujuFetchPage} from './cryptojuju-adapter.mjs';

const H=3600000,D=24*H;
const tfMillis=Object.freeze({'1h':H,'4h':4*H,'1d':D});
const exit=VECTOR_EXIT_CONFIGS.find(x=>x.id==='fixed_1_5_3_12');
if(!exit)throw Error('Fixed Vector exit missing');
export const MTF_AUDIT_LOCK=Object.freeze({
 symbol:'BTCUSDT',entryInterval:'1h',contextIntervals:['4h','1d'],
 modes:['baseline_v11','break_extreme_2'],side:'short',historyDays:365,
 feeRate:0.0006,stressSlippageRate:0.0005,minimumCohortTrades:30,
 exitId:'fixed_1_5_3_12',
 note:'Exploratory historical cohorts only; this history was already used in earlier Vector studies.'
});
const cohortNames=['all','bear_4h','bear_1d','bear_both','bull_both','unknown_context'];
const summarize=n=>({trades:n.trades,wins:n.wins,winRatePct:n.trades?Number((100*n.wins/n.trades).toFixed(4)):null,
 meanNetPct:n.trades?Number((n.netSum/n.trades).toFixed(6)):null,
 sampleSufficient:n.trades>=MTF_AUDIT_LOCK.minimumCohortTrades});
const empty=()=>({trades:0,wins:0,netSum:0});
const cohortFor=(h4,d1)=>({
 all:true,bear_4h:h4==='bear',bear_1d:d1==='bear',bear_both:h4==='bear'&&d1==='bear',
 bull_both:h4==='bull'&&d1==='bull',unknown_context:h4===null||d1===null
});
function checkWindow(bars){
 if(!Array.isArray(bars)||bars.length<22)return false;
 const period=H;
 return bars.every((b,i)=>Number.isSafeInteger(b.time)&&
  (i===0||b.time-bars[i-1].time===period));
}
function auditMode(hourWindows,context,mode,cutoffTime){
 const matrix=Object.fromEntries(['earlier','later'].map(p=>[p,
  Object.fromEntries(['baseline','stress'].map(s=>[s,
   Object.fromEntries(cohortNames.map(c=>[c,empty()]))]))]));
 const diagnostics={signals:0,closed:0,censored:0,censoredAtCutoff:0,censoredAtWindow:0,
   rejectedWindows:0,usableWindows:0,observations:0,contextUnknown:0,boundaryExcluded:0};
 for(const w of hourWindows){
  const bars=w.candles??w;
  if(!checkWindow(bars)){diagnostics.rejectedWindows++;continue;}
  diagnostics.usableWindows++;
  const raw=vectorAIT(bars);
  const events=applyVectorConfirmation(bars,raw,mode).events;
  // Non-overlap is evaluated INDEPENDENTLY for each execution-cost scenario.
  for(const [scenario,slippage] of [['baseline',0],['stress',MTF_AUDIT_LOCK.stressSlippageRate]]){
   let occupied=-1;
   for(let i=0;i<events.length;i++){
    if(events[i].signal!=='short')continue;
    const entryIndex=i+1;
    if(entryIndex>=bars.length){continue;}
    if(entryIndex<=occupied)continue;
    const sourceIndex=events[i].sourceIndex??i;
    const entryTime=bars[entryIndex].time;
    // Delayed confirmation initiated earlier must never count as fresh later signal.
    if(entryTime>=cutoffTime && bars[sourceIndex].time<cutoffTime){
     if(scenario==='baseline')diagnostics.boundaryExcluded++;
     continue;
    }
    if(scenario==='baseline')diagnostics.signals++;
    const split=entryTime<cutoffTime?'earlier':'later';
    const trade=simulateVectorExitTrade(bars,events,i,'short',exit,{
      cutoffTime,feeRate:MTF_AUDIT_LOCK.feeRate,slippageRate:slippage
    });
    if(trade.status==='closed'){
     occupied=trade.exitIndex;
     const h4=contextAtEntry(context.h4,entryTime);
     const d1=contextAtEntry(context.d1,entryTime);
     const match=cohortFor(h4,d1);
     if(scenario==='baseline'){
      diagnostics.closed++;diagnostics.observations++;
      if(match.unknown_context)diagnostics.contextUnknown++;
     }
     for(const name of cohortNames)if(match[name]){
      const bucket=matrix[split][scenario][name];
      bucket.trades++;bucket.wins+=Number(trade.netPct>0);bucket.netSum+=trade.netPct;
     }
    }else{
     if(scenario==='baseline'){
      diagnostics.censored++;
      if(trade.censorReason==='split_boundary')diagnostics.censoredAtCutoff++;
      else diagnostics.censoredAtWindow++;
     }
     occupied=bars.length-1;
     if(split==='earlier'){
      const idx=bars.findIndex(b=>b.time>=cutoffTime);
      if(idx>=0)occupied=idx-1;
     }
    }
   }
  }
 }
 return {mode,diagnostics,splits:Object.fromEntries(Object.entries(matrix).map(([split,scenarios])=>
  [split,Object.fromEntries(Object.entries(scenarios).map(([scenario,cohorts])=>
    [scenario,Object.fromEntries(Object.entries(cohorts).map(([label,x])=>[label,summarize(x)]))]))]))};
}
export function studyHistoricalMtf({hourWindows=[],h4Windows=[],d1Windows=[],cutoffTime}={}){
 if(!Number.isSafeInteger(cutoffTime)||!Array.isArray(hourWindows)||!Array.isArray(h4Windows)||!Array.isArray(d1Windows))
  throw Error('Expected chronological clean windows and chronological cutoffTime');
 const context={
  h4:buildCompletedVectorContext(h4Windows,4*H),
  d1:buildCompletedVectorContext(d1Windows,D)
 };
 return {status:'EXPLORATORY_ONLY',cutoffTime,locks:MTF_AUDIT_LOCK,
  interpretations:{
   all:'Original SHORT signals without higher-timeframe filtering',
   bear_4h:'Of original SHORT trades, those entered while last closed 4H Vector direction is bearish',
   bear_1d:'Of original SHORT trades, those entered while last closed 1D Vector direction is bearish',
   bear_both:'Of original SHORT trades, both last CLOSED 4H and 1D bearish',
   bull_both:'Of original SHORT trades, both last CLOSED 4H and 1D bullish',
   unknown_context:'Of original SHORT trades, last expected closed 4H or 1D Vector direction unavailable',
   caution:'Cohorts overlap. These are descriptive returns on subsets of a fixed unfiltered trade stream, not a filtered portfolio simulation. Earlier/later periods are both historically reused; later is NOT an untouched holdout for V1.2.'
  },
  modes:Object.fromEntries(MTF_AUDIT_LOCK.modes.map(mode=>[mode,auditMode(hourWindows,context,mode,cutoffTime)]))};
}
async function fetchHistory(fetchPage,symbol,interval,startTime,endTime){
 const step=tfMillis[interval],rows=[];
 for(let start=startTime;start<endTime;start+=180*step){
  const end=Math.min(start+180*step,endTime);
  const page=await fetchPage({symbol,interval,startTime:start,endTime:end,limit:200});
  rows.push(...page.filter(x=>Number(x.time)>=start&&Number(x.time)<end));
 }
 return rows;
}
export async function runHistoricalMtf({now=Date.now(),fetchPage=makeCryptoJujuFetchPage()}={}){
 const endTime=Math.floor(now/H)*H,startTime=endTime-MTF_AUDIT_LOCK.historyDays*D;
 const plans={},coverage={};
 for(const interval of ['1d','4h','1h']){
  const step=tfMillis[interval],start=Math.floor(startTime/step)*step,end=Math.floor(endTime/step)*step;
  const rows=await fetchHistory(fetchPage,MTF_AUDIT_LOCK.symbol,interval,start,end);
  const plan=planCleanBacktestWindows(rows,{startTime:start,endTime:end,intervalMs:step},{minBars:22});
  plans[interval]=plan;
  coverage[interval]={qualityStatus:plan.status,expectedBars:plan.quality.expected,
   receivedRows:rows.length,excludedBars:plan.excludedBars,
   cleanWindows:plan.eligibleWindows.length,coveragePct:Number(plan.quality.coveragePct.toFixed(3))};
 }
 const cutoffTime=Math.floor((startTime+(endTime-startTime)/2)/H)*H;
 const audit=studyHistoricalMtf({hourWindows:plans['1h'].eligibleWindows,h4Windows:plans['4h'].eligibleWindows,
  d1Windows:plans['1d'].eligibleWindows,cutoffTime});
 const status=plans['1h'].eligibleWindows.length?'EXPLORATORY_COMPLETE':'BLOCKED_HISTORY';
 return {schemaVersion:1,status,asOf:new Date(now).toISOString(),branch:process.env.GITHUB_REF_NAME??null,
  commit:process.env.GITHUB_SHA??null,runId:process.env.GITHUB_RUN_ID??null,
  source:'Bitunix klines via CryptoJuju read-only proxy',coverage,...audit,status,
  futureEvaluation:'The separate locked BTC 1H SHORT prospective study starts 2026-10-26 00:00 UTC; this experiment neither modifies nor replaces it.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const report=await runHistoricalMtf();
  console.log(JSON.stringify(report,null,2));
  if(report.status==='BLOCKED_HISTORY')process.exitCode=1;
 }catch(e){console.error(JSON.stringify({status:'ERROR',error:String(e.message??e)}));process.exitCode=1;}
}
