/* EXPLORATORY EVENT LEDGER ONLY: immutable V1.1 V1.2 V1.4 V1.5.
   After-the-fact 12h outcomes are LABELS, never features or decisions.
   Each risk trade is simulated independently, never crossing quarantined gaps. */
import {pathToFileURL} from 'node:url';
import {vectorAIT} from './vector-ait-v1.mjs';
import {applyVectorConfirmation} from './vector-antiwhipsaw-v12.mjs';
import {applyVectorV14,VECTOR_V14_LOCK} from './vector-v14-hysteresis.mjs';
import {applyVectorV15,V15_LOCK} from './vector-v15-followthrough.mjs';
import {simulateVectorExitTrade,VECTOR_EXIT_CONFIGS} from './vector-exit-selection.mjs';
import {planCleanBacktestWindows} from './quarantine.mjs';
import {makeCryptoJujuFetchPage} from './cryptojuju-adapter.mjs';
const H=3600000,D=24*H,round=x=>x===null?null:Number(x.toFixed(6));
export const LEDGER_LOCK=Object.freeze({
 protocol:'vector-event-by-event-btc-eth-sol-90d-20261026',
 symbols:['BTCUSDT','ETHUSDT','SOLUSDT'],days:90,timeframe:'1h',
 modes:['baseline_v11','break_extreme_2',VECTOR_V14_LOCK.id,V15_LOCK.protocol],
 exit:'fixed_1_5_3_12',feeRate:.0006,slippageRate:.0005,
 reviewStart:Date.parse('2026-10-10T00:00:00Z'),
 reviewEnd:Date.parse('2026-10-15T00:00:00Z'),
 minWindow:55,forwardBars:[3,6,12],confirmationMaxBars:3,
 observationGrossThresholdPct:.4,observationMfeThresholdPct:.8,
 minClosedPerHalf:30,
 disclaimer:'Hindsight event study on previously viewed OHLC; not a genuine holdout, not trading advice.'
});
const FIXED=VECTOR_EXIT_CONFIGS.find(x=>x.id===LEDGER_LOCK.exit);
if(!FIXED)throw Error('Missing frozen exit simulator');
const direction=s=>s==='long'?1:-1;
const cleanBucket=()=>({closed:0,wins:0,sumNet:0,stop:0,take:0,timeout:0,
 censored:0,worstNet:null,worstAdverse:null});
const finish=b=>({trades:b.closed,wins:b.wins,
 winRatePct:b.closed?round(b.wins*100/b.closed):null,
 meanNetPct:b.closed?round(b.sumNet/b.closed):null,
 worstNetPct:round(b.worstNet),worstAdversePct:round(b.worstAdverse),
 censored:b.censored,reasons:{stop:b.stop,take:b.take,timeout:b.timeout},
 adequate:b.closed>=LEDGER_LOCK.minClosedPerHalf});
