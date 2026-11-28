/* Bounded, predeclared threshold tests. Separate from paid model memory.
 * One case per scheduler slot. Full source SHA and archived signal parity
 * verified, then only the fixed training prefix enters the diagnostic. */
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {historicalTargetFor,loadHistoricalPeriod} from './historical-period.mjs';
import {boundedTrainingWindow} from './level6-bounded-window.mjs';
import {THRESHOLD_VERSION,thresholdFor,ADVANCED_FEATURES} from './level6-advanced-features.mjs';
import {ruleId} from './level5-rule-contract.mjs';
import {runDiagnostic} from './level5-structured-execution.mjs';
import {storageState} from './storage-policy.mjs';
export const VERSION='CJ_L6_THRESHOLD_SMALL_PILOT_V1';
const sha=x=>createHash('sha256').update(x).digest('hex'),need=(x,m)=>{if(!x)throw Error(m)};
export const PILOT_CASES=Object.freeze([
 {symbol:'BTCUSDT',timeframe:'1d',channel:'momentum',features:ADVANCED_FEATURES},
 {symbol:'BTCUSDT',timeframe:'30m',channel:'momentum',features:['RSI14']},
 {symbol:'BTCUSDT',timeframe:'15m',channel:'momentum',features:['RSI14']}
]);
export async function runThresholdPilot(db){
 if(process.memoryUsage().rss>280*1024*1024)return {status:'PAUSED_MEMORY',paidCalls:0};
 const size=await db.query('SELECT pg_database_size(current_database())::bigint AS bytes');
 if(storageState(Number(size.rows[0]?.bytes)).warning)return {status:'PAUSED_STORAGE',paidCalls:0};
 await db.query("CREATE TABLE IF NOT EXISTS cj_l6_threshold_pilot (id text PRIMARY KEY,report text NOT NULL,report_sha256 char(64) NOT NULL,created_at timestamptz NOT NULL DEFAULT now())");
 for(const spec of PILOT_CASES){
  const {symbol,timeframe,channel,features}=spec,id=VERSION+'|'+timeframe;
  const prior=await db.query('SELECT report,trim(report_sha256) AS sha FROM cj_l6_threshold_pilot WHERE id=$1',[id]);
  if(prior.rowCount){const row=prior.rows[0],r=JSON.parse(row.report);need(sha(row.report)===row.sha&&r.version===VERSION&&r.timeframe===timeframe&&r.holdoutUsed===false&&r.noPromotion===true,'PILOT_READBACK_POLICY');continue;}
  const target=historicalTargetFor(symbol,timeframe);
  const q=await db.query("SELECT report_gzip,raw_bytes,trim(report_sha256) AS sha,trim(source_sequence_sha256) AS source_sha FROM cj_multiyear_replay_reports WHERE symbol=$1 AND timeframe=$2 AND period_start_ms=$3 AND period_end_ms=$4 AND engine_version=$5",[symbol,timeframe,target.startMs,target.endMs,'CJ_FIVE_INDICATOR_TWO_YEAR_REPLAY_V1_20261124']);
  need(q.rowCount===1,'BASELINE_REQUIRED');const r=q.rows[0],raw=gunzipSync(r.report_gzip,{maxOutputLength:16*1024*1024});
  need(raw.length===Number(r.raw_bytes)&&sha(raw)===r.sha,'BASELINE_SHA');const archived=JSON.parse(raw);
  const source=await loadHistoricalPeriod(db,{symbol,timeframe,...target});
  need(source.sequenceSha256===r.source_sha&&archived.sourceSequenceSha256===r.source_sha,'SOURCE_SHA');
  if(process.memoryUsage().rss>320*1024*1024)return {status:'PAUSED_MEMORY_AFTER_LOAD',timeframe,paidCalls:0};
  const {bars,window,holdoutBars,totalTrainingBars}=boundedTrainingWindow(source,archived,channel);
  const scope={symbol,timeframe,channel,sourceSha256:source.sequenceSha256};
  const diagnostics=features.map(feature=>{
   const rule={kind:'DIAGNOSTIC_TAG',feature,operator:'GT_MID'};
   return {rule,threshold:thresholdFor(rule),ruleId:ruleId(rule,scope),...runDiagnostic({channel,bars,priceStep:archived.priceStep,rule})};
  });
  const report={version:VERSION,grammar:THRESHOLD_VERSION,source:'Bitunix',...scope,baselineSha:r.sha,trainingBars:bars.length,totalTrainingBars,holdoutBars,window,diagnostics,manualPilot:true,predeclared:true,paidCalls:0,holdoutUsed:false,noPromotion:true,noTrading:true,noSignalChanges:true};
  const body=JSON.stringify(report),digest=sha(body);need(Buffer.byteLength(body)<1000000,'REPORT_TOO_LARGE');
  const c=await db.connect();
  try{
   await c.query('BEGIN');const cap=await c.query('SELECT pg_database_size(current_database())::bigint AS bytes');
   need(!storageState(Number(cap.rows[0]?.bytes),undefined,Buffer.byteLength(body)).warning,'CAPACITY_GUARD');
   await c.query('INSERT INTO cj_l6_threshold_pilot(id,report,report_sha256) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[id,body,digest]);
   const check=await c.query('SELECT report,trim(report_sha256) AS sha FROM cj_l6_threshold_pilot WHERE id=$1',[id]);
   need(check.rowCount===1&&check.rows[0].sha===digest&&sha(check.rows[0].report)===digest,'PILOT_READBACK_SHA');
   await c.query('COMMIT');
   return {status:'THRESHOLD_PILOT_VERIFIED',symbol,timeframe,channel,reportSha256:digest,trainingBars:bars.length,totalTrainingBars,holdoutBars,window,diagnostics:diagnostics.map(x=>({rule:x.rule,threshold:x.threshold,decision:x.evaluation.decision,systems:Object.fromEntries(Object.entries(x.evaluation.systems).map(([k,v])=>[k,{taggedN:v.pooled.tagged.eligible,untaggedN:v.pooled.untagged.eligible,taggedPrecision:v.pooled.tagged.precision,untaggedPrecision:v.pooled.untagged.precision,foldWins:v.foldWins,pass:v.pass}]))})),manualPilot:true,paidCalls:0,holdoutUsed:false,noPromotion:true,noTrading:true};
  }catch(e){try{await c.query('ROLLBACK')}catch{}throw e}finally{c.release()}
 }
 return {status:'THRESHOLD_SMALL_PILOTS_COMPLETE',cases:3,paidCalls:0,noTrading:true};
}
