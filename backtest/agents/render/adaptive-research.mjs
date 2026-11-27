/* Evidence-driven, bounded adaptive research. NOT an LLM or code-writing agent.
 * Only audited Bitunix training data; Binance and older/forward holdout locked.
 * One new hypothesis per completed V4 result, deduplicated by parent hash.
 */
import {createHash,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {RULES,experimentChannel,SPEC} from './autonomous-rule-candidates.mjs';
import {reviewResult,planJobs} from './autonomous-experiment-worker.mjs';
import {historicalTargetFor,loadHistoricalPeriod} from './historical-period.mjs';
import {storageState} from './storage-policy.mjs';
export const VERSION='CJ_ADAPTIVE_RESEARCH_V1_20261127',SOURCE='Bitunix';
const hash=x=>createHash('sha256').update(x).digest('hex');
const need=(x,m)=>{if(!x)throw Error(m)};
const audit=JSON.parse((await readFile(new URL('../../HISTORICAL_LIBRARY_FINAL_AUDIT_2026-11-27.md',import.meta.url),'utf8')).split('\x60\x60\x60json\n')[1].split('\n\x60\x60\x60')[0]);
const planned=new Map(planJobs().map(x=>[x.id,x]));
const finite=x=>typeof x==='number'&&Number.isFinite(x);
export function chooseHypothesis(channel,review,experiment){
 const rule=RULES[channel];need(rule&&review?.base&&review?.candidate&&experiment?.folds?.length===3,'BAD_EVIDENCE');
 const a=review.base,b=review.candidate;
 for(const x of [a,b])need(['events','matched','eligible','samples'].every(k=>Number.isSafeInteger(x[k])&&x[k]>=0)&&x.matched<=x.eligible&&x.samples===x.eligible&&(x.precision===null||finite(x.precision))&&(x.meanGrossBps===null||finite(x.meanGrossBps)),'BAD_METRICS');
 if(a.samples<10||b.samples<10)return {status:'INSUFFICIENT_PARENT_SAMPLE'};
 const precisionDelta=b.precision-a.precision,matchDelta=(b.matched-a.matched)/Math.max(1,a.matched),grossDelta=b.meanGrossBps-a.meanGrossBps;
 const warnings=experiment.warningStats,warningRate=warnings?.tested>0?warnings.confirmed/warnings.tested:null;
 let direction,reason;
 if(warningRate!==null&&warningRate<.8){direction='stricter';reason='WARNING_CONFIRMATION_BELOW_80_PERCENT';}
 else if(precisionDelta<-.02&&matchDelta>=-.05){direction='stricter';reason='PRECISION_LOSS';}
 else if(matchDelta<-.05){direction='looser';reason='PIVOT_COVERAGE_LOSS';}
 else if(b.events===a.events&&b.matched===a.matched&&grossDelta===0){direction='looser';reason='NO_OBSERVED_EFFECT';}
 else if(grossDelta<0){direction='stricter';reason='GROSS_FORWARD_RETURN_DETERIORATION';}
 else {direction='looser';reason='EXPLORE_COVERAGE_WHILE_MONITORING_PRECISION';}
 const sign=(direction==='stricter'?1:-1)*rule.strict,options=rule.grid.filter(v=>Math.sign(v-rule.anchor)===sign).sort((a,b)=>Math.abs(a-rule.anchor)-Math.abs(b-rule.anchor));
 need(options.length>0,'NO_ALLOWED_HYPOTHESIS');
 return {status:'HYPOTHESIS',channel,source:SOURCE,anchor:rule.anchor,threshold:options[0],direction,reason,evidence:{precisionDelta,matchDelta,grossDelta,warningRate,foldWins:review.foldWins,samples:b.samples},holdoutUsed:false,noPromotion:true};
}
export async function initializeAdaptive(db){
 await db.query("CREATE TABLE IF NOT EXISTS cj_adaptive_research (id char(64) PRIMARY KEY,parent_id char(64) UNIQUE NOT NULL REFERENCES cj_autonomous_experiments(id),parent_sha256 char(64) NOT NULL,source text NOT NULL CHECK(source='Bitunix'),symbol text NOT NULL,timeframe text NOT NULL,channel text NOT NULL,proposal text NOT NULL,status text NOT NULL,attempts int NOT NULL DEFAULT 0,lease_token text,lease_until timestamptz,report text,report_sha256 char(64),error text,updated_at timestamptz NOT NULL DEFAULT now())");
}
export function verifiedParent(row){
 const id=String(row.id).trim(),p=planned.get(id);need(p&&hash(row.report)===String(row.report_sha256).trim(),'PARENT_SHA_MISMATCH');
 const e=JSON.parse(row.report),receipt=audit.pairs.find(x=>x.symbol===p.symbol&&x.timeframe===p.timeframe);
 need(e.protocol===SPEC.version&&e.job===id&&e.symbol===p.symbol&&e.timeframe===p.timeframe&&e.channel===p.channel&&e.holdoutUsed===false&&e.noTrading===true&&e.sourceSha256===receipt.sourceSequenceSha256&&e.baselineReportSha256===receipt.reportSha256,'PARENT_PROVENANCE_MISMATCH');
 const review=reviewResult(e.experiment);need(JSON.stringify(review)===JSON.stringify(e.review),'PARENT_REVIEW_MISMATCH');
 return {id,e,receipt,proposal:chooseHypothesis(p.channel,review,e.experiment)};
}
export async function runAdaptiveResearch(db){
 if(process.memoryUsage().rss>350*1024*1024)return {status:'PAUSED_MEMORY'};
 const cap=await db.query('SELECT pg_database_size(current_database())::bigint AS bytes');if(storageState(Number(cap.rows[0]?.bytes)).warning)return {status:'PAUSED_STORAGE'};
 await initializeAdaptive(db);
 const q=await db.query("SELECT trim(p.id) AS id,p.report,trim(p.report_sha256) AS report_sha256 FROM cj_autonomous_experiments p LEFT JOIN cj_adaptive_research a ON a.parent_id=p.id WHERE p.protocol=$1 AND p.status='COMPLETED' AND a.id IS NULL ORDER BY p.priority LIMIT 8",[SPEC.version]);
 let proposed=0;
 for(const row of q.rows){
  const parent=verifiedParent(row),{e,proposal}=parent,id=hash(JSON.stringify([VERSION,parent.id,row.report_sha256,proposal]));
  const save=await db.query("INSERT INTO cj_adaptive_research(id,parent_id,parent_sha256,source,symbol,timeframe,channel,proposal,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(parent_id) DO NOTHING",[id,parent.id,row.report_sha256,SOURCE,e.symbol,e.timeframe,e.channel,JSON.stringify(proposal),proposal.status==='HYPOTHESIS'?'PENDING':'SKIPPED']);
  proposed+=save.rowCount;
 }
 await db.query("UPDATE cj_adaptive_research SET status='BLOCKED',error='FINAL_LEASE_EXPIRED',lease_token=NULL,lease_until=NULL WHERE status='RUNNING' AND attempts>=3 AND lease_until<=now()");
 const token=randomUUID(),j=(await db.query("WITH next AS (SELECT id FROM cj_adaptive_research WHERE attempts<3 AND (status='PENDING' OR (status IN ('RUNNING','RETRY') AND lease_until<=now())) ORDER BY updated_at,id FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE cj_adaptive_research a SET status='RUNNING',attempts=attempts+1,lease_token=$1,lease_until=now()+interval '15 minutes',updated_at=now() FROM next WHERE a.id=next.id RETURNING a.*",[token])).rows[0];
 if(!j)return {status:'NO_DUE_ADAPTIVE',proposed,counts:(await db.query("SELECT status,count(*)::int AS n FROM cj_adaptive_research GROUP BY status")).rows,noTrading:true};
 try{
  const p=(await db.query("SELECT trim(id) AS id,report,trim(report_sha256) AS report_sha256 FROM cj_autonomous_experiments WHERE id=$1 AND status='COMPLETED'",[j.parent_id])).rows[0],parent=verifiedParent(p);
  const {e,receipt,proposal}=parent;
  need(j.source===SOURCE&&j.symbol===e.symbol&&j.timeframe===e.timeframe&&j.channel===e.channel&&String(j.parent_sha256).trim()===p.report_sha256&&j.proposal===JSON.stringify(proposal)&&String(j.id).trim()===hash(JSON.stringify([VERSION,parent.id,p.report_sha256,proposal])),'PROPOSAL_MISMATCH');
  const target=historicalTargetFor(j.symbol,j.timeframe),src=await loadHistoricalPeriod(db,{symbol:j.symbol,timeframe:j.timeframe,...target});
  need(src.sequenceSha256===receipt.sourceSequenceSha256&&src.barCount===receipt.bars,'SOURCE_SHA_MISMATCH');
  const r=await db.query("SELECT report_gzip,raw_bytes,report_sha256 FROM cj_multiyear_replay_reports WHERE symbol=$1 AND timeframe=$2 AND period_start_ms=$3 AND period_end_ms=$4 AND engine_version=$5",[j.symbol,j.timeframe,target.startMs,target.endMs,'CJ_FIVE_INDICATOR_TWO_YEAR_REPLAY_V1_20261124']);
  need(r.rowCount===1,'BASE_REPORT_REQUIRED');const raw=gunzipSync(r.rows[0].report_gzip,{maxOutputLength:16*1024*1024});
  need(raw.length===Number(r.rows[0].raw_bytes)&&hash(raw)===receipt.reportSha256&&hash(raw)===String(r.rows[0].report_sha256).trim(),'BASE_REPORT_SHA');
  const report=JSON.parse(raw);need(report.holdoutStartTime===src.candles[Math.floor(src.barCount*.7)].time,'TRAIN_BOUNDARY');
  const anchor=experimentChannel(j.channel,src.candles,report);need(JSON.stringify(anchor)===JSON.stringify(e.experiment),'V4_PARENT_REPLAY_MISMATCH');
  const experiment=experimentChannel(j.channel,src.candles,report,proposal.threshold),review=reviewResult(experiment);
  const a=e.review.candidate,b=review.candidate,delta={matched:b.matched-a.matched,precision:b.precision===null||a.precision===null?null:b.precision-a.precision,grossBps:b.meanGrossBps===null||a.meanGrossBps===null?null:b.meanGrossBps-a.meanGrossBps};
  const better=review.status==='REVIEW_CANDIDATE_ONLY'&&b.samples>=30&&delta.matched>=0&&delta.precision!==null&&delta.precision>=0&&delta.grossBps!==null&&delta.grossBps>=0&&(delta.matched>0||delta.precision>0||delta.grossBps>0);
  const decision=better?'HUMAN_REVIEW_ONLY':'RETAIN_ORIGINAL_AND_ARCHIVE_COUNTEREVIDENCE';
  const evidence={protocol:VERSION,source:SOURCE,symbol:j.symbol,timeframe:j.timeframe,channel:j.channel,parentId:parent.id,parentSha256:p.report_sha256,sourceSha256:src.sequenceSha256,proposal,experiment,review,delta,decision,holdoutUsed:false,noPromotion:true,noTrading:true};
  const body=JSON.stringify(evidence),cap=await db.query('SELECT pg_database_size(current_database())::bigint AS bytes');
  need(body.length<1000000&&!storageState(Number(cap.rows[0]?.bytes),undefined,Buffer.byteLength(body)).warning,'CAPACITY_GUARD');
  const saved=await db.query("UPDATE cj_adaptive_research SET status='COMPLETED',report=$3,report_sha256=$4,error=NULL,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1 AND lease_token=$2 AND status='RUNNING' RETURNING id",[j.id,token,body,hash(body)]);
  need(saved.rowCount===1,'LEASE_LOST');return {status:'COMPLETED',source:SOURCE,symbol:j.symbol,timeframe:j.timeframe,channel:j.channel,proposal,delta,decision,reportSha256:hash(body),prefixChecks:experiment.prefixChecks,noTrading:true};
 }catch(e){const reason=String(e.message).slice(0,200);await db.query("UPDATE cj_adaptive_research SET status=CASE WHEN attempts>=3 THEN 'BLOCKED' ELSE 'RETRY' END,error=$3,lease_token=NULL,lease_until=now()+interval '1 hour',updated_at=now() WHERE id=$1 AND lease_token=$2",[j.id,token,reason]);return {status:'FAILED',reason,noTrading:true};}
}