function addBin(dest,x){
 for(const k of ['closed','wins','sumNet','stop','take','timeout','censored'])dest[k]+=x[k];
 for(const k of ['worstNet','worstAdverse'])if(x[k]!==null)
  dest[k]=dest[k]===null?x[k]:Math.min(dest[k],x[k]);
}
function forwardPath(bars,i,side,n,cutoffTime){
 const start=i+1,end=start+n-1,first=bars[start];
 if(!first||end>=bars.length)return null;
 if(first.time<cutoffTime&&bars[end].time>=cutoffTime)return null;
 const future=bars.slice(start,end+1),entry=Number(first.open),dir=direction(side);
 const high=Math.max(...future.map(x=>Number(x.high)));
 const low=Math.min(...future.map(x=>Number(x.low)));
 return {grossPct:round(100*dir*(Number(future.at(-1).close)-entry)/entry),
  mfePct:round(100*Math.max(0,dir*((dir===1?high:low)-entry)/entry)),
  maePct:round(100*Math.min(0,dir*((dir===1?low:high)-entry)/entry))};
}
function afterSignalStatus(i,side,modeEvents){
 if(i>0&&modeEvents[i-1].direction===direction(side))return {status:'already_aligned'};
 const limit=Math.min(modeEvents.length-1,i+LEDGER_LOCK.confirmationMaxBars);
 for(let j=i;j<=limit;j++){
  const e=modeEvents[j];
  if(e.signal===side&&(e.sourceIndex??j)===i)
   return {status:'accepted',acceptedTime:e.time,delayBars:j-i,reason:e.why??null};
 }
 return {status:'rejected'};
}
function signalLedger(bars,raw,modeEvents,symbol,mode,cutoffTime){
 const result=[];
 for(let i=0;i<raw.length;i++){
  const side=raw[i].signal;if(!side)continue;
  const disposition=afterSignalStatus(i,side,modeEvents);
  const record={symbol,mode,time:bars[i].time,side,
   close:Number(bars[i].close),period:bars[i].time<cutoffTime?'earlier':'later',
   classification:disposition.status,acceptedTime:disposition.acceptedTime??null,
   delayBars:disposition.delayBars??null,reason:disposition.reason??null};
  for(const n of LEDGER_LOCK.forwardBars)record['next'+n+'h']=forwardPath(bars,i,side,n,cutoffTime);
  if(record['next12h']&&disposition.status==='rejected'){
   const h=record['next12h'];
   record.hindsightLabel=h.grossPct>=LEDGER_LOCK.observationGrossThresholdPct&&
    h.mfePct>=LEDGER_LOCK.observationMfeThresholdPct?'potential_missed_move':
    h.grossPct<=0?'possibly_avoided_loss':'ambiguous';
  }else record.hindsightLabel=null;
  result.push(record);
 }
 return result;
}
function fixedTrades(bars,events,symbol,mode,cutoffTime){
 const list=[],summary={long:{earlier:cleanBucket(),later:cleanBucket()},
  short:{earlier:cleanBucket(),later:cleanBucket()}};
 for(const side of ['long','short']){
  let blockedTo=-1;
  for(let i=0;i<events.length-1;i++){
   const e=events[i];if(e.signal!==side)continue;
   const start=i+1,source=e.sourceIndex??i,part=bars[start].time<cutoffTime?'earlier':'later';
   if(part==='later'&&bars[source].time<cutoffTime||start<=blockedTo)continue;
   const t=simulateVectorExitTrade(bars,events,i,side,FIXED,{
    cutoffTime,feeRate:LEDGER_LOCK.feeRate,slippageRate:LEDGER_LOCK.slippageRate});
   const item={symbol,mode,side,period:part,originTime:bars[source].time,
    signalTime:bars[i].time,entryTime:bars[start].time,
    exitTime:t.status==='closed'?bars[t.exitIndex].time:null,
    status:t.status,exitReason:t.reason??t.censorReason,
    netPct:t.status==='closed'?round(t.netPct):null,
    durationBars:t.status==='closed'?t.exitIndex-start+1:null,
    adversePct:null,favorablePct:null};
   const b=summary[side][part];
   if(t.status==='closed'){
    const price=t.entry,dir=direction(side),path=bars.slice(start,t.exitIndex+1);
    const extremeWorst=dir===1?
     Math.min(...path.map(x=>Number(x.low))):
     Math.max(...path.map(x=>Number(x.high)));
    const extremeBest=dir===1?
     Math.max(...path.map(x=>Number(x.high))):
     Math.min(...path.map(x=>Number(x.low)));
    item.adversePct=round(Math.min(0,100*dir*(extremeWorst-price)/price));
    item.favorablePct=round(Math.max(0,100*dir*(extremeBest-price)/price));
    b.closed++;b.sumNet+=t.netPct;b.wins+=Number(t.netPct>0);
    b[t.reason]++;b.worstNet=b.worstNet===null?t.netPct:Math.min(b.worstNet,t.netPct);
    b.worstAdverse=b.worstAdverse===null?item.adversePct:Math.min(b.worstAdverse,item.adversePct);
    blockedTo=t.exitIndex;
   }else{
    b.censored++;blockedTo=bars.length-1;
    if(part==='earlier'){
     const next=bars.findIndex(x=>x.time>=cutoffTime);
     if(next!==-1)blockedTo=next-1;
    }
   }
   list.push(item);
  }
 }
 return {trades:list,summary};
}
function directionalEpisodes(bars,events,symbol,mode,cutoffTime){
 const positions=events.flatMap((e,i)=>e.signal&&i+1<bars.length?[i]:[]);
 const ledger=[];
 for(let p=0;p<positions.length;p++){
  const i=positions[p],n=positions[p+1],first=events[i],start=i+1;
  const side=first.signal,part=bars[start].time<cutoffTime?'earlier':'later';
  if(part==='later'&&bars[first.sourceIndex??i].time<cutoffTime)continue;
  const exit=n!==undefined?n+1:null,close=exit!==null&&exit<bars.length&&
   (part==='later'||bars[exit].time<cutoffTime)&&events[n].signal!==side;
  const item={symbol,mode,side,period:part,signalTime:bars[i].time,
   entryTime:bars[start].time,exitTime:close?bars[exit].time:null,
   status:close?'closed':'censored',netPct:null,durationBars:null,
   adversePct:null,favorablePct:null};
  if(close){
   const dir=direction(side),entry=Number(bars[start].open)*(1+dir*LEDGER_LOCK.slippageRate),
    price=Number(bars[exit].open)*(1-dir*LEDGER_LOCK.slippageRate);
   item.netPct=round(100*(dir*(price-entry)/entry-
    LEDGER_LOCK.feeRate*(1+price/entry)));
   item.durationBars=exit-start;
   const path=bars.slice(start,exit);
   const hi=Math.max(...path.map(x=>Number(x.high)));
   const lo=Math.min(...path.map(x=>Number(x.low)));
   item.adversePct=round(Math.min(0,100*dir*((dir===1?lo:hi)-entry)/entry));
   item.favorablePct=round(Math.max(0,100*dir*((dir===1?hi:lo)-entry)/entry));
  }
  ledger.push(item);
 }
 return ledger;
}
function countStatuses(entries){
 const totals={accepted:0,rejected:0,already_aligned:0,
  potential_missed_move:0,possibly_avoided_loss:0,ambiguous:0,
  rejectedWith12h:0,rejectedCensored12h:0};
 for(const e of entries){
  totals[e.classification]++;
  if(e.classification==='rejected'){
   if(e['next12h']){totals.rejectedWith12h++;totals[e.hindsightLabel]++;}
   else totals.rejectedCensored12h++;
  }
 }
 return totals;
}
export function auditReversalWindows(windows,{symbol='BTCUSDT',cutoffTime}={}){
 if(!Array.isArray(windows)||!Number.isSafeInteger(cutoffTime))throw Error('Invalid audit arguments');
 const byMode=Object.fromEntries(LEDGER_LOCK.modes.map(m=>[m,{
  signalLedger:[],fixedTrades:[],episodes:[],reviewSignals:[],
  risk:{long:{earlier:cleanBucket(),later:cleanBucket()},
   short:{earlier:cleanBucket(),later:cleanBucket()}}}]));
 let cleanWindows=0,skippedWindows=0;
 for(const w of windows){
  const bars=w.candles??w;
  if(!Array.isArray(bars)||bars.length<LEDGER_LOCK.minWindow||
    bars.some((b,i)=>!Number.isSafeInteger(b.time)||(i&&b.time-bars[i-1].time!==H))){
   skippedWindows++;continue;
  }
  cleanWindows++;
  const raw=vectorAIT(bars),modes={
   baseline_v11:applyVectorConfirmation(bars,raw,'baseline_v11').events,
   break_extreme_2:applyVectorConfirmation(bars,raw,'break_extreme_2').events,
   [VECTOR_V14_LOCK.id]:applyVectorV14(bars,{rawVector:raw}).events,
   [V15_LOCK.protocol]:applyVectorV15(bars,{rawVector:raw}).events};
  for(const mode of LEDGER_LOCK.modes){
   const r=byMode[mode],events=modes[mode];
   r.signalLedger.push(...signalLedger(bars,raw,events,symbol,mode,cutoffTime));
   const execution=fixedTrades(bars,events,symbol,mode,cutoffTime);
   r.fixedTrades.push(...execution.trades);
   for(const side of ['long','short'])for(const p of ['earlier','later'])
    addBin(r.risk[side][p],execution.summary[side][p]);
   r.episodes.push(...directionalEpisodes(bars,events,symbol,mode,cutoffTime));
   if(symbol==='BTCUSDT')r.reviewSignals.push(...events.flatMap((e,i)=>
    e.signal&&bars[i].time>=LEDGER_LOCK.reviewStart&&bars[i].time<LEDGER_LOCK.reviewEnd?
    [{time:bars[i].time,side:e.signal,sourceTime:bars[e.sourceIndex??i].time,
     reason:e.why??null,delayBars:e.delayBars??0}]:[]));
  }
 }
 return {schemaVersion:1,status:'EXPLORATORY_AUDIT',symbol,cutoffTime,cleanWindows,skippedWindows,
  byMode:Object.fromEntries(Object.entries(byMode).map(([mode,r])=>[mode,{
   classification:countStatuses(r.signalLedger),
   risk:Object.fromEntries(Object.entries(r.risk).map(([side,ps])=>[side,
    Object.fromEntries(Object.entries(ps).map(([p,x])=>[p,finish(x)]))])),
   signalLedger:r.signalLedger,fixedTrades:r.fixedTrades,episodes:r.episodes,
   episodeSummary:{
    closed:r.episodes.filter(x=>x.status==='closed').length,
    censored:r.episodes.filter(x=>x.status==='censored').length,
    worstAdversePct:(()=>{
     const vals=r.episodes.filter(x=>x.status==='closed').map(x=>x.adversePct);
     return vals.length?Math.min(...vals):null;
    })()
   },reviewSignals:r.reviewSignals
  }])),
  caveats:[
   'This event ledger uses already examined historical data, not a fresh holdout.',
   'Forward 3/6/12-hour prices are hindsight labels only; never used to decide a signal.',
   'A signal already aligned with the current state is not a missed reversal.',
   'Directional episodes have no protective stop, are diagnostic only and can suffer catastrophic loss.',
   'Risk simulation uses next-open fills, fixed SL/TP/time, fees and slippage; no order placement.',
   'No cross-gap simulation; unresolved positions and unavailable forward paths are censored.',
   'Pine chart timezone and exact screenshot crosshair times remain unverified.'
  ]};
}
async function fetchRows(fetchPage,symbol,start,end){
 const rows=[];
 for(let a=start;a<end;a+=180*H){
  const b=Math.min(a+180*H,end);
  const page=await fetchPage({symbol,interval:'1h',startTime:a,endTime:b,limit:200});
  rows.push(...page.filter(x=>Number(x.time)>=a&&Number(x.time)<b));
 }
 return rows;
}
export async function runReversalLedger({now=Date.now(),fetchPage=makeCryptoJujuFetchPage()}={}){
 const end=Math.floor(now/H)*H,start=end-LEDGER_LOCK.days*D,cutoff=(start+end)/2;
 const results=[];
 for(const symbol of LEDGER_LOCK.symbols){
  try{
   const rows=await fetchRows(fetchPage,symbol,start,end);
   const q=planCleanBacktestWindows(rows,{startTime:start,endTime:end,intervalMs:H},
    {minBars:LEDGER_LOCK.minWindow});
   const audit=auditReversalWindows(q.eligibleWindows,{symbol,cutoffTime:cutoff});
   results.push({symbol,status:q.eligibleWindows.length?'STUDIED':'BLOCKED',
    coverage:{quality:q.status,expected:q.quality.expected,received:rows.length,
     validCoveragePct:round(q.quality.coveragePct),excludedBars:q.excludedBars,
     cleanWindows:q.eligibleWindows.length},audit});
  }catch(err){results.push({symbol,status:'ERROR',error:String(err?.message??err)});}
 }
 const status=results.some(x=>x.status==='ERROR')?'PARTIAL_ERROR':
  results.every(x=>x.status==='BLOCKED')?'BLOCKED':'HISTORICAL_COMPLETE';
 return {schemaVersion:1,status,generatedAt:new Date(now).toISOString(),
  commit:process.env.GITHUB_SHA??null,runId:process.env.GITHUB_RUN_ID??null,
  branch:process.env.GITHUB_REF_NAME??null,history:{start,end,cutoff},
  lock:LEDGER_LOCK,source:'readonly Bitunix futures OHLC via CryptoJuju proxy',results};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const r=await runReversalLedger();console.log(JSON.stringify(r,null,2));
 if(r.status!=='HISTORICAL_COMPLETE')process.exitCode=1;
}
