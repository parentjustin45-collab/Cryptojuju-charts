/*
 * Staging-only drop-in API + isolated research supervisor.
 * Preserves the legacy CryptoJuju API v1.1.0 routes. Disabled unless
 * CJ_AGENT_RUNTIME_ENABLED=1 and DATABASE_URL is set on Render.
 *
 * This file is NOT deployed to production by merely committing it.
 */
import {pathToFileURL} from 'node:url';
import {main as startResearch} from './supervisor.mjs';

const BITUNIX_HOST='fapi.bitunix.com';

export function validateBitunixTarget(raw){
  if(!raw)return {ok:false,httpStatus:400,error:'Missing url'};
  let target;
  try{target=new URL(String(raw));}
  catch{return {ok:false,httpStatus:400,error:'Invalid url'};}
  if(target.protocol!=='https:' || target.hostname!==BITUNIX_HOST ||
     (target.port && target.port!=='443') || target.username || target.password)
    return {ok:false,httpStatus:403,error:'Bitunix host only'};
  return {ok:true,url:target};
}

export async function createIntegratedApp({
  expressFactory=null,corsFactory=null,fetchImpl=globalThis.fetch
}={}){
  const express=expressFactory ?? (await import('express')).default;
  const cors=corsFactory ?? (await import('cors')).default;
  if(typeof fetchImpl!=='function')throw Error('fetch is required');
  const app=express();
  app.use(cors());
  app.use(express.json());
  const runtime={status:'DISABLED',kind:'DETERMINISTIC_NOT_LLM',noTrading:true,
    lastStartUtc:null,blockedReason:null};

  // Preserve the public client contract from cryptojuju-api/server.js v1.1.0.
  app.get('/',(_req,res)=>res.json({
    name:'CryptoJuju API',status:'online',version:'1.1.0',bitunixProxy:'online'
  }));
  app.get('/api/bitunix/proxy',async(req,res)=>{
    const check=validateBitunixTarget(req.query?.url);
    if(!check.ok)return res.status(check.httpStatus).json({error:check.error});
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),12000);
    try{
      const upstream=await fetchImpl(check.url.toString(),{
        method:'GET',headers:{accept:'application/json',
          'user-agent':'CryptoJuju-API/1.1'},signal:controller.signal
      });
      const body=await upstream.text();
      res.status(upstream.status);
      res.set('content-type',upstream.headers.get('content-type')||'application/json');
      res.set('cache-control','public, max-age=2');
      return res.send(body);
    }catch(e){
      const timedOut=e?.name==='AbortError';
      return res.status(timedOut?504:502).json({
        error:timedOut?'Bitunix timeout':'Bitunix upstream error',
        detail:String(e?.message??e)
      });
    }finally{clearTimeout(timer);}
  });

  // No DB URLs, query output, or project secrets can leak from this route.
  app.get('/api/agents/status',(_req,res)=>{
    res.set('cache-control','no-store');
    res.json({service:'CryptoJuju Agent Research',
      status:runtime.status,kind:runtime.kind,noTrading:runtime.noTrading,
      lastStartUtc:runtime.lastStartUtc});
  });
  app.get('/healthz',(_req,res)=>res.json({status:'online',api:'1.1.0'}));

  async function startAgents({
    enabled=process.env.CJ_AGENT_RUNTIME_ENABLED==='1',
    databaseUrl=process.env.DATABASE_URL,
    researchStarter=startResearch
  }={}){
    if(!enabled){runtime.status='DISABLED';return runtime.status;}
    if(!databaseUrl){
      runtime.status='BLOCKED';runtime.blockedReason='NO_DATABASE_URL';
      return runtime.status;
    }
    runtime.status='STARTING';
    runtime.lastStartUtc=new Date().toISOString();
    // Use only the existing API listener, no second exposed port.
    process.env.CJ_AGENT_HTTP_DISABLED='1';
    try {
      await researchStarter();
      runtime.status='RUNNING';
    }catch(e){
      runtime.status='BLOCKED';
      runtime.blockedReason='AGENT_STARTUP_FAILED';
      console.error('CJ_AGENT_STARTUP_ERROR '+String(e?.message??e));
    }
    return runtime.status;
  }
  return {app,runtime,startAgents};
}

export async function startCombinedServer({
  port=Number(process.env.PORT??10000),
  createApp=createIntegratedApp
}={}){
  const {app,startAgents}=await createApp();
  await new Promise((resolve,reject)=>{
    const server=app.listen(port,'0.0.0.0',resolve);
    server.once('error',reject);
  });
  console.log('CryptoJuju API v1.1.0 running with agent integration on '+port);
  // Do not block the public Bitunix proxy while the DB gate and research
  // engine initialize. A failure leaves the API alive, but agents blocked.
  void startAgents();
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  startCombinedServer().catch(e=>{
    console.error('CJ_COMBINED_API_FATAL '+String(e?.message??e));
    process.exitCode=1;
  });
