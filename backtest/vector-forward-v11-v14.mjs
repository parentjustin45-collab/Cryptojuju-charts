/* LOCKED prospective shadow-paper comparison. NO exchange orders, NO strategies
 * optimized on post-start data. Both Vector engines run on exactly identical,
 * continuous, fully CLOSED Bitunix 1H OHLC. Entries at NEXT candle OPEN.
 * One open paper trade per mode (LONG and SHORT share occupancy).
 */
import {pathToFileURL} from 'node:url';
import {vectorAIT} from './vector-ait-v1.mjs';
import {applyVectorV14,VECTOR_V14_LOCK} from './vector-v14-hysteresis.mjs';
import {VECTOR_EXIT_CONFIGS,simulateVectorExitTrade} from './vector-exit-selection.mjs';
import {planCleanBacktestWindows} from './quarantine.mjs';
import {makeCryptoJujuFetchPage} from './cryptojuju-adapter.mjs';
const H=3600000,D=24*H,num=x=>x==null?null:Number(x.toFixed(6));
export const FORWARD_LOCK=Object.freeze({
 protocol:'cj-vector-v11-v14-forward-paper-btc-eth-sol-1h-v1',
 earliestSignalTime:'2026-10-28T00:00:00Z',
 instrument:['BTCUSDT','ETHUSDT','SOLUSDT'],
 interval:'1h',
 evaluationModes:['V1.1','V1.4'],
 v14Identity:VECTOR_V14_LOCK.id,
 risk:'fixed_1_5_3_12',
 feePerSide:0.0006,slippagePerSide:0.0005,
 warmupBars:168,minContinuousBars:55,minimumClosedTradesPerMode:30,
 rule:'NEXT-OPEN entry; 1.5% stop; 3% take; max 12 closed 1H bars; stop-first on same OHLC bar; gap exit at OPEN',
 data:'Bitunix public LAST_PRICE only; no credentials; no other exchanges',
 status:'RESEARCH_SHADOW_ONLY',
 note:'No order placement, no V1.1/V1.4 changes; do NOT optimize settings or backfill pre-start trades.'
});
const START=Date.parse(FORWARD_LOCK.earliestSignalTime);
const FIXED=VECTOR_EXIT_CONFIGS.find(x=>x.id===FORWARD_LOCK.risk);
if(!FIXED||FIXED.family!=='fixed'||FIXED.stopPct!==1.5||FIXED.takePct!==3||FIXED.maxBars!==12)
 throw Error('Locked risk exit rule absent or modified');
const makeBucket=()=>({signalCount:0,entries:0,closed:0,winning:0,sumNetPct:0,
 lossNetPct:0,censoredGap:0,pending:0,notFillable:0,
 stop:0,take:0,timeout:0,
 grossPositive:0,medianNetPct:null});
