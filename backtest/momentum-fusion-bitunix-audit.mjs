/* Read-only baseline audit of USER Momentum Fusion Pine v6 — no tuning, orders,
 * screenshot claims, or changes to active Vector/prospective forward workflow.
 */
import {pathToFileURL} from 'node:url';
import {calculateMomentumFusion,MOMFUSION_DEFAULTS} from './momentum-fusion-v1.mjs';
import {vectorAIT} from './vector-ait-v1.mjs';
import {planCleanBacktestWindows} from './quarantine.mjs';
import {makeCryptoJujuFetchPage} from './cryptojuju-adapter.mjs';
const H=3600000,D=24*H,STEP={ '15m':H/4,'30m':H/2,'1h':H,'4h':4*H};
export const MOMENTUM_AUDIT_LOCK=Object.freeze({
 id:'momentum-fusion-source-baseline-bitunix-2026-10-26-v1',
 exchanges:['Bitunix'],symbols:['BTCUSDT','ETHUSDT','SOLUSDT'],
 timeframes:['15m','30m','1h','4h'],
 barsRequested:672,minContinuous:135,
 source:'User-provided Momentum Fusion Pine Script v6, original default values',
 calibration:'NOT VERIFIED versus TradingView exports; evaluate close-bar event alignment before treating counts as platform parity.',
 retrospectiveOnly:true,noTrades:true,noThresholdOptimizations:true,
 vectorComparison:'Descriptive V1.1 trend direction at Momentum alert and subsequent 12-bar matching signal only, NEVER a trading backtest.'
});
const round=x=>Number(x.toFixed(3));
function eventSummary(bars,{symbol,tf,segmentStartMs}){
 const mom=calculateMomentumFusion(bars),vec=vectorAIT(bars);
 const key={bull:0,bear:0,rawBullCross:0,rawBearCross:0,
  regBull:0,regBear:0,hiddenBull:0,hiddenBear:0,firstAvailable:null,
  momentumBullVsVectorBull:0,momentumBearVsVectorBear:0,
  momentumBullVsVectorShort:0,momentumBearVsVectorLong:0,
  bullFollowedByV11LongWithin12:0,bearFollowedByV11ShortWithin12:0,
  trendBlocksBull:0,trendBlocksBear:0};
 const events=[];
 for(let i=0;i<bars.length;i++){
  const row=mom[i],v=vec[i];
  if(row.composite!==null&&key.firstAvailable===null)
   key.firstAvailable=bars[i].time;
  key.rawBullCross+=Number(row.crossUpFromOS);
  key.rawBearCross+=Number(row.crossDnFromOB);
  key.trendBlocksBull+=Number(row.crossUpFromOS&&!row.bullSignal);
  key.trendBlocksBear+=Number(row.crossDnFromOB&&!row.bearSignal);
  for(const d of row.divergences){
   key[d.type]++;
   events.push({symbol,tf,kind:d.type,availableAt:bars[i].time,
    pivotTime:d.pivotTime,previousPivotTime:d.previousPivotTime,
    lastClosedBarAtSignal:bars[i].time,
    referencePrice:Number(bars[i].close),
    cannotKnowAtPivot:true,segmentStartMs});
  }
  for(const [kind,flag,direction] of [
   ['bull',row.bullSignal,1],['bear',row.bearSignal,-1]
  ]){
   if(!flag)continue;
   key[kind]++;
   if(direction===1){
    if(v.direction===1)key.momentumBullVsVectorBull++;
    if(v.direction===-1)key.momentumBullVsVectorShort++;
   }else{
    if(v.direction===-1)key.momentumBearVsVectorBear++;
    if(v.direction===1)key.momentumBearVsVectorLong++;
   }
   const follow=vec.slice(i+1,Math.min(i+13,bars.length))
    .some(x=>x.signal===(direction===1?'long':'short'));
   if(follow){
    if(direction===1)key.bullFollowedByV11LongWithin12++;
    else key.bearFollowedByV11ShortWithin12++;
   }
   events.push({symbol,tf,kind,availableAt:bars[i].time,
    referencePrice:Number(bars[i].close),oscillator:round(row.composite),
    v11Direction:v.direction,followingV11SignalWithin12:follow,
    followupIsHindsight:true,segmentStartMs});
  }
 }
 return {counts:key,events,bars:bars.length};
}
function addCounts(into,other){
 for(const [k,v] of Object.entries(other)){
  if(k==='firstAvailable'){
   into.firstAvailable=into.firstAvailable===null?v:
    v===null?into.firstAvailable:Math.min(into.firstAvailable,v);
  }else into[k]=(into[k]??0)+v;
 }
}
async function fetchWindows(fetchPage,{symbol,tf,stepMs,nowMs}){
 const end=Math.floor(nowMs/stepMs)*stepMs;
 const start=end-MOMENTUM_AUDIT_LOCK.barsRequested*stepMs;
 const rows=[];
 for(let t=start;t<end;t+=180*stepMs){
  const until=Math.min(end,t+180*stepMs);
  const chunk=await fetchPage({symbol,interval:tf,startTime:t,
   endTime:until,limit:200});
  rows.push(...chunk.filter(r=>Number(r.time)>=t&&Number(r.time)<until));
 }
 const clean=planCleanBacktestWindows(rows,{startTime:start,endTime:end,
  intervalMs:stepMs},{minBars:MOMENTUM_AUDIT_LOCK.minContinuous});
 return {clean,rawCount:rows.length,start,end};
}
export async function auditMomentumFusion({fetchPage=makeCryptoJujuFetchPage(),
 nowMs=Date.now(),markets=MOMENTUM_AUDIT_LOCK.symbols,
 timeframes=MOMENTUM_AUDIT_LOCK.timeframes}={}){
 const results=[];
 for(const tf of timeframes)for(const symbol of markets){
  const market={symbol,tf},stepMs=STEP[tf];
  if(!stepMs)throw Error('Unsupported timeframe '+tf);
  try{
   const {clean,rawCount,start,end}=await fetchWindows(fetchPage,{
    symbol,tf,stepMs,nowMs});
   let counts=null,barsAnalyzed=0;const events=[];
   for(const w of clean.eligibleWindows){
    const r=eventSummary(w.candles,{symbol,tf,segmentStartMs:w.startTime});
    if(!counts)counts={...r.counts};
    else addCounts(counts,r.counts);
    barsAnalyzed+=r.bars;events.push(...r.events);
   }
   results.push({market,status:clean.eligibleWindows.length?'ANALYZED':'BLOCKED_DATA',
    data:{expected:clean.quality.expected,received:rawCount,
     validPercent:round(clean.quality.coveragePct),
     excludedBars:clean.excludedBars,eligibleWindows:clean.eligibleWindows.length,
     barsAnalyzed,issues:clean.issues.length,missing:clean.missing.length,
     lastExpectedClosedOpen:end-stepMs,start,end,
     sourceStatus:clean.status},counts,events,
    note:'Event at confirmation bar, not a historical pivot label. Later Vector matching is retrospective only.'});
  }catch(error){results.push({market,status:'ERROR',error:String(error?.message??error)});}
 }
 return {protocol:MOMENTUM_AUDIT_LOCK.id,
  createdAt:new Date(nowMs).toISOString(),
  gitCommit:process.env.GITHUB_SHA??null,githubRun:process.env.GITHUB_RUN_ID??null,
  lock:MOMENTUM_AUDIT_LOCK,defaults:MOMFUSION_DEFAULTS,
  state:results.every(r=>r.status==='ANALYZED')?'ALL_ANALYZED':
   results.some(r=>r.status==='ERROR')?'SOME_ERROR':'PARTIAL_QUARANTINE',
  results,cautions:['Counts are NOT a profitability or prediction-accuracy backtest.',
   'TradingView line annotations refer to pivot timestamp; actual alert is pivotRight bars later.',
   'JS parity to Pine tie behavior, SMA missing data and oscillator must be crosschecked against TradingView.',
   'EMA 21/55 Trend Filter is kept ON exactly as in the user Pine source.',
   'Only Bitunix public OHLC; closed bars, quarantine and no real exchange orders.',
   'Retrospective historical data are not a future holdout.']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const r=await auditMomentumFusion();
 console.log(JSON.stringify(r,null,2));
 if(r.state!=='ALL_ANALYZED')process.exitCode=1;
}
