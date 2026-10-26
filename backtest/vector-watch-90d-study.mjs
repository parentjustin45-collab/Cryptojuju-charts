/* Read-only research: value of non-tradable WATCH alerts preceding unchanged
   V1.4 confirmations and their hindsight 12-hour outcomes. No extra filters,
   no use of future OHLC in WATCH, no trades on warnings. */
import {pathToFileURL} from 'node:url';
import {vectorAIT} from './vector-ait-v1.mjs';
import {applyVectorV14} from './vector-v14-hysteresis.mjs';
import {applyVectorWatch,VECTOR_WATCH_LOCK} from './vector-watch-shadow.mjs';
import {auditReversalWindows} from './vector-event-ledger.mjs';
import {planCleanBacktestWindows} from './quarantine.mjs';
import {makeCryptoJujuFetchPage} from './cryptojuju-adapter.mjs';
const H=3600000,D=24*H,r=n=>n==null?null:Number(n.toFixed(6));
export const WATCH_AUDIT_LOCK=Object.freeze({
 protocol:'vector-two-stage-watch-90d-historical-v1',
 symbolGroup:['BTCUSDT','ETHUSDT','SOLUSDT'],
 start:Date.parse('2026-07-28T01:00:00Z'),
 end:Date.parse('2026-10-26T01:00:00Z'),
 cutoff:Date.parse('2026-09-11T01:00:00Z'),
 timeframe:'1h',minBars:55,forwardBars:12,
 missedMoveGrossPct:.4,missedMoveMfePct:.8,
 forwardObservationNotBefore:Date.parse('2026-10-28T00:00:00Z'),
 note:'Historical exploratory audit on repeatedly studied history; WATCH is not a trade. No new candidate model selection.'
});
const blank=()=>({count:0,confirmed:0,expired:0,canceled:0,superseded:0,
 censoredEnd:0,confirmedLeadBarsSum:0,
 outcomeObserved:0,missedMovePotential:0,negativeMove:0,ambiguous:0,
 censored12h:0,matchedV11Rejected:0});
