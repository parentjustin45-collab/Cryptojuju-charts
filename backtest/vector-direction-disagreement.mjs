/* Read-only directional disagreement between V1.1 and V1.4.
 * Both engines read IDENTICAL confirmed, contiguous Bitunix OHLC.
 * Ex-post horizon returns are diagnostic only, NEVER used for a signal/order.
 * No V1.1/V1.4 implementation changes; no retroactive cherry-picked trades.
 */
import {pathToFileURL} from 'node:url';
import {vectorAIT} from './vector-ait-v1.mjs';
import {applyVectorV14} from './vector-v14-hysteresis.mjs';
import {readVectorWatchState} from './vector-watch-browser.mjs';
import {makeCryptoJujuFetchPage} from './cryptojuju-adapter.mjs';
import {planCleanBacktestWindows} from './quarantine.mjs';

const H=3600000,D=24*H;
const nr=x=>x==null?null:Number(x.toFixed(5));
const label=d=>d===1?'LONG':d===-1?'SHORT':'NON_ETABLIE';
export const DIRECTION_AUDIT_LOCK=Object.freeze({
 id:'vector-v11-v14-direction-disagreement-same-bitunix-bars-v1',
 durationDays:90,minWindowBars:55,warmupBars:55,forwardHorizonsBars:[3,6,12],
 feeModel:'NONE: ex-post directional gross movement is not a simulated trade',
 markets:[{symbol:'BTCUSDT',tf:'1h',step:H},
  {symbol:'ETHUSDT',tf:'1h',step:H},
  {symbol:'SOLUSDT',tf:'1h',step:H},
  {symbol:'BTCUSDT',tf:'4h',step:4*H}],
 provenance:'Bitunix futures public LAST_PRICE 1h/4h via CryptoJuju proxy; no cross-exchange fallback',
 holdout:false,noTrades:true,
 caveat:'The 90d market history and screenshot cases were already examined; no untouched holdout or proof of live profit.'
});
function latestSig(data,i){
 for(let j=i;j>=0;j--)if(data[j].signal)return {time:data[j].time,side:data[j].signal,ageBars:i-j};
 return null;
}
function afterBar(bars,i,side,n,cutoff,step){
 const first=i+1,last=i+n,dir=side===1?1:-1;
 if(last>=bars.length)return null;
 if(bars[first].time<cutoff&&bars[last].time>=cutoff)return null;
 const price=Number(bars[first].open),exit=Number(bars[last].close);
 const values=bars.slice(first,last+1),extreme=dir===1?
  Math.max(...values.map(x=>Number(x.high))):
  Math.min(...values.map(x=>Number(x.low)));
 return {grossPct:nr(100*dir*(exit-price)/price),
  favorablePct:nr(Math.max(0,100*dir*(extreme-price)/price)),
  bars:n,hours:n*step/H};
}
function validBars(bars,step){
 return Array.isArray(bars)&&bars.length>=DIRECTION_AUDIT_LOCK.minWindowBars&&
  bars.every((b,i)=>Number.isSafeInteger(b.time)&&b.time%step===0&&
   b.open>0&&b.close>0&&b.high>=Math.max(b.open,b.close)&&
   b.low>0&&b.low<=Math.min(b.open,b.close)&&
   Number.isFinite(b.volume)&&b.volume>=0&&
   (i===0||b.time-bars[i-1].time===step));
}
export function compareDirectionWindow(bars,{symbol='BTCUSDT',tf='1h',step=H,
 cutoffTime=Number.MAX_SAFE_INTEGER}={}){
 if(!Number.isSafeInteger(cutoffTime)||!validBars(bars,step))
  throw Error('Invalid continuous closed Bitunix window');
 const v11=vectorAIT(bars),v14=applyVectorV14(bars,{rawVector:v11}).events;
 const eligible=[];
 for(let i=DIRECTION_AUDIT_LOCK.warmupBars-1;i<bars.length;i++){
  const d11=v11[i].direction,d14=v14[i].direction;
  eligible.push({i,time:bars[i].time,d11,d14,
   category:d11!==0&&d14!==0&&d11!==d14?'opposite':
    d11===d14&&d11!==0?'agree':'unestablished'});
 }
 const counts={agree:0,opposite:0,unestablished:0};
 for(const row of eligible)counts[row.category]++;
 const episodes=[];
 let active=null;
 const endEpisode=(j,reason)=>{
  if(active===null)return;
  const first=active.start,last=j-1,sideV11=active.dir11,sideV14=active.dir14;
  const startingPrice=Number(bars[first].close);
  const f={};for(const n of DIRECTION_AUDIT_LOCK.forwardHorizonsBars){
   f['horizon'+n]={
    v11:afterBar(bars,first,sideV11,n,cutoffTime,step),
    v14:afterBar(bars,first,sideV14,n,cutoffTime,step)
   };
  }
  episodes.push({symbol,tf,startTime:bars[first].time,
   endTime:bars[last].time,closedBars:last-first+1,
   durationHours:(last-first+1)*step/H,
   v11Side:label(sideV11),v14Side:label(sideV14),
   v11LastSignal:latestSig(v11,first),v14LastSignal:latestSig(v14,first),
   closeAtStart:startingPrice,resolution:reason,
   nextEventTime:j<bars.length?bars[j].time:null,
   futureGross:f});
  active=null;
 };
 for(const row of eligible){
  if(row.category!=='opposite'){
   if(active!==null){
    const reason=v14[row.i].direction===active.dir11?'v14_caught_up':
     v11[row.i].direction===active.dir14?'v11_reversed_back':'other_or_neutral';
    endEpisode(row.i,reason);
   }
   continue;
  }
  if(active===null){active={start:row.i,dir11:row.d11,dir14:row.d14};continue;}
  if(row.d11!==active.dir11||row.d14!==active.dir14){
   endEpisode(row.i,'new_disagreement_pair');
   active={start:row.i,dir11:row.d11,dir14:row.d14};
  }
 }
 if(active!==null)endEpisode(bars.length,'censored_window_end');
 return {symbol,tf,step,windowStart:bars[0].time,windowEnd:bars.at(-1).time+step,
  bars:bars.length,classified:eligible.length,counts,
  disagreementSharePct:eligible.length?nr(counts.opposite*100/eligible.length):null,
  current:{time:bars.at(-1).time,close:Number(bars.at(-1).close),
   v11:label(v11.at(-1).direction),v14:label(v14.at(-1).direction),
   v11LastSignal:latestSig(v11,bars.length-1),
   v14LastSignal:latestSig(v14,bars.length-1),
   opposite:v11.at(-1).direction!==0&&v14.at(-1).direction!==0&&
    v11.at(-1).direction!==v14.at(-1).direction},
  episodes,
  warning:'All futureGross labels are hindsight market movement from NEXT candle open to horizon close, before fees/stops and not a tradable result.'};
}
function summarizeGroup(rows){
 const summary={windows:rows.length,observedBars:0,agreeBars:0,oppositeBars:0,
  neutralBars:0,episodes:0,
  resolvedV14:0,resolvedV11:0,censoredEpisodes:0,
  lengthBarsTotal:0,maxLengthBars:0,
  horizon12Observed:0,forwardV11GrossSum:0,forwardV14GrossSum:0};
 for(const row of rows){
  summary.observedBars+=row.classified;
  summary.agreeBars+=row.counts.agree;
  summary.oppositeBars+=row.counts.opposite;
  summary.neutralBars+=row.counts.unestablished;
  for(const e of row.episodes){
   summary.episodes++;summary.lengthBarsTotal+=e.closedBars;
   summary.maxLengthBars=Math.max(summary.maxLengthBars,e.closedBars);
   summary.resolvedV14+=Number(e.resolution==='v14_caught_up');
   summary.resolvedV11+=Number(e.resolution==='v11_reversed_back');
   summary.censoredEpisodes+=Number(e.resolution==='censored_window_end');
   if(e.futureGross.horizon12.v11&&e.futureGross.horizon12.v14){
    summary.horizon12Observed++;
    summary.forwardV11GrossSum+=e.futureGross.horizon12.v11.grossPct;
    summary.forwardV14GrossSum+=e.futureGross.horizon12.v14.grossPct;
   }
  }
 }
 return {...summary,oppositeRatePct:summary.observedBars?
  nr(100*summary.oppositeBars/summary.observedBars):null,
  meanLengthBars:summary.episodes?nr(summary.lengthBarsTotal/summary.episodes):null,
  meanFuture12BarV11GrossPct:summary.horizon12Observed?
   nr(summary.forwardV11GrossSum/summary.horizon12Observed):null,
  meanFuture12BarV14GrossPct:summary.horizon12Observed?
   nr(summary.forwardV14GrossSum/summary.horizon12Observed):null,
  warning:'Ex-post gross returns at DISAGREEMENT episode start, before all fees and risk exits; do not optimize strategy or infer profitability.'};
}
export function auditDirectionalWindows(windows,{symbol='BTCUSDT',tf='1h',step=H,
 cutoffTime=Number.MAX_SAFE_INTEGER,expectedLastClosedTime=null}={}){
 const accepted=[],excluded=[];
 for(const w of windows){
  const bars=w.candles??w;
  if(!validBars(bars,step)){excluded.push({first:bars?.[0]?.time??null,why:'SHORT_OR_INVALID'});continue;}
  accepted.push(compareDirectionWindow(bars,{symbol,tf,step,cutoffTime}));
 }
 const summary=summarizeGroup(accepted);
 let snapshot=null;
 if(expectedLastClosedTime!==null){
  const latest=accepted.findLast(w=>w.current.time===expectedLastClosedTime);
  if(latest){
   snapshot={...latest.current,sourceWindowBars:latest.bars,
    lastWindowOppositeRatePct:latest.disagreementSharePct,
    watchStatus:'separate WATCH module, not an order',
    currentEpisodes:latest.episodes.slice(-3)};
  }
 }
 return {symbol,tf,summary,snapshot,
  noCurrentSnapshotReason:snapshot?null:'Latest closed candles do not have a valid 55+ contiguous data segment',
  episodes:accepted.flatMap(x=>x.episodes),excludedWindows:excluded,
  caution:'V1.1/V1.4 port on exactly the same Bitunix candles. Browser V1.1 may use a longer or different loaded history; screenshot directions are not exact bar-matched verification.'};
}
async function pages(fetchPage,symbol,tf,step,start,end){
 const rows=[];
 for(let t=start;t<end;t+=180*step){
  const stop=Math.min(end,t+180*step);
  const b=await fetchPage({symbol,interval:tf,startTime:t,endTime:stop,limit:200});
  rows.push(...b.filter(x=>Number(x.time)>=t&&Number(x.time)<stop));
 }
 return rows;
}
export async function runDirectionAudit({now=Date.now(),fetchPage=makeCryptoJujuFetchPage()}={}){
 const reports=[];
 for(const m of DIRECTION_AUDIT_LOCK.markets){
  const end=Math.floor(now/m.step)*m.step;
  const start=end-DIRECTION_AUDIT_LOCK.durationDays*D;
  const cutoff=start+45*D;
  try{
   const candles=await pages(fetchPage,m.symbol,m.tf,m.step,start,end);
   const clean=planCleanBacktestWindows(candles,
    {startTime:start,endTime:end,intervalMs:m.step},{minBars:DIRECTION_AUDIT_LOCK.minWindowBars});
   const result=auditDirectionalWindows(clean.eligibleWindows,{
    symbol:m.symbol,tf:m.tf,step:m.step,cutoffTime:cutoff,
    expectedLastClosedTime:end-m.step});
   // Independently verify the live WATCH module on precisely the same suffix.
   if(result.snapshot){
    const w=clean.eligibleWindows.findLast(s=>s.candles.at(-1).time===end-m.step);
    const converted=w.candles.map(x=>({...x,time:x.time/1000}));
    const watch=readVectorWatchState(converted,m.tf,Math.floor(now/1000));
    result.snapshot.watch={status:watch.status,label:watch.label,
     confirmedDirection:watch.confirmedDirection,watchDirection:watch.watchDirection,
     tradingSignal:watch.tradingSignal};
    if(watch.confirmedDirection!==result.snapshot.v14 &&
      !(watch.confirmedDirection===null&&result.snapshot.v14==='NON_ETABLIE'))
      throw Error('WATCH and V1.4 direction mismatch on identical closed OHLC');
   }
   reports.push({status:result.snapshot?'VERIFIED_SNAPSHOT':'HISTORICAL_ONLY_NO_FRESH_STATE',
    market:m,coverage:{state:clean.status,validCoveragePct:nr(clean.quality.coveragePct),
     expected:clean.quality.expected,received:candles.length,
     excludedBars:clean.excludedBars,cleanWindows:clean.eligibleWindows.length},
    audit:result});
  }catch(e){reports.push({status:'BLOCKED',market:m,error:String(e?.message??e)});}
 }
 return {protocol:DIRECTION_AUDIT_LOCK.id,
  generatedAt:new Date(now).toISOString(),branch:process.env.GITHUB_REF_NAME??null,
  commit:process.env.GITHUB_SHA??null,runId:process.env.GITHUB_RUN_ID??null,
  source:'Bitunix public closed 1h and 4h futures OHLC only',lock:DIRECTION_AUDIT_LOCK,
  status:reports.every(r=>r.status==='VERIFIED_SNAPSHOT')?'ALL_FOUR_FRESH_SNAPSHOTS':
   reports.some(r=>r.status==='BLOCKED')?'PARTIAL_BLOCKED':'HISTORICAL_WITH_SOME_MISSING_SNAPSHOT',
  reports};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const r=await runDirectionAudit();
 process.stdout.write(JSON.stringify(r,null,2));
 if(r.status!=='ALL_FOUR_FRESH_SNAPSHOTS')process.exitCode=1;
}
