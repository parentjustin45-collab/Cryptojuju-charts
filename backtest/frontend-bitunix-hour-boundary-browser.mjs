/* DEV V1.26.0, READ ONLY — observes BTCUSDT 1H + 15m through the real
 * CryptoJuju frontend and the actual Bitunix WebSocket at the next clock-hour.
 * Tracks WS delivery, bucket merge, LightweightCharts series, and animation frame.
 * Does NOT fabricate market candles, trade, mutate indicators, or publish to main.
 */
import {spawn} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const H=3600000, symbol='BTCUSDT';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const utc=ms=>new Date(ms).toISOString();
const start=Date.now();
let target=(Math.floor(start/H)+1)*H;
if(target-start<180000)target+=H;
const report={mode:'REAL_FRONTEND_BOUNDARY_READONLY',symbol,branch:'dev/v1.26.0',
 targetUtc:utc(target),startedUtc:utc(start),timeframes:['1h','15m'],checks:[],errors:[]};
const port=18881,base='http://127.0.0.1:'+port;
let server=null,browser=null,page=null;
async function snapshotREST(label){
 try{
  const u=new URL('https://fapi.bitunix.com/api/v1/futures/market/kline');
  for(const [k,v] of Object.entries({symbol,interval:'1h',endTime:Date.now(),limit:3,type:'LAST_PRICE'}))u.searchParams.set(k,String(v));
  const r=await fetch(u,{signal:AbortSignal.timeout(10_000)});
  const j=await r.json(),rows=j?.data?.list??j?.data??[];
  return {label,atUtc:utc(Date.now()),http:r.status,code:j.code,candles:Array.isArray(rows)?
   rows.slice(0,3).map(k=>({time:k.time,open:k.open,high:k.high,low:k.low,close:k.close})):[]};
 }catch(e){return {label,error:String(e?.message??e)};}
}
try{
 if(target-start>H)throw Error('Invalid target boundary');
 console.log('TARGET '+report.targetUtc+'; waiting until ~2 min before boundary to launch real browser');
 while(Date.now()<target-125000)await sleep(Math.min(30000,target-125000-Date.now()));
 server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:process.cwd(),stdio:'ignore'});
 for(let i=0;i<60;i++){try{if((await fetch(base+'/index.html')).ok)break;}catch{}await sleep(120);}
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
 page=await context.newPage();
 page.on('pageerror',e=>report.errors.push('pageerror: '+String(e)));
 await page.route('**/lightweight-charts@4.2.2/dist/lightweight-charts.standalone.production.js',route=>
  route.fulfill({path:'node_modules/lightweight-charts/dist/lightweight-charts.standalone.production.js',contentType:'text/javascript'}));
 await page.goto(base+'/index.html?cjdiag=1',{waitUntil:'domcontentloaded',timeout:45000});
 await page.waitForFunction(()=>typeof cards!=='undefined'&&cards[0]?.cs&&cards[1]?.cs,{timeout:25000});
 await page.evaluate(()=>{
  setL('two');
  for(const [idx,tf] of [[0,'1h'],[1,'15m']]){
   const o=cards[idx],sym=o.el.querySelector('.sym'),select=o.el.querySelector('.tf');
   sym.innerHTML='<option selected>BTCUSDT</option>';select.value=tf;load(o);
  }
  for(let i=2;i<4;i++)stopLive(cards[i]);
 });
 try{
  await page.waitForFunction(()=>[0,1].every(i=>
   String(cards[i].historySource||'').startsWith('Bitunix')&&cards[i].ws?.readyState===1),null,{timeout:85000});
 }catch(e){report.errors.push('Some feeds not ready before deadline: '+String(e?.message??e));}
 const connected=await page.evaluate(()=>[0,1].map(i=>{
  const o=cards[i];return {tf:o.interval,source:o.historySource,
   wsState:o.ws?.readyState??null,historyCount:o.data.length,
   lastBar:o.data.at(-1)?.time??null};
 }));
 report.atStart=connected;
 // Per-frame observer captures the first real update after the boundary,
 // including while 200-event debug trace rolls over during heavy trading.
 await page.evaluate(({target})=>{
  const m=window.__CJ_BOUNDARY_MONITOR__={target,tf:{},ended:false};
  for(let i of [0,1]){
   const o=cards[i];
   m.tf[i]={tf:o.interval,first:{},atBoundary:null,events:[],snapshots:[]};
   o.cjFeedTrace=[];
  }
  // Hook the exact in-app trace at emission time. Polling the app's bounded
  // 200-event buffer can miss high-volume packets during an hour rollover.
  const originalTrace=window.cjFeedTrace;
  if(typeof originalTrace!=='function')throw Error('Diagnostic hook missing from dev frontend');
  window.cjFeedTrace=function(o,stage,details={}){
   originalTrace(o,stage,details);
   const i=cards.indexOf(o),at=Date.now();
   if(i<0||i>1||at<target-10000||at>target+120000)return;
   const record=m.tf[i];if(!record)return;
   const e={atMs:at,stage,...details};
   if(stage==='bar_merged'){
    const prev=o.data.at(-2),next=o.data.at(-1);
    if(prev)e.previousOHLC={open:prev.open,high:prev.high,low:prev.low,close:prev.close,time:prev.time};
    if(next)e.currentOHLC={open:next.open,high:next.high,low:next.low,close:next.close,time:next.time};
    if(e.action==='appended'&&e.previousOHLC&&e.currentOHLC){
     e.identicalOHLC=['open','high','low','close'].every(k=>e.previousOHLC[k]===e.currentOHLC[k]);
    }
   }
   if(record.events.length<900)record.events.push(e);
   if(at>=target&&record.first[stage]===undefined)record.first[stage]=at-target;
  };
  m.timer=setInterval(()=>{
   const at=Date.now();
   for(let i of [0,1]){
    const o=cards[i],r=m.tf[i];
    const barTime=Number(o.data?.at(-1)?.time??0);
    const seriesTime=Number(o.cs?.data?.()?.at(-1)?.time??0);
    const boundarySec=target/1000;
    if(at>=target&&r.first.dataNewBar===undefined&&barTime>=boundarySec)
     r.first.dataNewBar=at-target;
    if(at>=target&&r.first.seriesNewBar===undefined&&seriesTime>=boundarySec)
     r.first.seriesNewBar=at-target;
    if(at>=target&&r.atBoundary===null)r.atBoundary={atMs:at,barTime,seriesTime,wsState:o.ws?.readyState};
    if(at>=target&&at<target+110000&&r.snapshots.length<30&&
       (r.snapshots.length===0||at-r.snapshots.at(-1).atMs>3500))
     r.snapshots.push({atMs:at,barTime,seriesTime,wsState:o.ws?.readyState});
   }
   if(at>target+115000){clearInterval(m.timer);m.ended=true}
  },100);
 },{target});
 console.log('Feeds: '+JSON.stringify(connected)+'; watching boundary '+report.targetUtc);
 while(Date.now()<target+7000)await sleep(Math.min(1500,target+7000-Date.now()));
 report.restAfter7s=await snapshotREST('after+7s');
 try{await page.screenshot({path:'bitunix-boundary-plus7s.png',fullPage:true})}catch(e){report.errors.push('screen+7 '+e.message)}
 while(Date.now()<target+105000)await sleep(Math.min(2000,target+105000-Date.now()));
 report.restAfter105s=await snapshotREST('after+105s');
 try{await page.screenshot({path:'bitunix-boundary-plus105s.png',fullPage:true})}catch(e){report.errors.push('screen+105 '+e.message)}
 report.atEnd=await page.evaluate(()=>{
  const m=window.__CJ_BOUNDARY_MONITOR__;clearInterval(m.timer);
  return [0,1].map(i=>{
   const o=cards[i],d=m.tf[i],events=d.events;
   const firstOf=stage=>events.find(e=>e.atMs>=m.target&&e.stage===stage);
   const firstPacket=firstOf('ws_market_packet'),
    firstNewMerged=events.find(e=>e.atMs>=m.target&&e.stage==='bar_merged'&&e.action==='appended');
   return {tf:d.tf,source:o.historySource,wsState:o.ws?.readyState,
    lastBar:o.data.at(-1)?.time,seriesLast:o.cs?.data?.()?.at(-1)?.time,
    first:d.first,firstPacket:firstPacket?{deltaMs:firstPacket.atMs-m.target,
     rawKlineTime:firstPacket.rawKlineTime,
     normalizedFirstBarTime:firstPacket.normalizedFirstBarTime}:null,
    firstNewMerged:firstNewMerged?{deltaMs:firstNewMerged.atMs-m.target,barTime:firstNewMerged.barTime,
     previousOHLC:firstNewMerged.previousOHLC,currentOHLC:firstNewMerged.currentOHLC,
     identicalOHLC:firstNewMerged.identicalOHLC}:null,
    atBoundary:d.atBoundary,snapshots:d.snapshots,
    eventCounts:events.reduce((acc,e)=>(acc[e.stage]=(acc[e.stage]||0)+1,acc),{}),
    lastErrors:events.filter(e=>e.stage==='ws_parse_error').slice(-3)};
  });
 });
 report.checks=report.atEnd.map(t=>({tf:t.tf,sourceOK:String(t.source||'').startsWith('Bitunix'),
  websocketMessageAfterBoundary:t.first.ws_market_packet!==undefined,
  dataNewBarWithin10s:t.first.dataNewBar!==undefined&&t.first.dataNewBar<10000,
  seriesNewBarWithin10s:t.first.seriesNewBar!==undefined&&t.first.seriesNewBar<10000,
  firstDataDelayMs:t.first.dataNewBar??null,
  firstSeriesDelayMs:t.first.seriesNewBar??null,
  firstPacketDelayMs:t.firstPacket?.deltaMs??null,
  firstAppendedOHLC:t.firstNewMerged??null,
  possiblePreviousOHLCClone:t.firstNewMerged?.identicalOHLC??null}));
 report.status=report.checks.every(c=>c.sourceOK&&c.dataNewBarWithin10s&&c.seriesNewBarWithin10s)?
  'PASS_NO_90S_DELAY':'INCONCLUSIVE_OR_DELAY_DETECTED';
 if(report.status!=='PASS_NO_90S_DELAY')process.exitCode=1;
}catch(e){
 report.status='TEST_ERROR';report.errors.push(String(e?.stack??e));process.exitCode=1;
}finally{
 report.finishedUtc=utc(Date.now());
 await writeFile('bitunix-frontend-hour-boundary-report.json',JSON.stringify(report,null,2));
 console.log('SUMMARY '+JSON.stringify({targetUtc:report.targetUtc,status:report.status,checks:report.checks,errors:report.errors}));
 try{await browser?.close()}catch{}
 try{server?.kill()}catch{}
}
