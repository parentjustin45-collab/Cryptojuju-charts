/* Level 5.3: execute only validated declarative diagnostic tags.
 * No generated JS, external requests, changes to signals or trading.
 * One bounded job per pass, audited data and transactional deduplication.
 */
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {verifiedParent} from './adaptive-research.mjs';
import {buildPacket,validateProposal,requestBody} from './llm-research.mjs';
import {compileRule,validateNewRule,readFeedback} from './level5-rule-contract.mjs';
import {generate,experimentChannel} from './autonomous-rule-candidates.mjs';
import {stratifyFold,evaluate} from './level5-vector-diagnostic.mjs';
import {atr14,findPivots} from './state-pivot-observer.mjs';
import {historicalTargetFor,loadHistoricalPeriod} from './historical-period.mjs';
import {storageState} from './storage-policy.mjs';
export const VERSION='CJ_L5_STRUCTURED_EXECUTION_V1';
export const PILOT_TIMEFRAMES=['1d','4h','1h'];
const hash=x=>createHash('sha256').update(x).digest('hex'),need=(x,m)=>{if(!x)throw Error(m)};
const trim=x=>String(x??'').trim(),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function verifyStructuredResult(row,packet,liveFeedback=[]){
 need(hash(row.result)===trim(row.result_sha)&&hash(row.packet)===trim(row.packet_sha)&&hash(JSON.stringify(packet))===trim(row.packet_sha),'RESULT_PROVENANCE');
 const result=JSON.parse(row.result),proposal=validateProposal(result.proposal);
 need(result.packetSha256===trim(row.packet_sha)&&result.source===packet.source&&result.channel===packet.channel&&result.status==='HUMAN_REVIEW_ONLY'&&result.noExecution===true&&result.noPromotion===true&&result.noTrading===true&&Array.isArray(result.feedback),'RESULT_POLICY');
 const review=validateNewRule(result.experimentRule,packet,result.feedback);
 need(same(review,result.ruleReview)&&hash(JSON.stringify(requestBody(packet,{structured:true,feedback:result.feedback})))===result.requestSha256,'REVIEW_PROVENANCE');
 need(review.rule.kind==='NONE'||proposal.kind==='DIAGNOSTIC_ONLY','DIAGNOSTIC_ONLY');
 const duplicate=review.rule.kind!=='NONE'&&liveFeedback.some(x=>x.ruleId===review.ruleId);
 return {...review,duplicate,proposalKind:proposal.kind};
}
export function runDiagnostic({channel,bars,priceStep,rule}){
 need(bars.length>=150&&bars.length<=14000,'TRAINING_SIZE');
 const tag=compileRule(rule),original=generate(channel,bars,priceStep,false),parent=generate(channel,bars,priceStep,true);
 const n=bars.length,cuts=[0,Math.floor(n/3),Math.floor(n*2/3),n],atr=atr14(bars),positions=new Map(bars.map((b,i)=>[b.time,i])),folds=[];
 for(const cut of cuts.slice(1,3)){
  const prefix=bars.slice(0,cut);
  for(const mode of [original,parent])for(const e of mode.signals){const i=positions.get(e.time);if(i<cut)need(tag(prefix,i,e.side)===tag(bars,i,e.side),'TAG_PREFIX_PARITY');}
 }
 for(let i=0;i<3;i++){const start=cuts[i],end=cuts[i+1],pivots=findPivots(bars,atr,start,end);folds.push({fold:i+1,startTime:bars[start].time,endTime:bars[end-1].time,original:stratifyFold(bars,atr,positions,pivots,original,start,end,tag),parent:stratifyFold(bars,atr,positions,pivots,parent,start,end,tag)});}
 return {folds,evaluation:evaluate(folds),noSignalChanges:true,noPromotion:true,noTrading:true,holdoutUsed:false};
}
export async function runStructuredExecution(db){
 if(process.memoryUsage().rss>350*1024*1024)return {status:'PAUSED_MEMORY'};
 const cap=await db.query('SELECT pg_database_size(current_database())::bigint AS bytes');if(storageState(Number(cap.rows[0]?.bytes)).warning)return {status:'PAUSED_STORAGE'};
 const c=await db.connect();let attemptId=null;
 try{
  await c.query('BEGIN');
  const lock=await c.query("SELECT pg_try_advisory_xact_lock(hashtext('CJ_LEVEL5_STRUCTURED_V1')) AS locked");
  if(!lock.rows[0].locked){await c.query('ROLLBACK');return {status:'BUSY'};}
  await c.query("CREATE TABLE IF NOT EXISTS cj_llm_structured_executions (attempt_id char(64) PRIMARY KEY,rule_id char(64),status text NOT NULL,report text,report_sha256 char(64),error text,created_at timestamptz NOT NULL DEFAULT now())");
  const q=await c.query("SELECT trim(l.id) AS attempt_id,l.result,trim(l.result_sha256) AS result_sha,l.packet,trim(l.packet_sha256) AS packet_sha,trim(a.id) AS adaptive_id,a.report AS adaptive_report,trim(a.report_sha256) AS adaptive_sha,trim(p.id) AS parent_id,p.report AS parent_report,trim(p.report_sha256) AS parent_sha FROM cj_llm_research_attempts l JOIN cj_adaptive_research a ON a.id=l.parent_id JOIN cj_autonomous_experiments p ON p.id=a.parent_id LEFT JOIN cj_llm_structured_executions x ON x.attempt_id=l.id WHERE l.status='HUMAN_REVIEW_ONLY' AND a.status='COMPLETED' AND p.status='COMPLETED' AND a.timeframe=ANY($1::text[]) AND l.result::jsonb ? 'experimentRule' AND x.attempt_id IS NULL ORDER BY l.created_at,l.id LIMIT 1",[PILOT_TIMEFRAMES]);
  if(!q.rowCount){await c.query('COMMIT');return {status:'NO_ELIGIBLE_STRUCTURED_RULE',timeframes:PILOT_TIMEFRAMES};}
  const row=q.rows[0];await c.query('SAVEPOINT structured_job');attemptId=row.attempt_id;
  const packet=buildPacket(row),review=verifyStructuredResult(row,packet,await readFeedback(c,packet));
  const dup=await c.query("SELECT 1 FROM cj_llm_structured_executions WHERE rule_id=$1 AND status='COMPLETED' LIMIT 1",[review.ruleId]);
  if(review.rule.kind==='NONE'||review.duplicate||dup.rowCount){
   const status=review.rule.kind==='NONE'?'SKIPPED_NO_RULE':'SKIPPED_DUPLICATE';
   await c.query('INSERT INTO cj_llm_structured_executions(attempt_id,rule_id,status) VALUES($1,$2,$3)',[attemptId,review.ruleId,status]);await c.query('COMMIT');return {status,channel:packet.channel,ruleId:review.ruleId};
  }
  const {e,receipt}=verifiedParent({id:row.parent_id,report:row.parent_report,report_sha256:row.parent_sha});
  need(receipt.bars<=18000,'PILOT_BAR_LIMIT');
  const target=historicalTargetFor(packet.symbol,packet.timeframe),src=await loadHistoricalPeriod(c,{symbol:packet.symbol,timeframe:packet.timeframe,...target});
  need(src.sequenceSha256===receipt.sourceSequenceSha256&&src.barCount===receipt.bars&&src.sequenceSha256===packet.sourceSha256,'SOURCE_SHA');
  const rq=await c.query('SELECT report_gzip,raw_bytes,report_sha256 FROM cj_multiyear_replay_reports WHERE symbol=$1 AND timeframe=$2 AND period_start_ms=$3 AND period_end_ms=$4 AND engine_version=$5',[packet.symbol,packet.timeframe,target.startMs,target.endMs,'CJ_FIVE_INDICATOR_TWO_YEAR_REPLAY_V1_20261124']);
  need(rq.rowCount===1,'BASE_REPORT_REQUIRED');const rr=rq.rows[0],raw=gunzipSync(rr.report_gzip,{maxOutputLength:16*1024*1024});
  need(raw.length===Number(rr.raw_bytes)&&hash(raw)===receipt.reportSha256&&hash(raw)===trim(rr.report_sha256),'BASE_REPORT_SHA');
  const archive=JSON.parse(raw),n=Math.floor(src.barCount*.7),bars=src.candles.slice(0,n);
  need(archive.holdoutStartTime===src.candles[n].time,'TRAIN_BOUNDARY');
  need(JSON.stringify(experimentChannel(packet.channel,src.candles,archive))===JSON.stringify(e.experiment),'PARENT_REPLAY');
  const diagnostic=runDiagnostic({channel:packet.channel,bars,priceStep:archive.priceStep,rule:review.rule});
  const report={version:VERSION,attemptId,proposalSha256:row.result_sha,packetSha256:row.packet_sha,ruleId:review.ruleId,rule:review.rule,source:packet.source,sourceSha256:packet.sourceSha256,channel:packet.channel,symbol:packet.symbol,timeframe:packet.timeframe,trainingBars:n,holdoutBars:src.barCount-n,...diagnostic};
  const body=JSON.stringify(report),sha=hash(body);need(Buffer.byteLength(body)<1000000,'REPORT_TOO_LARGE');
  const size=await c.query('SELECT pg_database_size(current_database())::bigint AS bytes');need(!storageState(Number(size.rows[0]?.bytes),undefined,Buffer.byteLength(body)).warning,'CAPACITY_GUARD');
  await c.query("INSERT INTO cj_llm_structured_executions(attempt_id,rule_id,status,report,report_sha256) VALUES($1,$2,'COMPLETED',$3,$4)",[attemptId,review.ruleId,body,sha]);
  await c.query('COMMIT');return {status:'COMPLETED',reportSha256:sha,ruleId:review.ruleId,rule:review.rule,channel:packet.channel,symbol:packet.symbol,timeframe:packet.timeframe,trainingBars:n,holdoutBars:src.barCount-n,evaluation:diagnostic.evaluation,noSignalChanges:true,noPromotion:true,noTrading:true,holdoutUsed:false};
 }catch(e){const reason=/^[A-Z0-9_]+$/.test(String(e.message))?String(e.message).slice(0,100):'EXECUTION_BLOCKED';if(attemptId&&reason!=='CAPACITY_GUARD'){try{await c.query('ROLLBACK TO SAVEPOINT structured_job');await c.query("INSERT INTO cj_llm_structured_executions(attempt_id,status,error) VALUES($1,'BLOCKED',$2) ON CONFLICT(attempt_id) DO NOTHING",[attemptId,reason]);await c.query('COMMIT');return {status:'BLOCKED',attemptId,reason,noTrading:true};}catch{/* rollback below */}}await c.query('ROLLBACK');return {status:'BLOCKED',attemptId,reason,noTrading:true};}finally{c.release();}
}
