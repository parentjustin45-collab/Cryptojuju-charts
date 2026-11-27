/*
 * CryptoJuju Render research supervisor.
 * One controlled research subprocess at a time; no keys, no orders, no code writes.
 * This is a deterministic runner, NOT yet autonomous LLM research.
 */
import {createServer} from 'node:http';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,readFile,access,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {SPECIALISTS,dueSpecialists,utcSlot,assessBitunixData,summarizeDiagnostics} from './plan.mjs';
import {initializeSpecialistMemory} from './knowledge.mjs';
import {initializeArchive,archiveAgentArtifacts,archiveCapacity} from './archive.mjs';
import {runHistoricalBridgeIfEnabled} from './historical-bridge-scheduler.mjs';
import {runAutonomousExperiment} from './autonomous-experiment-worker.mjs';
import {runHistoricalBackfillBatch} from './historical-backfill-worker.mjs';
import {runEligibleMultiYearReplay} from './historical-replay-worker.mjs';
import {isFiveByFive} from './five-by-five.mjs';

const ROOT=fileURLToPath(new URL('../../../',import.meta.url));
const RESEARCH_SOURCE_COMMIT=(()=>{
  try{
    const commit=execFileSync('git',['rev-parse','HEAD'],{
      cwd:ROOT,encoding:'utf8',timeout:2000,stdio:['ignore','pipe','ignore']
    }).trim();
    return /^[a-f0-9]{40}$/i.test(commit)?commit:null;
  }catch{return null;}
})();
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
    case 'momentum': return {file:'backtest/agents/run-render-indicator-pilot.mjs',
      args:['momentum',join(folder,'data')],env:{}};
    case 'speed': return {file:'backtest/agents/run-render-indicator-pilot.mjs',
      args:['speed',join(folder,'data')],env:{}};
    case 'cipher': return isFiveByFive()
      ? {file:'backtest/agents/run-cj-cipher-five-by-five.mjs',
        args:[join(folder,'data'),join(folder,'cipher')],env:{}}
      : {file:'backtest/agents/run-cj-cipher-pilot.mjs',
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
  // Research children use public Bitunix only; keep DB secrets in supervisor.
  delete env.DATABASE_URL;
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
        consistencyStatus:c.consistencyStatus,sha256:c.sha256,status:c.status,
        reason:c.reason??null,anchorBars:c.anchorBars??null,recovered:c.recovered===true,
        failureDetails:c.failureDetails??null
      })),assessment};
    }catch(err){
      status='BLOCKED';evidence={...evidence,assessment:{reason:String(err?.message??err)}};
    }
  }
  if(agent.id==='momentum'||agent.id==='speed'){
    try{
      const summary=JSON.parse(await readFile(
        join(outFolder(slot),'data',agent.id+'-render-summary.json'),'utf8'));
      const count=isFiveByFive()?25:9;
      const expected=agent.id==='momentum'
        ?'MOMENTUM_FUSION_'+count+'_DOUBLE_READ_CASES_READY'
        :'SPEED_V3_'+count+'_DOUBLE_READ_CASES_READY';
      const ok=summary.kind===agent.id&&summary.status===expected &&
        summary.passed===count&&summary.blocked===0&&summary.cases?.length===count &&
        summary.cases.every(c=>c.status==='VALIDATED_RESEARCH_ONLY'&&
          /^[a-f0-9]{64}$/i.test(c.sourceSha256??'')&&
          Number.isSafeInteger(c.closingEndTime)&&
          c.evidence?.sampledPrefixChecks===3);
      status=(status==='EXECUTED_RESEARCH_ONLY'&&ok)
        ?status:'BLOCKED';
      evidence={...evidence,summary:{protocol:summary.protocol,
        status:summary.status,cases:summary.cases?.length??0,
        passed:summary.passed,blocked:summary.blocked,
        descriptiveResults:summary.cases.map(c=>({
          symbol:c.symbol,timeframe:c.timeframe,status:c.status,
          evidence:c.evidence,sourceSha256:c.sourceSha256
        }))}};
    }catch(err){
      status='BLOCKED';evidence={...evidence,
        reason:'MISSING_OR_INVALID_SPECIALIST_SUMMARY',
        message:String(err?.message??err)};
    }
  }
  if(agent.id==='vector' || agent.id==='cipher'){
    try {
      const file=agent.id==='vector'
        ? join(outFolder(slot),'data','vector-v11-summary.json')
        : join(outFolder(slot),'cipher','cj-cipher-pilot-summary.json');
      const summary=JSON.parse(await readFile(file,'utf8'));
      const cases=Array.isArray(summary.cases)?summary.cases:[];
      const expectedCount=isFiveByFive()?25:9;
      const accepted=agent.id==='vector'
        ? summary.status==='RESEARCH_SIGNAL_REPLAY_COMPLETE' &&
          cases.length===expectedCount && summary.passed===expectedCount && summary.blocked===0 &&
          summary.candidateComparisonsPassed===expectedCount && summary.candidateComparisonsBlocked===0
        : isFiveByFive()
          ? summary.status==='CIPHER_25_MARKETS_MTF_PILOT_COMPLETE' &&
            cases.length===25 && summary.validated===25 && summary.blocked===0
          : summary.status==='CIPHER_3_MARKETS_FIRST_PILOT_COMPLETE' &&
            cases.length===3 && summary.validated===3 && summary.blocked===0;
      status=(status==='EXECUTED_RESEARCH_ONLY' && accepted)?status:'BLOCKED';
      evidence={...evidence,summary:{protocol:summary.protocol,status:summary.status,
        cases:cases.length,passed:summary.passed??summary.validated,
        blocked:summary.blocked??null,metadataError:summary.metadataError??null,
        fatalError:summary.fatalError??null,
        caseMetrics:agent.id==='vector'?cases.map(x=>({
          symbol:x.symbol,timeframe:x.timeframe,status:x.status,
          signals:x.signals,holdoutTrades:x.holdoutTrades,
          trainingTrades:x.trainingTrades,v12Status:x.v12Status,
          noLookaheadPrefixChecks:x.noLookaheadPrefixChecks
        })):undefined}};
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
  await initializeArchive(db);
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
export async function hasVectorSourceFiles(slot,{accessImpl=access}={}){
  const dir=join(outFolder(slot),'data');
  for(const symbol of ['BTCUSDT','ETHUSDT','SOLUSDT']){
    for(const timeframe of ['15m','1h','4h']){
      for(const suffix of ['.json','-repeatability.json']){
        try{await accessImpl(join(dir,symbol+'-'+timeframe+suffix));}
        catch{return false;}
      }
    }
  }
  return true;
}

async function priorReports(db,slot) {
  const r=await db.query(
    "SELECT agent,status,exit_code,evidence FROM cj_agent_runs "+
    "WHERE slot=$1 AND agent <> 'diagnostics' ORDER BY agent",[slot]);
  return r.rows;
}

export function parseAllowedSpecialists(raw){
  if(typeof raw!=='string'||!raw.trim())return [];
  const ids=raw.split(',').map(s=>s.trim());
  const known=new Set(SPECIALISTS.map(x=>x.id));
  if(ids.some(id=>!known.has(id))||new Set(ids).size!==ids.length)
    throw Error('CJ_AGENT_ALLOWED_IDS must list distinct known specialists');
  return ids;
}

export async function runDueCycle(db,now=new Date(),{
  executor=executeResearchProcess,allowedIds=[],sourceFilesReady=hasVectorSourceFiles,
  archiveRun=archiveAgentArtifacts,capacityReader=archiveCapacity
}={}){
  if(!Array.isArray(allowedIds)||allowedIds.some(id=>!SPECIALISTS.some(a=>a.id===id)))
    throw Error('Invalid explicit specialist allowlist');
  const allow=new Set(allowedIds);
  const slot=utcSlot(now),completed=[];
  for(const agent of dueSpecialists(now).filter(a=>allow.has(a.id))){
    if(!(await claim(db,agent.id,slot)))continue;
    let result,refreshedInput=null,didExecute=false;
    try{
      if(['vector','momentum','speed'].includes(agent.id)){
        const data=await db.query(
          "SELECT status FROM cj_agent_runs WHERE agent='bitunix-data' AND slot=$1",[slot]);
        if(data.rows[0]?.status!=='DATA_READY_FOR_RESEARCH_ONLY'){
          result={status:'BLOCKED',evidence:{reason:'DEPENDENCY_BITUNIX_DATA_NOT_READY'}};
        }else if(!(await sourceFilesReady(slot))){
          // Render uses an ephemeral filesystem: the validated DB record can
          // outlive the actual candle files after a service deployment.
          // Rehydrate ONLY from fresh, independently verified public candles.
          // The old DB data result is not treated as authorization to skip checks.
          const dataAgent=SPECIALISTS.find(a=>a.id==='bitunix-data');
          refreshedInput=await executor(dataAgent,slot);
          if(refreshedInput.status!=='DATA_READY_FOR_RESEARCH_ONLY'){
            result={status:'BLOCKED',
              evidence:{reason:'RESEARCH_INPUT_REHYDRATION_FAILED',
                rehydrationStatus:refreshedInput.status}};
          }
        }
      }
      if(!result && agent.id==='diagnostics'){
        const reports=await priorReports(db,slot);
        const audit=summarizeDiagnostics(reports);
        const cleanupAllowed=reports.length===5 &&
          reports.every(r=>r.status!=='RUNNING' &&
            r.evidence?.reason!=='ARCHIVE_PERSISTENCE_FAILED');
        result={status:'EXECUTED_RESEARCH_ONLY',evidence:{
          ...audit,storage:await capacityReader(db),cleanupAllowed}};
      }else if(!result){
        didExecute=true;
        result=await executor(agent,slot);
      }
    }catch(error){
      result={status:'BLOCKED',evidence:{reason:'UNHANDLED_RESEARCH_ERROR',
        message:String(error?.message??error)}};
    }
    // The process finishing is not a success until every emitted report is
    // archived in PostgreSQL and its manifest read back inside a transaction.
    if(didExecute){
      try {
        const successful=['EXECUTED_RESEARCH_ONLY','DATA_READY_FOR_RESEARCH_ONLY']
          .includes(result.status);
        const receipt=await archiveRun(db,agent.id,slot,{requireSummary:successful});
        result.evidence={...result.evidence,archive:receipt};
      }catch(e){
        result={status:'BLOCKED',evidence:{...result?.evidence,
          preArchiveStatus:result?.status??null,
          reason:'ARCHIVE_PERSISTENCE_FAILED',
          archiveError:String(e?.message??e).slice(0,220)}};
      }
    }
    if(refreshedInput&&result?.status==='EXECUTED_RESEARCH_ONLY'){
      result.evidence={...result.evidence,sourceRehydrated:true,
        rehydrationChecks:refreshedInput.evidence?.checks?.map(
          x=>({symbol:x.symbol,timeframe:x.timeframe,sha256:x.sha256,status:x.status})
        )??[]};
    }
    result.evidence={...result.evidence,researchSourceCommit:RESEARCH_SOURCE_COMMIT};
    await record(db,agent.id,slot,result);
    // Postgres now holds the complete per-hour research output. Avoid slowly
    // filling the ephemeral Render filesystem with yesterday's scratch files.
    // Never clear scratch when any archival failure remains unresolved.
    if(agent.id==='diagnostics' && result.status==='EXECUTED_RESEARCH_ONLY'&&
       result.evidence?.cleanupAllowed){
      try{await rm(outFolder(slot),{recursive:true,force:true});}
      catch(err){console.error('CJ_ARCHIVE_SCRATCH_CLEANUP_FAILED '+
        String(err?.message??err).slice(0,180));}
    }
    completed.push({agent:agent.id,status:result.status,
      elapsedMs:result.evidence?.elapsedMs??null,
      totalChecks:Array.isArray(result.evidence?.checks)?result.evidence.checks.length:null,
      passedChecks:Array.isArray(result.evidence?.checks)
        ?result.evidence.checks.filter(x=>x.status==='DATA_READY_FOR_RESEARCH_ONLY').length:null,
      reason:result.evidence?.assessment?.reason??result.evidence?.reason??null,
      failedChecks:result.evidence?.checks?.filter(x=>x.status!=='DATA_READY_FOR_RESEARCH_ONLY').map(({symbol,timeframe,reason,failureDetails,anchorBars})=>({symbol,timeframe,reason,failureDetails,anchorBars}))??null,
      recoveredChecks:result.evidence?.checks?.filter(x=>x.recovered).map(({symbol,timeframe,anchorBars})=>({symbol,timeframe,anchorBars}))??null,
      sourceRehydrated:result.evidence?.sourceRehydrated??false,
      totalCases:result.evidence?.summary?.cases??null,
      passedCases:result.evidence?.summary?.passed??null,
      archiveFiles:result.evidence?.archive?.files??null,
      databaseBytes:result.evidence?.storage?.dbBytes??null,
      databaseWarning:result.evidence?.storage?.warning??null});
  }
  return {slot,completed};
}

export async function main(){
  if(process.env.CJ_AGENT_RUNTIME_ENABLED!=='1')
    throw Error('Set CJ_AGENT_RUNTIME_ENABLED=1 only after deployment approval');
  const allowedIds=parseAllowedSpecialists(process.env.CJ_AGENT_ALLOWED_IDS);
  if(allowedIds.length===0)
    throw Error('No specialist explicitly enabled: set CJ_AGENT_ALLOWED_IDS');
  console.log('CJ_AGENT_ALLOWED_IDS '+allowedIds.join(','));
  const db=await initializeDb();
  let busy=false,lastCycle=null,lastError=null;
  const tick=async()=>{
    if(busy)return;
    busy=true;
    try {
      const r=await runDueCycle(db,new Date(),{allowedIds});
      lastCycle=r.slot;lastError=null;
      for(const outcome of r.completed){
        console.log('CJ_AGENT '+JSON.stringify(outcome));
        if(outcome.databaseBytes!==null)
          console.log('CJ_ARCHIVE_CAPACITY '+JSON.stringify({
            usedBytes:outcome.databaseBytes,warning:outcome.databaseWarning}));
      }
      // Run the historical bridge ONLY once after an actual diagnostics slot.
      // Its failures cannot change prior agent statuses or the next hourly run.
      if(r.completed.some(x=>x.agent==='diagnostics') &&
        process.env.CJ_HISTORICAL_BRIDGE_ENABLED==='1'){
        try{
          const report=await runHistoricalBridgeIfEnabled(db);
          console.log('CJ_HISTORICAL_BRIDGE '+JSON.stringify(report));
        }catch(err){
          console.error('CJ_HISTORICAL_BRIDGE_ERROR '+
            String(err?.message??err).slice(0,220));
        }
      }
      // Historical backfill remains OFF unless explicitly enabled. Its
      // own bounded workload never authorizes indicator code promotion.
      if(r.completed.some(x=>x.agent==='diagnostics') &&
        process.env.CJ_HISTORICAL_BACKFILL_ENABLED==='1'){
        try{
          const count=Number(process.env.CJ_HISTORICAL_BACKFILL_BATCH??3);
          const report=await runHistoricalBackfillBatch(db,{limit:count});
          console.log('CJ_HISTORICAL_BACKFILL '+JSON.stringify(report));
        }catch(err){
          console.error('CJ_HISTORICAL_BACKFILL_ERROR '+
            String(err?.message??err).slice(0,220));
        }
      }
      // Five-indicator two-year replay is opt-in. A pair MUST have every
      // closed bar, verified SHA and official Bitunix price precision.
      // No automatic strategy optimization, trading or change to main.
      if(r.completed.some(x=>x.agent==='diagnostics') &&
        process.env.CJ_HISTORICAL_REPLAY_ENABLED==='1'){
        try{
          const report=await runEligibleMultiYearReplay(db,{maxPairs:1});
          console.log('CJ_HISTORICAL_REPLAY '+JSON.stringify(report));
        }catch(err){
          console.error('CJ_HISTORICAL_REPLAY_ERROR '+
            String(err?.message??err).slice(0,220));
        }
      }
      if(r.completed.some(x=>x.agent==='diagnostics') && process.env.CJ_AUTONOMOUS_EXPERIMENTS_ENABLED==='1'){
        try{console.log('CJ_AUTONOMOUS_EXPERIMENT '+JSON.stringify(await runAutonomousExperiment(db)));}
        catch(e){console.error('CJ_AUTONOMOUS_EXPERIMENT_ERROR '+String(e?.message??e).slice(0,180));}
      }
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
  // Optional ONE guarded bootstrap pass on redeploy, for initial validation.
  // Independent of hourly agent status; never blocks the public API listener.
  if(process.env.CJ_HISTORICAL_BRIDGE_ENABLED==='1' &&
    process.env.CJ_HISTORICAL_BRIDGE_BOOTSTRAP_ON_START==='1'){
    try{
      const report=await runHistoricalBridgeIfEnabled(db);
      console.log('CJ_HISTORICAL_BRIDGE_BOOTSTRAP '+JSON.stringify(report));
    }catch(err){
      console.error('CJ_HISTORICAL_BRIDGE_BOOTSTRAP_ERROR '+
        String(err?.message??err).slice(0,220));
    }
  }
  if(process.env.CJ_HISTORICAL_BACKFILL_ENABLED==='1' &&
    process.env.CJ_HISTORICAL_BACKFILL_BOOTSTRAP_ON_START==='1'){
    try{
      const count=Number(process.env.CJ_HISTORICAL_BACKFILL_BATCH??3);
      const report=await runHistoricalBackfillBatch(db,{limit:count});
      console.log('CJ_HISTORICAL_BACKFILL_BOOTSTRAP '+JSON.stringify(report));
    }catch(err){
      console.error('CJ_HISTORICAL_BACKFILL_BOOTSTRAP_ERROR '+
        String(err?.message??err).slice(0,220));
    }
  }
  // One bounded pass for legacy provenance failures after the new anchor
  // method is deployed. Persisted per-window marker makes restarts idempotent.
  // No normal backfill work here; keep the hourly schedule and quota intact.
  if(process.env.CJ_HISTORICAL_BACKFILL_ENABLED==='1'&&!busy){
    busy=true;
    try{
      const report=await runHistoricalBackfillBatch(db,{limit:10,repairOnly:true});
      console.log('CJ_HISTORICAL_BACKFILL_ANCHOR_REPAIR '+JSON.stringify(report));
    }catch(err){
      console.error('CJ_HISTORICAL_BACKFILL_ANCHOR_REPAIR_ERROR '+String(err?.message??err).slice(0,220));
    }finally{busy=false;}
  }
  if(process.env.CJ_AUTONOMOUS_EXPERIMENTS_ENABLED==='1'&&!busy){
    busy=true;
    try{console.log('CJ_AUTONOMOUS_EXPERIMENT_BOOTSTRAP '+JSON.stringify(await runAutonomousExperiment(db)));}
    catch(e){console.error('CJ_AUTONOMOUS_EXPERIMENT_ERROR '+String(e?.message??e).slice(0,180));}
    finally{busy=false;}
  }
  const stop=async()=>{clearInterval(timer);http?.close();await db.end();};
  process.once('SIGTERM',()=>{void stop();});
  process.once('SIGINT',()=>{void stop();});
}
if(process.argv[1] && fileURLToPath(import.meta.url)===fileURLToPath(new URL('file://'+process.argv[1]))) {
  main().catch(e=>{console.error('CJ_AGENT_FATAL '+String(e?.message??e));process.exitCode=1;});
}
