/*
 * CryptoJuju Render research supervisor.
 * One controlled research subprocess at a time; no keys, no orders, no code writes.
 * This is a deterministic runner, NOT yet autonomous LLM research.
 */
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {SPECIALISTS,dueSpecialists,utcSlot,assessBitunixData,summarizeDiagnostics} from './plan.mjs';
import {initializeSpecialistMemory} from './knowledge.mjs';

const ROOT=fileURLToPath(new URL('../../../',import.meta.url));
const OUTPUT_LIMIT=12000;
const outFolder=slot=>join(tmpdir(),'cryptojuju-agent-research',slot.slice(0,13).replaceAll(':','-'));
const truncated=(s,max=OUTPUT_LIMIT)=>String(s??'').slice(-max);

function commandFor(agent,slot){
  const folder=outFolder(slot);
  switch(agent.id){
    case 'bitunix-data': return {file:'backtest/agents/run-bitunix-data-pilot.mjs',
      args:[join(folder,'data')],env:{CJ_DATA_PILOT_BARS:'480'}};
    case 'vector': return {file:'backtest/agents/run-vector-v11-pilot.mjs',
      args:[join(folder,'data')],env:{}};
    case 'momentum': return {file:'backtest/momentum-fusion-extended-bitunix.mjs',args:[],env:{}};
    case 'speed': return {file:'backtest/speed-bitunix-live.mjs',
      args:[],env:{SPEED_HISTORY_DAYS:'30'}};
    case 'cipher': return {file:'backtest/agents/run-cj-cipher-pilot.mjs',
      args:[join(folder,'cipher')],env:{}};
    default: throw Error('No subprocess for '+agent.id);
  }
}

export async function executeResearchProcess(agent,slot,{spawnImpl=spawn}={}){
  const command=commandFor(agent,slot);
  await mkdir(outFolder(slot),{recursive:true});
  const executable=process.execPath;
  const env={...process.env,...command.env};
  // Never enable trading or allow a child to deploy code.
  delete env.BITUNIX_API_KEY;delete env.BITUNIX_API_SECRET;
  delete env.GITHUB_TOKEN;delete env.GH_TOKEN;delete env.OPENAI_API_KEY;
  env.CJ_TRADING_ENABLED='0';
  const started=Date.now();
  const result=await new Promise(resolve=>{
    let stdout='',stderr='',done=false,timedOut=false;
    const child=spawnImpl(executable,[command.file,...command.args],
      {cwd:ROOT,env,stdio:['ignore','pipe','pipe'],shell:false});
    const finish=(exitCode,error=null)=>{
      if(done)return;done=true;clearTimeout(timer);
      resolve({exitCode,elapsedMs:Date.now()-started,timedOut,
        stdout:truncated(stdout),stderr:truncated(stderr),
        error:error?String(error.message??error):null});
    };
    child.stdout?.on('data',chunk=>{stdout=truncated(stdout+chunk);});
    child.stderr?.on('data',chunk=>{stderr=truncated(stderr+chunk);});
    child.on('error',e=>finish(null,e));
    child.on('close',code=>finish(code));
    const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},agent.timeoutMs);
  });
  let status=result.exitCode===0&&!result.timedOut?'EXECUTED_RESEARCH_ONLY':'BLOCKED';
  let evidence={exitCode:result.exitCode,elapsedMs:result.elapsedMs,
    timedOut:result.timedOut,stdout:result.stdout,stderr:result.stderr,error:result.error};
  if(agent.id==='bitunix-data'){
    try {
      const summary=JSON.parse(await readFile(join(outFolder(slot),'data','summary.json'),'utf8'));
      const assessment=assessBitunixData(summary);
      status=(result.exitCode===0 && !result.timedOut && !result.error)
        ? assessment.status:'BLOCKED';
      evidence={...evidence,checks:summary.checks.map(c=>({
        symbol:c.symbol,timeframe:c.timeframe,acceptedBars:c.acceptedBars,
        consistencyStatus:c.consistencyStatus,sha256:c.sha256,status:c.status
      })),assessment};
    }catch(err){
      status='BLOCKED';evidence={...evidence,assessment:{reason:String(err?.message??err)}};
    }
  }
  if(agent.id==='vector' || agent.id==='cipher'){
    try {
      const file=agent.id==='vector'
        ? join(outFolder(slot),'data','vector-v11-summary.json')
        : join(outFolder(slot),'cipher','cj-cipher-pilot-summary.json');
      const summary=JSON.parse(await readFile(file,'utf8'));
      const cases=Array.isArray(summary.cases)?summary.cases:[];
      const accepted=agent.id==='vector'
        ? summary.status==='RESEARCH_SIGNAL_REPLAY_COMPLETE' &&
          cases.length===9 && summary.passed===9 && summary.blocked===0 &&
          summary.candidateComparisonsPassed===9 && summary.candidateComparisonsBlocked===0
        : summary.status==='CIPHER_3_MARKETS_FIRST_PILOT_COMPLETE' &&
          cases.length===3 && summary.validated===3 && summary.blocked===0;
      status=(status==='EXECUTED_RESEARCH_ONLY' && accepted)?status:'BLOCKED';
      evidence={...evidence,summary:{protocol:summary.protocol,status:summary.status,
        cases:cases.length,passed:summary.passed??summary.validated,
        blocked:summary.blocked??null,metadataError:summary.metadataError??null,
        fatalError:summary.fatalError??null}};
    }catch(err){
      status='BLOCKED';
      evidence={...evidence,reason:'MISSING_OR_INVALID_SPECIALIST_SUMMARY',
        message:String(err?.message??err)};
    }
  }
  return {status,evidence};
}

