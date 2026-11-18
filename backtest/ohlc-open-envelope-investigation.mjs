/* DEVELOPMENT DIAGNOSTIC ONLY — NOT an OHLC repair or a trading feed.
 * Tests the hypothesis that Bitunix defines OPEN from preceding close but
 * HIGH/LOW from executions, excluding that OPEN in certain bars.
 * Fetch original 1m source around every invalid 15m/1h bar; measure 7d
 * Vector V1.1 response to a separately labeled, in-memory envelope scenario.
 */
import {writeFile} from 'node:fs/promises';
import {makeBitunixFetchPage} from './bitunix-adapter.mjs';
import {STEP_MS,normalizeCandles} from './ohlc-parity-core.mjs';
import {vectorAIT} from './vector-ait-v1.mjs';
import {planCleanBacktestWindows} from './quarantine.mjs';
import {normalizeBitunixOpenEnvelope} from './ohlc-bitunix-open-envelope.mjs';
import {classifyHistory} from './quality-gate.mjs';
const symbol='BTCUSDT',frames={'15m':672,'1h':168},today=Date.now(),iso=t=>new Date(t).toISOString();
const page=makeBitunixFetchPage({
 fetchImpl:(url,opts)=>fetch(url,{...opts,signal:AbortSignal.timeout(18000)})
});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function request(tf,a,b,limit=200){
 let last;
 for(let k=0;k<2;k++){
  try{return await page({symbol,interval:tf,startTime:a,endTime:b,limit})}
  catch(e){last=e;if(k===0)await sleep(500)}
 }
 throw last;
}
async function full(tf,step,count){
 const current=Math.floor(today/step)*step,endTime=current-step,startTime=endTime-step*count;
 const rows=[];
 for(let t=startTime;t<endTime;t+=180*step){
  const e=Math.min(t+180*step,endTime);
  rows.push(...await request(tf,t,e,200));
 }
 return {rows,window:{startTime,endTime,intervalMs:step}};
}
function summaryVector(rows,window){
 const ordered=rows.map(r=>({
  time:Number(r.time),open:Number(r.open),high:Number(r.high),low:Number(r.low),
  close:Number(r.close),volume:Number(r.volume??0)
 })).sort((a,b)=>a.time-b.time);
 const strict=planCleanBacktestWindows(rows,window,{minBars:25});
 const candidate=ordered.map(b=>({
  ...b,high:Math.max(b.open,b.close,b.high),low:Math.min(b.open,b.close,b.low)
 }));
 const modified=ordered.filter((b,i)=>b.high!==candidate[i].high||b.low!==candidate[i].low)
  .map((b,i)=>({utc:iso(b.time),original:b,normalization:{
   high:Math.max(b.open,b.high,b.close),low:Math.min(b.open,b.low,b.close)}}));
 let result=null,error=null;
 try{
  const v=vectorAIT(candidate);
  const signals=v.filter(x=>x.signal).map(x=>({utc:iso(x.time),signal:x.signal}));
  result={signalCount:signals.length,long:signals.filter(x=>x.signal==='long').length,
   short:signals.filter(x=>x.signal==='short').length,
   sampleSignals:signals.slice(0,30)};
 }catch(e){error=String(e?.message??e)}
 return {rawStrictStatus:strict.status,rawInvalid:strict.issues.length,
  rawBacktestAllowed:strict.status==='READY',
  strictEligibleBars:strict.eligibleWindows.reduce((n,x)=>n+x.bars,0),
  strictExcludedBars:strict.excludedBars,
  envelopeSimulation:{candidateModified:modified.length,candidateBarCount:candidate.length,
   sampleModified:modified.slice(0,25),vectorResult:result,error,
   WARNING:'RESEARCH ONLY. Envelopes are NOT independent verified prices. Do not use these signals in real trading or claim profitable backtests.'}};
}
const report={version:'CJ_BITUNIX_OPEN_ENVELOPE_HYPOTHESIS_V1',
 startedUTC:iso(today),symbol,frames:[],errors:[],
 source:'Official Bitunix REST, LAST_PRICE; independent TradingView not fetched',
 noPriceEditsToRepository:true,noLiveTrades:true};
