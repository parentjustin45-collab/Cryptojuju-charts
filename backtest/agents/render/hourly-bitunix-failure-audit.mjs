/* Read-only evidence audit of actual intermittent hourly failures. */
import pg from 'pg';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:10000});
const log=x=>console.log('CJ_HOURLY_FAILURE_AUDIT '+JSON.stringify(x));
const hash=x=>createHash('sha256').update(x).digest('hex');
async function read(db,slot,path){
 const q=await db.query("SELECT trim(m.sha256) AS sha,o.raw_bytes,o.content FROM cj_archive_manifest m JOIN cj_archive_objects o ON o.sha256=m.sha256 WHERE m.agent='bitunix-data' AND m.slot=$1 AND m.path=$2",[slot,path]);
 if(q.rowCount!==1)return null;
 const row=q.rows[0],raw=gunzipSync(row.content,{maxOutputLength:16*1024*1024});
 if(raw.length!==Number(row.raw_bytes)||hash(raw)!==row.sha)throw Error('ARCHIVE_HASH_MISMATCH');
 return JSON.parse(raw.toString('utf8'));
}
const summarize=o=>o?{status:o.status,reason:o.reason,window:o.historyWindow,anchorBars:o.provenance?.anchorBars,quality:o.quality,issues:o.normalizationIssues?.slice(0,5),requestErrors:o.requests?.filter(x=>x.error).map(x=>({startTime:x.startTime,endTime:x.endTime,received:x.received,limit:x.limit,error:x.error})).slice(0,4)}:null;
let db;
try{
 db=await pool.connect();await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 await db.query("SET LOCAL statement_timeout='15s'");
 const q=await db.query("SELECT slot FROM cj_agent_runs WHERE agent='bitunix-data' AND status='BLOCKED' AND slot>=$1 AND slot<$2 ORDER BY slot LIMIT 48",['2026-11-25T00:00:00Z','2026-11-27T09:00:00Z']);
 let cases=0,missing=0;
 for(const {slot} of q.rows){
  const summary=await read(db,slot,'data/summary.json');
  if(!summary){missing++;log({status:'MISSING_SUMMARY',slot});continue;}
  for(const c of summary.checks.filter(x=>x.status!=='DATA_READY_FOR_RESEARCH_ONLY')){
   const base='data/'+c.symbol+'-'+c.timeframe;
   const first=await read(db,slot,base+'.json');
   const repeat=await read(db,slot,base+'-repeatability.json');
   const second=await read(db,slot,base+'-second-read-when-blocked.json');
   log({status:'CASE',slot,symbol:c.symbol,timeframe:c.timeframe,summaryReason:c.reason,first:summarize(first),second:summarize(second),repeat:repeat?{status:repeat.status,reason:repeat.reason,differences:repeat.differences?.slice(0,4),differenceCount:repeat.differenceCount}:null});
   cases++;
  }
 }
 await db.query('ROLLBACK');log({status:'PASS',slots:q.rowCount,cases,missing,readOnly:true});
}catch(e){if(db)try{await db.query('ROLLBACK')}catch{};log({status:'FAIL',reason:String(e.message).slice(0,200)});process.exitCode=1;}
finally{db?.release();await pool.end();}