export async function initializeDb(){
  const url=process.env.DATABASE_URL;
  if(!url)throw Error('DATABASE_URL missing: no persistent research is permitted');
  const {default:pg}=await import('pg');
  const db=new pg.Pool({connectionString:url,max:1,connectionTimeoutMillis:7000});
  await db.query(
    "CREATE TABLE IF NOT EXISTS cj_agent_runs ("+
    "agent text NOT NULL, slot timestamptz NOT NULL, "+
    "status text NOT NULL, exit_code integer, "+
    "started_at timestamptz NOT NULL DEFAULT now(), "+
    "finished_at timestamptz, evidence jsonb, "+
    "PRIMARY KEY(agent, slot))");
  await initializeSpecialistMemory(db);
  return db;
}

async function claim(db,id,slot){
  const r=await db.query(
    "INSERT INTO cj_agent_runs(agent,slot,status) VALUES($1,$2,'RUNNING') "+
    "ON CONFLICT(agent,slot) DO NOTHING RETURNING agent",[id,slot]);
  return r.rowCount===1;
}
async function record(db,id,slot,result){
  await db.query(
    "UPDATE cj_agent_runs SET status=$3,exit_code=$4,evidence=$5,finished_at=now() "+
    "WHERE agent=$1 AND slot=$2",
    [id,slot,result.status,result.evidence?.exitCode??null,JSON.stringify(result.evidence??{})]);
}
async function priorReports(db,slot) {
  const r=await db.query(
    "SELECT agent,status,exit_code FROM cj_agent_runs "+
    "WHERE slot=$1 AND agent <> 'diagnostics' ORDER BY agent",[slot]);
  return r.rows;
}

export async function runDueCycle(db,now=new Date(),{executor=executeResearchProcess}={}){
  const slot=utcSlot(now),completed=[];
  for(const agent of dueSpecialists(now)){
    if(!(await claim(db,agent.id,slot)))continue;
    let result;
    try{
      if(agent.id==='vector'){
        const data=await db.query(
          "SELECT status FROM cj_agent_runs WHERE agent='bitunix-data' AND slot=$1",[slot]);
        if(data.rows[0]?.status!=='DATA_READY_FOR_RESEARCH_ONLY'){
          result={status:'BLOCKED',evidence:{reason:'DEPENDENCY_BITUNIX_DATA_NOT_READY'}};
        }
      }
      if(!result && agent.id==='diagnostics'){
        result={status:'EXECUTED_RESEARCH_ONLY',
          evidence:summarizeDiagnostics(await priorReports(db,slot))};
      }else if(!result){
        result=await executor(agent,slot);
      }
    }catch(error){
      result={status:'BLOCKED',evidence:{reason:'UNHANDLED_RESEARCH_ERROR',
        message:String(error?.message??error)}};
    }
    await record(db,agent.id,slot,result);
    completed.push({agent:agent.id,status:result.status});
  }
  return {slot,completed};
}

export async function main(){
  if(process.env.CJ_AGENT_RUNTIME_ENABLED!=='1')
    throw Error('Set CJ_AGENT_RUNTIME_ENABLED=1 only after deployment approval');
  const db=await initializeDb();
  let busy=false,lastCycle=null,lastError=null;
  const tick=async()=>{
    if(busy)return;
    busy=true;
    try {
      const r=await runDueCycle(db,new Date());
      lastCycle=r.slot;lastError=null;
      for(const outcome of r.completed)console.log('CJ_AGENT '+JSON.stringify(outcome));
    }catch(e){
      lastError=String(e?.message??e);
      console.error('CJ_AGENT_CYCLE_ERROR '+lastError);
    }finally{busy=false;}
  };
  const http=process.env.CJ_AGENT_HTTP_DISABLED==='1'?null:createServer((req,res)=>{
    if(req.method!=='GET'||req.url!=='/healthz'){
      res.writeHead(404,{'content-type':'application/json'});res.end('{"error":"not_found"}');return;
    }
    res.writeHead(lastError?503:200,{'content-type':'application/json','cache-control':'no-store'});
    res.end(JSON.stringify({service:'cryptojuju-research',runtime:'DETERMINISTIC_ONLY',
      lastCycle,healthy:!lastError,workInProgress:busy}));
  });
  const port=Number(process.env.PORT??10000);
  if(http)await new Promise(resolve=>http.listen(port,'0.0.0.0',resolve));
  console.log('CJ_AGENT_RUNTIME_DETERMINISTIC '+(http?'port='+port:'embedded=true'));
  const timer=setInterval(()=>{void tick();},60000);
  timer.unref();
  await tick();
  const stop=async()=>{clearInterval(timer);http?.close();await db.end();};
  process.once('SIGTERM',()=>{void stop();});
  process.once('SIGINT',()=>{void stop();});
}
if(process.argv[1] && fileURLToPath(import.meta.url)===fileURLToPath(new URL('file://'+process.argv[1]))) {
  main().catch(e=>{console.error('CJ_AGENT_FATAL '+String(e?.message??e));process.exitCode=1;});
}
