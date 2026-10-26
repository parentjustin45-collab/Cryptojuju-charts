/* Real-Bitunix-CLOSED-candles, isolated Chromium mobile/desktop preview.
 * The data file comes from live read-only Bitunix REST in the preceding CI step.
 * Remote network is blocked inside browser to isolate deterministic rendering.
 * This validates UI against genuine exchange OHLC, not streaming Bitunix WSS.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const report=JSON.parse(fs.readFileSync('vector-watch-bitunix-snapshot.json','utf8'));
assert.equal(report.status,'BITUNIX_FRESH_SNAPSHOT_VERIFIED');
const port=18874,url='http://127.0.0.1:'+port+'/index.html';
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],
 {cwd:process.cwd(),stdio:'ignore'});
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
let browser;
try{
 for(let i=0;i<30;i++){
  try{const t=await fetch(url);if(t.ok)break;}catch{}
  await sleep(200);
 }
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const e of [
  {id:'desktop',w:1440,h:900,mobile:false},
  {id:'android-390',w:390,h:844,mobile:true}
 ]){
  const ctx=await browser.newContext({viewport:{width:e.w,height:e.h},
   isMobile:e.mobile,hasTouch:e.mobile,deviceScaleFactor:e.mobile?2:1});
  const page=await ctx.newPage(),pageErrors=[];
  page.on('pageerror',err=>pageErrors.push(String(err)));
  await page.route('**/*',async route=>{
   const u=route.request().url();
   if(u.includes('unpkg.com/lightweight-charts@4.2.2/dist/lightweight-charts.standalone.production.js'))
    await route.fulfill({path:'node_modules/lightweight-charts/dist/lightweight-charts.standalone.production.js',
     contentType:'text/javascript'});
   else if(u.startsWith('http://127.0.0.1:'+port+'/'))await route.continue();
   else await route.abort();
  });
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>typeof cards!=='undefined'&&cards.length===4,null,{timeout:30000});
  await page.locator('.card').first().locator('.indBtn').click();
  const checked=page.locator('.card').first().locator('[data-x="watchstate"]');
  assert.equal(await checked.isChecked(),false,'WATCH must default off');
  await checked.check();
  for(const record of report.symbols){
   assert.equal(record.status,'BITUNIX_VERIFIED');
   const symbol=record.symbol,expected=record.WATCH.status;
   const actual=await page.evaluate(async({record})=>{
    const o=cards[0];o.loadToken=(o.loadToken||0)+1;
    stopLive(o);o.cjWatchSerial=(o.cjWatchSerial||0)+1;
    o.cjWatchKey=null;o.cjWatchValue=null;
    o.el.querySelector('.sym').innerHTML='<option selected>'+record.symbol+'</option>';
    o.el.querySelector('.curSym').textContent=record.symbol;
    o.el.querySelector('.tf').value='1h';o.interval='1h';
    o.el.querySelector('.wmSymbol').textContent=record.symbol;
    o.el.querySelector('.wmTf').textContent='1H';
    o.el.querySelector('.feed').textContent='SOURCE: Bitunix vérifiée en lecture seule ('+record.source+')';
    o.data=record.ohlc;
    o.cs.setData(o.data);
    renderIndicators(o);
    o.ch.timeScale().fitContent();
    const markersBefore=vectorAIT(o.data,'1h').markers.map(x=>[x.time,x.text]);
    await new Promise((resolve,reject)=>{
     const limit=Date.now()+18000;
     function check(){
      const el=o.el.querySelector('.cjWatchBadge');
      if(el&&!el.hidden&&['possible','confirmed_idle','neutral','insufficient','stale'].includes(el.dataset.status))resolve();
      else if(Date.now()>limit)reject(Error('WATCH never resolved'));else setTimeout(check,80);
     }check();
    });
    const el=o.el.querySelector('.cjWatchBadge');
    const bounds=el.getBoundingClientRect();
    // Toggle off/on must never mutate existing LONG/SHORT markers.
    const markersAfter=vectorAIT(o.data,'1h').markers.map(x=>[x.time,x.text]);
    return {status:el.dataset.status,label:el.textContent,
     x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height,
     markerSame:JSON.stringify(markersBefore)===JSON.stringify(markersAfter),
     feed:o.el.querySelector('.feed').textContent,
     latest:o.data.at(-1).time,latestClose:o.data.at(-1).close};
   },{record});
   assert.equal(actual.status,expected,symbol+' '+e.id+': WATCH status differs from same real Bitunix OHLC');
   assert.equal(actual.markerSame,true,symbol+' '+e.id+': V1.1 marker mutation detected');
   assert.ok(actual.x>=-3&&actual.x+actual.width<=e.w+3,
    symbol+' '+e.id+': WATCH clipped horizontally');
   assert.ok(actual.y>=-3&&actual.y+actual.height<=e.h+3,
    symbol+' '+e.id+': WATCH clipped vertically');
   if(symbol==='BTCUSDT'){
    await page.locator('.card').first().locator('.drawer').evaluate(x=>x.classList.remove('open'));
    await page.screenshot({path:'watch-bitunix-'+e.id+'.png',fullPage:true});
   }
   process.stdout.write(JSON.stringify({browser:e.id,exchange:'Bitunix',symbol,
    state:actual.status,lastPrice:actual.latestClose,markersIntact:true})+'\n');
  }
  // Confirm per-card switch clears old message immediately
  const old=await page.evaluate(()=>{
   const o=cards[0],el=o.el.querySelector('.cjWatchBadge');
   const old=el.textContent;
   o.el.querySelector('.tf').value='4h';
   load(o);
   return {old,newState:el.textContent};
  });
  assert.match(old.newState,/changement de graphique/);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('cjIndicators18_0')).watchstate),true);
  assert.ok(pageErrors.every(err=>/network|fetch/i.test(err)),
   'Unexpected JavaScript page errors: '+pageErrors.join(' | '));
  await ctx.close();
 }
}finally{
 try{await browser?.close();}catch{}
 try{server.kill();}catch{}
}
