/* Vector V1.4 confirmation-latency audit (research only).
 * Compares V1.1 countertrend flips versus unchanged V1.4 on EXACTLY the
 * same valid closed Bitunix 1H bars. No optimization, signals, or orders.
 *
 * The "missed entry move" is hypothetical next-open price difference:
 * signed(V1.4 entry open - V1.1 entry open)/V1.1 entry open.
 * It is NOT P&L, a trade backtest, or proof the earlier flip was right.
 */
import {pathToFileURL} from 'node:url';
import {vectorAIT} from './vector-ait-v1.mjs';
import {applyVectorV14} from './vector-v14-hysteresis.mjs';
import {planCleanBacktestWindows} from './quarantine.mjs';
import {makeCryptoJujuFetchPage} from './cryptojuju-adapter.mjs';
const H=3600000,D=24*H;
const round=n=>n==null?null:Number(n.toFixed(6));
const sideText=x=>x===1?'LONG':x===-1?'SHORT':'NONE';
const median=v=>{if(!v.length)return null;const z=[...v].sort((a,b)=>a-b),mid=z.length>>1;return z.length%2?z[mid]:(z[mid-1]+z[mid])/2;};
export const LATENCY_LOCK=Object.freeze({
 protocol:'vector-v14-confirmation-delay-vs-v11-on-same-closed-ohlc-v1',
 asOfExclusive:'2026-10-26T13:00:00Z',
 days:90,chronologicalSplitDays:45,
 symbols:['BTCUSDT','ETHUSDT','SOLUSDT'],tf:'1h',stepMs:H,
 minCleanBars:55,warmupBars:55,feePerSide:0.0006,slippagePerSide:0.0005,
 simulation:'V1.1 next-open to next-open on short-lived flips only; V1.4 is ALREADY IN its prior direction',
 notes:'Historical, repeatedly inspected 90d OHLC; no new trading version, no holdout, no orders.'
});
const cutoff=Date.parse(LATENCY_LOCK.asOfExclusive)-LATENCY_LOCK.chronologicalSplitDays*D;
const start=Date.parse(LATENCY_LOCK.asOfExclusive)-LATENCY_LOCK.days*D;
function quality(bars,step){
 if(!Array.isArray(bars)||bars.length<LATENCY_LOCK.minCleanBars)throw Error('Too-short valid OHLC segment');
 if(bars.some((b,i)=>!Number.isSafeInteger(b.time)||
  (i>0&&b.time-bars[i-1].time!==step)||b.open<=0||b.close<=0||
  b.high<Math.max(b.open,b.close)||b.low>Math.min(b.open,b.close)||
  b.low<=0||!Number.isFinite(b.volume)||b.volume<0))throw Error('Invalid or discontinuous closed OHLC');
}
const summaryTemplate=()=>({counterFlips:0,lateConfirmed:0,revertedV11:0,
  unresolvedBoundary:0,unresolvedGapOrEnd:0,simultaneousOrOther:0,
  pairedFillCount:0,lateEntryWorse:0,lateEntryBetter:0,flatEntry:0,
  delayBars:[],entryGapPct:[],shortLivedV11NetPct:[]});
function returnSim(entryOpen,exitOpen,dir){
 const initial=entryOpen*(1+dir*LATENCY_LOCK.slippagePerSide);
 const final=exitOpen*(1-dir*LATENCY_LOCK.slippagePerSide);
 return round(100*(dir*(final-initial)/initial-
   LATENCY_LOCK.feePerSide*(1+final/initial)));
}
/* This deterministic pure ledger is separately testable with synthetic
 * transition arrays. Its future observations never change the engines.
 */
