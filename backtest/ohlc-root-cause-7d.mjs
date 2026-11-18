/* DEV-only, read-only BTCUSDT candle audit, 7 days of CLOSED Bitunix klines.
 * Count OHLC defects, gaps, duplicates and proxy mismatch, plus quantify how
 * bad data quarantines Vector V1.1 evaluation. No historical candles repaired.
 * Independent TradingView only for the user-provided screenshots, not this feed.
 */
import {writeFile} from 'node:fs/promises';
import {makeBitunixFetchPage} from './bitunix-adapter.mjs';
import {makeCryptoJujuFetchPage} from './cryptojuju-adapter.mjs';
import {STEP_MS,normalizeCandles,compareCandleSets,publicQuality} from './ohlc-parity-core.mjs';
import {planCleanBacktestWindows} from './quarantine.mjs';
import {vectorAIT} from './vector-ait-v1.mjs';

const symbol='BTCUSDT',tfs=['15m','1h','4h'],now=Date.now();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const iso=t=>new Date(t).toISOString();
const direct=makeBitunixFetchPage({
 fetchImpl:(url,opts)=>fetch(url,{...opts,signal:AbortSignal.timeout(18000)})
});
const proxy=makeCryptoJujuFetchPage({
 fetchImpl:(url,opts)=>fetch(url,{...opts,signal:AbortSignal.timeout(18000)})
});
const report={version:'CJ_OHLC_ROOT_CAUSE_7D_V1',symbol,startedUTC:iso(now),
 branch:'dev/v1.26.0',policy:{closedHistoryDays:7,skipLatestClosedBar:true,
 repairOHLC:false,trading:false,compareSources:['Bitunix direct REST','CryptoJuju proxy to same Bitunix REST'],
 tradingViewIndependent:'NOT_RETRIEVED_AUTOMATICALLY',vectorModel:'V1.1 research, same as frontend regression port'},
 frames:[],crossTimeframe:[],errors:[],status:'PENDING'};
