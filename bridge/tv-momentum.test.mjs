import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {createTradingViewReceiver} from './tv-momentum-server.mjs';
import {validateTradingViewBar} from './tv-momentum-core.mjs';
import {readWebhookStore,compareWebhookObservations} from './tv-momentum-report.mjs';
import {calculateMomentumFusion} from '../backtest/momentum-fusion-v1.mjs';
const TOKEN='TEST_ONLY_e6788e8e0123456789abcdefff324a567890';
const H=3600000,BASE=Date.UTC(2026,9,27,0);
const NOW=BASE+H+42000;
const values={composite:47,rsi:53,stochRsi:46,momRaw:3,
 momentumRank:62,emaFast:100.5,emaSlow:99.2,bullSignal:false,
 bearSignal:false,pivotLowConfirmed:false,pivotHighConfirmed:false};
function body({t=BASE,tf='60',auth=TOKEN}={}){
 const ms={'15':900000,'30':1800000,'60':H,'240':4*H}[tf];
 return {auth,protocol:'cj-tv-momfusion-closedbar-v1',
  profile:'momfusion-pine-v6-defaults-2026-10-26',source:'TradingView',
  symbol:'BITUNIX:BTCUSDT.P',timeframe:tf,barOpenMs:t,barCloseMs:t+ms,
  ohlc:{open:100,high:102,low:99,close:101},values:{...values}};
}
async function launch(tmp){
 const server=createTradingViewReceiver({secret:TOKEN,storePath:tmp,
  now:()=>NOW});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const base='http://127.0.0.1:'+server.address().port;
 const post=(b,extra={})=>fetch(base+'/tv/momentum',{
  method:'POST',headers:{'Content-Type':'application/json',...extra},
  body:JSON.stringify(b)});
 return {server,post,base};
}
test('Refuse start without private token or configured storage',()=>{
 assert.throws(()=>createTradingViewReceiver(),/random 32/);
 assert.throws(()=>createTradingViewReceiver({secret:'short'}),/random 32/);
 assert.throws(()=>createTradingViewReceiver({secret:TOKEN}),/persistence path/);
});
test('Accept, fsync and deduplicate authenticated closed candle without storing secret',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cj-tv-'));
 const file=path.join(dir,'tradingview.ndjson');
 let c=await launch(file);
 try{
  const a=await c.post(body());
  assert.equal(a.status,202);
  const id=(await a.json()).id;
  assert.match(id,/BITUNIX:BTCUSDT/);
  assert.equal((await c.post(body())).status,200);
  const modified=body();modified.values.composite=45;
  assert.equal((await c.post(modified)).status,409);
  const content=fs.readFileSync(file,'utf8');
  assert.equal(content.trim().split('\n').length,1);
  assert.ok(!content.includes(TOKEN));
  assert.deepEqual(readWebhookStore(file).map(x=>x.barOpenMs),[BASE]);
 }finally{await new Promise(ok=>c.server.close(ok));}
 // Dedup persists over restart (not just a Map in RAM).
 c=await launch(file);
 try{
  assert.equal((await c.post(body())).status,200);
  assert.equal((await (await fetch(c.base+'/healthz')).json()).storedEvents,1);
 }finally{await new Promise(ok=>c.server.close(ok));fs.rmSync(dir,{recursive:true,force:true});}
});
test('Wrong token, malformed body, OHLC anomaly and future-time are never stored',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cj-tv-'));
 const f=path.join(dir,'db.ndjson'),c=await launch(f);
 try{
  assert.equal((await c.post(body({auth:'guess'}))).status,401);
  assert.equal((await c.post(body({auth:''}))).status,401);
  const changed=body();changed.ohlc.high=99;
  assert.equal((await c.post(changed)).status,422);
  const changed2=body();changed2.barOpenMs=NOW+H;
  changed2.barCloseMs=NOW+2*H;
  assert.equal((await c.post(changed2)).status,422);
  const changed3=body();changed3.timeframe='D';
  assert.equal((await c.post(changed3)).status,422);
  const changed4=body();changed4.symbol='BTCUSDT';
  assert.equal((await c.post(changed4)).status,422);
  assert.equal((await c.post(body(),{'Content-Type':'text/plain'})).status,415);
  const oversized='x'.repeat(9000);
  const p=await fetch(c.base+'/tv/momentum',{method:'POST',
   headers:{'Content-Type':'application/json'},body:oversized});
  assert.equal(p.status,413);
  assert.equal(fs.readFileSync(f,'utf8'),'');
 }finally{await new Promise(ok=>c.server.close(ok));fs.rmSync(dir,{recursive:true,force:true});}
});
test('The endpoint does not accept old, unclosed, edited fields or a hidden trade command',()=>{
 assert.throws(()=>validateTradingViewBar(body(),{nowMs:BASE+H-121000}),/delivery window/);
 assert.throws(()=>validateTradingViewBar(body(),{nowMs:BASE+50*H}),/delivery window/);
 const bogus=body();bogus.order='buy';
 assert.throws(()=>validateTradingViewBar(bogus,{nowMs:NOW}),/structure/);
 const missing=body();delete missing.values.composite;
 assert.throws(()=>validateTradingViewBar(missing,{nowMs:NOW}),/structure/);
});
test('Same-source parity needs 200 consecutive bars and detects a deliberate wrong Pine composite',()=>{
 function stream(n=230,{withGap=false,bad=false}={}){
  const candles=Array.from({length:n},(_,i)=>{
   const p=100+3*Math.sin(i*.14)+1.1*Math.cos(i*.067);
   return {time:BASE+(i+(withGap&&i>=100?1:0))*H,
    open:p-.15,high:p+.5,low:p-.6,close:p,volume:0};
  });
  const values=calculateMomentumFusion(candles);
  return candles.map((c,i)=>({
   ...body({t:c.time}),barCloseMs:c.time+H,
   ohlc:{open:c.open,high:c.high,low:c.low,close:c.close},
   values:{
    composite:bad&&i===202?18:values[i].composite,
    rsi:values[i].rsi,stochRsi:values[i].stochRsi,
    momentumRank:values[i].momentumRank,
    momRaw:i>=10?candles[i].close-candles[i-10].close:null,
    emaFast:values[i].emaFast,emaSlow:values[i].emaSlow,
    bullSignal:values[i].bullSignal,bearSignal:values[i].bearSignal,
    pivotLowConfirmed:values[i].pivotLowConfirmed,
    pivotHighConfirmed:values[i].pivotHighConfirmed
   }
  }));
 }
 const valid=compareWebhookObservations(stream(230));
 assert.equal(valid.markets[0].status,'MATCHED_SAME_SOURCE_WITHIN_TOLERANCE');
 assert.ok(valid.markets[0].comparedValues>700);
 assert.equal(valid.markets[0].mismatchedValues,0);
 const changed=compareWebhookObservations(stream(230,{bad:true}));
 assert.equal(changed.markets[0].status,'PINE_JS_MISMATCH');
 assert.equal(changed.markets[0].fields.composite.different,1);
 assert.equal(compareWebhookObservations(stream(160)).markets[0].status,
  'COLLECTING_CONTIGUOUS_OHLC');
 assert.equal(compareWebhookObservations(stream(230,{withGap:true})).markets[0].status,
  'COLLECTING_CONTIGUOUS_OHLC');
});
