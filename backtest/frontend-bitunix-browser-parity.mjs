/* DEV ONLY — real Chromium/LightweightCharts pipeline test with deterministic
 * Bitunix-shaped WebSocket frames (no exchange connection, no synthetic profits).
 * Tests exchange-event time fallback through WS receive -> merge -> chart data
 * -> next animation frame, on desktop and Android-sized viewports.
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
const port=18878,origin='http://127.0.0.1:'+port;
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:process.cwd(),stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let browser;
try{
 for(let i=0;i<50;i++){try{if((await fetch(origin+'/index.html')).ok)break;}catch{}await sleep(150);}
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const env of [{label:'desktop',width:1440,height:900,mobile:false},{label:'android',width:390,height:844,mobile:true}]){
  const context=await browser.newContext({viewport:{width:env.width,height:env.height},
   deviceScaleFactor:env.mobile?2:1,isMobile:env.mobile,hasTouch:env.mobile,
   serviceWorkers:'block'});
  const page=await context.newPage();
  await page.route('**/*',async route=>{
   const url=route.request().url();
   if(url.includes('unpkg.com/lightweight-charts@4.2.2/dist/lightweight-charts.standalone.production.js'))
    await route.fulfill({path:'node_modules/lightweight-charts/dist/lightweight-charts.standalone.production.js',contentType:'text/javascript'});
   else if(url.startsWith(origin+'/'))await route.continue();
   else await route.abort();
  });
  const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
  await page.goto(origin+'/index.html?cjdiag=1',{waitUntil:'domcontentloaded',timeout:45_000});
  await page.waitForFunction(()=>typeof cards!=='undefined'&&cards[0]?.cs&&cards[0]?.el,{timeout:20_000});
  const observed=await page.evaluate(async ()=>{
   const o=cards[0];
   o.loadToken=(o.loadToken||0)+1;stopLive(o);
   const hour=Math.floor(Date.now()/3600000)*3600;
   const data=Array.from({length:100},(_,i)=>({
    time:hour-(100-i)*3600,open:65000,high:65020,low:64980,
    close:65000,volume:100
   }));
   o.interval='1h';o.historySource='Bitunix Futures';
   o.el.querySelector('.tf').value='1h';
   o.el.querySelector('.sym').innerHTML='<option selected>BTCUSDT</option>';
   o.data=data;o.cs.setData(o.data);
   class FakeSocket{
    static instances=[];
    constructor(url){this.url=url;this.sent=[];this.readyState=1;FakeSocket.instances.push(this)}
    send(payload){this.sent.push(payload)}
    close(){this.readyState=3}
   }
   window.WebSocket=FakeSocket;
   startLive(o,'BTCUSDT','1h');
   const ws=o.ws;ws.onopen();
   const subscribed=JSON.parse(ws.sent[0]);
   const k={o:'65000',h:'65014.4',l:'64985.1',c:'65008.5',b:'101'};
   const message=(ts,bar,channel='market_kline_60min')=>({
    ch:channel,symbol:'BTCUSDT',ts,data:{...k,...bar}
   });
   const t0=performance.now();
   ws.onmessage({data:JSON.stringify(message(hour*1000+148,{}))});
   const processMs=performance.now()-t0;
   await new Promise(resolve=>requestAnimationFrame(resolve));
   const first={lastData:o.data.at(-1),seriesLast:typeof o.cs.data==='function'?o.cs.data().at(-1):null,
    count:o.data.length,trace:o.cjFeedTrace.slice(),processMs};
   ws.onmessage({data:JSON.stringify(message(hour*1000+2000,{c:'65009.5',h:'65018.2'}))});
   const second={lastData:o.data.at(-1),count:o.data.length};
   ws.onmessage({data:JSON.stringify(message(hour*1000+2100,{c:'65099'},'irrelevant_channel'))});
   const ignored={lastData:o.data.at(-1),count:o.data.length};
   const previous=(hour-3600)*1000+55_000;
   ws.onmessage({data:JSON.stringify(message(previous,{c:'65001.1'}))});
   const late={lastData:o.data.at(-1),count:o.data.length};
   const prior={...o.data.at(-1)},nextHour=hour+3600;
   const countBefore=o.data.length;
   ws.onmessage({data:JSON.stringify(message(nextHour*1000+149,{
    o:String(prior.open),h:String(prior.high),l:String(prior.low),c:'65010.4'
   }))});
   const quarantine={count:o.data.length,lastData:{...o.data.at(-1)},
    traced:o.cjFeedTrace.some(e=>e.stage==='kline_quarantined')};
   const tradeMessage={ch:'trade',symbol:'BTCUSDT',ts:(nextHour+2)*1000,
    data:[{t:new Date((nextHour+2)*1000).toISOString(),p:'65077.8',v:'0.2',s:'buy'},
     {t:new Date((nextHour+3)*1000).toISOString(),p:'65079.6',v:'0.1',s:'sell'}]};
   ws.onmessage({data:JSON.stringify(tradeMessage)});
   const afterTrade={bar:{...o.data.at(-1)},count:o.data.length,
    source:o.cjBarSource,seriesLast:o.cs.data().at(-1)};
   const staleWhileTrade={...prior};
   ws.onmessage({data:JSON.stringify(message((nextHour+4)*1000,{
    o:String(staleWhileTrade.open),h:String(staleWhileTrade.high),
    l:String(staleWhileTrade.low),c:'65072.2'
   }))});
   const afterRepeat={bar:{...o.data.at(-1)},source:o.cjBarSource};
   stopLive(o);
   return {hour,subscribed,first,second,ignored,late,quarantine,afterTrade,afterRepeat,
    countBefore,nextHour,wsUrl:ws.url,traceStages:first.trace.map(x=>x.stage)};
  });
  assert.equal(observed.subscribed.args[0].ch,'market_kline_60min');
  assert.equal(observed.first.lastData.time,observed.hour,'new candle appended at exact hour');
  assert.equal(observed.first.count,101,'append exactly one candle');
  assert.ok(observed.first.seriesLast===null||observed.first.seriesLast.time===observed.hour,'LightweightCharts series did not advance');
  assert.equal(observed.first.lastData.open,65000);
  assert.equal(observed.first.lastData.close,65008.5);
  assert.equal(observed.second.lastData.close,65009.5);
  assert.equal(observed.second.count,101,'one bar on repeated same-hour WS messages');
  assert.equal(observed.ignored.lastData.close,observed.second.lastData.close,'wrong channel must be ignored');
  assert.equal(observed.late.lastData.time,observed.hour,'old packet must not change current bar timestamp');
  assert.equal(observed.quarantine.traced,true,'previous-period Kline should be quarantined');
  assert.equal(observed.quarantine.count,observed.countBefore,'stale Kline must not append');
  assert.equal(observed.quarantine.lastData.time,observed.hour,'stale Kline must not change current period');
  assert.equal(observed.afterTrade.count,observed.countBefore+1,'new trade creates one fresh period');
  assert.equal(observed.afterTrade.bar.time,observed.nextHour,'trade candle correctly bucketed');
  assert.equal(observed.afterTrade.bar.open,65077.8);
  assert.equal(observed.afterTrade.bar.high,65079.6);
  assert.equal(observed.afterTrade.bar.low,65077.8);
  assert.equal(observed.afterTrade.bar.close,65079.6);
  assert.equal(observed.afterTrade.source,'trade');
  assert.equal(observed.afterTrade.seriesLast.time,observed.nextHour);
  assert.equal(observed.afterRepeat.bar.high,65079.6,'repeated stale Kline must not inflate high');
  assert.equal(observed.afterRepeat.bar.low,65077.8,'repeated stale Kline must not inflate low');
  for(const stage of ['ws_open','ws_market_packet','merge_received','bar_merged','series_update','frame_callback'])
   assert.ok(observed.traceStages.includes(stage),'missing diagnostic stage '+stage);
  assert.ok(observed.first.processMs<5000,'browser pipeline is unreasonably slow');
  const summary={viewport:env.label,firstNewCandleBar:observed.first.lastData.time,
   wsToSeriesMs:Math.round(observed.first.processMs*100)/100,
   readbackSeriesTime:observed.first.seriesLast?.time??null,
   sameHourDedupe:'PASS',wrongChannel:'PASS',latePacket:'PASS',
   staleKlineQuarantine:'PASS',realTradeCandleRollover:'PASS',
   stages:observed.traceStages.slice(-7),pageErrors:pageErrors.slice(0,3)};
  console.log(JSON.stringify(summary));
  await context.close();
 }
}finally{
 try{await browser?.close()}catch{}
 server.kill();
}
