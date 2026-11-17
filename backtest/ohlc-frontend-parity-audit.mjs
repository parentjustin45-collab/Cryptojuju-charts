/* DEV-only OHLC comparison of the ACTUAL CryptoJuju browser series, official
 * Bitunix REST and CryptoJuju's Bitunix proxy. BTCUSDT 15m/1h/4h.
 * Read-only; 48 fully closed candles per TF, omitting the latest closed bar
 * to avoid boundary races / transient exchange REST lag.
 * This is NOT an independent TradingView data feed. Never infer TV parity.
 */
import {spawn} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {makeBitunixFetchPage} from './bitunix-adapter.mjs';
import {makeCryptoJujuFetchPage} from './cryptojuju-adapter.mjs';
import {closedWindow,normalizeCandles,compareCandleSets,publicQuality,
 parityCsvRow,PARITY_CSV_HEADER} from './ohlc-parity-core.mjs';

const symbol='BTCUSDT',timeframes=['15m','1h','4h'];
const serverPort=18882,base='http://127.0.0.1:'+serverPort;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const stamp=t=>new Date(t).toISOString();
const referenceTime=Date.now(),report={
 version:'CJ_OHLC_PARITY_V1',branch:'dev/v1.26.0',symbol,
 startedUTC:stamp(referenceTime),
 sources:{
  frontend:'Actual dev index.html LightweightCharts + CryptoJuju Bitunix history',
  direct:'Official Bitunix public futures market/kline',
  proxy:'CryptoJuju /api/bitunix/proxy -> same official Bitunix futures kline'
 },
 tradingViewStatus:'NOT_CHECKED_REQUIRES_EXPORT_OR_AUTHORIZED_ACCESS',
 policy:{timeframes,closedBarsPerTf:48,skippedMostRecentClosedBars:1,
  priceToleranceUSDT:0.011,neverRepairPrices:true,noTrading:true},
 results:[],errors:[],status:'INCOMPLETE'};
