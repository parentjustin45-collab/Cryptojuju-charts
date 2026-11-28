/* One archived, verified Bitunix training scope per pass.
 * Predeclared cases; never rank/select a winner on holdout. */
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {historicalTargetFor,loadHistoricalPeriod} from './historical-period.mjs';
import {studyConfluence,VERSION} from './level6-confluence.mjs';
import {storageState} from './storage-policy.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex'),need=(v,m)=>{if(!v)throw Error(m)};
export const CASES=Object.freeze([
 ['BTCUSDT','1d'],['ETHUSDT','1d'],['SOLUSDT','1d'],['1000PEPEUSDT','1d'],['BTCUSDT','4h']
]);
export async function runConfluencePilot(db){
 if(process.memoryUsage().rss>280*1024*1024)return {status:'PAUSED_MEMORY',paidCalls:0};
 const size=await db.query('SELECT pg_database_size(current_database())::bigint AS bytes');
 if(storageState(Number(size.rows[0]?.bytes)).warning)return {status:'PAUSED_STORAGE',paidCalls:0};
 await db.query("CREATE TABLE IF NOT EXISTS cj_l6_confluence_reports (id text PRIMARY KEY,report text NOT NULL,report_sha256 char(64) NOT NULL,created_at timestamptz NOT NULL DEFAULT now())");
 for(const [symbol,timeframe] of CASES){
  const id=VERSION+'|'+symbol+'|'+timeframe;
  const prior=await db.query('SELECT report,trim(report_sha256) AS sha FROM cj_l6_confluence_reports WHERE id=$1',[id]);
  if(prior.rowCount){const r=prior.rows[0],x=JSON.parse(r.report);need(sha(r.report)===r.sha&&x.version===VERSION&&x.symbol===symbol&&x.timeframe===timeframe&&x.holdoutUsed===false&&x.noPromotion===true,'CONFLUENCE_READBACK');continue;}
  const target=historicalTargetFor(symbol,timeframe);
  const q=await db.query("SELECT report_gzip,raw_bytes,trim(report_sha256) AS sha,trim(source_sequence_sha256) AS source_sha FROM cj_multiyear_replay_reports WHERE symbol=$1 AND timeframe=$2 AND period_start_ms=$3 AND period_end_ms=$4 AND engine_version=$5",[symbol,timeframe,target.startMs,target.endMs,'CJ_FIVE_INDICATOR_TWO_YEAR_REPLAY_V1_20261124']);
  need(q.rowCount===1,'CONFLUENCE_BASELINE_REQUIRED');const r=q.rows[0],raw=gunzipSync(r.report_gzip,{maxOutputLength:16*1024*1024});
  need(raw.length===Number(r.raw_bytes)&&sha(raw)===r.sha,'CONFLUENCE_BASELINE_SHA');const archive=JSON.parse(raw);
  const source=await loadHistoricalPeriod(db,{symbol,timeframe,...target});
  need(source.sequenceSha256===r.source_sha&&archive.sourceSequenceSha256===r.source_sha,'CONFLUENCE_SOURCE_SHA');
  const n=Math.floor(source.barCount*.7);need(archive.holdoutStartTime===source.candles[n].time,'CONFLUENCE_TRAIN_BOUNDARY');
  if(process.memoryUsage().rss>320*1024*1024)return {status:'PAUSED_MEMORY_AFTER_LOAD',symbol,timeframe,paidCalls:0};
  const study=studyConfluence(source.candles.slice(0,n),archive);
  const report={version:VERSION,source:'Bitunix',symbol,timeframe,sourceSha256:source.sequenceSha256,baselineSha:r.sha,priceStep:archive.priceStep,trainingBars:n,holdoutBars:source.barCount-n,...study};
  const body=JSON.stringify(report),digest=sha(body);need(Buffer.byteLength(body)<2000000,'CONFLUENCE_REPORT_LIMIT');
  const c=await db.connect();
  try{
   await c.query('BEGIN');const cap=await c.query('SELECT pg_database_size(current_database())::bigint AS bytes');
   need(!storageState(Number(cap.rows[0]?.bytes),undefined,Buffer.byteLength(body)).warning,'CAPACITY_GUARD');
   await c.query('INSERT INTO cj_l6_confluence_reports(id,report,report_sha256) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[id,body,digest]);
   const check=await c.query('SELECT report,trim(report_sha256) AS sha FROM cj_l6_confluence_reports WHERE id=$1',[id]);
   need(check.rowCount===1&&check.rows[0].sha===digest&&sha(check.rows[0].report)===digest,'CONFLUENCE_READBACK');
   await c.query('COMMIT');
   return {status:'CONFLUENCE_PILOT_VERIFIED',symbol,timeframe,source:'Bitunix',reportSha256:digest,trainingBars:n,holdoutBars:source.barCount-n,channelCounts:study.channelCounts,conflictBars:study.conflictBars,systems:Object.fromEntries(Object.entries(study.pooled).map(([k,v])=>[k,{events:v.events,eligible:v.eligible,matched:v.matched,precision:v.precision,pivotCoverage:v.pivotCoverage,meanNet20Bps:v.meanNet20Bps,positiveNet20:v.positiveNet20}])),prefixChecks:study.prefixChecks,holdoutUsed:false,noPromotion:true,noTrading:true,paidCalls:0};
  }catch(e){try{await c.query('ROLLBACK')}catch{}throw e}finally{c.release()}
 }
 return {status:'CONFLUENCE_PILOTS_COMPLETE',cases:CASES.length,paidCalls:0,noTrading:true};
}