const countByTf={'15m':672,'1h':168,'4h':42};
async function load(fetchPage,tf,window){
 const rows=[],errors=[];
 for(let t=window.startTime;t<window.endTime;t+=170*window.intervalMs){
  const e=Math.min(window.endTime,t+170*window.intervalMs);
  let success=false;
  for(let attempt=1;attempt<=2;attempt++){
   try{
    const r=await fetchPage({symbol,interval:tf,startTime:t,endTime:e,limit:200});
    rows.push(...r);success=true;break;
   }catch(err){if(attempt===2)errors.push({utc:iso(t),error:String(err?.message??err)});
    else await sleep(600)}
  }
  if(!success)continue;
 }
 return {rows,errors};
}
function describeInvalid(snap){
 return snap.invalid.map(x=>{
  const b=x.bar;
  return {utc:x.utc,time:x.time,reasons:x.reasons,open:b.open,high:b.high,
   low:b.low,close:b.close,highDeficitUSDT:Number(Math.max(0,Math.max(b.open,b.close)-b.high).toFixed(8)),
   lowExcessUSDT:Number(Math.max(0,b.low-Math.min(b.open,b.close)).toFixed(8))};
 });
}
function vectorImpact(raw,window){
 const w=planCleanBacktestWindows(raw,window,{minBars:25});
 const out={status:w.status,invalid:w.issues.length,missing:w.missing.length,
  duplicates:w.duplicateTimes.length,eligibleWindows:w.eligibleWindows.length,
  eligibleBars:w.eligibleWindows.reduce((n,x)=>n+x.bars,0),
  excludedBars:w.excludedBars,segments:w.segments,
  signalsTotal:0,long:0,short:0,signals:[],
  caveat:'Only continuous clean segments can be evaluated. Signals after a gap need fresh indicator warmup; no inference about a missing signal.'};
 for(const segment of w.eligibleWindows){
  try{
   for(const row of vectorAIT(segment.candles)){
    if(!row.signal)continue;
    out.signalsTotal++;out[row.signal]++;
    if(out.signals.length<15)out.signals.push({utc:iso(row.time),side:row.signal});
   }
  }catch(e){out.status='VECTOR_EVALUATION_ERROR';out.error=String(e?.message??e)}
 }
 return out;
}
function cross(source,sourceStep,target,targetStep,label){
 const srcInvalid=new Set(source.invalid.map(x=>x.time));
 const dstInvalid=new Set(target.invalid.map(x=>x.time));
 let compared=0,skipped=0;const mismatches=[];
 for(const [t,d] of target.bars){
  const chunk=[];
  for(let c=t;c<t+targetStep;c+=sourceStep){
   const b=source.bars.get(c);if(!b||srcInvalid.has(c)){chunk.length=0;break}
   chunk.push(b);
  }
  if(chunk.length!==targetStep/sourceStep||dstInvalid.has(t)){skipped++;continue}
  const a={open:chunk[0].open,high:Math.max(...chunk.map(x=>x.high)),
   low:Math.min(...chunk.map(x=>x.low)),close:chunk.at(-1).close};
  const delta=Object.fromEntries(['open','high','low','close'].map(k=>[k,Number((a[k]-d[k]).toFixed(8))]));
  compared++;
  if(Object.values(delta).some(v=>Math.abs(v)>0.011))
   mismatches.push({utc:iso(t),aggregated:a,original:d,delta});
 }
 return {comparison:label,compared,skipped,mismatches:mismatches.length,samples:mismatches.slice(0,8),
  caution:'Aggregations are another view of the SAME Bitunix feed, not independent TradingView evidence.'};
}
const snapshots={};
for(const tf of tfs){
 const step=STEP_MS[tf],count=countByTf[tf],current=Math.floor(now/step)*step;
 const window={intervalMs:step,endTime:current-step,startTime:current-step-count*step};
 const f={tf,window:{fromUTC:iso(window.startTime),toExclusiveUTC:iso(window.endTime),
  expected:count},errors:[],status:'PENDING'};
 report.frames.push(f);
 try{
  const [a,b]=await Promise.all([load(direct,tf,window),load(proxy,tf,window)]);
  f.errors=[...a.errors.map(x=>({...x,source:'direct'})),...b.errors.map(x=>({...x,source:'proxy'}))];
  const x=normalizeCandles(a.rows,window,'direct'),y=normalizeCandles(b.rows,window,'proxy');
  snapshots[tf]=x;
  f.direct=publicQuality(x);f.proxy=publicQuality(y);
  f.invalidDirect=describeInvalid(x);f.invalidProxy=describeInvalid(y);
  f.parity=compareCandleSets(x,y,window);
  f.vector=vectorImpact(a.rows,window);
  f.status=f.errors.length?'FETCH_ERRORS':x.quality!=='CLEAN'||y.quality!=='CLEAN'?
   'RAW_OHLC_BLOCKED':f.parity.status==='MATCH'?'CLEAN_MATCH':'SOURCE_MISMATCH';
 }catch(e){f.status='ERROR';f.errors.push({error:String(e?.stack??e)})}
 console.log('TIMEFRAME '+JSON.stringify({tf,status:f.status,errors:f.errors,
  direct:f.direct,proxy:f.proxy,parity:f.parity,vector:f.vector?{
   status:f.vector.status,signalsTotal:f.vector.signalsTotal,eligibleBars:f.vector.eligibleBars,
   excludedBars:f.vector.excludedBars}:null}).slice(0,18000));
}
if(snapshots['15m']&&snapshots['1h'])report.crossTimeframe.push(
 cross(snapshots['15m'],STEP_MS['15m'],snapshots['1h'],STEP_MS['1h'],'15m rolled into 1h'));
if(snapshots['1h']&&snapshots['4h'])report.crossTimeframe.push(
 cross(snapshots['1h'],STEP_MS['1h'],snapshots['4h'],STEP_MS['4h'],'1h rolled into 4h'));
report.status=report.frames.some(x=>x.status==='ERROR'||x.status==='FETCH_ERRORS')?'INCOMPLETE':
 report.frames.every(x=>x.status==='CLEAN_MATCH')&&report.crossTimeframe.every(x=>!x.mismatches)?
  'CLEAN':'DATA_QUALITY_OR_PARITY_BLOCKED';
report.finishedUTC=iso(Date.now());
await writeFile('cj-ohlc-root-cause-7d.json',JSON.stringify(report,null,2)+'\n');
console.log('SUMMARY '+JSON.stringify({status:report.status,frames:report.frames.map(x=>({
 tf:x.tf,status:x.status,expected:x.window.expected,
 received:x.direct?.count,invalid:x.direct?.invalid,
 missing:x.direct?.missing,duplicate:x.direct?.duplicates,
 proxyInvalid:x.proxy?.invalid,parity:x.parity?.status,
 invalidSamples:x.invalidDirect.slice(0,12),
 vectorEligibleBars:x.vector?.eligibleBars,vectorSignals:x.vector?.signalsTotal,
 vectorExcludedBars:x.vector?.excludedBars
})),crossTimeframe:report.crossTimeframe.map(x=>({
 comparison:x.comparison,compared:x.compared,skipped:x.skipped,mismatches:x.mismatches}))}));
if(report.status==='INCOMPLETE')process.exitCode=2;
