/**
 * Read-only original Momentum Fusion V1 vs locked Vector V1.1/V1.4
 * PAIRED SIGNAL GATE DIAGNOSTIC. FIXED before inspecting its results.
 * Uses only historical CLOSED Bitunix OHLC strictly before the frozen
 * Vector prospective start. Never sends orders or modifies other engines.
 */
import {pathToFileURL} from 'node:url';
import {makeCryptoJujuFetchPage} from './cryptojuju-adapter.mjs';
import {planCleanBacktestWindows} from './quarantine.mjs';
import {calculateMomentumFusion,MOMFUSION_DEFAULTS} from './momentum-fusion-v1.mjs';
import {vectorAIT} from './vector-ait-v1.mjs';
import {applyVectorV14} from './vector-v14-hysteresis.mjs';
import {VECTOR_EXIT_CONFIGS,simulateVectorExitTrade} from './vector-exit-selection.mjs';
import {FORWARD_LOCK} from './vector-forward-v11-v14.mjs';

const H=3600000,FORWARD_START=Date.parse(FORWARD_LOCK.earliestSignalTime);
const RISK=VECTOR_EXIT_CONFIGS.find(c=>c.id===FORWARD_LOCK.risk);
if(!RISK||RISK.stopPct!==1.5||RISK.takePct!==3||RISK.maxBars!==12)
 throw Error('Frozen Vector risk mismatch');
