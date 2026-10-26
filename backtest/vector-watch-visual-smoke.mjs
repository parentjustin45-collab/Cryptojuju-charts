/* Playwright smoke-test on REAL dev index.html served via HTTP.
 * Market history for WATCH test is deterministic and injected directly in a
 * test-only page context. No Bitunix trades, no production calls from test.
 * Browsers: Chromium desktop and Android-like mobile viewport.
 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import {chromium} from 'playwright';
const port=18873,url='http://127.0.0.1:'+port+'/index.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],
 {cwd:process.cwd(),stdio:'ignore'});
let browser=null,success=false;
function syntheticInjector(){
 const chart=cards[0],h=3600,now=Math.floor(Date.now()/3600000)*3600;
 const b=Array.from({length:75},(_,i)=>({
  time:now-(75-i)*h,open:100,high:100.5,low:99.5,close:100,volume:100
 }));
 b[30]={...b[30],open:100.4,high:100.45,low:99.55,close:99.6,volume:10000};
 b[74]={...b[74],open:99.5,high:100.35,low:99.45,close:100.3,volume:10000};
 chart.data=b;chart.interval='1h';
 chart.el.querySelector('.tf').value='1h';
 refreshExperimentalWatch(chart);
 return {bars:b.length,model:typeof refreshExperimentalWatch,
  header:document.title};
}
try{
 for(let i=0;i<35;i++){
  if(server.exitCode!==null)throw Error('HTTP fixture server failed');
  try{const r=await fetch(url);if(r.ok)break;}catch{}
  await sleep(180);
 }
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const env of [
  {label:'desktop',width:1440,height:900,mobile:false},
  {label:'android-390',width:390,height:844,mobile:true}
 ]){
  const context=await browser.newContext({
   viewport:{width:env.width,height:env.height},
   deviceScaleFactor:env.mobile?2:1,isMobile:env.mobile,
   hasTouch:env.mobile,userAgent:env.mobile?
   'Mozilla/5.0 (Linux; Android 16; Mobile) AppleWebKit/537.36 Chrome/134.0.0.0 Mobile Safari/537.36':
   undefined,
   serviceWorkers:'block'
  });
  const page=await context.newPage();
  // Real LightweightCharts locally, deterministic disconnected UI; no external
  // market API, websocket or production dependency may influence this smoke test.
  await page.route('**/*',async route=>{
   const u=route.request().url();
   if(u.includes('unpkg.com/lightweight-charts@4.2.2/dist/lightweight-charts.standalone.production.js')){
    await route.fulfill({path:'node_modules/lightweight-charts/dist/lightweight-charts.standalone.production.js',contentType:'text/javascript'});
   }else if(u.startsWith('http://127.0.0.1:'+port+'/')){
    await route.continue();
   }else await route.abort();
  });
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForSelector('.card .indBtn',{timeout:25000});
  await page.waitForFunction(()=>document.querySelectorAll('.card').length===4);
  // The original online market feed is not required for deterministic UI
  // testing. Avoid depending on external history/Bitunix endpoints.
  const toggle=page.locator('.card').first().locator('[data-x="watchstate"]');
  assert.equal(await toggle.count(),1,env.label+': WATCH control missing');
  assert.equal(await toggle.isChecked(),false,env.label+': must default OFF');
  assert.equal(await page.locator('.card').first().locator('.cjWatchBadge').isHidden(),true,
   env.label+': OFF badge visible');
  await page.locator('.card').first().locator('.indBtn').click();
  const menu=page.locator('.card').first().locator('.drawer');
  assert.equal(await menu.evaluate(el=>el.classList.contains('open')),true);
  await toggle.check();
  await page.evaluate(syntheticInjector);
  await page.waitForFunction(()=>{
   const badge=document.querySelector('.card .cjWatchBadge');
   return badge&&!badge.hidden&&
    (badge.dataset.status==='possible'||badge.dataset.status==='confirmed_idle');
  },null,{timeout:16000});
  const status=await page.locator('.card').first().locator('.cjWatchBadge').evaluate(el=>({
   text:el.textContent,status:el.dataset.status,visible:!el.hidden,
   rect:(()=>{const x=el.getBoundingClientRect();return {x:x.left,y:x.top,w:x.width,h:x.height}})()
  }));
  assert.equal(status.status,'possible',
   env.label+': WATCH should reflect deterministic completed-bar LONG possibility; got '+JSON.stringify(status));
  assert.match(status.text,/Retournement possible LONG/);
  const [height,width]=[env.height,env.width];
  assert.ok(status.rect.x>=-3&&status.rect.x+status.rect.w<=width+3,
   env.label+': WATCH overflowed screen horizontally');
  assert.ok(status.rect.y>=0&&status.rect.y+status.rect.h<=height+3,
   env.label+': WATCH overflowed screen vertically');
  // Update a still-forming candle only. No confirmed WATCH changes.
  const before=await page.locator('.card').first().locator('.cjWatchBadge').textContent();
  await page.evaluate(()=>{
   const o=cards[0],last=o.data.at(-1);
   o.data.push({time:last.time+3600,open:last.close,high:last.close+5,
     low:last.close-5,close:last.close+4,volume:1000000});
   refreshExperimentalWatch(o);
  });
  await page.waitForTimeout(300);
  const after=await page.locator('.card').first().locator('.cjWatchBadge').textContent();
  assert.equal(after,before,env.label+': still-forming candle modified WATCH');
  await menu.evaluate(el=>el.classList.remove('open'));
  await page.screenshot({path:'watch-'+env.label+'.png',fullPage:true});
  // Persistence is per-card, reload keeps preference but not a stale watch.
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('cjIndicators18_0')).watchstate),true);
  // Switching symbol/timeframe must clear stale label synchronously.
  const changed=await page.evaluate(()=>{
   const o=cards[0],a=o.el.querySelector('.cjWatchBadge');
   const before=a.textContent;
   o.el.querySelector('.tf').value='4h';
   // Calling load() starts an asynchronous feed, but must reset immediately.
   load(o);
   return {before,after:a.textContent};
  });
  assert.match(changed.before,/Retournement possible LONG/);
  assert.match(changed.after,/changement de graphique/);
  const originalMarkers=await page.evaluate(()=>{
   const o=cards[0];
   return vectorAIT(o.data,'1h').markers.map(m=>[m.time,m.text]);
  });
  assert.ok(Array.isArray(originalMarkers),'Existing vector marker engine no longer callable');
  await context.close();
  process.stdout.write(JSON.stringify({viewport:env.label,watch:status.status,
   badgeVisible:status.visible,checks:'PASS',pageErrors:errors.slice(0,4)})+'\n');
 }
 success=true;
}finally{
 try{await browser?.close()}catch{}
 try{server.kill()}catch{}
}
if(!success)process.exitCode=1;
