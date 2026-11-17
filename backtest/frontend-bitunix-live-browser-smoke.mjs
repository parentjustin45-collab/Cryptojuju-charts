/* DEV ONLY: Real Bitunix WebSocket received inside Chromium running the actual
 * development index.html. Read-only, BTCUSDT 1H, no trades/keys/fake fills.
 * Reports health watchdog and timestamped receive -> chart-series traces.
 */
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const port=18879,base='http://127.0.0.1:'+port;
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:process.cwd(),stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let browser;
const report={symbol:'BTCUSDT',tf:'1h',mode:'REAL_BROWSER_READONLY',startedUtc:new Date().toISOString()};
try{
 for(let i=0;i<60;i++){try{if((await fetch(base+'/index.html')).ok)break;}catch{}await sleep(150)}
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/lightweight-charts@4.2.2/dist/lightweight-charts.standalone.production.js',route=>
  route.fulfill({path:'node_modules/lightweight-charts/dist/lightweight-charts.standalone.production.js',contentType:'text/javascript'}));
 await page.goto(base+'/index.html?cjdiag=1',{waitUntil:'domcontentloaded',timeout:45000});
 await page.waitForFunction(()=>typeof cards!=='undefined'&&cards[0]?.el&&cards[0]?.cs,{timeout:30000});
 // Load BTCUSDT 1H with the site's own REST history and WebSocket logic,
 // not a mock. The initial chart load is cancelled via the loadToken.
 await page.evaluate(()=>{
  const o=cards[0],sym=o.el.querySelector('.sym'),tf=o.el.querySelector('.tf');
  sym.innerHTML='<option selected>BTCUSDT</option>';tf.value='1h';
  load(o);
 });
 await page.waitForFunction(()=>cards[0]?.historySource&&cards[0]?.el.querySelector('.feed')?.textContent.includes('LIVE compatible'),null,{timeout:110000});
 await page.waitForFunction(()=>cards[0]?.lastMarketTickAt>0&&cards[0]?.cjFeedTrace?.some(x=>x.stage==='series_update'),null,{timeout:45000});
 await page.waitForTimeout(3000);
 const data=await page.evaluate(()=>{
  const o=cards[0],trace=o.cjFeedTrace||[],last=o.data.at(-1);
  const recent=trace.filter(x=>['ws_open','ws_market_packet','merge_received','bar_merged','series_update','frame_callback'].includes(x.stage));
  const packets=recent.filter(x=>x.stage==='ws_market_packet'),series=recent.filter(x=>x.stage==='series_update'),frames=recent.filter(x=>x.stage==='frame_callback');
  const firstSeries=series[0],firstPacket=packets[0];
  return {
   historySource:o.historySource,historyCount:o.data.length,
   wsReadyState:o.ws?.readyState,connectedAt:o.wsConnectedAt,lastMarketTickAt:o.lastMarketTickAt,
   lastDataTime:last?.time,lastDataClose:last?.close,lastSeriesTime:typeof o.cs.data==='function'?o.cs.data().at(-1)?.time:null,
   packetCount:packets.length,seriesCount:series.length,frameCount:frames.length,
   firstPacketToSeriesMs:firstPacket&&firstSeries?firstSeries.atMs-firstPacket.atMs:null,
   samples:recent.slice(0,24)
  };
 });
 Object.assign(report,data,{pageErrors:errors,finishedUtc:new Date().toISOString()});
 console.log(JSON.stringify(report,null,2));
 if(report.historySource!=='Bitunix Futures'||report.packetCount===0||report.seriesCount===0||report.frameCount===0||
  report.lastSeriesTime!==report.lastDataTime||report.pageErrors.length)process.exitCode=1;
 await context.close();
}catch(e){report.error=String(e?.stack??e);report.pageErrors=report.pageErrors||[];console.log(JSON.stringify(report,null,2));process.exitCode=1;}
finally{try{await browser?.close()}catch{}server.kill();}
