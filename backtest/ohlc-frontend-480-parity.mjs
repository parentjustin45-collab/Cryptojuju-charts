/* DEV V1.26.0, READ-ONLY, real frontend chart audit.
 * Checks 480 fully closed candles each in BTCUSDT 15m, 1h and 4h:
 * - actual chart's data[] and LightweightCharts series[]
 * - official Bitunix REST (paged 170 bars/request)
 * - CryptoJuju Bitunix proxy (same upstream exchange, not independent)
 * Includes chart count (500 expected maximum), source provenance,
 * timestamp/interval coverage, price mismatches and OHLC invalid defects.
 * Browser live stream intentionally stopped after loading each TF.
 * NO synthetic candles, real trading, data repair, UI publication or main writes.
 */
import {spawn} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {makeBitunixFetchPage} from './bitunix-adapter.mjs';
import {makeCryptoJujuFetchPage} from './cryptojuju-adapter.mjs';
import {normalizeCandles,compareCandleSets,publicQuality,STEP_MS} from './ohlc-parity-core.mjs';
const symbol='BTCUSDT', tfs=['15m','1h','4h'], N=480;
const start=Date.now(),iso=t=>new Date(t).toISOString(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const report={version:'CJ_FRONTEND_480_CLOSED_OHLC_PARITY_V1',branch:'dev/v1.26.0',startedUTC:iso(start),
 symbol,numberClosedToAuditPerTF:N,timeframes:tfs,rawHistoryNotModified:true,
 sourceCaveat:'CryptoJuju proxy and Bitunix direct use same upstream Bitunix feed, not independent TradingView evidence',
 browser:'Real dev index.html with LightweightCharts in Chromium',results:[],errors:[],status:'PENDING'};
const base='http://127.0.0.1:18884';
const fetchImpl=(url,opts={})=>fetch(url,{...opts,signal:AbortSignal.timeout(18000),cache:'no-store',credentials:'omit'});
const direct=makeBitunixFetchPage({fetchImpl});
const proxy=makeCryptoJujuFetchPage({fetchImpl});
let server=null,browser=null;
async function getRows(fn,tf,w){
 const rows=[],errors=[];
 for(let t=w.startTime;t<w.endTime;t+=170*w.intervalMs){
  const end=Math.min(w.endTime,t+170*w.intervalMs);
  let ok=false;
  for(let i=0;i<2;i++){
   try{rows.push(...await fn({symbol,interval:tf,startTime:t,endTime:end,limit:200}));ok=true;break}
   catch(e){if(i===1)errors.push({fromUTC:iso(t),error:String(e?.message??e)});
    else await sleep(350)}
  }
  if(!ok)continue;
 }
 return {rows,errors};
}
function compareRawUiSeries(raw,series){
 const map=new Map(series.map(x=>[Number(x.time),x])),mismatches=[];
 for(const r of raw){
  const v=map.get(Number(r.time));
  if(!v||['open','high','low','close'].some(k=>Math.abs(Number(r[k])-Number(v[k]))>0.0000001)){
   mismatches.push({utc:iso(Number(r.time)*1000),raw:r,series:v??null});
  }
 }
 return {rawCount:raw.length,seriesCount:series.length,
  mismatches:mismatches.length,samples:mismatches.slice(0,8)};
}
try{
 server=spawn('python3',['-m','http.server','18884','--bind','127.0.0.1'],
  {cwd:process.cwd(),stdio:'ignore'});
 let up=false;
 for(let i=0;i<80;i++){
  try{if((await fetch(base+'/index.html',{signal:AbortSignal.timeout(1500)})).ok){up=true;break}}catch{}
  await sleep(120);
 }
 if(!up)throw Error('DEV frontend test server unavailable');
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
 const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push('PAGE: '+String(e)));
 await page.route('**/lightweight-charts@4.2.2/dist/lightweight-charts.standalone.production.js',r=>
  r.fulfill({path:'node_modules/lightweight-charts/dist/lightweight-charts.standalone.production.js',contentType:'text/javascript'}));
 await page.goto(base+'/index.html?cjdiag=1',{waitUntil:'domcontentloaded',timeout:45000});
 await page.waitForFunction(()=>typeof cards!=='undefined'&&cards[0]?.cs&&cards[0]?.el,{timeout:30000});
 for(const tf of tfs){
  const step=STEP_MS[tf],currentOpen=Math.floor(start/step)*step;
  const w={intervalMs:step,endTime:currentOpen-step,startTime:currentOpen-step-N*step};
  const item={tf,fromUTC:iso(w.startTime),endExclusiveUTC:iso(w.endTime),expected:N,
   errors:[],status:'PENDING'};
  report.results.push(item);
  const [a,b]=await Promise.all([getRows(direct,tf,w),getRows(proxy,tf,w)]);
  for(const e of a.errors)item.errors.push({source:'direct',...e});
  for(const e of b.errors)item.errors.push({source:'proxy',...e});
  let data=null;
  try{
   data=await page.evaluate(async({tf,symbol})=>{
    const o=cards[0];
    o.el.querySelector('.sym').innerHTML='<option selected>'+symbol+'</option>';
    o.el.querySelector('.tf').value=tf;
    o.historySource='';
    await load(o);
    stopLive(o);
    return {source:o.historySource,historyCount:o.data.length,
     historyFetchedAt:o.historyFetchedAt,
     chartRaw:o.data.map(x=>({...x})),
     chartSeries:o.cs.data().map(x=>({...x}))};
   },{tf,symbol});
   if(!String(data.source).startsWith('Bitunix'))
    throw Error('Frontend not using Bitunix history: '+data.source);
  }catch(e){item.errors.push({source:'frontend',error:String(e?.stack??e)})}
  const c=data?normalizeCandles(data.chartRaw,w,'frontendRaw'):null;
  const s=data?normalizeCandles(data.chartSeries,w,'frontendSeries'):null;
  const d=normalizeCandles(a.rows,w,'BitunixDirect'),p=normalizeCandles(b.rows,w,'CryptoJujuProxy');
  item.frontend={source:data?.source??null,loadedCount:data?.historyCount??0,
   rawVsVisible:data?compareRawUiSeries(data.chartRaw,data.chartSeries):null};
  item.quality={frontend:c?publicQuality(c):null,
   series:s?publicQuality(s):null,direct:publicQuality(d),proxy:publicQuality(p)};
  item.comparison={
   frontendVsDirect:c?compareCandleSets(c,d,w):null,
   visibleVsDirect:s?compareCandleSets(s,d,w):null,
   proxyVsDirect:compareCandleSets(p,d,w)
  };
  const mismatches=Object.values(item.comparison).some(x=>!x||x.priceMismatches||
   x.missingInA||x.missingInB||x.maxDifferenceUSDT>0.011);
  const hasQualityErrors=Object.values(item.quality).some(x=>!x||x.quality!=='CLEAN');
  const outOfUI=data?.historyCount<480||item.frontend.rawVsVisible?.mismatches;
  item.status=item.errors.length||outOfUI?'INCOMPLETE':
   mismatches?'MISMATCH_OR_MISSING':hasQualityErrors?'RAW_MATCH_WITH_KNOWN_INVALID_OHLC':'CLEAN_MATCH';
  console.log('TF '+JSON.stringify({tf,status:item.status,frontend:item.frontend,
   quality:item.quality,comparison:item.comparison,errors:item.errors}).slice(0,13000));
 }
 await ctx.close();
}catch(e){report.errors.push('FATAL: '+String(e?.stack??e))}
finally{
 report.status=report.errors.length||report.results.some(x=>x.status==='INCOMPLETE')?
  'INCOMPLETE':report.results.some(x=>x.status==='MISMATCH_OR_MISSING')?
   'MISMATCH':report.results.some(x=>x.status==='RAW_MATCH_WITH_KNOWN_INVALID_OHLC')?
    'RAW_MATCH_WITH_OHLC_DEFECTS':'ALL_480_CLEAN_MATCH';
 report.finishedUTC=iso(Date.now());
 await writeFile('cj-frontend-480-parity.json',JSON.stringify(report,null,2)+'\n');
 console.log('SUMMARY '+JSON.stringify({status:report.status,results:report.results.map(x=>({
  tf:x.tf,status:x.status,frontendLoaded:x.frontend?.loadedCount,
  invalid:x.quality?.direct?.invalid,missing:x.quality?.direct?.missing,
  frontendInvalid:x.quality?.frontend?.invalid,
  rawVisibleMismatches:x.frontend?.rawVsVisible?.mismatches,
  comparePriceMismatches:x.comparison?.frontendVsDirect?.priceMismatches,
  compareVisiblePriceMismatches:x.comparison?.visibleVsDirect?.priceMismatches,
  errors:x.errors
 })),errors:report.errors}));
 try{await browser?.close()}catch{}
 try{server?.kill()}catch{}
 if(['INCOMPLETE','MISMATCH'].includes(report.status))process.exitCode=2;
}
