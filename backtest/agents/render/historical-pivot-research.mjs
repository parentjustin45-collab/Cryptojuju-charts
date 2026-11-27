/* Read-only production research pass: use immutable audited sources/reports. */
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {loadHistoricalPeriod,historicalTargetFor} from './historical-period.mjs';
import {SPEC,CHANNELS,studySignals} from './historical-pivot-diagnostics.mjs';
const VERSION='CJ_FIVE_INDICATOR_TWO_YEAR_REPLAY_V1_20261124';
const hash=b=>createHash('sha256').update(b).digest('hex');
const log=o=>console.log('CJ_PIVOT_RESEARCH '+JSON.stringify(o));
const insist=(v,msg)=>{if(!v)throw Error(msg)};
const md=await readFile(new URL('../../HISTORICAL_LIBRARY_FINAL_AUDIT_2026-11-27.md',import.meta.url),'utf8');
const baseline=JSON.parse(md.split('\x60\x60\x60json\n')[1].split('\n\x60\x60\x60')[0]);
insist(baseline.status==='PASS'&&baseline.pairs.length===25,'AUDIT_BASELINE_REQUIRED');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:10000});
let db,pairs=0,bars=0,events=0;const aggregate={training:{},holdout:{}};
try{
 insist(process.env.DATABASE_URL,'DATABASE_URL_REQUIRED');
 db=await pool.connect();await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 await db.query("SET LOCAL statement_timeout='30s'");
 await db.query("SET LOCAL idle_in_transaction_session_timeout='60s'");
 for(const receipt of baseline.pairs){
  const {symbol,timeframe}=receipt,target=historicalTargetFor(symbol,timeframe);
  const source=await loadHistoricalPeriod(db,{symbol,timeframe,...target,pageSize:2000});
  insist(source.sequenceSha256===receipt.sourceSequenceSha256&&source.barCount===receipt.bars,'SOURCE_BASELINE_MISMATCH');
  const q=await db.query('SELECT report_gzip,raw_bytes,report_sha256 FROM cj_multiyear_replay_reports WHERE symbol=$1 AND timeframe=$2 AND period_start_ms=$3 AND period_end_ms=$4 AND engine_version=$5',[symbol,timeframe,target.startMs,target.endMs,VERSION]);
  insist(q.rowCount===1,'REPORT_MISSING');const row=q.rows[0];
  const raw=gunzipSync(row.report_gzip,{maxOutputLength:16*1024*1024});
  insist(raw.length===Number(row.raw_bytes)&&hash(raw)===receipt.reportSha256&&hash(raw)===String(row.report_sha256).trim(),'REPORT_HASH_MISMATCH');
  const report=JSON.parse(raw.toString('utf8'));
  insist(report.sourceSequenceSha256===source.sequenceSha256&&report.closedCandles===source.barCount,'REPORT_SOURCE_MISMATCH');
  const split=Math.floor(source.barCount*.7);insist(report.holdoutStartTime===source.candles[split].time,'HOLDOUT_MISMATCH');
  const study=studySignals(source.candles,report.indicators,split);
  let n=0;
  for(const [phase,value] of Object.entries(study))for(const ch of CHANNELS){
   const st=value.channels[ch];n+=st.events;
   const dest=aggregate[phase][ch]??={};
   for(const [k,v] of Object.entries(st))dest[k]=(dest[k]??0)+v;
  }
  insist(n===receipt.signals,'EVENT_BASELINE_MISMATCH');
  pairs++;bars+=source.barCount;events+=n;
  log({status:'PAIR',symbol,timeframe,bars:source.barCount,events:n,study});
 }
 insist(pairs===25&&bars===617151&&events===360092,'FINAL_COUNT_MISMATCH');
 await db.query('ROLLBACK');
 log({status:'PASS',pairs,bars,events,spec:SPEC,aggregate,readOnly:true,noTrading:true});
}catch(e){if(db)try{await db.query('ROLLBACK')}catch{};log({status:'FAIL',pairs,bars,events,reason:String(e.message).slice(0,200)});process.exitCode=1;}
finally{db?.release();await pool.end();}
