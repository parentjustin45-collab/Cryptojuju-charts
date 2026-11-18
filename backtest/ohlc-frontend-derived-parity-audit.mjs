/* DEV-only, END-TO-END provenanced Bitunix history parity in real Chromium.
 * 480 CLOSED BTCUSDT 15m/1h/4h candles per TF, up to 500 chart bars:
 *  - original REST payload preserved in actual frontend, byte-for-price parity
 *    with independently queried official Bitunix public REST;
 *  - EXACTLY the historical OHLC-derived envelope validated by the shared
 *    research engine, not arbitrary normalization;
 *  - chart LightweightCharts series EXACTLY matches indicator input o.data;
 *  - no missing or duplicated closed buckets; blocked unknown defects.
 * Neither Bitunix REST path is an independent TradingView price feed.
 */
import {spawn} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {makeBitunixFetchPage} from './bitunix-adapter.mjs';
import {normalizeCandles,publicQuality,STEP_MS} from './ohlc-parity-core.mjs';
import {normalizeBitunixOpenEnvelope} from './ohlc-bitunix-open-envelope.mjs';
const SYMBOL=process.env.CJ_SYMBOL||'BTCUSDT',TFS=['15m','1h','4h'],N=480;
if(!['BTCUSDT','ETHUSDT','SOLUSDT'].includes(SYMBOL))throw Error('Unsupported audited symbol');
const at=Date.now(),iso=t=>new Date(t).toISOString(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const result={protocol:'CJ_DEV_REAL_FRONTEND_DERIVED_OHLC_PARITY_V1',branch:'dev/v1.26.0',
 startedUTC:iso(at),symbol:SYMBOL,closedBarsEach:N,source:'Bitunix Futures LAST_PRICE',
 noTrading:true,mainUnchanged:true,
 independence:'Bitunix official REST and CryptoJuju proxy come from SAME EXCHANGE; no independent TradingView validation',
 timeframes:[],errors:[],status:'PENDING'};
const base='http://127.0.0.1:18886',direct=makeBitunixFetchPage({
 fetchImpl:(url,opts)=>fetch(url,{...opts,signal:AbortSignal.timeout(18000),cache:'no-store'})
});
let server=null,browser=null;
async function fetch480(tf,w){
 const out=[],errors=[];
 for(let t=w.startTime;t<w.endTime;t+=170*w.intervalMs){
  const to=Math.min(w.endTime,t+170*w.intervalMs);let done=false;
  for(let i=0;i<2;i++){
   try{out.push(...await direct({symbol:SYMBOL,interval:tf,startTime:t,endTime:to,limit:200}));
    done=true;break}
   catch(e){if(i===1)errors.push({utc:iso(t),message:String(e?.message??e)});
    else await sleep(400)}
  }
  if(!done)continue;
 }
 return {out,errors};
}
function eqBar(a,b){
 return a&&b&&['open','high','low','close'].every(k=>
  Number.isFinite(Number(a[k]))&&Number.isFinite(Number(b[k]))&&
  Math.abs(Number(a[k])-Number(b[k]))<=0.011);
}
const toMs=x=>({...x,time:Number(x.time)*1000});
try{
 server=spawn('python3',['-m','http.server','18886','--bind','127.0.0.1'],
  {cwd:process.cwd(),stdio:'ignore'});
 let up=false;
 for(let i=0;i<80;i++){try{if((await fetch(base+'/index.html',{signal:AbortSignal.timeout(1500)})).ok){up=true;break}}catch{}
  await sleep(120)}
 if(!up)throw Error('Could not start real development frontend');
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
 const page=await ctx.newPage();page.on('pageerror',e=>result.errors.push('Browser page error '+String(e)));
 await page.route('**/lightweight-charts@4.2.2/dist/lightweight-charts.standalone.production.js',r=>
  r.fulfill({path:'node_modules/lightweight-charts/dist/lightweight-charts.standalone.production.js',contentType:'text/javascript'}));
 await page.goto(base+'/index.html?cjdiag=1',{waitUntil:'domcontentloaded',timeout:45000});
 await page.waitForFunction(()=>typeof cards!=='undefined'&&cards[0]?.cs&&cards[0]?.el,{timeout:30000});
 for(const tf of TFS){
  const step=STEP_MS[tf],open=Math.floor(at/step)*step;
  const w={startTime:open-step-(N*step),endTime:open-step,intervalMs:step};
  const out={tf,expected:N,fromUTC:iso(w.startTime),toExclusiveUTC:iso(w.endTime),
   issues:[],status:'PENDING'};result.timeframes.push(out);
  const fetched=await fetch480(tf,w);
  out.issues.push(...fetched.errors.map(x=>({...x,type:'FETCH_ERROR'})));
  let front;
  try{
   front=await page.evaluate(async({tf,symbol})=>{
    const o=cards[0],sym=o.el.querySelector('.sym');
    sym.innerHTML='<option selected>'+symbol+'</option>';
    o.el.querySelector('.tf').value=tf;
    o.historySource='';
    await load(o);
    const snap={source:o.historySource,raw:o.cjHistoryRaw,
     data:o.data.map(x=>({...x})),series:o.cs.data().map(x=>({...x})),
     quality:o.cjHistoryQuality&&{status:o.cjHistoryQuality.status,
      corrected:o.cjHistoryQuality.corrected,issues:o.cjHistoryQuality.issues,
      checkedClosed:o.cjHistoryQuality.checkedClosed},
     historyLength:o.data.length,feed:o.el.querySelector('.feed')?.textContent};
    stopLive(o);return snap;
   },{tf,symbol:SYMBOL});
  }catch(e){out.issues.push({type:'FRONTEND_ERROR',error:String(e?.stack??e)})}
  if(!front?.raw||front.quality?.status==='BLOCKED'){
   out.status='BLOCKED_FRONTEND_HISTORY';
   out.issues.push({type:'FRONTEND_BLOCKED',quality:front?.quality??null,
    feed:front?.feed??null});continue;
  }
  out.frontend={source:front.source,historyLength:front.historyLength,
   rawLength:front.raw.length,correctedTotal:front.quality?.corrected?.length,
   correctionSamples:front.quality?.corrected?.slice(0,6)};
  const rawData=front.raw.map(toMs),visible=front.data.map(toMs),
   series=front.series.map(toMs);
  const raw=normalizeCandles(rawData,w,'frontendOriginalREST');
  const derived=normalizeCandles(visible,w,'frontendDerivedChart');
  const visibleSeries=normalizeCandles(series,w,'lightweightChartsVisible');
  const reference=normalizeCandles(fetched.out,w,'BitunixOfficialREST');
  out.quality={original:publicQuality(raw),derived:publicQuality(derived),
   series:publicQuality(visibleSeries),reference:publicQuality(reference)};
  const independent=normalizeBitunixOpenEnvelope(rawData,{intervalMs:step});
  out.engine={status:independent.status,corrected:independent.changes.length,
   issues:independent.issues.slice(0,8)};
  const correctedByTime=new Map(independent.changes.map(c=>[c.time,c]));
  const engineByTime=new Map(independent.candles.map(c=>[c.time,c]));
  out.audit={sourcePriceDiscrepancies:0,chartVsEngineDiscrepancies:0,
   seriesVsChartDiscrepancies:0,invalidBarsWithoutVerifiedCorrection:0,
   correctedClosedBars:0,cleanClosedBars:0};
  for(let t=w.startTime;t<w.endTime;t+=step){
   const bitunix=reference.bars.get(t),source=raw.bars.get(t),
    chart=derived.bars.get(t),seriesBar=visibleSeries.bars.get(t),
    engine=engineByTime.get(t);
   if(!eqBar(bitunix,source)){out.audit.sourcePriceDiscrepancies++;
    if(out.issues.length<10)out.issues.push({type:'RAW_NOT_EQUAL_OFFICIAL_BITUNIX',utc:iso(t),source,bitunix})}
   if(!eqBar(chart,engine)){out.audit.chartVsEngineDiscrepancies++;
    if(out.issues.length<10)out.issues.push({type:'CHART_NOT_EQUAL_VALIDATED_ENGINE',utc:iso(t),chart,engine})}
   if(!eqBar(chart,seriesBar)){out.audit.seriesVsChartDiscrepancies++;
    if(out.issues.length<10)out.issues.push({type:'CHART_SERIES_NOT_EQUAL_CHART_DATA',utc:iso(t)})}
   const isInvalid=reference.badTimes.has(t);
   if(isInvalid){
    const change=correctedByTime.get(t);
    if(change&&eqBar(change.original,bitunix)&&eqBar(change.derived,chart))
     out.audit.correctedClosedBars++;
    else out.audit.invalidBarsWithoutVerifiedCorrection++;
   }else out.audit.cleanClosedBars++;
  }
  if(!String(front.source).startsWith('Bitunix'))
   out.issues.push({type:'UNEXPECTED_SOURCE',source:front.source});
  if(front.historyLength<480)out.issues.push({type:'TOO_FEW_CHART_BARS',count:front.historyLength});
  if(front.quality.issues.length)out.issues.push({type:'FRONTEND_QUALITY_BLOCKED',items:front.quality.issues});
  if(independent.status==='BLOCKED')out.issues.push({type:'SHARED_ENGINE_CANNOT_VALIDATE'});
  if(Object.values(out.audit).some((n,i)=>i<4&&n>0))
   out.issues.push({type:'AUDIT_NUMERIC_DISCREPANCIES',summary:out.audit});
  if(out.quality.derived.quality!=='CLEAN'||out.quality.series.quality!=='CLEAN')
   out.issues.push({type:'DERIVED_OR_SERIES_NOT_CLEAN'});
  if(out.quality.original.missing||out.quality.reference.missing||out.quality.reference.duplicates)
   out.issues.push({type:'MISSING_OR_DUPLICATE_ORIGINAL'});
  out.status=out.issues.length?'FAIL':'PASS_DERIVED_WITH_RAW_PROVENANCE';
  console.log('TF '+JSON.stringify({tf,status:out.status,quality:out.quality,audit:out.audit,
   frontend:out.frontend,issues:out.issues}).slice(0,14000));
 }
 await ctx.close();
}catch(e){result.errors.push('FATAL: '+String(e?.stack??e))}
finally{
 result.status=result.errors.length||result.timeframes.length!==TFS.length||
  result.timeframes.some(x=>x.status!=='PASS_DERIVED_WITH_RAW_PROVENANCE')?
  'FAIL_OR_INCOMPLETE':'PASS_REAL_FRONTEND_SOURCE_DERIVED_PARITY';
 result.completedUTC=iso(Date.now());
 await writeFile('cj-derived-frontend-parity-report.json',JSON.stringify(result,null,2)+'\n');
 console.log('SUMMARY '+JSON.stringify({status:result.status,frames:result.timeframes.map(x=>({
  tf:x.tf,status:x.status,historyLength:x.frontend?.historyLength,
  rawInvalid:x.quality?.reference?.invalid,derivedInvalid:x.quality?.derived?.invalid,
  corrections:x.audit?.correctedClosedBars,audit:x.audit,issues:x.issues
 })),errors:result.errors}).slice(0,15000));
 try{await browser?.close()}catch{}
 try{server?.kill()}catch{}
 if(result.status!=='PASS_REAL_FRONTEND_SOURCE_DERIVED_PARITY')process.exitCode=2;
}
