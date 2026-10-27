import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createPilotReceiver,createPostgresStore,CREATE_SQL} from './tv-momentum-render.mjs';
const H=3600000,now=Date.UTC(2026,9,27,16)+20000;
const token='TEST_ONLY_111111111122222222223333333333444444';
const observation=(time=now-H-20000)=>({
 auth:token,protocol:'cj-tv-momfusion-closedbar-v1',
 profile:'momfusion-pine-v6-defaults-2026-10-26',source:'TradingView',
 symbol:'BINANCE:BTCUSDT',timeframe:'60',
 barOpenMs:Math.floor(time/H)*H,
 barCloseMs:Math.floor(time/H)*H+H,
 ohlc:{open:100,high:104,low:96,close:101},
 values:{composite:50,rsi:45,stochRsi:55,momRaw:1,
  momentumRank:60,emaFast:101,emaSlow:99,bullSignal:false,
  bearSignal:false,pivotLowConfirmed:false,pivotHighConfirmed:false}
});
function db(){
 const rows=new Map();
 return async(sql,args=[])=>{
  if(sql===CREATE_SQL)return {rowCount:0,rows:[]};
  if(sql==='SELECT 1 AS ok')return {rowCount:1,rows:[{ok:1}]};
  if(sql.startsWith('INSERT')){
   const [id,hash,payload]=args;
   if(rows.has(id))return {rowCount:0,rows:[]};
   rows.set(id,{content_hash:hash,payload:JSON.parse(payload)});
   return {rowCount:1,rows:[{id}]};
  }
  if(sql.startsWith('SELECT content_hash')){
   const found=rows.get(args[0]);
   return {rows:found?[{content_hash:found.content_hash}]:[],rowCount:found?1:0};
  }
  throw Error('Unexpected query');
 };
}
async function onServer(options){
 const server=createPilotReceiver({...options,now:()=>now});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const base='http://127.0.0.1:'+server.address().port;
 const finish=()=>new Promise(resolve=>server.close(resolve));
 return {base,finish,post:(p)=>fetch(base+'/tv/momentum',{method:'POST',
  headers:{'Content-Type':'application/json'},body:JSON.stringify(p)})};
}
test('Fail closed if db or dedicated token is missing',async()=>{
 const s=await onServer({secret:token});try{
  assert.equal((await fetch(s.base+'/healthz')).status,503);
  assert.equal((await s.post(observation())).status,503);
 }finally{await s.finish();}
});
test('Postgres schema uses a primary key and JSONB, never an exchange API key',()=>{
 assert.match(CREATE_SQL,/PRIMARY KEY/);
 assert.match(CREATE_SQL,/JSONB/);
 assert.doesNotMatch(CREATE_SQL,/password|api.?key|trading_order/i);
});
test('Secured payload persistence, duplicate and conflict detection',async()=>{
 const query=db(),store=createPostgresStore(query),s=await onServer({secret:token,store});
 try{
  assert.equal((await fetch(s.base+'/healthz')).status,200);
  const bad=observation();bad.auth='wrong';
  assert.equal((await s.post(bad)).status,401);
  assert.equal((await s.post(observation())).status,202);
  assert.equal((await s.post(observation())).status,200);
  const changed=observation();changed.values.rsi=44;
  assert.equal((await s.post(changed)).status,409);
  assert.equal((await s.post({...observation(),order:'BUY'})).status,422);
 }finally{await s.finish();}
});
test('Reject invalid content type and future/impossible OHLC',async()=>{
 const store=createPostgresStore(db()),s=await onServer({secret:token,store});
 try{
  const t=await fetch(s.base+'/tv/momentum',{method:'POST',
   headers:{'Content-Type':'text/plain'},body:'BUY'});
  assert.equal(t.status,415);
  const bad=observation();bad.ohlc.high=99;
  assert.equal((await s.post(bad)).status,422);
  const late=observation();late.barOpenMs+=2*H;late.barCloseMs+=2*H;
  assert.equal((await s.post(late)).status,422);
 }finally{await s.finish();}
});
test('Database write failures result in 503 (not false acknowledgement)',async()=>{
 const store={ready:async()=>true,persist:async()=>{throw Error('database unavailable')}};
 const s=await onServer({secret:token,store});
 try{assert.equal((await s.post(observation())).status,503);}
 finally{await s.finish();}
});
