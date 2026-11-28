/* One predeclared BTC Daily training-only smoke test, no paid model call.
 * This does not enter LLM feedback or select/promote a winning rule. */
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {ADVANCED_FEATURES,ADVANCED_VERSION} from './level6-advanced-features.mjs';
import {ruleId} from './level5-rule-contract.mjs';
import {runDiagnostic} from './level5-structured-execution.mjs';
import {historicalTargetFor,loadHistoricalPeriod} from './historical-period.mjs';
import {storageState} from './storage-policy.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex'),need=(x,m)=>{if(!x)throw Error(m)};
export const PILOT_VERSION='CJ_L6_ADVANCED_FEATURES_PILOT_V1';
export async function runAdvancedPilot(db){
 if(process.memoryUsage().rss>300*1024*1024)return {status:'PAUSED_MEMORY',paidCalls:0};
 const size=await db.query('SELECT pg_database_size(current_database())::bigint AS bytes');
 if(storageState(Number(size.rows[0]?.bytes)).warning)return {status:'PAUSED_STORAGE',paidCalls:0};
 const symbol='BTCUSDT',timeframe='1d',channel='momentum',target=historicalTargetFor(symbol,timeframe);
 await db.query("CREATE TABLE IF NOT EXISTS cj_l6_advanced_pilot (id text PRIMARY KEY,report text NOT NULL,report_sha256 char(64) NOT NULL,created_at timestamptz NOT NULL DEFAULT now())");
 const prior=await db.query('SELECT report,trim(report_sha256) AS sha FROM cj_l6_advanced_pilot WHERE id=$1',[PILOT_VERSION]);
 if(prior.rowCount){
  need(sha(prior.rows[0].report)===prior.rows[0].sha,'PILOT_READBACK_SHA');
  const x=JSON.parse(prior.rows[0].report);need(x.version===PILOT_VERSION&&x.holdoutUsed===false&&x.noPromotion===true,'PILOT_READBACK_POLICY');
  return {status:'ADVANCED_PILOT_ALREADY_VERIFIED',reportSha256:prior.rows[0].sha,paidCalls:0};
 }
 const q=await db.query("SELECT report_gzip,raw_bytes,trim(report_sha256) AS sha,trim(source_sequence_sha256) AS source_sha FROM cj_multiyear_replay_reports WHERE symbol=$1 AND timeframe=$2 AND period_start_ms=$3 AND period_end_ms=$4 AND engine_version=$5",[symbol,timeframe,target.startMs,target.endMs,'CJ_FIVE_INDICATOR_TWO_YEAR_REPLAY_V1_20261124']);
 need(q.rowCount===1,'BASELINE_REQUIRED');const r=q.rows[0],raw=gunzipSync(r.report_gzip,{maxOutputLength:16*1024*1024});
 need(raw.length===Number(r.raw_bytes)&&sha(raw)===r.sha,'BASELINE_SHA');const archived=JSON.parse(raw);
 const source=await loadHistoricalPeriod(db,{symbol,timeframe,...target});
 need(source.sequenceSha256===r.source_sha&&archived.sourceSequenceSha256===r.source_sha,'SOURCE_SHA');
 // Do not recompute historical holdout signals for this pilot.
 const n=Math.floor(source.barCount*.7);need(archived.holdoutStartTime===source.candles[n].time,'TRAIN_BOUNDARY');
 const bars=source.candles.slice(0,n),scope={symbol,timeframe,channel,sourceSha256:source.sequenceSha256};
 const diagnostics=ADVANCED_FEATURES.map(feature=>{
  const rule={kind:'DIAGNOSTIC_TAG',feature,operator:'GT_PREVIOUS'};
  return {rule,ruleId:ruleId(rule,scope),...runDiagnostic({channel,bars,priceStep:archived.priceStep,rule})};
 });
 const report={version:PILOT_VERSION,grammar:ADVANCED_VERSION,source:'Bitunix',...scope,baselineSha:r.sha,trainingBars:n,holdoutBars:source.barCount-n,diagnostics,predeclared:true,manualPilot:true,paidCalls:0,holdoutUsed:false,noPromotion:true,noTrading:true,noSignalChanges:true};
 const body=JSON.stringify(report),digest=sha(body);need(Buffer.byteLength(body)<1000000,'REPORT_TOO_LARGE');
 const c=await db.connect();
 try{
  await c.query('BEGIN');const cap=await c.query('SELECT pg_database_size(current_database())::bigint AS bytes');
  need(!storageState(Number(cap.rows[0]?.bytes),undefined,Buffer.byteLength(body)).warning,'CAPACITY_GUARD');
  await c.query('INSERT INTO cj_l6_advanced_pilot(id,report,report_sha256) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[PILOT_VERSION,body,digest]);
  const check=await c.query('SELECT report,trim(report_sha256) AS sha FROM cj_l6_advanced_pilot WHERE id=$1',[PILOT_VERSION]);
  need(check.rowCount===1&&check.rows[0].sha===digest&&sha(check.rows[0].report)===digest,'PILOT_READBACK_SHA');
  await c.query('COMMIT');
  return {status:'ADVANCED_PILOT_VERIFIED',reportSha256:digest,channel,symbol,timeframe,trainingBars:n,holdoutBars:source.barCount-n,diagnostics:diagnostics.map(x=>({rule:x.rule,ruleId:x.ruleId,decision:x.evaluation.decision,systems:Object.fromEntries(Object.entries(x.evaluation.systems).map(([k,v])=>[k,{taggedN:v.pooled.tagged.eligible,untaggedN:v.pooled.untagged.eligible,taggedPrecision:v.pooled.tagged.precision,untaggedPrecision:v.pooled.untagged.precision,foldWins:v.foldWins,pass:v.pass}]))})),manualPilot:true,paidCalls:0,holdoutUsed:false,noPromotion:true,noTrading:true,noSignalChanges:true};
 }catch(e){try{await c.query('ROLLBACK')}catch{}throw e}finally{c.release()}
}
