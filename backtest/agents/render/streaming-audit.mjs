/* One-shot read-only production audit against immutable archived original events. */
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {historicalTargetFor} from './historical-period.mjs';
import {streamVerifiedPeriod} from './streaming-period.mjs';
import {CHANNELS} from './streaming-originals.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const need=(x,m)=>{if(!x)throw Error(m)};
const log=x=>console.log('CJ_STREAM_AUDIT '+JSON.stringify(x));
const md=await readFile(new URL('../../HISTORICAL_LIBRARY_FINAL_AUDIT_2026-11-27.md',import.meta.url),'utf8');
const baseline=JSON.parse(md.split('\x60\x60\x60json\n')[1].split('\n\x60\x60\x60')[0]);
need(baseline.status==='PASS'&&baseline.pairs.length===25,'AUDIT_REQUIRED');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:10000});
let db,pairs=0,bars=0,events=0,comparisons=0;
try{
 need(process.env.DATABASE_URL,'DATABASE_URL_REQUIRED');db=await pool.connect();await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 await db.query("SET LOCAL statement_timeout='30s'");await db.query("SET LOCAL idle_in_transaction_session_timeout='60s'");
 for(const receipt of baseline.pairs){
  const {symbol,timeframe}=receipt,target=historicalTargetFor(symbol,timeframe);
  const q=await db.query('SELECT report_gzip,raw_bytes,report_sha256 FROM cj_multiyear_replay_reports WHERE symbol=$1 AND timeframe=$2 AND period_start_ms=$3 AND period_end_ms=$4 AND engine_version=$5',[symbol,timeframe,target.startMs,target.endMs,'CJ_FIVE_INDICATOR_TWO_YEAR_REPLAY_V1_20261124']);
  need(q.rowCount===1,'REPORT_MISSING');const row=q.rows[0],raw=gunzipSync(row.report_gzip,{maxOutputLength:16*1024*1024});
  need(raw.length===Number(row.raw_bytes)&&hash(raw)===receipt.reportSha256&&hash(raw)===String(row.report_sha256).trim(),'REPORT_HASH_MISMATCH');
  const report=JSON.parse(raw);
  const result=await streamVerifiedPeriod(db,{exchange:'Bitunix',symbol,timeframe,...target,priceStep:report.priceStep,pageSize:1000});
  need(result.sequenceSha256===receipt.sourceSequenceSha256&&result.bars===receipt.bars,'SOURCE_HASH_MISMATCH');
  for(const ch of CHANNELS){const e=report.indicators[ch].signals,digest=createHash('sha256');for(const x of e)digest.update(JSON.stringify(x)+'\n');need(result.counts[ch]===e.length&&result.eventSha256[ch]===digest.digest('hex'),'EVENT_PARITY_'+symbol+'_'+timeframe+'_'+ch);events+=e.length;comparisons++;}
  pairs++;bars+=result.bars;log({status:'PAIR',symbol,timeframe,bars:result.bars,counts:result.counts,eventSha256:result.eventSha256,pages:result.pages});
 }
 need(pairs===25&&bars===617151&&events===360092&&comparisons===150,'FINAL_COUNT');
 // Read one actually imported Binance contiguous archive, not a mixed feed.
 const q=await db.query("SELECT symbol,timeframe,start_ms,end_ms,bars FROM cj_binance_um_archive_queue WHERE status='VERIFIED' ORDER BY priority LIMIT 1");
 need(q.rowCount===1,'BINANCE_IMPORTED_SAMPLE_REQUIRED');const x=q.rows[0];
 const bin=await streamVerifiedPeriod(db,{exchange:'Binance',symbol:x.symbol,timeframe:x.timeframe,startMs:Number(x.start_ms),endMs:Number(x.end_ms),priceStep:.000001,pageSize:100});
 need(bin.bars===Number(x.bars),'BINANCE_COUNT');log({status:'BINANCE_READER_SAMPLE',...bin,priceStepNote:'diagnostic read only, not verified historical Binance tick; no performance claim'});
 await db.query('ROLLBACK');log({status:'PASS',pairs,bars,events,comparisons,binanceSampleBars:bin.bars,readOnly:true,noTrading:true});
}catch(e){if(db)try{await db.query('ROLLBACK')}catch{};log({status:'FAIL',pairs,bars,events,comparisons,reason:String(e.message).slice(0,200)});process.exitCode=1;}
finally{db?.release();await pool.end();}