export const COMPARISON_LOCK=Object.freeze({
 id:'cj-momentum-v1-vector-historical-paired-gate-v1',
 studyType:'FROZEN_PRE_FORWARD_HISTORICAL_DIAGNOSTIC',
 endExclusive:FORWARD_LOCK.earliestSignalTime,
 models:['Vector V1.1','Vector V1.4'],
 instruments:['BTCUSDT','ETHUSDT','SOLUSDT'],
 timeframes:['1h','4h'],
 requestedBars:{'1h':2016,'4h':672},
 minimumContinuousBars:180,
 mandatoryWarmupBars:168,
 gate:'at Vector confirmed bar: Momentum composite >50 and EMA21>EMA55 for LONG; composite <50 and EMA21<EMA55 for SHORT',
 gatesPresetBeforeData:true,
 nextOpenEntry:true,
 feePerSide:FORWARD_LOCK.feePerSide,
 slippagePerSide:FORWARD_LOCK.slippagePerSide,
 stopPct:RISK.stopPct,takePct:RISK.takePct,maxBars:RISK.maxBars,
 studyLimit:'Paired signal outcomes, not portfolio PnL or trade execution. All prospective dates excluded. TradingView parity pending.'
});
const FRAME=Object.freeze({'1h':H,'4h':4*H});
const fixed6=x=>x==null?null:Number(x.toFixed(6));
function blank(){
 return {events:0,allowed:0,rejected:0,unavailable:0,
  closed:0,wins:0,losers:0,zero:0,sumNetPct:0,
  censored:0,pendingEntry:0,stop:0,take:0,timeout:0};
}
function push(bucket,{verdict,trade}){
 bucket.events++;
 if(verdict==='ACCEPT')bucket.allowed++;
 else if(verdict==='REJECT')bucket.rejected++;
 else bucket.unavailable++;
 if(trade.status!=='closed'){
  bucket.censored++;
  if(trade.censorReason==='no_next_open')bucket.pendingEntry++;
  return;
 }
 bucket.closed++;
 bucket.sumNetPct+=trade.netPct;
 bucket.wins+=Number(trade.netPct>0);
 bucket.losers+=Number(trade.netPct<0);
 bucket.zero+=Number(trade.netPct===0);
 bucket[trade.reason]++;
}
function finish(bucket){
 return {...bucket,winRatePct:bucket.closed?fixed6(100*bucket.wins/bucket.closed):null,
  meanNetPct:bucket.closed?fixed6(bucket.sumNetPct/bucket.closed):null,
  netPctSum:fixed6(bucket.sumNetPct)};
}
export function evaluatePairedCleanWindows(cleanWindows,{endExclusive=FORWARD_START,
 symbol='BTCUSDT',timeframe='1h'}={}){
 const step=FRAME[timeframe];
 if(!step||!Number.isSafeInteger(endExclusive)||endExclusive>FORWARD_START)
  throw Error('Invalid or post-forward comparison boundary');
 const results={};
 for(const model of COMPARISON_LOCK.models){
  results[model]={all:blank(),accepted:blank(),rejected:blank(),unavailable:blank(),events:[]};
 }
 let skippedShort=0,skippedInvalid=0,used=0;
 for(const segment of cleanWindows){
  const bars=segment.candles??segment;
  if(!Array.isArray(bars)||bars.length<COMPARISON_LOCK.minimumContinuousBars){
   skippedShort++;continue;
  }
  if(!bars.every((b,i)=>Number.isSafeInteger(b.time)&&b.time%step===0&&
      b.time<endExclusive&&(i===0||b.time-bars[i-1].time===step))){
   skippedInvalid++;continue;
  }
  used++;
  const momentum=calculateMomentumFusion(bars);
  const v11=vectorAIT(bars);
  const v14=applyVectorV14(bars,{rawVector:v11}).events;
  for(const [label,series] of [['Vector V1.1',v11],['Vector V1.4',v14]]){
   const target=results[label];
   for(let i=COMPARISON_LOCK.mandatoryWarmupBars;i<bars.length;i++){
    const side=series[i].signal;
    if(side!=='long'&&side!=='short')continue;
    const m=momentum[i];
    let verdict;
    if(m.composite===null||!Number.isFinite(m.composite))
     verdict='UNAVAILABLE';
    else if(side==='long'&&m.composite>50&&m.bullTrend ||
            side==='short'&&m.composite<50&&m.bearTrend)
     verdict='ACCEPT';
    else verdict='REJECT';
    // Independent signal trade outcomes, with same fee/risk/slippage for
    // ACCEPTED and REJECTED; this is a diagnostic, not tradable portfolio.
    const trade=simulateVectorExitTrade(bars,series,i,side,RISK,{
     cutoffTime:endExclusive,
     feeRate:COMPARISON_LOCK.feePerSide,
     slippageRate:COMPARISON_LOCK.slippagePerSide
    });
    // A completed historical exit must be strictly BEFORE the prospective start.
    if(trade.status==='closed'&&
       (trade.exitIndex>=bars.length||bars[trade.exitIndex].time>=endExclusive))
      throw Error('Prospective leakage in historical paired outcome');
    push(target.all,{verdict,trade});
    const bucket=verdict==='ACCEPT'?'accepted':verdict==='REJECT'?'rejected':'unavailable';
    push(target[bucket],{verdict,trade});
    target.events.push({symbol,timeframe,model:label,
     signalUtc:new Date(bars[i].time).toISOString(),
     side,verdict,
     momentumComposite:fixed6(m.composite),
     momentumEmaBull:m.bullTrend,momentumEmaBear:m.bearTrend,
     entryUtc:bars[i+1]?new Date(bars[i+1].time).toISOString():null,
     exitUtc:trade.status==='closed'?new Date(bars[trade.exitIndex].time).toISOString():null,
     tradeStatus:trade.status,exitReason:trade.reason??null,
     hypotheticalNetPct:trade.status==='closed'?fixed6(trade.netPct):null,
     why:'This is an independently simulated candidate, NOT a filled portfolio order'
    });
   }
  }
 }
 for(const value of Object.values(results)){
  for(const k of ['all','accepted','rejected','unavailable'])
   value[k]=finish(value[k]);
 }
 return {symbol,timeframe,usedWindows:used,skippedShort,skippedInvalid,
  models:results,cutoffUtc:new Date(endExclusive).toISOString(),
  warning:'Counts/outcomes are hindsight, each signal simulated independently; overlapping signals can overlap. Not portfolio PnL or forward validation.'};
}
async function fetchBitunixHistory(fetchPage,symbol,timeframe,step,desired,end){
 const start=end-desired*step,rows=[];
 for(let t=start;t<end;t+=180*step){
  const until=Math.min(t+180*step,end);
  const got=await fetchPage({symbol,interval:timeframe,
   startTime:t,endTime:until,limit:200});
  rows.push(...got.filter(r=>Number(r.time)>=t&&Number(r.time)<until));
 }
 const windows=planCleanBacktestWindows(rows,{
  startTime:start,endTime:end,intervalMs:step
 },{minBars:COMPARISON_LOCK.minimumContinuousBars});
 return {windows,received:rows.length,start,end};
}
export async function runHistoricalMomentumVector({
 fetchPage=makeCryptoJujuFetchPage(),cutoffMs=FORWARD_START,
 instruments=COMPARISON_LOCK.instruments,
 timeframes=COMPARISON_LOCK.timeframes
}={}){
 if(!Number.isSafeInteger(cutoffMs)||cutoffMs>FORWARD_START)
  throw Error('Cannot examine prospective data in this historical study');
 const results=[];
 for(const tf of timeframes)for(const symbol of instruments){
  const step=FRAME[tf];
  if(!step)throw Error('Invalid TF');
  const end=Math.floor(cutoffMs/step)*step;
  try{
   const {windows,received,start}=await fetchBitunixHistory(fetchPage,
    symbol,tf,step,COMPARISON_LOCK.requestedBars[tf],end);
   const report=evaluatePairedCleanWindows(windows.eligibleWindows,{
    symbol,timeframe:tf,endExclusive:end
   });
   results.push({symbol,timeframe:tf,status:report.usedWindows?'ANALYZED':'DATA_QUARANTINED',
    received,expected:COMPARISON_LOCK.requestedBars[tf],
    historyFromUtc:new Date(start).toISOString(),
    missing:windows.missing.length,issues:windows.issues.length,
    duplicateTimes:windows.duplicateTimes.length,
    excludedBars:windows.excludedBars,
    windows:windows.eligibleWindows.length,
    report});
  }catch(e){
   results.push({symbol,timeframe:tf,status:'ERROR',error:String(e?.message??e)});
  }
 }
 const hadErrors=results.some(x=>x.status==='ERROR');
 return {protocol:COMPARISON_LOCK.id,
  status:hadErrors?'ERROR':results.some(x=>x.status==='ANALYZED')?
   'EXPLORATORY_HISTORICAL_READY':'NO_ELIGIBLE_HISTORY',
  generatedAt:new Date().toISOString(),
  branch:process.env.GITHUB_REF_NAME??null,
  commit:process.env.GITHUB_SHA??null,
  lock:COMPARISON_LOCK,results,
  notes:['No 2026-10-28 00:00Z or later OHLC/signal/exit is permitted.',
   'This independent retrospective study does not update or contaminate the existing Vector prospective forward comparison.',
   'Momentum Fusion original Pine parity still requires TradingView reference; no automatic paywall bypass.',
   'No real order, no Bitunix account, no subscription required.',
   'This workflow runs on dev push/manual dispatch; GitHub schedule on dev is NOT a background 15-minute scheduler.']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const r=await runHistoricalMomentumVector();
 console.log(JSON.stringify(r,null,2));
 if(r.status==='ERROR')process.exitCode=1;
}
