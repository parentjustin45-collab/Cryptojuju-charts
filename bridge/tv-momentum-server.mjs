/* Standalone local/test TradingView webhook receiver.
 * FAIL CLOSED without a dedicated random 32+ byte webhook-only secret AND
 * configured durable store path. NOT installed into production CryptoJuju API.
 * Requires an independently configured durable disk for 24/7 operation.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {validateTradingViewBar,observationId,canonicalObservation}
 from './tv-momentum-core.mjs';

const MAX_BYTES=8192,MAX_EXISTING_BYTES=50*1024*1024;
function sameSecret(provided,expected){
 if(typeof provided!=='string')return false;
 // Equal-length digests mitigate obvious timing leaks and string-length oracle.
 const h=s=>crypto.createHash('sha256').update(s,'utf8').digest();
 return crypto.timingSafeEqual(h(provided),h(expected));
}
function openStore(storePath){
 if(typeof storePath!=='string'||!storePath.trim()||
    path.basename(storePath).startsWith('.'))throw Error('Explicit persistence path required');
 fs.mkdirSync(path.dirname(path.resolve(storePath)),{recursive:true,mode:0o700});
 const index=new Map();
 if(fs.existsSync(storePath)){
  if(fs.statSync(storePath).size>MAX_EXISTING_BYTES)
   throw Error('Storage > 50 MB; archive and rotate securely first');
  const raw=fs.readFileSync(storePath,'utf8');
  if(raw.length>0&&!raw.endsWith('\n'))
   throw Error('Incomplete persisted NDJSON; do not append or silently truncate');
  for(const line of raw.split('\n')){
   if(!line)continue;
   const item=JSON.parse(line);
   const id=observationId(item),content=canonicalObservation(item);
   if(index.has(id)&&index.get(id)!==content)
    throw Error('Conflicting historical events in persistent store');
   index.set(id,content);
  }
 }
 const handle=fs.openSync(storePath,fs.constants.O_WRONLY|fs.constants.O_APPEND|fs.constants.O_CREAT,0o600);
 return {
  size:()=>index.size,
  persist(item){
   const id=observationId(item),serialized=canonicalObservation(item);
   const prior=index.get(id);
   if(prior)return prior===serialized?'DUPLICATE':'CONFLICT';
   // Acknowledge only AFTER bytes are safely fsynced; never leak token.
   fs.writeSync(handle,serialized+'\n',null,'utf8');
   fs.fsyncSync(handle);
   index.set(id,serialized);
   return 'INSERTED';
  },
  close:()=>fs.closeSync(handle)
 };
}
function send(res,status,data){
 const text=JSON.stringify(data);
 res.writeHead(status,{'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store','x-content-type-options':'nosniff'});
 res.end(text);
}
export function createTradingViewReceiver({
 secret,storePath,now=()=>Date.now()
}={}){
 if(typeof secret!=='string'||Buffer.byteLength(secret,'utf8')<32)
  throw Error('CJ_TV_WEBHOOK_TOKEN must be a random 32+ byte single-purpose token');
 const store=openStore(storePath);
 let closed=false;
 const server=http.createServer(async(req,res)=>{
  if(req.url==='/healthz'&&req.method==='GET'){
   send(res,200,{status:'configured',purpose:'Momentum research only',
    storedEvents:store.size()});return;
  }
  if(req.url!=='/tv/momentum'||req.method!=='POST'){
   send(res,404,{error:'not found'});return;
  }
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']??'')){
   send(res,415,{error:'JSON required'});return;
  }
  const sizeHeader=Number(req.headers['content-length']??0);
  if(sizeHeader>MAX_BYTES){
   send(res,413,{error:'payload too large'});req.resume();return;
  }
  let bytes=0,chunks=[];
  try{
   for await(const chunk of req){
    bytes+=chunk.length;
    if(bytes>MAX_BYTES)throw Error('TOO_LARGE');
    chunks.push(chunk);
   }
  }catch{
   if(!res.headersSent)send(res,413,{error:'payload too large'});
   return;
  }
  let incoming;
  try{incoming=JSON.parse(Buffer.concat(chunks).toString('utf8'));}
  catch{send(res,400,{error:'invalid JSON'});return;}
  // Auth before validating details, errors do not expose model data.
  if(!sameSecret(incoming?.auth,secret)){
   send(res,401,{error:'unauthorized'});return;
  }
  let safe;
  try{safe=validateTradingViewBar(incoming,{nowMs:now()});}
  catch(err){send(res,422,{error:String(err?.message??err)});return;}
  try{
   const result=store.persist(safe);
   if(result==='CONFLICT'){send(res,409,{status:'conflict'});return;}
   send(res,result==='INSERTED'?202:200,{status:result.toLowerCase(),
    id:observationId(safe)});
  }catch{
   // Do not acknowledge lost data; operator investigates durable store.
   send(res,503,{error:'persistence unavailable'});return;
  }
 });
 server.on('close',()=>{if(!closed){closed=true;store.close();}});
 return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const app=createTradingViewReceiver({
  secret:process.env.CJ_TV_WEBHOOK_TOKEN,
  storePath:process.env.CJ_TV_WEBHOOK_STORE
 });
 const port=Number(process.env.PORT??3000);
 if(!Number.isSafeInteger(port)||port<1||port>65535)throw Error('Invalid PORT');
 app.listen(port,process.env.HOST??'127.0.0.1',()=>{
  console.log('Isolated Momentum webhook receiver started, no trading routes, auth required');
 });
}
