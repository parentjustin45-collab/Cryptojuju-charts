/* Bounded deterministic autonomous experiment queue, not an LLM.
 * Only immutable audited two-year training data. Never promote or edit code.
 * Lease prevents duplicate active claims across overlapping deployments.
 */
import {createHash,randomUUID} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {readFile} from 'node:fs/promises';
import {FIVE_CASES} from './five-by-five.mjs';
import {historicalTargetFor,loadHistoricalPeriod} from './historical-period.mjs';
import {experimentChannel,SPEC,CHANNELS} from './autonomous-rule-candidates.mjs';
import {storageState} from './storage-policy.mjs';
const VERSION=SPEC.version;
const hash=x=>createHash('sha256').update(x).digest('hex');
const require=(v,m)=>{if(!v)throw Error(m)};
const baseline=JSON.parse((await readFile(new URL('../../HISTORICAL_LIBRARY_FINAL_AUDIT_2026-11-27.md',import.meta.url),'utf8')).split('\x60\x60\x60json\n')[1].split('\n\x60\x60\x60')[0]);
const PRIOR='be19897265943f23e38bffe6f46fbbe770dc4624';
export function planJobs(){
 return [...FIVE_CASES].sort((a,b)=>['1d','4h','1h','30m','15m'].indexOf(a.timeframe)-['1d','4h','1h','30m','15m'].indexOf(b.timeframe)).flatMap(({symbol,timeframe})=>CHANNELS.map(channel=>({symbol,timeframe,channel,hypothesis:SPEC.candidates[channel],id:hash(JSON.stringify([VERSION,PRIOR,symbol,timeframe,channel]))})));
}
export function reviewResult(z){
 const totals=(mode,folds=z.folds)=>{let events=0,matched=0,eligible=0,samples=0,gross=0;for(const f of folds)for(const x of Object.values(f[mode])){events+=x.events;matched+=x.early+x.on+x.late;eligible+=x.eligible;samples+=x.samples;gross+=x.sumGrossBps;}return {events,matched,eligible,samples,precision:eligible?matched/eligible:null,meanGrossBps:samples?gross/samples:null};};
 const base=totals('baseline'),candidate=totals('candidate');
 const foldWins=z.folds.filter(f=>{const a=totals('baseline',[f]),b=totals('candidate',[f]);return a.samples>0&&b.samples>0&&b.meanGrossBps>a.meanGrossBps;}).length;
 const review=base.samples>=30&&candidate.samples>=30&&candidate.precision>=base.precision&&candidate.matched>=base.matched&&candidate.meanGrossBps>=base.meanGrossBps&&foldWins===3;
 return {status:review?'REVIEW_CANDIDATE_ONLY':'RETAIN_BASELINE_OR_INSUFFICIENT_EVIDENCE',base,candidate,foldWins,noPromotion:true,independentValidation:false};
}
export async function initializeAutonomousQueue(db){
 await db.query("CREATE TABLE IF NOT EXISTS cj_autonomous_experiments (id char(64) PRIMARY KEY,protocol text NOT NULL,symbol text NOT NULL,timeframe text NOT NULL,channel text NOT NULL,hypothesis text NOT NULL,status text NOT NULL DEFAULT 'PENDING',attempts integer NOT NULL DEFAULT 0,lease_token text,lease_until timestamptz,priority integer NOT NULL,report text,report_sha256 char(64),error text,updated_at timestamptz NOT NULL DEFAULT now())");
 const jobs=planJobs().map((x,priority)=>({...x,priority}));
 await db.query("INSERT INTO cj_autonomous_experiments(id,protocol,symbol,timeframe,channel,hypothesis,priority) SELECT id,$2,symbol,timeframe,channel,hypothesis,priority FROM jsonb_to_recordset($1::jsonb) AS j(id text,symbol text,timeframe text,channel text,hypothesis text,priority int) ON CONFLICT(id) DO NOTHING",[JSON.stringify(jobs),VERSION]);
}
export async function runAutonomousExperiment(db,{memoryBudgetBytes=350*1024*1024}={}){
 if(process.memoryUsage().rss>memoryBudgetBytes)return {status:'PAUSED_MEMORY',noTrading:true};
 const size=await db.query('SELECT pg_database_size(current_database())::bigint AS bytes');
 if(storageState(Number(size.rows[0]?.bytes)).warning)return {status:'PAUSED_STORAGE',noTrading:true};
 await initializeAutonomousQueue(db);
 await db.query("UPDATE cj_autonomous_experiments SET status='BLOCKED',error='FINAL_LEASE_EXPIRED',lease_token=NULL,lease_until=NULL,updated_at=now() WHERE protocol=$1 AND status='RUNNING' AND attempts>=3 AND lease_until<=now()",[VERSION]);
 const token=randomUUID();
 const q=await db.query("WITH next AS (SELECT id FROM cj_autonomous_experiments WHERE protocol=$1 AND attempts<3 AND (status='PENDING' OR (status IN ('RUNNING','RETRY') AND lease_until<=now())) ORDER BY priority FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE cj_autonomous_experiments j SET status='RUNNING',attempts=attempts+1,lease_token=$2,lease_until=now()+interval '15 minutes',updated_at=now() FROM next WHERE j.id=next.id RETURNING trim(j.id) AS id,j.symbol,j.timeframe,j.channel,j.hypothesis,j.attempts",[VERSION,token]);
 const j=q.rows[0];
 if(!j){
  const z=await db.query("SELECT status,count(*)::int AS n FROM cj_autonomous_experiments WHERE protocol=$1 GROUP BY status",[VERSION]);return {status:'NO_DUE_EXPERIMENT',counts:z.rows,noTrading:true};
 }
 try{
  const {symbol,timeframe,channel}=j,target=historicalTargetFor(symbol,timeframe),receipt=baseline.pairs.find(x=>x.symbol===symbol&&x.timeframe===timeframe);
  require(receipt&&baseline.status==='PASS','BASELINE_REQUIRED');
  const src=await loadHistoricalPeriod(db,{symbol,timeframe,...target});
  require(src.sequenceSha256===receipt.sourceSequenceSha256&&src.barCount===receipt.bars,'SOURCE_MISMATCH');
  const r=await db.query('SELECT report_gzip,raw_bytes,report_sha256 FROM cj_multiyear_replay_reports WHERE symbol=$1 AND timeframe=$2 AND period_start_ms=$3 AND period_end_ms=$4 AND engine_version=$5',[symbol,timeframe,target.startMs,target.endMs,'CJ_FIVE_INDICATOR_TWO_YEAR_REPLAY_V1_20261124']);
  require(r.rowCount===1,'REPORT_MISSING');const row=r.rows[0],raw=gunzipSync(row.report_gzip,{maxOutputLength:16*1024*1024});
  require(raw.length===Number(row.raw_bytes)&&hash(raw)===receipt.reportSha256&&hash(raw)===String(row.report_sha256).trim(),'REPORT_HASH_MISMATCH');
  const report=JSON.parse(raw);
  require(report.holdoutStartTime===src.candles[Math.floor(src.barCount*.7)].time,'TRAINING_BOUNDARY_MISMATCH');
  const experiment=experimentChannel(channel,src.candles,report),review=reviewResult(experiment);
  const evidence={protocol:VERSION,job:j.id,symbol,timeframe,channel,hypothesis:j.hypothesis,priorCommit:PRIOR,sourceSha256:src.sequenceSha256,baselineReportSha256:receipt.reportSha256,experiment,review,holdoutUsed:false,noTrading:true};
  const body=JSON.stringify(evidence);
  require(body.length<=1000000,'REPORT_TOO_LARGE');
  const cap=await db.query('SELECT pg_database_size(current_database())::bigint AS bytes');
  require(!storageState(Number(cap.rows[0]?.bytes),undefined,Buffer.byteLength(body)).warning,'CAPACITY_GUARD');
  const save=await db.query("UPDATE cj_autonomous_experiments SET status='COMPLETED',report=$3,report_sha256=$4,lease_token=NULL,lease_until=NULL,error=NULL,updated_at=now() WHERE id=$1 AND lease_token=$2 AND status='RUNNING' RETURNING id",[j.id,token,body,hash(body)]);
  require(save.rowCount===1,'LEASE_LOST');
  return {status:'COMPLETED',symbol,timeframe,channel,hypothesis:j.hypothesis,review,reportSha256:hash(body),prefixChecks:experiment.prefixChecks,noTrading:true};
 }catch(e){
  const reason=String(e?.message??e).slice(0,180);
  await db.query("UPDATE cj_autonomous_experiments SET status=CASE WHEN attempts>=3 THEN 'BLOCKED' ELSE 'RETRY' END,error=$3,lease_token=NULL,lease_until=now()+interval '1 hour',updated_at=now() WHERE id=$1 AND lease_token=$2",[j.id,token,reason]);
  return {status:'FAILED',symbol:j.symbol,timeframe:j.timeframe,channel:j.channel,reason,noTrading:true};
 }
}
