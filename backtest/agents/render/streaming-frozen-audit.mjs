/* Real-data technical parity only, frozen first 70% training. No performance selection. */
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {historicalTargetFor,loadHistoricalPeriod} from './historical-period.mjs';
import {createFrozenEvaluation,KEYS} from './streaming-frozen.mjs';
import {generateFrozen,simulate,VARIANTS,PROTOCOL} from './prospective-validation.mjs';
import {VERIFIED_INTERVALS} from '../research-batch.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const digest=events=>{const d=createHash('sha256');for(const e of events)d.update(JSON.stringify(e)+'\n');return d.digest('hex');};
const need=(x,m)=>{if(!x)throw Error(m)};
const log=x=>console.log('CJ_FROZEN_STREAM_AUDIT '+JSON.stringify(x));
const md=await readFile(new URL('../../HISTORICAL_LIBRARY_FINAL_AUDIT_2026-11-27.md',import.meta.url),'utf8');
const baseline=JSON.parse(md.split('\x60\x60\x60json\n')[1].split('\n\x60\x60\x60')[0]);
need(baseline.status==='PASS'&&baseline.pairs.length===25,'AUDIT_REQUIRED');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:10000});
let db,pairs=0,sourceBars=0,trainingBars=0,events=0,comparisons=0,simulations=0,warnings=0;
try{
 need(process.env.DATABASE_URL,'DATABASE_URL_REQUIRED');db=await pool.connect();await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await db.query("SET LOCAL statement_timeout='30s'");await db.query("SET LOCAL idle_in_transaction_session_timeout='60s'");
 for(const receipt of baseline.pairs){
  const {symbol,timeframe}=receipt,target=historicalTargetFor(symbol,timeframe),step=VERIFIED_INTERVALS[timeframe];
  const src=await loadHistoricalPeriod(db,{symbol,timeframe,...target,pageSize:2000});
  need(src.sequenceSha256===receipt.sourceSequenceSha256&&src.barCount===receipt.bars,'SOURCE_MISMATCH');
  const q=await db.query('SELECT report_gzip,raw_bytes,report_sha256 FROM cj_multiyear_replay_reports WHERE symbol=$1 AND timeframe=$2 AND period_start_ms=$3 AND period_end_ms=$4 AND engine_version=$5',[symbol,timeframe,target.startMs,target.endMs,'CJ_FIVE_INDICATOR_TWO_YEAR_REPLAY_V1_20261124']);
  need(q.rowCount===1,'REPORT_MISSING');const row=q.rows[0],raw=gunzipSync(row.report_gzip,{maxOutputLength:16*1024*1024});
  need(raw.length===Number(row.raw_bytes)&&hash(raw)===receipt.reportSha256&&hash(raw)===String(row.report_sha256).trim(),'REPORT_HASH_MISMATCH');
  const report=JSON.parse(raw),n=Math.floor(src.barCount*.7),a=src.candles.slice(0,n);
  need(report.holdoutStartTime===src.candles[n].time&&a.length>150,'TRAIN_BOUNDARY');
  const startIndex=Math.min(480,Math.floor(n/3)),x=createFrozenEvaluation({priceStep:report.priceStep,intervalMs:step,startIndex});
  for(let p=0;p<a.length;p+=997)for(const b of a.slice(p,p+997))x.consume(b);
  const z=x.finish();
  for(const [ch,v] of VARIANTS){
   const key=ch+'|'+v,ref=generateFrozen(ch,v,a,report.priceStep);
   need(z.counts[key]===ref.signals.length&&z.eventSha256[key]===digest(ref.signals),'EVENT_PARITY_'+key+'_'+symbol+'_'+timeframe);
   if(v==='original')need(digest(report.indicators[ch].signals.filter(e=>e.time<report.holdoutStartTime))===z.eventSha256[key],'ORIGINAL_ARCHIVE_PARITY');
   if(ref.warningStats){need(JSON.stringify(ref.warningStats)===JSON.stringify(z.warningStats[key]),'WARNING_PARITY_'+key);warnings++;}
   for(const [i,cost] of PROTOCOL.costs.entries()){need(JSON.stringify(z.simulations[key][i])===JSON.stringify(simulate(a,ref.signals,{startIndex,cost})),'SIM_PARITY_'+key+'_'+cost.id);simulations++;}
   comparisons++;events+=ref.signals.length;
  }
  pairs++;sourceBars+=src.barCount;trainingBars+=n;log({status:'PAIR',symbol,timeframe,bars:n,counts:z.counts,eventSha256:z.eventSha256,warningStats:z.warningStats,simulations:39,comparisonOnly:true});
 }
 need(pairs===25&&sourceBars===617151&&comparisons===325&&simulations===975&&warnings===75,'FINAL_COUNTS');
 await db.query('ROLLBACK');log({status:'PASS',pairs,sourceBars,trainingBars,events,comparisons,simulations,warnings,holdoutUsedForSignals:false,readOnly:true,noTrading:true});
}catch(e){if(db)try{await db.query('ROLLBACK')}catch{};log({status:'FAIL',pairs,sourceBars,trainingBars,events,comparisons,simulations,warnings,reason:String(e.message).slice(0,240)});process.exitCode=1;}
finally{db?.release();await pool.end();}