for(const [tf,count] of Object.entries(frames)){
 const step=STEP_MS[tf],frame={tf,diagnostics:[],errors:[]};
 report.frames.push(frame);
 try{
  const {rows,window}=await full(tf,step,count);
  const clean=normalizeCandles(rows,window,'Bitunix direct');
  const byTime=new Map(rows.map(x=>[Number(x.time),x]));
  frame.window={startUTC:iso(window.startTime),endExclusiveUTC:iso(window.endTime)};
  frame.expected=count;frame.found=clean.count;frame.invalid=clean.invalid.length;
  frame.missing=clean.missing.length;frame.duplicates=clean.duplicates.length;
  frame.vector=summaryVector(rows,window);
  const normalized=normalizeBitunixOpenEnvelope(rows,{intervalMs:step});
  const candidateQuality=classifyHistory(normalized.candles,window);
  frame.actualNormalizer={
   status:normalized.status,corrections:normalized.changes.length,
   unreconciled:normalized.issues.length,
   strictBacktestReady:candidateQuality.canBacktest,
   rawWasBlocked:clean.quality==='BLOCKED',
   correctionSamples:normalized.changes.slice(0,5),
   issueSamples:normalized.issues.slice(0,5),
   note:'Derived, non-production research series. Raw remains untouched. No independent TradingView proof beyond user screenshots.'
  };
  const normalMap=new Map(normalized.candles.map(x=>[x.time,x]));

  const invalid=[...clean.invalid].sort((a,b)=>a.time-b.time);
  for(const bad of invalid){
   const t=bad.time,r=bad.bar,p=byTime.get(t-step),v=Number(p?.close);
   const detail={utc:iso(t),time:t,open:r.open,high:r.high,low:r.low,close:r.close,
    previousClose:Number.isFinite(v)?v:null,
    openingEqualsPreviousClose:Number.isFinite(v)&&Math.abs(r.open-v)<0.000001,
    highDeficit:Number(Math.max(0,Math.max(r.open,r.close)-r.high).toFixed(8)),
    lowExcess:Number(Math.max(0,r.low-Math.min(r.open,r.close)).toFixed(8)),
    oneMinute:null};
   frame.diagnostics.push(detail);
   try{
    const smaller=await request('1m',t,t+step,200);
    const sc=normalizeCandles(smaller,{startTime:t,endTime:t+step,intervalMs:60000},'Bitunix 1m');
    const ordered=[...sc.bars.values()].sort((x,y)=>x.time-y.time);
    const agg=ordered.length?{
     open:ordered[0].open,high:Math.max(...ordered.map(x=>x.high)),
     low:Math.min(...ordered.map(x=>x.low)),close:ordered.at(-1).close}:null;
    detail.oneMinute={expected:step/60000,found:sc.count,invalid:sc.invalid.length,
     missing:sc.missing.length,duplicates:sc.duplicates.length,
     aggregatedRaw:agg,
     envelopeOfOneMinute:agg?{
      open:agg.open,high:Math.max(agg.high,...ordered.map(x=>x.open),...ordered.map(x=>x.close)),
      low:Math.min(agg.low,...ordered.map(x=>x.open),...ordered.map(x=>x.close)),close:agg.close}:null,
     firstMinuteOpen:ordered[0]?.open??null,firstMinuteHigh:ordered[0]?.high??null,
     firstMinuteLow:ordered[0]?.low??null};
   }catch(e){const err=String(e?.message??e);frame.errors.push({utc:iso(t),error:err});detail.oneMinute={error:err}}
  }
  frame.previousCloseCount=frame.diagnostics.filter(x=>x.openingEqualsPreviousClose).length;
  frame.oneMinuteCompleteCount=frame.diagnostics.filter(x=>x.oneMinute?.found===x.oneMinute?.expected&&
   x.oneMinute.invalid===0&&x.oneMinute.missing===0).length;
  frame.oneMinuteAllBarsCount=frame.diagnostics.filter(x=>x.oneMinute?.found===x.oneMinute?.expected&&
   x.oneMinute.missing===0&&x.oneMinute.duplicates===0).length;
  frame.oneMinuteEnvelopeAgreement=frame.diagnostics.filter(x=>{
   const a=x.oneMinute?.envelopeOfOneMinute,b=normalMap.get(x.time);
   return a&&b&&x.oneMinute.found===x.oneMinute.expected&&
    ['open','high','low','close'].every(k=>Math.abs(a[k]-b[k])<=0.011);
  }).length;
  frame.actualNormalizer.oneMinuteEnvelopeAgreement=frame.oneMinuteEnvelopeAgreement;
  frame.actualNormalizer.oneMinuteEligible=frame.oneMinuteAllBarsCount;
  if(normalized.issues.length||!candidateQuality.canBacktest||
    normalized.changes.length!==frame.invalid||
    frame.oneMinuteEnvelopeAgreement!==frame.invalid)
    frame.errors.push({error:'DERIVED_ENVELOPE_NOT_FULLY_VERIFIED_IN_THIS_RESEARCH_WINDOW'});

  console.log('TIMEFRAME '+JSON.stringify({tf,expected:count,found:frame.found,invalid:frame.invalid,
   openingEqualsPreviousClose:frame.previousCloseCount,oneMinuteComplete:frame.oneMinuteCompleteCount,
   derived:frame.actualNormalizer,
   errors:frame.errors,vector:frame.vector?{strict:frame.vector.rawStrictStatus,
    strictExcluded:frame.vector.strictExcludedBars,scenarioSignals:
     frame.vector.envelopeSimulation.vectorResult?.signalCount}:null}));
 }catch(e){frame.errors.push({error:String(e?.stack??e)})}
}
report.completedUTC=iso(Date.now());
report.status=report.frames.some(x=>x.errors.length)?'PARTIAL_WITH_ERRORS':'EVIDENCE_CAPTURED';
report.warning='Observed price formation does not authorize exchange data changes. Preserve raw; no silent repair. Validate any derived OHLC against independent sources before product use.';
await writeFile('cj-open-envelope-investigation.json',JSON.stringify(report,null,2)+'\n');
console.log('SUMMARY '+JSON.stringify({status:report.status,frames:report.frames.map(x=>({
 tf:x.tf,invalid:x.invalid,previousCloseMatches:x.previousCloseCount,
 oneMinuteComplete:x.oneMinuteCompleteCount,errors:x.errors,
 vectorRawBlocked:x.vector?.rawBacktestAllowed===false,
 envelopeScenarioSignals:x.vector?.envelopeSimulation.vectorResult?.signalCount
}))}));
if(report.status!=='EVIDENCE_CAPTURED')process.exitCode=2;
