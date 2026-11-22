/*
 * HTTP smoke of staging integration: real Express/CORS, fake upstream Bitunix.
 * No external market calls, no PostgreSQL, no orders, no production deploy.
 */
import assert from 'node:assert/strict';
import {createIntegratedApp} from './integrated-api.mjs';

const known='https://fapi.bitunix.com/api/v1/futures/market/kline?symbol=BTCUSDT';
const upstream=[];
const {app,startAgents}=await createIntegratedApp({
  fetchImpl:async(url)=>{
    upstream.push(url);
    return {status:200,headers:{get:()=> 'application/json'},
      text:async()=>JSON.stringify({ok:true,synthetic:true})};
  }
});
const server=await new Promise(resolve=>{
  const h=app.listen(0,'127.0.0.1',()=>resolve(h));
});
const base='http://127.0.0.1:'+server.address().port;
try {
  const root=await fetch(base+'/');
  assert.equal(root.status,200);
  const payload=await root.json();
  assert.equal(payload.version,'1.1.0');
  assert.equal(payload.bitunixProxy,'online');
  const blocked=await fetch(base+'/api/bitunix/proxy?url='+encodeURIComponent('http://127.0.0.1/admin'));
  assert.equal(blocked.status,403);
  assert.equal(upstream.length,0);
  const allowed=await fetch(base+'/api/bitunix/proxy?url='+encodeURIComponent(known));
  assert.equal(allowed.status,200);
  assert.equal((await allowed.json()).synthetic,true);
  assert.equal(upstream.length,1);
  assert.equal(await startAgents({enabled:false}),'DISABLED');
  const status=await fetch(base+'/api/agents/status');
  const view=await status.json();
  assert.equal(view.status,'DISABLED');
  assert.equal(view.noTrading,true);
  assert.equal(Object.keys(view).some(k=>/secret|password|database/i.test(k)),false);
  const health=await fetch(base+'/healthz');
  assert.equal(health.status,200);
  console.log('CJ_RENDER_API_SMOKE PASS (synthetic and no production calls)');
}finally{
  await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
}
