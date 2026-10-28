import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createPilotReceiver} from './tv-momentum-render.mjs';
import {renderTradingViewPrivateDashboard} from './tv-momentum-dashboard.mjs';

const pw='A_PRIVATE_PASSWORD_NOT_THE_WEBHOOK_TOKEN_12345',
  hook='WEBHOOK_SUBMISSION_TOKEN_TEST_NOT_READER_98765';
const fakeStore={
 ready:async()=>({received:2}),
 persist:async()=> 'INSERTED',
 dashboardSnapshot:async()=>({
  total:2,
  observations:[
   {payload:{symbol:'EXCHANGE:<script>alert(1)</script>',timeframe:'60',
    barOpenMs:Date.UTC(2026,9,28,10),barCloseMs:Date.UTC(2026,9,28,11),
    ohlc:{close:85000},values:{composite:58,bullSignal:true}}},
   {payload:{symbol:'BITUNIX:BTCUSDT.P',timeframe:'60',
    barOpenMs:Date.UTC(2026,9,28,9),barCloseMs:Date.UTC(2026,9,28,10),
    ohlc:{close:84920},values:{composite:60.2,bearSignal:true}}}
  ]})
};
async function listen(options){
 const server=createPilotReceiver({...options,store:options.store??fakeStore});
 server.listen(0,'127.0.0.1');
 await once(server,'listening');
 const url='http://127.0.0.1:'+server.address().port;
 return {url,close:()=>new Promise(resolve=>server.close(resolve))};
}
const basic=(user,password)=>'Basic '+Buffer.from(user+':'+password).toString('base64');

test('Private read-only route fails closed unless independent password configured',async()=>{
 const a=await listen({secret:hook});try{
  const r=await fetch(a.url+'/private/tradingview');
  assert.equal(r.status,404);
  assert.doesNotMatch(await r.text(),/85,000|84920/);
 }finally{await a.close();}
});
test('Dashboard blocks anonymous access and wrong/user-webhook passwords',async()=>{
 const a=await listen({secret:hook,dashboardPassword:pw});
 try{
  for(const authorization of [undefined,basic('owner',hook),basic('owner','bad'),basic('admin',pw)]){
   const headers=authorization?{Authorization:authorization}:{};
   const r=await fetch(a.url+'/private/tradingview',{headers});
   assert.equal(r.status,401);
   assert.match(r.headers.get('www-authenticate'),/Basic/);
   const page=await r.text();
   assert.doesNotMatch(page,/84920|85000|58.00|60.20/);
  }
 }finally{await a.close();}
});
test('Owner auth presents no-store private summary; rejects HTML injection; never reveals secrets',async()=>{
 const a=await listen({secret:hook,dashboardPassword:pw});
 try{
  const r=await fetch(a.url+'/private/tradingview',{
   headers:{Authorization:basic('owner',pw)}});
  assert.equal(r.status,200);
  assert.match(r.headers.get('cache-control'),/no-store/);
  assert.match(r.headers.get('content-security-policy'),/default-src 'none'/);
  const page=await r.text();
  assert.match(page,/BITUNIX:BTCUSDT.P/);
  assert.match(page,/58.00/);
  assert.match(page,/2/);
  assert.doesNotMatch(page,/<script>alert\(1\)<\/script>/);
  assert.match(page,/&lt;script&gt;/);
  assert.doesNotMatch(page,new RegExp(pw));
  assert.doesNotMatch(page,new RegExp(hook));
 }finally{await a.close();}
});
test('GET only, no query-string authentication, no JSON public data endpoint',async()=>{
 const a=await listen({secret:hook,dashboardPassword:pw});
 try{
  assert.equal((await fetch(a.url+'/private/tradingview?token='+pw)).status,401);
  assert.equal((await fetch(a.url+'/private/tradingview',{method:'POST',
    headers:{Authorization:basic('owner',pw)}})).status,405);
  assert.equal((await fetch(a.url+'/private/events')).status,404);
  assert.equal((await fetch(a.url+'/healthz')).status,200);
 }finally{await a.close();}
});
test('Empty dataset stays clear about no TradingView alerts',()=>{
 const page=renderTradingViewPrivateDashboard({total:0,observations:[]});
 assert.match(page,/Aucune chandelle reçue/);
 assert.doesNotMatch(page,/parité validée|tests rentables/i);
});
