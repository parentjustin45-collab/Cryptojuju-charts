/* Frozen prospective Vector V1.3 EMA50 BTC 1H SHORT experiment.
 * Independent of the existing 2026-10-26 V1.2 prospective study.
 * Selected after exploratory V1.3 historical analysis on 2026-10-25.
 * No trading orders, signal promotion or writes to production/main.
 */
import {pathToFileURL} from 'node:url';
import {vectorAIT} from './vector-ait-v1.mjs';
import {applyVectorV13} from './vector-v13-regime.mjs';
import {simulateVectorExitTrade,VECTOR_EXIT_CONFIGS} from './vector-exit-selection.mjs';
import {planCleanBacktestWindows} from './quarantine.mjs';
import {makeCryptoJujuFetchPage} from './cryptojuju-adapter.mjs';
const H=3600000,D=24*H;
export const VECTOR_V13_FORWARD_LOCK=Object.freeze({
 protocol:'vector-v13-btc-1h-short-ema50-forward-v1',
 startTime:Date.parse('2026-10-27T00:00:00Z'),
 symbol:'BTCUSDT',interval:'1h',intervalMs:H,side:'short',
 modes:['baseline_v11','break_extreme_2','v13_ema50_slope'],
 primaryCandidate:'v13_ema50_slope',parentCandidate:'break_extreme_2',
 exit:'fixed_1_5_3_12',feeRate:0.0006,
 scenarios:{zero:0,stress:0.0005,harsh:0.001},
 warmupDays:35,minCompletedTrades:30,
 terms:'Closed bars only, next-open fills, 1.5% stop, 3% target, max 12 bars; one pre-registered candidate, no re-optimization or Pine certification.'
});
const exit=VECTOR_EXIT_CONFIGS.find(x=>x.id===VECTOR_V13_FORWARD_LOCK.exit);
if(!exit)throw Error('Prospective Vector exit configuration missing');
const round=n=>n==null?null:Number(n.toFixed(6));
const blank=()=>({signalCount:0,completedTrades:0,wins:0,sumNetPct:0,
 censored:0,skippedWarmup:0,skippedBoundary:0,pendingNextOpen:0,
 sumNetSq:0,worstNetPct:null,bestNetPct:null,closedTrades:[]});