function classifyFuture(bars,index,side,cutoffTime){
 const start=index+1,end=start+WATCH_AUDIT_LOCK.forwardBars-1;
 if(end>=bars.length||(bars[start]?.time<cutoffTime&&bars[end].time>=cutoffTime))
  return {status:'censored',gross12hPct:null,mfe12hPct:null,mae12hPct:null};
 const sliced=bars.slice(start,end+1),d=side==='long'?1:-1,
  entry=Number(sliced[0].open);
 const extremal=d===1?Math.max(...sliced.map(v=>Number(v.high))):
  Math.min(...sliced.map(v=>Number(v.low)));
 const worst=d===1?Math.min(...sliced.map(v=>Number(v.low))):
  Math.max(...sliced.map(v=>Number(v.high)));
 const gross=100*d*(Number(sliced.at(-1).close)-entry)/entry,
  favorable=Math.max(0,100*d*(extremal-entry)/entry),
  adverse=Math.min(0,100*d*(worst-entry)/entry);
 const status=gross>=WATCH_AUDIT_LOCK.missedMoveGrossPct &&
  favorable>=WATCH_AUDIT_LOCK.missedMoveMfePct?'potential_move':
  gross<=0?'negative_move':'ambiguous';
 return {status,gross12hPct:r(gross),mfe12hPct:r(favorable),mae12hPct:r(adverse)};
}
function scanWindow(bars,symbol,cutoffTime){
 const raw=vectorAIT(bars),v14=applyVectorV14(bars,{rawVector:raw}),
  shadow=applyVectorWatch(bars,{rawVector:raw,v14});
 const baseline=auditReversalWindows([{candles:bars}],{symbol,cutoffTime});
 const rejects=new Set(baseline.byMode.v14_hysteresis_structure_momentum_v1.signalLedger
  .filter(x=>x.classification==='rejected')
  .map(x=>x.time+'|'+x.side));
 const watches=shadow.alerts.map(a=>{
  const outcome=classifyFuture(bars,a.index,a.side,cutoffTime);
  return {symbol,watchTime:a.time,side:a.side,heldDirection:a.heldDirection,
   watchClose:a.close,bodyAtr:r(a.bodyAtr),resolution:a.resolution,
   confirmedTime:a.resolution==='confirmed'?a.resolvedTime:null,
   leadBars:a.leadBars,
   period:a.time<cutoffTime?'earlier':'later',
   wasV11Rejected:rejects.has(a.time+'|'+a.side),...outcome};
 });
 return {watches,confirmedExact:shadow.unchangedConfirmed,
  referenceSignalTimes:v14.events.flatMap(e=>e.signal?[{time:e.time,side:e.signal}]:[]),
  watchCount:shadow.alerts.length};
}
export function auditShadowWindows(windows,{symbol='BTCUSDT',cutoffTime=WATCH_AUDIT_LOCK.cutoff}={}){
 if(!Array.isArray(windows)||!Number.isSafeInteger(cutoffTime))throw Error('Invalid WATCH audit input');
 const data=[],baselineParts=[];
 let cleanWindows=0,skippedWindows=0,confirmedExact=true;
 for(const w of windows){
  const bars=w.candles??w;
  if(!Array.isArray(bars)||bars.length<WATCH_AUDIT_LOCK.minBars ||
    bars.some((b,i)=>!Number.isSafeInteger(b.time)||(i&&b.time-bars[i-1].time!==H))){
   skippedWindows++;continue;
  }
  cleanWindows++;
  const run=scanWindow(bars,symbol,cutoffTime);
  confirmedExact&&=run.confirmedExact;
  data.push(...run.watches);
  baselineParts.push(...run.referenceSignalTimes);
 }
 const allBins={};
 for(const period of ['earlier','later']){
  allBins[period]={};
  for(const side of ['long','short']){
   const rows=data.filter(a=>a.period===period&&a.side===side),b=blank();
   for(const x of rows){
    b.count++;
    if(x.resolution==='confirmed'){
     b.confirmed++;b.confirmedLeadBarsSum+=x.leadBars??0;
    }else if(x.resolution==='expired_unconfirmed')b.expired++;
    else if(x.resolution==='canceled_opposite_vector')b.canceled++;
    else if(x.resolution==='superseded_by_other_confirmation')b.superseded++;
    else b.censoredEnd++;
    if(x.status==='censored')b.censored12h++;
    else{
     b.outcomeObserved++;
     if(x.status==='potential_move')b.missedMovePotential++;
     else if(x.status==='negative_move')b.negativeMove++;
     else b.ambiguous++;
    }
    if(x.wasV11Rejected)b.matchedV11Rejected++;
   }
   allBins[period][side]={...b,
    confirmedRatePct:b.count?r(100*b.confirmed/b.count):null,
    meanLeadBars:b.confirmed?r(b.confirmedLeadBarsSum/b.confirmed):null,
    diagnosticPotentialMoveRatePct:b.outcomeObserved?
     r(100*b.missedMovePotential/b.outcomeObserved):null};
  }
 }
 return {status:'HISTORICAL_SHADOW_ONLY',symbol,cutoffTime,
  cleanWindows,skippedWindows,confirmedExact,summary:allBins,
  watches:data,referenceSignalTimes:baselineParts,
  caution:[
   'WATCH emitted only after close, no order, no V1.4 position flip.',
   'A WATCH is just the first opposite raw Vector impulse, not a predictive filter.',
   'Alerts on already-examined 90d history are NOT prospective validation.',
   '12h outcomes are retrospective labels, and cannot prove trade profitability.',
   'End/gap/split right-censoring is never counted as winning or losing.',
   'Never compare WATCH apparent win rate to V1.4 fixed-stop trade win rate.'
  ]};
}
async function pages(fetchPage,symbol,start,end){
 const rows=[];
 for(let a=start;a<end;a+=180*H){
  const stop=Math.min(a+180*H,end);
  const page=await fetchPage({symbol,interval:'1h',startTime:a,endTime:stop,limit:200});
  rows.push(...page.filter(c=>Number(c.time)>=a&&Number(c.time)<stop));
 }
 return rows;
}
export async function runWatchAudit({fetchPage=makeCryptoJujuFetchPage(),now=Date.now()}={}){
 const L=WATCH_AUDIT_LOCK,reports=[];
 for(const symbol of L.symbolGroup){
  try{
   const rows=await pages(fetchPage,symbol,L.start,L.end);
   const plan=planCleanBacktestWindows(rows,{startTime:L.start,endTime:L.end,intervalMs:H},
    {minBars:L.minBars});
   const audit=auditShadowWindows(plan.eligibleWindows,{symbol,cutoffTime:L.cutoff});
   reports.push({symbol,status:audit.cleanWindows?'STUDIED':'BLOCKED',
    coverage:{state:plan.status,expected:plan.quality.expected,received:rows.length,
     validCoveragePct:r(plan.quality.coveragePct),
     excludedBars:plan.excludedBars,cleanWindows:plan.eligibleWindows.length},
    audit});
  }catch(e){reports.push({symbol,status:'ERROR',error:String(e?.message??e)});}
 }
 const status=reports.some(x=>x.status==='ERROR')?'PARTIAL_ERROR':
  reports.every(x=>x.status==='BLOCKED')?'BLOCKED':'HISTORICAL_COMPLETE';
 return {schemaVersion:1,status,generatedAt:new Date(now).toISOString(),
  branch:process.env.GITHUB_REF_NAME??null,commit:process.env.GITHUB_SHA??null,
  runId:process.env.GITHUB_RUN_ID??null,source:'Read-only Bitunix futures OHLC via CryptoJuju',
  lock:L,warning:VECTOR_WATCH_LOCK.note,reports};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const x=await runWatchAudit();console.log(JSON.stringify(x,null,2));
 if(x.status!=='HISTORICAL_COMPLETE')process.exitCode=1;
}
