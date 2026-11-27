import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {loadHistoricalPeriod,historicalTargetFor} from './historical-period.mjs';
import {SPEC,CHANNELS,experimentChannel} from './historical-targeted-v3-experiments.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const insist=(v,m)=>{if(!v)throw Error(m)};
const log=x=>console.log('CJ_EXPERIMENT_V3 '+JSON.stringify(x));
const md=await readFile(new URL('../../HISTORICAL_LIBRARY_FINAL_AUDIT_2026-11-27.md',import.meta.url),'utf8');
const baseline=JSON.parse(md.split('\x60\x60\x60json\n')[1].split('\n\x60\x60\x60')[0]);
insist(baseline.status==='PASS'&&baseline.pairs.length===25,'AUDIT_REQUIRED');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:10000});
let db,pairs=0,bars=0,checks=0,experiments=0;const sums={};
try{
 insist(process.env.DATABASE_URL,'DATABASE_URL_REQUIRED');
 db=await pool.connect();await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 await db.query("SET LOCAL statement_timeout='30s'");await db.query("SET LOCAL idle_in_transaction_session_timeout='60s'");
 for(const receipt of baseline.pairs){
  const {symbol,timeframe}=receipt,target=historicalTargetFor(symbol,timeframe);
  const src=await loadHistoricalPeriod(db,{symbol,timeframe,...target,pageSize:2000});
  insist(src.sequenceSha256===receipt.sourceSequenceSha256&&src.barCount===receipt.bars,'SOURCE_MISMATCH');
  const q=await db.query('SELECT report_gzip,raw_bytes,report_sha256 FROM cj_multiyear_replay_reports WHERE symbol=$1 AND timeframe=$2 AND period_start_ms=$3 AND period_end_ms=$4 AND engine_version=$5',[symbol,timeframe,target.startMs,target.endMs,'CJ_FIVE_INDICATOR_TWO_YEAR_REPLAY_V1_20261124']);
  insist(q.rowCount===1,'REPORT_MISSING');const row=q.rows[0],raw=gunzipSync(row.report_gzip,{maxOutputLength:16*1024*1024});
  insist(raw.length===Number(row.raw_bytes)&&hash(raw)===receipt.reportSha256&&hash(raw)===String(row.report_sha256).trim(),'REPORT_HASH_MISMATCH');
  const report=JSON.parse(raw);insist(report.sourceSequenceSha256===src.sequenceSha256&&report.holdoutStartTime===src.candles[Math.floor(src.barCount*.7)].time,'REPORT_SOURCE');
  for(const ch of CHANNELS){
   const z=experimentChannel(ch,src.candles,report);
   for(const f of z.folds)for(const mode of ['baseline','candidate'])for(const side of ['long','short']){
    const key=[ch,f.fold,mode,side].join('|'),dest=sums[key]??={};for(const [k,v] of Object.entries(f[mode][side]))dest[k]=(dest[k]??0)+v;
   }
   checks+=z.prefixChecks;experiments++;
   log({status:'CHANNEL',symbol,timeframe,...z});
  }
  pairs++;bars+=src.barCount;log({status:'PAIR',symbol,timeframe,bars:src.barCount,experiments});
 }
 insist(pairs===25&&bars===617151&&experiments===150&&checks===300,'FINAL_COUNT');
 await db.query('ROLLBACK');
 for(const ch of CHANNELS)log({status:'AGGREGATE',channel:ch,groups:Object.fromEntries(Object.entries(sums).filter(([k])=>k.startsWith(ch+'|')))});
 log({status:'PASS',pairs,bars,experiments,checks,spec:SPEC,readOnly:true,noTrading:true,holdoutUsed:false});
}catch(e){if(db)try{await db.query('ROLLBACK')}catch{};log({status:'FAIL',pairs,bars,experiments,checks,reason:String(e.message).slice(0,200)});process.exitCode=1;}
finally{db?.release();await pool.end();}
