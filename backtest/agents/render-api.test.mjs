import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBitunixTarget,createIntegratedApp} from './render/integrated-api.mjs';
const fakes=()=>{
 const routes=new Map(),uses=[];
 const factory=()=>{
   const app={use(x){uses.push(x)},get(path,fn){routes.set(path,fn);}};
   return app;
 };
 factory.json=()=>()=>{};
 const cors=()=>()=>{};
 return {factory,cors,routes,uses};
};
const res=()=>({
 statusCode:200,headers:{},body:null,
 status(n){this.statusCode=n;return this;},
 set(k,v){this.headers[k]=v;return this;},
 json(o){this.body=o;return this;},
 send(s){this.body=s;return this;}
});
test('proxy URL accepts Bitunix only and rejects unsafe targets',()=>{
 assert.equal(validateBitunixTarget('https://fapi.bitunix.com/api/v1/futures/market/kline').ok,true);
 for(const bad of ['http://fapi.bitunix.com/','https://evil.example/','https://fapi.bitunix.com.evil.example/',
  'https://evil.example@fapi.bitunix.com/','ftp://fapi.bitunix.com/','https://fapi.bitunix.com:8080/']){
   assert.equal(validateBitunixTarget(bad).ok,false,bad);
 }
});
test('API preserves legacy v1.1.0 root and Bitunix proxy contract in staging',async()=>{
 const a=fakes(),seen=[];
 const app=await createIntegratedApp({
  expressFactory:a.factory,corsFactory:a.cors,
  fetchImpl:async (url,opts)=>{
    seen.push({url,method:opts.method});
    return {status:200,headers:{get:()=> 'application/json'},text:async()=>'{\"ok\":true}'};
  }
 });
 assert.equal(a.uses.length,2);
 const root=res();
 a.routes.get('/')({},root);
 assert.deepEqual(root.body,{name:'CryptoJuju API',status:'online',version:'1.1.0',bitunixProxy:'online'});
 const denied=res();
 await a.routes.get('/api/bitunix/proxy')({query:{url:'http://localhost/admin'}},denied);
 assert.equal(denied.statusCode,403);
 assert.equal(seen.length,0);
 const valid=res();
 await a.routes.get('/api/bitunix/proxy')({
   query:{url:'https://fapi.bitunix.com/api/v1/futures/market/kline?symbol=BTCUSDT'}
 },valid);
 assert.equal(valid.statusCode,200);
 assert.equal(valid.headers['cache-control'],'public, max-age=2');
 assert.equal(valid.body,'{"ok":true}');
 assert.equal(seen.length,1);
 const state=res();
 a.routes.get('/api/agents/status')({},state);
 assert.equal(state.body.status,'DISABLED');
 assert.equal('DATABASE_URL' in state.body,false);
 assert.equal(app.runtime.noTrading,true);
});
test('agent supervisor stays fail-closed if off or DATABASE_URL unavailable',async()=>{
 const a=fakes();
 const {startAgents,runtime}=await createIntegratedApp({
  expressFactory:a.factory,corsFactory:a.cors,fetchImpl:async()=>{}
 });
 let called=0;
 assert.equal(await startAgents({enabled:false,researchStarter:()=>{called++}}),'DISABLED');
 assert.equal(await startAgents({enabled:true,databaseUrl:null,
   researchStarter:()=>{called++}}),'BLOCKED');
 assert.equal(called,0);
 assert.equal(runtime.blockedReason,'NO_DATABASE_URL');
});
test('startup gate permits embedded runtime with injected fake',async()=>{
 const a=fakes();
 const {startAgents,runtime}=await createIntegratedApp({
  expressFactory:a.factory,corsFactory:a.cors,fetchImpl:async()=>{}
 });
 let called=0;
 assert.equal(await startAgents({enabled:true,databaseUrl:'postgres://test',
   researchStarter:async()=>{called++}}),'RUNNING');
 assert.equal(called,1);
 assert.equal(runtime.status,'RUNNING');
});