let server,browser;
const requestOptions=(url,opts={})=>fetch(url,{
 ...opts,signal:AbortSignal.timeout(12000),cache:'no-store',credentials:'omit'
});
async function retryFeed(label,fn){
 let error;
 for(let attempt=1;attempt<=2;attempt++){
  try{return await fn()}catch(e){error=e;if(attempt<2)await sleep(750)}
 }
 throw Error(label+': '+String(error?.message??error));
}
const direct=makeBitunixFetchPage({fetchImpl:requestOptions});
const proxy=makeCryptoJujuFetchPage({fetchImpl:requestOptions});
try{
 server=spawn('python3',['-m','http.server',String(serverPort),'--bind','127.0.0.1'],{
  cwd:process.cwd(),stdio:'ignore'
 });
 let serverUp=false;
 for(let i=0;i<50;i++){
  try{if((await fetch(base+'/index.html',{signal:AbortSignal.timeout(2000)})).ok){
   serverUp=true;break
  }}catch{}
  await sleep(200);
 }
 if(!serverUp)throw Error('Development frontend server failed to start');
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
 const page=await context.newPage();
 const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
 await page.route('**/lightweight-charts@4.2.2/dist/lightweight-charts.standalone.production.js',route=>
  route.fulfill({path:'node_modules/lightweight-charts/dist/lightweight-charts.standalone.production.js',
   contentType:'text/javascript'}));
 await page.goto(base+'/index.html?cjdiag=1',{waitUntil:'domcontentloaded',timeout:45000});
 await page.waitForFunction(()=>typeof cards!=='undefined'&&cards[0]?.cs&&cards[0]?.el,{
  timeout:30000
 });
 const csvRows=['interval,'+PARITY_CSV_HEADER];
 for(const tf of timeframes){
  const window=closedWindow(referenceTime,tf,48,1);
  const item={tf,startUTC:stamp(window.startTime),endExclusiveUTC:stamp(window.endTime),
   expectedClosed:window.expected,window,errors:[],status:'INCOMPLETE'};
  report.results.push(item);
  const tasks=[
   ['direct',()=>retryFeed('Direct Bitunix',()=>direct({symbol,interval:tf,
      startTime:window.startTime,endTime:window.endTime,limit:200}))],
   ['proxy',()=>retryFeed('CryptoJuju proxy',()=>proxy({symbol,interval:tf,
      startTime:window.startTime,endTime:window.endTime,limit:200}))]
  ];
  const fetched=Object.fromEntries(await Promise.all(tasks.map(async([name,fn])=>{
   try{return [name,{rows:await fn()}]}catch(e){return [name,{error:String(e?.message??e)}]}
  })));
  let frontend;
  try{
   frontend=await page.evaluate(async({tf,symbol})=>{
    const o=cards[0];
    o.el.querySelector('.sym').innerHTML='<option selected>'+symbol+'</option>';
    o.el.querySelector('.tf').value=tf;o.historySource='';
    await load(o);
    const rows=o.data.map(x=>({time:x.time,open:x.open,high:x.high,
     low:x.low,close:x.close,volume:x.volume??0}));
    const result={historySource:o.historySource,historyFetchedAt:o.historyFetchedAt,
     historyCount:rows.length,seriesCount:o.cs.data().length,
     data:rows,series:o.cs.data().map(x=>({time:x.time,open:x.open,
      high:x.high,low:x.low,close:x.close}))};
    stopLive(o);
    return result;
   },{tf,symbol});
   if(!String(frontend.historySource).startsWith('Bitunix'))
    throw Error('Frontend source is not Bitunix: '+String(frontend.historySource));
   if(frontend.data.length<50)throw Error('Frontend returned too few candles: '+frontend.data.length);
   const tail=frontend.data.slice(-1)[0],tailSeries=frontend.series.slice(-1)[0];
   if(tail?.time!==tailSeries?.time)throw Error('Frontend data/series timestamp mismatch');
  }catch(e){item.errors.push('frontend: '+String(e?.message??e))}
  const snapshots={
   frontend:frontend&&!item.errors.length?normalizeCandles(frontend.data,window,'frontend'):null,
   direct:fetched.direct.rows?normalizeCandles(fetched.direct.rows,window,'direct'):null,
   proxy:fetched.proxy.rows?normalizeCandles(fetched.proxy.rows,window,'proxy'):null
  };
  for(const name of ['direct','proxy'])if(fetched[name].error)item.errors.push(fetched[name].error);
  item.sourceQuality=Object.fromEntries(Object.entries(snapshots).map(([name,v])=>
   [name,v?publicQuality(v):{label:name,error:item.errors.slice()}]));
  item.frontend={source:frontend?.historySource??null,
   historyCount:frontend?.historyCount??0,seriesCount:frontend?.seriesCount??0};
  item.parity={frontendVsDirect:snapshots.frontend&&snapshots.direct?
   compareCandleSets(snapshots.frontend,snapshots.direct,window):null,
   proxyVsDirect:snapshots.proxy&&snapshots.direct?
   compareCandleSets(snapshots.proxy,snapshots.direct,window):null};
  item.status=item.errors.length||!item.parity.frontendVsDirect||!item.parity.proxyVsDirect?
   'INCOMPLETE':
   [item.parity.frontendVsDirect.status,item.parity.proxyVsDirect.status].every(x=>x==='MATCH')?
    'PASS':'BLOCKED_OR_MISMATCH';
  if(snapshots.frontend&&snapshots.direct){
   for(let t=window.startTime;t<window.endTime;t+=window.intervalMs){
    csvRows.push(tf+','+parityCsvRow(t,snapshots.frontend,snapshots.direct));
   }
  }
  // Report every issue, even on a failed GitHub action; do not imply a perfect
  // match when direct and frontend independently share a bad Bitunix OHLC.
  console.log('TIMEFRAME '+JSON.stringify({tf,status:item.status,errors:item.errors,
   quality:item.sourceQuality,parity:item.parity,
   frontend:item.frontend}).slice(0,9000));
 }
 report.pageErrors=pageErrors;
 if(pageErrors.length)report.errors.push(...pageErrors);
 report.status=report.results.every(x=>x.status==='PASS')&&!report.errors.length?'PASS':'BLOCKED_OR_INCOMPLETE';
 await writeFile('cj-ohlc-parity-BTCUSDT.csv',csvRows.join('\n')+'\n');
 await context.close();
}catch(e){report.status='TEST_ERROR';report.errors.push(String(e?.stack??e));process.exitCode=1}
finally{
 report.completedUTC=stamp(Date.now());
 await writeFile('cj-ohlc-parity-report.json',JSON.stringify(report,null,2)+'\n');
 console.log('SUMMARY '+JSON.stringify({status:report.status,results:report.results.map(x=>({
  tf:x.tf,status:x.status,
  frontendVsDirect:x.parity?.frontendVsDirect?.status??'NO_DATA',
  proxyVsDirect:x.parity?.proxyVsDirect?.status??'NO_DATA',
  directInvalid:x.sourceQuality?.direct?.invalid??null,
  frontendInvalid:x.sourceQuality?.frontend?.invalid??null,
  priceMismatches:x.parity?.frontendVsDirect?.priceMismatches??null,
  errors:x.errors})),errors:report.errors}));
 if(report.status!=='PASS')process.exitCode=1;
 try{await browser?.close()}catch{}
 try{server?.kill()}catch{}
}
