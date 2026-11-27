/* Use internal Render network, read-only; smoke never publishes outcomes. */
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {FIVE_CASES} from './five-by-five.mjs';
import {VERIFIED_INTERVALS} from '../research-batch.mjs';
import {loadHistoricalPeriod,historicalTargetFor} from './historical-period.mjs';
import {PROTOCOL,VARIANTS,evaluateFrozen} from './prospective-validation.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const assert=(v,m)=>{if(!v)throw Error(m)};
const log=x=>console.log('CJ_PROSPECTIVE_V1 '+JSON.stringify(x));
const mode=process.argv[2]??'inventory';
assert(['inventory','checkpoint','final'].includes(mode),'INVALID_MODE');
const evaluationEnd=mode==='checkpoint'?PROTOCOL.checkpointMs:mode==='final'?PROTOCOL.endMs:null;
if(evaluationEnd!==null)assert(Date.now()>=evaluationEnd,'FUTURE_WINDOW_NOT_CLOSED');
const md=await readFile(new URL('../../HISTORICAL_LIBRARY_FINAL_AUDIT_2026-11-27.md',import.meta.url),'utf8');
const baseline=JSON.parse(md.split('\x60\x60\x60json\n')[1].split('\n\x60\x60\x60')[0]);
assert(baseline.status==='PASS'&&baseline.pairs.length===25,'AUDIT_REQUIRED');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:10000});
let db,pairs=0,simulations=0,checks=0,ready=0;
try{
 assert(process.env.DATABASE_URL,'DATABASE_URL_REQUIRED');
 db=await pool.connect();await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 await db.query("SET LOCAL statement_timeout='30s'");await db.query("SET LOCAL idle_in_transaction_session_timeout='60s'");
 const asOf=Date.UTC(2026,10,27,14),historicalEnd=Date.UTC(2026,10,24);
 for(const {symbol,timeframe} of FIVE_CASES){
  const target=historicalTargetFor(symbol,timeframe),step=VERIFIED_INTERVALS[timeframe],receipt=baseline.pairs.find(x=>x.symbol===symbol&&x.timeframe===timeframe);
  const q=await db.query('SELECT report_gzip,raw_bytes,report_sha256 FROM cj_multiyear_replay_reports WHERE symbol=$1 AND timeframe=$2 AND period_start_ms=$3 AND period_end_ms=$4 AND engine_version=$5',[symbol,timeframe,target.startMs,target.endMs,'CJ_FIVE_INDICATOR_TWO_YEAR_REPLAY_V1_20261124']);
  assert(q.rowCount===1,'REPORT_MISSING');const row=q.rows[0],raw=gunzipSync(row.report_gzip,{maxOutputLength:16*1024*1024});
  assert(raw.length===Number(row.raw_bytes)&&hash(raw)===receipt.reportSha256&&hash(raw)===String(row.report_sha256).trim(),'REPORT_HASH_MISMATCH');
  const report=JSON.parse(raw);assert(report.sourceSequenceSha256===receipt.sourceSequenceSha256,'SOURCE_HASH_MISMATCH');
  if(mode==='inventory'){
   const end=Math.floor(asOf/step)*step;
   const inv=await db.query('SELECT count(*)::int AS n,min(open_ms) AS first,max(open_ms) AS last FROM cj_historical_candles WHERE symbol=$1 AND timeframe=$2 AND open_ms>=$3 AND open_ms<$4',[symbol,timeframe,historicalEnd,end]);
   const n=Number(inv.rows[0].n),expected=(end-historicalEnd)/step;
   let verified=false,reason=null;
   try{await loadHistoricalPeriod(db,{symbol,timeframe,startMs:historicalEnd-480*step,endMs:end});verified=true;ready++;}catch(e){reason=String(e.message).slice(0,150);}
   // Operational smoke: only 240 bars ending at training boundary, 160 warm-up.
   const trainEnd=report.holdoutStartTime;
   const smoke=await loadHistoricalPeriod(db,{symbol,timeframe,startMs:trainEnd-240*step,endMs:trainEnd});
   const result=evaluateFrozen(smoke.candles,report.priceStep,160);
   assert(result.length===VARIANTS.length,'SMOKE_VARIANT_COUNT');
   checks+=result.reduce((n,x)=>n+x.prefixChecks,0);simulations+=result.reduce((n,x)=>n+x.results.length,0);
   log({status:'INVENTORY',symbol,timeframe,expected,available:n,verified,reason,first:inv.rows[0].first,last:inv.rows[0].last,smokeVariants:result.length,smokeSimulations:result.reduce((n,x)=>n+x.results.length,0)});
  }else{
   const src=await loadHistoricalPeriod(db,{symbol,timeframe,startMs:PROTOCOL.startMs-PROTOCOL.warmupBars*step,endMs:evaluationEnd});
   const result=evaluateFrozen(src.candles,report.priceStep,PROTOCOL.warmupBars);
   checks+=result.reduce((n,x)=>n+x.prefixChecks,0);simulations+=result.reduce((n,x)=>n+x.results.length,0);ready++;
   for(const value of result)log({status:'RESULT',mode,symbol,timeframe,sequenceSha256:src.sequenceSha256,...value});
  }
  pairs++;
 }
 assert(pairs===25&&checks===325&&simulations===975,'FINAL_COUNTS');
 await db.query('ROLLBACK');
 log({status:'PASS',mode,pairs,ready,checks,simulations,variants:VARIANTS.length,protocol:PROTOCOL.id,noTrading:true,readOnly:true,independentResults:mode!=='inventory'});
}catch(e){if(db)try{await db.query('ROLLBACK')}catch{};log({status:'FAIL',mode,pairs,ready,checks,simulations,reason:String(e.message).slice(0,200)});process.exitCode=1;}
finally{db?.release();await pool.end();}