function aggregate(trades,mode){
 const b=makeBucket(),pnl=[];
 for(const t of trades.filter(x=>x.mode===mode)){
  b.signalCount++;
  if(t.status==='not_fillable'){b.notFillable++;continue;}
  b.entries++;
  if(t.status==='open_pending'){b.pending++;continue;}
  if(t.status==='censored_gap'){b.censoredGap++;continue;}
  if(t.status!=='closed')throw Error('Unexpected paper trade state');
  b.closed++;b.winning+=Number(t.netPct>0);b.grossPositive+=Number(t.grossPct>0);
  b.sumNetPct+=t.netPct;pnl.push(t.netPct);
  if(t.netPct<0)b.lossNetPct+=t.netPct;
  b[t.reason]++;
 }
 pnl.sort((a,b)=>a-b);
 b.medianNetPct=pnl.length?num(pnl.length%2?pnl[pnl.length>>1]:
  (pnl[pnl.length/2-1]+pnl[pnl.length/2])/2):null;
 return {...b,winRatePct:b.closed?num(100*b.winning/b.closed):null,
  meanNetPct:b.closed?num(b.sumNetPct/b.closed):null,
  netPctSum:num(b.sumNetPct),
  sufficientSample:b.closed>=FORWARD_LOCK.minimumClosedTradesPerMode,
  warning:'Sum/mean of isolated per-trade returns, NOT compounded portfolio growth.'};
}
const closedTime=now=>Math.floor(now/H)*H;
function validateNow(now){
 if(!Number.isSafeInteger(now)||now<0)throw Error('Invalid as-of timestamp');
 return closedTime(now);
}
export function studyForwardWindows(windows,{symbol='BTCUSDT',asOfMs=Date.now(),startTime=START}={}){
 const end=validateNow(asOfMs),trades=[],quality={windows:0,shortWindows:0,invalidWindows:0,
  signalsBeforeStartExcluded:0,unfilledSignals:0,
  lastCompleteTime:null};
 if(!Number.isSafeInteger(startTime)||!Array.isArray(windows))throw Error('Invalid study parameters');
 if(end<=startTime)return {symbol,status:'ARMED_NOT_STARTED',trades:[],
  byMode:{'V1.1':aggregate([],'V1.1'),'V1.4':aggregate([],'V1.4')},quality};
 for(const window of windows){
  const bars=window.candles??window;
  if(!Array.isArray(bars)||bars.length<FORWARD_LOCK.minContinuousBars){
   quality.shortWindows++;continue;
  }
  const valid=bars.every((b,i)=>Number.isSafeInteger(b.time)&&b.time%H===0&&
   b.time<end&&Number(b.open)>0&&Number(b.close)>0&&
   Number(b.high)>=Math.max(Number(b.open),Number(b.close))&&
   Number(b.low)>0&&Number(b.low)<=Math.min(Number(b.open),Number(b.close))&&
   Number.isFinite(Number(b.volume))&&Number(b.volume)>=0&&
   (i===0||b.time-bars[i-1].time===H));
  if(!valid){quality.invalidWindows++;continue;}
  quality.windows++;
  const raw=vectorAIT(bars),filtered=applyVectorV14(bars,{rawVector:raw}).events;
  const last=bars.at(-1).time;
  quality.lastCompleteTime=quality.lastCompleteTime===null?last:Math.max(last,quality.lastCompleteTime);
  for(const [mode,signals] of [['V1.1',raw],['V1.4',filtered]]){
   let occupied=-1;
   for(let i=FORWARD_LOCK.minContinuousBars-1;i<bars.length;i++){
    const s=signals[i],side=s.signal;
    if(!side)continue;
    if(bars[i].time<startTime){quality.signalsBeforeStartExcluded++;continue;}
    if(i<=occupied)continue;
    const entryIndex=i+1;
    if(entryIndex>=bars.length){
     const state=end<=bars[i].time+H?'open_pending':'not_fillable';
     trades.push({symbol,mode,side,signalTime:bars[i].time,
      entryTime:bars[i].time+H,entryPrice:null,status:state,
      reason:state==='not_fillable'?'missing_next_open':null,netPct:null,
      originTime:bars[s.sourceIndex??i]?.time??bars[i].time,
      exitTime:null});
     occupied=bars.length;
     continue;
    }
    if(bars[entryIndex].time<startTime)throw Error('Pre-start fill refused');
    const t=simulateVectorExitTrade(bars,signals,i,side,FIXED,{
     cutoffTime:startTime,feeRate:FORWARD_LOCK.feePerSide,
     slippageRate:FORWARD_LOCK.slippagePerSide
    });
    const entry=Number(bars[entryIndex].open)*(1+(side==='long'?1:-1)*FORWARD_LOCK.slippagePerSide);
    let status,reason,exitTime=null,netPct=null,grossPct=null;
    if(t.status==='closed'){
     status='closed';reason=t.reason;exitTime=bars[t.exitIndex].time;
     netPct=num(t.netPct);grossPct=num(100*(side==='long'?1:-1)*(t.exit-entry)/entry);
     occupied=t.exitIndex;
    }else{
     // A still-open trade is provisional, not a permanent censored loser/winner.
     // When an actual gap exists before the expected exit, the window is sealed,
     // explicitly censored, and the next clean window restarts after warmup.
     const expectedHorizon=bars[entryIndex].time+FIXED.maxBars*H;
     const isTrueEnd=last===end-H;
     status=isTrueEnd&&end<expectedHorizon?'open_pending':'censored_gap';
     reason=status==='open_pending'?'awaiting_future_closed_bars':'incomplete_or_missing_future_ohlc';
     occupied=bars.length;
    }
    trades.push({symbol,mode,side,signalTime:bars[i].time,entryTime:bars[entryIndex].time,
     entryPrice:num(entry),originTime:bars[s.sourceIndex??i]?.time??bars[i].time,
     status,reason,exitTime,netPct,grossPct,
     indicatorReason:s.why??null});
   }
  }
 }
 // Traces remain rerunnable from public OHLC and locked code; no external state.
 const byMode={'V1.1':aggregate(trades,'V1.1'),'V1.4':aggregate(trades,'V1.4')};
 const status=quality.windows===0?'NO_ELIGIBLE_CONTINUOUS_HISTORY':
  Object.values(byMode).every(x=>x.sufficientSample)?
   'OBSERVATIONS_ABOVE_MINIMUM_NOT_PROOF':'INSUFFICIENT_NEW_CLOSED_TRADES';
 return {symbol,status,asOfUtc:new Date(asOfMs).toISOString(),
  earliestSignalUtc:FORWARD_LOCK.earliestSignalTime,byMode,trades,quality,
  caution:['No pre-start SIGNAL can be counted or filled even if its exit occurs later.',
   'Rows after the current last fully CLOSED OHLC are excluded.',
   'Pending positions are not counted in closed return; each model holds at most one position at a time.',
   'A gap renders a trade censored; no invented candle to bridge.',
   'No overlapping LONG/SHORT in a given mode; the modes are evaluated independently.',
   'Both versions use identical frozen risk and cost assumptions; no real trading.',
   'Prospective date alone does not imply untampered future data: check run timestamps and source commits.']};
}
async function readPage(fetchPage,symbol,start,end){
 const rows=[];
 for(let t=start;t<end;t+=180*H){
  const b=Math.min(end,t+180*H);
  const q=await fetchPage({symbol,interval:'1h',startTime:t,endTime:b,limit:200});
  rows.push(...q.filter(x=>Number(x.time)>=t&&Number(x.time)<b));
 }
 return rows;
}
export async function runForwardPaper({nowMs=Date.now(),fetchPage=makeCryptoJujuFetchPage()}={}){
 const end=validateNow(nowMs),begin=START-FORWARD_LOCK.warmupBars*H,results=[];
 for(const symbol of FORWARD_LOCK.instrument){
  try{
   // Pre-start preflight intentionally checks the historical feed without
   // counting any of those candles as prospective paper trades.
   const raw=end>begin?await readPage(fetchPage,symbol,begin,end):[];
   const clean=end>begin?planCleanBacktestWindows(raw,
    {startTime:begin,endTime:end,intervalMs:H},
    {minBars:FORWARD_LOCK.minContinuousBars}):null;
   const audit=studyForwardWindows(clean?.eligibleWindows??[],{
    symbol,asOfMs:nowMs,startTime:START});
   results.push({symbol,status:audit.status,
    feed:clean?{quality:clean.status,expected:clean.quality.expected,
     received:raw.length,excluded:clean.excludedBars,
     windows:clean.eligibleWindows.length}:null,
    audit});
  }catch(e){results.push({symbol,status:'DATA_OR_AUDIT_ERROR',
   error:String(e?.message??e)});}
 }
 return {protocol:FORWARD_LOCK.protocol,
  status:results.some(r=>r.status==='DATA_OR_AUDIT_ERROR')?'ERROR':
   end<=START?'ARMED_NOT_STARTED':'PROSPECTIVE_COLLECTING',
  generatedAtUtc:new Date(nowMs).toISOString(),
  branch:process.env.GITHUB_REF_NAME??null,commit:process.env.GITHUB_SHA??null,
  runId:process.env.GITHUB_RUN_ID??null,
  source:'Bitunix public 1h futures LAST_PRICE via readonly CryptoJuju proxy',
  lock:FORWARD_LOCK,results,
  conditions:['No trades are placed; risk and expenses are simulation assumptions.',
   'The forward time barrier is immutable for this protocol. Never include pre-start trades.',
   'No strategy is selected or promoted based on an early small sample.',
   'No daily trigger exists merely by defining workflow_dispatch on a non-default GitHub branch.']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const r=await runForwardPaper();console.log(JSON.stringify(r,null,2));
 if(r.status==='ERROR')process.exitCode=1;
}
