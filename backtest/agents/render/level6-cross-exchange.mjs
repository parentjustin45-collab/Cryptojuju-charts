/* Level 6.2: controlled comparison, one complete daily pair at a time.
 * Binance verified archives are never substituted for Bitunix rows.
 * Same fixed research price step isolates source effects; not Binance native tick.
 * Descriptive original-indicator replay only; no tuning or candidate promotion.
 */
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {planArchives,parseArchive,PROTOCOL as BINANCE_PROTOCOL} from './binance-library.mjs';
import {historicalTargetFor,loadHistoricalPeriod,expectedHistoricalBars} from './historical-period.mjs';
import {studyContinuousHistoricalPeriod,studyMatchedExchangePeriod} from './historical-multiyear-replay.mjs';
import {VERIFIED_INTERVALS} from '../research-batch.mjs';
import {storageState,storageBudget} from './storage-policy.mjs';
export const VERSION='CJ_L6_MATCHED_EXCHANGE_DAILY_V1';
const BASE='CJ_FIVE_INDICATOR_TWO_YEAR_REPLAY_V1_20261124';
const SYMBOLS=['BTCUSDT','ETHUSDT','SOLUSDT','1000PEPEUSDT'];
const sha=x=>createHash('sha256').update(x).digest('hex');
const need=(x,m)=>{if(!x)throw Error(m)};
export function verifyBinanceRows(rows,{symbol,timeframe,startMs,endMs}){
 const step=VERIFIED_INTERVALS[timeframe],count=expectedHistoricalBars({timeframe,startMs,endMs});
 need(rows.length===count,'BINANCE_MATCHED_COUNT');
 const seq=createHash('sha256'),candles=[];
 for(let i=0;i<rows.length;i++){
  const x=rows[i],time=Number(x.open_ms),vals=['open_price','high_price','low_price','close_price','volume'].map(k=>Number(x[k]));
  const [open,high,low,close,volume]=vals;
  need(time===startMs+i*step&&vals.every(Number.isFinite)&&Math.min(open,low,close)>0&&volume>=0&&high>=Math.max(open,close)&&low<=Math.min(open,close),'BINANCE_MATCHED_OHLC_OR_GAP');
  const digest=sha(JSON.stringify(['BINANCE_UM',symbol,timeframe,time,...vals]));
  need(digest===x.fingerprint,'BINANCE_MATCHED_SHA');
  seq.update(digest+'\n');candles.push({time,open,high,low,close,volume});
 }
 return {source:'CJ_BINANCE_UM_POSTGRES_ARCHIVE_VERIFIED_V1',status:'CONTIGUOUS_SHA256_VERIFIED_UTC',market:{exchange:'Binance',priceType:'LAST_PRICE',symbol,timeframe},historyWindow:{startTime:startMs,endTime:endMs,intervalMs:step},barCount:count,sequenceSha256:seq.digest('hex'),candles,ordersPlaced:0};
}
export async function loadMatchedBinanceDaily(db,{symbol,startMs,endMs}){
 const timeframe='1d',step=VERIFIED_INTERVALS[timeframe];
 need(SYMBOLS.includes(symbol)&&endMs<=Math.floor(Date.now()/step)*step,'MATCHED_DAILY_SCOPE');
 const jobs=planArchives().filter(j=>j.symbol===symbol&&j.timeframe===timeframe&&j.startMs<endMs&&j.endMs>startMs);
 need(jobs.length>0&&jobs[0].startMs<=startMs&&jobs.at(-1).endMs>=endMs&&jobs.every((j,i)=>!i||j.startMs===jobs[i-1].endMs),'BINANCE_ARCHIVE_SCOPE_GAP');
 const keys=jobs.map(j=>j.key);
 const ready=await db.query("SELECT archive_key FROM cj_binance_um_archive_queue WHERE protocol=$1 AND status='VERIFIED' AND archive_key=ANY($2::text[])",[BINANCE_PROTOCOL,keys]);
 if(ready.rows.length!==keys.length)return {status:'AWAITING_BINANCE_ARCHIVES',verified:ready.rows.length,required:keys.length};
 const proofs=new Map();
 for(const j of jobs){
  const q=await db.query("SELECT trim(r.zip_sha256) AS digest,trim(r.sequence_sha256) AS seq,r.zip_bytes,r.bars FROM cj_binance_um_receipts r JOIN cj_binance_um_archive_queue q USING(archive_key) WHERE q.archive_key=$1 AND q.status='VERIFIED' AND q.protocol=$2 AND q.symbol=$3 AND q.timeframe=$4 AND q.start_ms=$5 AND q.end_ms=$6 AND q.bars=$7",[j.key,BINANCE_PROTOCOL,symbol,timeframe,j.startMs,j.endMs,j.bars]);
  need(q.rows.length===1,'BINANCE_RECEIPT_MISSING');const x=q.rows[0];
  const parsed=parseArchive(j,x.zip_bytes,x.digest);
  need(parsed.sequenceSha256===x.seq&&Number(x.bars)===j.bars,'BINANCE_RECEIPT_SEQUENCE');
  for(const row of parsed.rows)if(row.open_ms>=startMs&&row.open_ms<endMs){need(!proofs.has(row.open_ms),'BINANCE_DUPLICATE_ARCHIVE_ROW');proofs.set(row.open_ms,row.candle_sha256);}
 }
 const q=await db.query("SELECT c.open_ms,c.open_price,c.high_price,c.low_price,c.close_price,c.volume,trim(c.candle_sha256) AS fingerprint FROM cj_binance_um_candles c JOIN cj_binance_um_archive_queue q USING(archive_key) WHERE c.symbol=$1 AND c.timeframe=$2 AND c.open_ms>=$3 AND c.open_ms<$4 AND q.protocol=$5 AND q.status='VERIFIED' AND c.archive_key=ANY($6::text[]) ORDER BY c.open_ms",[symbol,timeframe,startMs,endMs,BINANCE_PROTOCOL,keys]);
 need(q.rows.length===proofs.size&&q.rows.every(x=>proofs.get(Number(x.open_ms))===x.fingerprint),'BINANCE_ARCHIVE_DB_MISMATCH');
 return verifyBinanceRows(q.rows,{symbol,timeframe,startMs,endMs});
}
// Strict diagnostic only: do not rewrite the baseline or waive a mismatch.
export function baselineDifference(archived,recalculated){
 const differences=[];let count=0;
 function walk(a,b,path){
  if(Object.is(a,b))return;
  if(a!==null&&b!==null&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)){
   const keys=new Set([...Object.keys(a),...Object.keys(b)]);
   for(const k of keys)walk(a[k],b[k],path+'.'+k);
   return;
  }
  count++;
  if(differences.length<12)differences.push({path,archived:a===undefined?'MISSING':a,recalculated:b===undefined?'MISSING':b});
 }
 walk(archived,recalculated,'report');
 return {count,differences: differences.map(x=>({...x,archived:typeof x.archived==='object'&&x.archived!==null?'OBJECT':x.archived,recalculated:typeof x.recalculated==='object'&&x.recalculated!==null?'OBJECT':x.recalculated})),semanticEqual:count===0};
}
export function matchedReport(bitunix,binance,{baselineSha,priceStep}){
 need(bitunix.market.exchange==='Bitunix'&&binance.market.exchange==='Binance'&&bitunix.market.symbol===binance.market.symbol&&bitunix.market.timeframe===binance.market.timeframe&&bitunix.historyWindow.startTime===binance.historyWindow.startTime&&bitunix.historyWindow.endTime===binance.historyWindow.endTime&&bitunix.sequenceSha256!==binance.sequenceSha256,'EXCHANGE_PAIR_MISMATCH');
 const target=historicalTargetFor(bitunix.market.symbol,bitunix.market.timeframe);
 const original=studyContinuousHistoricalPeriod(bitunix,{priceStep});
 need(sha(JSON.stringify(original))===baselineSha,'BITUNIX_BASELINE_REPLAY_MISMATCH');
 const other=studyMatchedExchangePeriod(binance,{priceStep,target});
 need(original.holdoutStartTime===other.holdoutStartTime&&original.closedCandles===other.closedCandles,'COMPARISON_SPLIT_MISMATCH');
 return {protocol:VERSION,symbol:original.symbol,timeframe:original.timeframe,startMs:original.startTime,endMs:original.endTime,baselineSha,priceStep,priceStepPolicy:'SAME_ARCHIVED_BITUNIX_RESEARCH_STEP_ON_BOTH_NOT_BINANCE_NATIVE_TICK',bitunix:{exchange:'Bitunix',sourceProtocol:bitunix.source,...original},binance:other,noTrading:true,noPromotion:true,noTuning:true,holdoutDescriptiveOnly:true};
}
export async function runCrossExchangePilot(db){
 if(process.memoryUsage().rss>300*1024*1024)return {status:'PAUSED_MEMORY'};
 const size=await db.query('SELECT pg_database_size(current_database())::bigint AS bytes');
 if(storageState(Number(size.rows[0]?.bytes)).warning)return {status:'PAUSED_STORAGE'};
 const exists=await db.query("SELECT to_regclass('public.cj_binance_um_archive_queue') AS t");
 if(!exists.rows[0]?.t)return {status:'AWAITING_BINANCE_LIBRARY'};
 await db.query("CREATE TABLE IF NOT EXISTS cj_l6_cross_exchange_reports (symbol text NOT NULL,timeframe text NOT NULL,start_ms bigint NOT NULL,end_ms bigint NOT NULL,engine_version text NOT NULL,bitunix_sha char(64) NOT NULL,binance_sha char(64) NOT NULL,report_sha256 char(64) NOT NULL,report_gzip bytea NOT NULL,raw_bytes bigint NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(symbol,timeframe,start_ms,end_ms,engine_version))");
 const waiting=[];
 for(const symbol of SYMBOLS){
  const timeframe='1d',target=historicalTargetFor(symbol,timeframe),{startMs,endMs}=target;
  const prior=await db.query("SELECT report_sha256 FROM cj_l6_cross_exchange_reports WHERE symbol=$1 AND timeframe=$2 AND start_ms=$3 AND end_ms=$4 AND engine_version=$5",[symbol,timeframe,startMs,endMs,VERSION]);
  if(prior.rowCount)continue;
  const binance=await loadMatchedBinanceDaily(db,{symbol,startMs,endMs});
  if(binance.status==='AWAITING_BINANCE_ARCHIVES'){waiting.push({symbol,...binance});continue;}
  const q=await db.query("SELECT trim(report_sha256) AS sha,trim(source_sequence_sha256) AS source_sha,report_gzip,raw_bytes FROM cj_multiyear_replay_reports WHERE symbol=$1 AND timeframe=$2 AND period_start_ms=$3 AND period_end_ms=$4 AND engine_version=$5",[symbol,timeframe,startMs,endMs,BASE]);
  need(q.rows.length===1,'BASELINE_REPORT_MISSING');const row=q.rows[0],raw=gunzipSync(row.report_gzip,{maxOutputLength:16*1024*1024});
  need(raw.length===Number(row.raw_bytes)&&sha(raw)===row.sha,'BASELINE_REPORT_SHA');
  const baseline=JSON.parse(raw.toString()),bitunix=await loadHistoricalPeriod(db,{symbol,timeframe,startMs,endMs});
  need(bitunix.sequenceSha256===row.source_sha&&baseline.sourceSequenceSha256===row.source_sha,'BASELINE_SOURCE_SHA');
  const fresh=studyContinuousHistoricalPeriod(bitunix,{priceStep:baseline.priceStep});
  const replaySha=sha(JSON.stringify(fresh));
  if(replaySha!==row.sha){
   const difference=baselineDifference(baseline,fresh);
   return {status:'BASELINE_REPLAY_MISMATCH_DIAGNOSTIC',symbol,timeframe,sourceSha256:row.source_sha,baselineSha:row.sha,replaySha,...difference,archivedSignalCounts:Object.fromEntries(Object.entries(baseline.indicators??{}).map(([k,v])=>[k,v.signalCount])),freshSignalCounts:Object.fromEntries(Object.entries(fresh.indicators).map(([k,v])=>[k,v.signalCount])),noComparisonPersisted:true,noTrading:true,noPromotion:true};
  }
  const report=matchedReport(bitunix,binance,{baselineSha:row.sha,priceStep:baseline.priceStep});
  const body=Buffer.from(JSON.stringify(report));need(body.length<=16*1024*1024,'REPORT_LIMIT');
  const zipped=gzipSync(body,{level:6}),digest=sha(body),client=await db.connect();
  try{
   await client.query('BEGIN');
   const cap=await client.query('SELECT pg_database_size(current_database())::bigint AS bytes');
   need(!storageState(Number(cap.rows[0]?.bytes),storageBudget(),zipped.length).warning,'CAPACITY_GUARD');
   const save=await client.query("INSERT INTO cj_l6_cross_exchange_reports(symbol,timeframe,start_ms,end_ms,engine_version,bitunix_sha,binance_sha,report_sha256,report_gzip,raw_bytes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING RETURNING report_sha256",[symbol,timeframe,startMs,endMs,VERSION,bitunix.sequenceSha256,binance.sequenceSha256,digest,zipped,body.length]);
   const check=await client.query("SELECT trim(report_sha256) AS sha,report_gzip,raw_bytes FROM cj_l6_cross_exchange_reports WHERE symbol=$1 AND timeframe=$2 AND start_ms=$3 AND end_ms=$4 AND engine_version=$5",[symbol,timeframe,startMs,endMs,VERSION]);
   need(check.rows.length===1&&check.rows[0].sha===digest&&Number(check.rows[0].raw_bytes)===body.length&&sha(gunzipSync(check.rows[0].report_gzip,{maxOutputLength:16*1024*1024}))===digest,'CROSS_REPORT_READBACK');
   await client.query('COMMIT');
   return {status:save.rowCount?'MATCHED_EXCHANGE_REPORT_VERIFIED':'ALREADY_ARCHIVED',symbol,timeframe,closedBars:bitunix.barCount,bitunixSha:bitunix.sequenceSha256,binanceSha:binance.sequenceSha256,reportSha256:digest,priceStep:baseline.priceStep,priceStepPolicy:report.priceStepPolicy,holdoutStartTime:report.bitunix.holdoutStartTime,signals:Object.fromEntries(Object.keys(report.bitunix.indicators).map(k=>[k,{bitunix:report.bitunix.indicators[k].signalCount,binance:report.binance.indicators[k].signalCount}])),noTrading:true,noPromotion:true,noTuning:true};
  }catch(e){try{await client.query('ROLLBACK')}catch{}throw e}finally{client.release()}
 }
 return {status:waiting.length?'AWAITING_COMPLETE_MATCHED_DAILY':'DAILY_PILOT_COMPLETE',waiting,noTrading:true};
}