export function compareCounterFlips(bars,v11,v14,{
 symbol='ETHUSDT',cutoffTime=cutoff,stepMs=H}={}){
 quality(bars,stepMs);
 if(!Number.isSafeInteger(cutoffTime)||v11.length!==bars.length||
  v14.length!==bars.length)throw Error('Misaligned engines or cutoff');
 const events=[];
 for(let i=LATENCY_LOCK.warmupBars-1;i<bars.length;i++){
  const raw=v11[i],ref=v14[i];
  const dir=raw.direction,prev=i>0?v11[i-1].direction:0;
  // Only a NEW V1.1 direction, against an ESTABLISHED V1.4 direction.
  if(!raw.signal||dir===0||dir===prev||ref.direction===0||
   ref.direction===dir)continue;
  const period=bars[i].time<cutoffTime?'earlier':'later';
  const cutoffIndex=period==='earlier'?
   bars.findIndex(b=>b.time>=cutoffTime):bars.length;
  const periodEnd=cutoffIndex<0?bars.length:cutoffIndex;
  const firstEntry=i+1,base={
   symbol,time:bars[i].time,side:sideText(dir),period,
   priorV14:sideText(ref.direction),v11EntryTime:null,
   v11EntryOpen:null,v14ConfirmationTime:null,v14EntryTime:null,
   v14ConfirmationReason:null,delayBars:null,waitHours:null,
   entryGapPct:null,v11ShortLivedNetPct:null,
   resolution:null,resolvedTime:null,
   observationsUsedAfterSignal:false};
  if(firstEntry>=periodEnd){
   events.push({...base,resolution:period==='earlier'?'censored_split':'censored_window_end'});
   continue;
  }
  const v11EntryOpen=Number(bars[firstEntry].open);
  base.v11EntryTime=bars[firstEntry].time;
  base.v11EntryOpen=v11EntryOpen;
  let resolution=null;
  for(let j=i+1;j<periodEnd;j++){
   const v11Still=v11[j].direction===dir,v14Caught=v14[j].direction===dir;
   if(v14Caught&&!v11Still){
    resolution={kind:'simultaneous_or_ambiguous',j};break;
   }
   if(v14Caught){resolution={kind:'v14_confirmed_later',j};break;}
   if(!v11Still){resolution={kind:'v11_reverted_first',j};break;}
   if(v14[j].direction===0){resolution={kind:'simultaneous_or_ambiguous',j};break;}
  }
  if(!resolution){
   events.push({...base,
    resolution:period==='earlier'&&periodEnd<bars.length?'censored_split':'censored_window_end',
    observationsUsedAfterSignal:true});
   continue;
  }
  const j=resolution.j,after=j+1;
  if(after>=periodEnd){
   events.push({...base,resolution:period==='earlier'&&periodEnd<bars.length?
    'censored_split':'censored_window_end',observationsUsedAfterSignal:true});
   continue;
  }
  const common={...base,resolution:resolution.kind,resolvedTime:bars[j].time,
   delayBars:j-i,waitHours:(j-i)*stepMs/H,observationsUsedAfterSignal:true};
  if(resolution.kind==='v14_confirmed_later'){
   const lateOpen=Number(bars[after].open);
   events.push({...common,v14ConfirmationTime:bars[j].time,
    v14EntryTime:bars[after].time,
    v14ConfirmationReason:v14[j].why??null,
    entryGapPct:round(100*dir*(lateOpen-v11EntryOpen)/v11EntryOpen)});
  }else if(resolution.kind==='v11_reverted_first'){
   // Hypothetical TWO-SIDED fee and slippage on V1.1 flip-and-flip-back.
   // V1.4 has remained exposed to the prior direction, not "out of market".
   events.push({...common,
    v11ShortLivedNetPct:returnSim(v11EntryOpen,Number(bars[after].open),dir)});
  }else events.push(common);
 }
 return events;
}
function aggregate(events){
 const buckets={};
 const grouped=Object.groupBy(events,x=>x.period+'|'+x.side);
 for(const period of ['earlier','later'])for(const side of ['LONG','SHORT']){
  const matches=grouped[period+'|'+side]??[],b=summaryTemplate();
  for(const x of matches){
   b.counterFlips++;
   if(x.resolution==='v14_confirmed_later'){
    b.lateConfirmed++;
    b.delayBars.push(x.delayBars);b.entryGapPct.push(x.entryGapPct);b.pairedFillCount++;
    b.lateEntryWorse+=Number(x.entryGapPct>0);
    b.lateEntryBetter+=Number(x.entryGapPct<0);
    b.flatEntry+=Number(x.entryGapPct===0);
   }else if(x.resolution==='v11_reverted_first'){
    b.revertedV11++;b.shortLivedV11NetPct.push(x.v11ShortLivedNetPct);
   }else if(x.resolution==='censored_split')b.unresolvedBoundary++;
   else if(x.resolution==='censored_window_end')b.unresolvedGapOrEnd++;
   else b.simultaneousOrOther++;
  }
  buckets[period+'|'+side]={
   counterFlips:b.counterFlips,lateConfirmed:b.lateConfirmed,
   revertedV11:b.revertedV11,unresolvedBoundary:b.unresolvedBoundary,
   unresolvedGapOrEnd:b.unresolvedGapOrEnd,simultaneousOrOther:b.simultaneousOrOther,
   pairedFillCount:b.pairedFillCount,lateEntryWorse:b.lateEntryWorse,
   lateEntryBetter:b.lateEntryBetter,flatEntry:b.flatEntry,
   medianDelayBars:round(median(b.delayBars)),
   meanDelayBars:b.delayBars.length?round(b.delayBars.reduce((a,c)=>a+c,0)/b.delayBars.length):null,
   medianEntryGapPct:round(median(b.entryGapPct)),
   meanEntryGapPct:b.entryGapPct.length?round(b.entryGapPct.reduce((a,c)=>a+c,0)/b.entryGapPct.length):null,
   medianShortLivedV11HypotheticalNetPct:round(median(b.shortLivedV11NetPct)),
   meanShortLivedV11HypotheticalNetPct:b.shortLivedV11NetPct.length?
    round(b.shortLivedV11NetPct.reduce((a,c)=>a+c,0)/b.shortLivedV11NetPct.length):null,
   adequateSample:b.counterFlips>=30,
   caveat:'Entry gaps are directionally signed, not executed P&L. Short-lived flip returns are hypothetical and do not count P&L for the held V1.4 position.'
  };
 }
 return buckets;
}
export function analyzeLatencyWindows(windows,{symbol='ETHUSDT',cutoffTime=cutoff}={}){
 if(!Array.isArray(windows)||!Number.isSafeInteger(cutoffTime))throw Error('Invalid window input');
 let cleanWindows=0,blockedWindows=0;const events=[];
 for(const w of windows){
  const bars=w.candles??w;
  try{
   quality(bars,H);
   const raw=vectorAIT(bars),v14=applyVectorV14(bars,{rawVector:raw}).events;
   events.push(...compareCounterFlips(bars,raw,v14,{symbol,cutoffTime}));
   cleanWindows++;
  }catch(e){blockedWindows++;}
 }
 return {symbol,cleanWindows,blockedWindows,
  cohorts:aggregate(events),events,
  caveats:['90d already studied; not a new prospective holdout.',
   'A late confirmation gap is a price difference only and does not prove a missed trade gain.',
   'V1.4 holds the old position; therefore skipped V1.1 flips are not "risk-free".',
   'Incomplete episodes and those crossing the split are censored, never winners.',
   'No optimization, no new strategy, no Bitunix orders.']};
}
async function history(fetchPage,symbol,startTime,endTime){
 const rows=[];
 for(let a=startTime;a<endTime;a+=180*H){
  const b=Math.min(endTime,a+180*H);
  const page=await fetchPage({symbol,interval:'1h',startTime:a,endTime:b,limit:200});
  rows.push(...page.filter(x=>Number(x.time)>=a&&Number(x.time)<b));
 }
 return rows;
}
export async function runLatencyAudit({fetchPage=makeCryptoJujuFetchPage()}={}){
 const results=[];
 for(const symbol of LATENCY_LOCK.symbols){
  try{
   const rows=await history(fetchPage,symbol,start,Date.parse(LATENCY_LOCK.asOfExclusive));
   const quality=planCleanBacktestWindows(rows,
    {startTime:start,endTime:Date.parse(LATENCY_LOCK.asOfExclusive),intervalMs:H},
    {minBars:LATENCY_LOCK.minCleanBars});
   const study=analyzeLatencyWindows(quality.eligibleWindows,{symbol,cutoffTime:cutoff});
   results.push({symbol,status:study.cleanWindows?'STUDIED':'BLOCKED',
    coverage:{state:quality.status,expected:quality.quality.expected,
     validCoveragePct:round(quality.quality.coveragePct),received:rows.length,
     excludedBars:quality.excludedBars,cleanWindows:study.cleanWindows},
    audit:study});
  }catch(e){results.push({symbol,status:'ERROR',error:String(e?.message??e)});}
 }
 const status=results.every(x=>x.status==='STUDIED')?'HISTORICAL_COMPLETE':'PARTIAL_OR_BLOCKED';
 return {schema:1,status,protocol:LATENCY_LOCK.protocol,
  fromUtc:new Date(start).toISOString(),toUtc:LATENCY_LOCK.asOfExclusive,
  cutoffUtc:new Date(cutoff).toISOString(),
  commit:process.env.GITHUB_SHA??null,runId:process.env.GITHUB_RUN_ID??null,
  branch:process.env.GITHUB_REF_NAME??null,lock:LATENCY_LOCK,results};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const r=await runLatencyAudit();
 console.log(JSON.stringify(r,null,2));
 if(r.status!=='HISTORICAL_COMPLETE')process.exitCode=1;
}
