/* ISOLATED Render free pilot / TradingView Momentum Fusion; NOT production.
 * Rejects ALL alerts until dedicated token and DATABASE_URL are configured.
 */
import http from 'node:http';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {validateTradingViewBar,observationId,canonicalObservation}
 from './tv-momentum-core.mjs';

const LIMIT=8192;
export const CREATE_SQL='CREATE TABLE IF NOT EXISTS cj_tv_momentum_pilot (id TEXT PRIMARY KEY, content_hash CHAR(64) NOT NULL, payload JSONB NOT NULL, first_received TIMESTAMPTZ NOT NULL DEFAULT NOW())';
export function digestObservation(item){
 return crypto.createHash('sha256').update(canonicalObservation(item)).digest('hex');
}
export function createPostgresStore(query){
 if(typeof query!=='function')throw Error('Database query function required');
 return {
  async persist(item){
   const id=observationId(item),fingerprint=digestObservation(item);
   const inserted=await query(
    'INSERT INTO cj_tv_momentum_pilot(id,content_hash,payload) VALUES ($1,$2,$3::jsonb) ON CONFLICT(id) DO NOTHING RETURNING id',
    [id,fingerprint,canonicalObservation(item)]
   );
   if(inserted.rowCount===1)return 'INSERTED';
   const prev=await query(
    'SELECT content_hash FROM cj_tv_momentum_pilot WHERE id=$1',[id]);
   if(prev.rows.length!==1)throw Error('Database race; retry');
   return prev.rows[0].content_hash===fingerprint?'DUPLICATE':'CONFLICT';
  },
  ready:async()=>{
   const x=await query('SELECT COUNT(*)::int AS received FROM cj_tv_momentum_pilot');
   return {received:Number(x.rows[0]?.received??0)};
  }
 };
}
const constantTimeSecret=(a,b)=>{
 if(typeof a!=='string'||typeof b!=='string')return false;
 const d=s=>crypto.createHash('sha256').update(s,'utf8').digest();
 return crypto.timingSafeEqual(d(a),d(b));
};
const send=(res,code,payload)=>{
 res.writeHead(code,{'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store','x-content-type-options':'nosniff'});
 res.end(JSON.stringify(payload));
};
export function createPilotReceiver({secret,store,now=Date.now}={}){
 const enabled=typeof secret==='string'&&Buffer.byteLength(secret,'utf8')>=32
  &&store&&typeof store.persist==='function'&&typeof store.ready==='function';
 return http.createServer(async(req,res)=>{
  if(req.url==='/healthz'&&req.method==='GET'){
   if(!enabled){send(res,503,{status:'NOT_CONFIGURED',service:'Momentum research pilot'});return;}
   try{
    const r=await store.ready();
    send(res,200,{status:'READY',service:'Momentum research pilot',
     storedObservations:Number(r?.received??0)});
   }catch{send(res,503,{status:'DATABASE_UNAVAILABLE'});}
   return;
  }
  if(req.url!=='/tv/momentum'||req.method!=='POST'){
   send(res,404,{error:'not found'});return;
  }
  if(!enabled){send(res,503,{error:'pilot not configured'});return;}
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']??'')){
   send(res,415,{error:'JSON required'});return;
  }
  if(Number(req.headers['content-length']??0)>LIMIT){
   send(res,413,{error:'payload too large'});req.resume();return;
  }
  let chunks=[],size=0;
  try{
   for await(const ch of req){size+=ch.length;if(size>LIMIT)throw Error('oversize');chunks.push(ch);}
  }catch{if(!res.headersSent)send(res,413,{error:'payload too large'});return;}
  let incoming;
  try{incoming=JSON.parse(Buffer.concat(chunks).toString('utf8'));}
  catch{send(res,400,{error:'invalid JSON'});return;}
  if(!constantTimeSecret(incoming?.auth,secret)){
   send(res,401,{error:'unauthorized'});return;
  }
  let item;
  try{item=validateTradingViewBar(incoming,{nowMs:now()});}
  catch(e){send(res,422,{error:String(e?.message??e)});return;}
  try{
   const state=await store.persist(item);
   if(state==='CONFLICT'){
    console.info('Momentum webhook: CONFLICT, no observation changed');
    send(res,409,{status:'conflict'});return;
   }
   console.info('Momentum webhook:',state==='INSERTED'?'INSERTED':'DUPLICATE');
   send(res,state==='INSERTED'?202:200,{status:state.toLowerCase(),
    id:observationId(item)});
  }catch{
   console.warn('Momentum webhook: PERSISTENCE_FAILED');
   send(res,503,{error:'durable storage unavailable'});
  }
 });
}
async function main(){
 let store=null;
 const configured=process.env.CJ_TV_WEBHOOK_TOKEN&&process.env.DATABASE_URL;
 if(configured){
  try{
   const {default:pg}=await import('pg');
   const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,
    max:3,connectionTimeoutMillis:1800,idleTimeoutMillis:15000,
    query_timeout:1800,statement_timeout:1800});
   await pool.query(CREATE_SQL);
   store=createPostgresStore((sql,args)=>pool.query(sql,args));
  }catch(err){
   console.error('Momentum pilot DB not ready:',String(err?.code??err?.name??'DB_ERROR'));
  }
 }
 const server=createPilotReceiver({secret:process.env.CJ_TV_WEBHOOK_TOKEN,store});
 const port=Number(process.env.PORT??3000);
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid PORT');
 server.listen(port,'0.0.0.0',()=>{
  console.log('Momentum pilot listening. Status:',store?'READY':'NOT_CONFIGURED');
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
 await main();