function finalize(s){
 const r={signals:s.signalCount,trades:s.completedTrades,wins:s.wins,
  winRatePct:s.completedTrades?round(100*s.wins/s.completedTrades):null,
  meanNetPct:s.completedTrades?round(s.sumNetPct/s.completedTrades):null,
  worstNetPct:round(s.worstNetPct),bestNetPct:round(s.bestNetPct),
  censored:s.censored,skippedWarmup:s.skippedWarmup,
  skippedBoundary:s.skippedBoundary,pendingNextOpen:s.pendingNextOpen,
  minSampleMet:s.completedTrades>=VECTOR_V13_FORWARD_LOCK.minCompletedTrades,
  closedTrades:s.closedTrades};
 return r;
}
export function evaluateVectorV13Forward({hourWindows=[],asOfTime,
 startTime=VECTOR_V13_FORWARD_LOCK.startTime}={}){
 if(!Array.isArray(hourWindows)||!Number.isSafeInteger(asOfTime)||!Number.isSafeInteger(startTime))
  throw Error('Invalid prospective Vector V1.3 evaluation window');
 if(asOfTime<=startTime)return {status:'NOT_STARTED',asOfTime,byMode:null};
 const out={};
 for(const mode of VECTOR_V13_FORWARD_LOCK.modes){
  out[mode]={};
  for(const [scenario,slippage] of Object.entries(VECTOR_V13_FORWARD_LOCK.scenarios)){
   const s=blank();
   for(const w of hourWindows){
    const bars=(w.candles??w).filter(b=>Number(b.time)+H<=asOfTime);
    if(bars.length<22)continue;
    for(let i=1;i<bars.length;i++){
     if(bars[i].time-bars[i-1].time!==H)throw Error('Noncontiguous prospective Vector window');
    }
    const raw=vectorAIT(bars);
    const events=applyVectorV13(bars,{mode,rawVector:raw}).events;
    let occupied=-1;
    for(let i=0;i<events.length;i++){
     const event=events[i];if(event.signal!=='short')continue;
     const sourceIdx=event.sourceIndex??i,sourceTime=bars[sourceIdx].time;
     if(sourceTime<startTime||bars[i].time<startTime){s.skippedWarmup++;continue;}
     const entryIdx=i+1;
     if(entryIdx<=occupied)continue;
     if(entryIdx>=bars.length){s.pendingNextOpen++;continue;}
     if(bars[entryIdx].time<startTime){s.skippedBoundary++;continue;}
     s.signalCount++;
     const t=simulateVectorExitTrade(bars,events,i,'short',exit,{
      cutoffTime:startTime,feeRate:VECTOR_V13_FORWARD_LOCK.feeRate,slippageRate:slippage
     });
     if(t.status==='closed'){
      s.completedTrades++;s.wins+=Number(t.netPct>0);s.sumNetPct+=t.netPct;
      s.worstNetPct=s.worstNetPct===null?t.netPct:Math.min(s.worstNetPct,t.netPct);
      s.bestNetPct=s.bestNetPct===null?t.netPct:Math.max(s.bestNetPct,t.netPct);
      s.closedTrades.push({sourceTime,signalTime:bars[i].time,entryTime:bars[entryIdx].time,
       exitTime:bars[t.exitIndex].time,netPct:round(t.netPct),reason:t.reason});
      occupied=t.exitIndex;
     }else{
      s.censored++;occupied=bars.length-1;
     }
    }
   }
   out[mode][scenario]={slippagePerSide:slippage,...finalize(s)};
  }
 }
 const a=out.v13_ema50_slope.stress,b=out.break_extreme_2.stress;
 return {status:a.minSampleMet&&b.minSampleMet?'MINIMUM_OBSERVATIONS_REACHED':'INSUFFICIENT_TRADES',
  asOfTime,byMode:out,
  comparisons:{v13MinusV12MeanNetPp:a.meanNetPct==null||b.meanNetPct==null?
   null:round(a.meanNetPct-b.meanNetPct),
   note:'Different non-overlapping trade streams; descriptive difference, NOT matched trade P&L or a compound portfolio.'},
  warning:'Forward period pre-registered AFTER viewing historical candidate; no strategy selection, no Pine parity claim, no execution on exchange.'};
}
async function fetchPageRange(fetchPage,startTime,endTime){
 const r=[];
 for(let a=startTime;a<endTime;a+=180*H){
  const b=Math.min(endTime,a+180*H);
  const page=await fetchPage({symbol:VECTOR_V13_FORWARD_LOCK.symbol,interval:'1h',
   startTime:a,endTime:b,limit:200});
  r.push(...page.filter(c=>Number(c.time)>=a&&Number(c.time)<b));
 }
 return r;
}
export async function runVectorV13Forward({now=Date.now(),fetchPage=makeCryptoJujuFetchPage()}={}){
 const lock=VECTOR_V13_FORWARD_LOCK,asOfTime=Math.floor(now/H)*H;
 const meta={schemaVersion:1,lock,generatedAt:new Date(now).toISOString(),
  asOfTime,runId:process.env.GITHUB_RUN_ID??null,commit:process.env.GITHUB_SHA??null,
  branch:process.env.GITHUB_REF_NAME??null,source:'read-only Bitunix klines via CryptoJuju proxy'};
 if(asOfTime<=lock.startTime)return {...meta,status:'NOT_STARTED',coverage:null,results:null};
 const startTime=lock.startTime-lock.warmupDays*D;
 const rows=await fetchPageRange(fetchPage,startTime,asOfTime);
 const plan=planCleanBacktestWindows(rows,{startTime,endTime:asOfTime,intervalMs:H},{minBars:22});
 const result=evaluateVectorV13Forward({hourWindows:plan.eligibleWindows,asOfTime});
 return {...meta,status:plan.eligibleWindows.length?result.status:'BLOCKED_HISTORY',
  coverage:{qualityStatus:plan.status,expected:plan.quality.expected,received:rows.length,
   eligibleWindows:plan.eligibleWindows.length,excludedBars:plan.excludedBars,
   coveragePct:round(plan.quality.coveragePct)},
  results:result,
  policy:'No cross-gap trades; incomplete/censored positions never credited. Historical warmup is signal-excluded and kept only for indicators. Re-reading OHLC is not an immutable live tick audit.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const output=await runVectorV13Forward();console.log(JSON.stringify(output,null,2));
  if(output.status==='BLOCKED_HISTORY')process.exitCode=1;
 }catch(e){console.error(JSON.stringify({status:'ERROR',message:String(e.message??e)}));process.exitCode=1;}
}
