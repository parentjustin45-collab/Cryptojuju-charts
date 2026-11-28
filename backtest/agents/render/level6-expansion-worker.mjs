/* Level 6.1 collector. Explicitly separate queue; canonical Bitunix candles.
 * All new markets pass live admission, double-read and immutable readback.
 * No changes to original research cohort, no trading, no automatic promotion.
 */
import {createHash,randomUUID} from 'node:crypto';
import {runExpansionPreflight,CANDIDATES,RANGE} from './level6-expansion-plan.mjs';
import {VERIFIED_INTERVALS} from '../research-batch.mjs';
import {fetchHourlyVerifiedWindow} from '../hourly-bitunix-recovery.mjs';
import {fetchBitunixDataPilot} from '../bitunix-data-pilot.mjs';
import {makeBitunixFetchPage} from '../../bitunix-adapter.mjs';
import {initializeHistoricalLibrary,ingestVerifiedHistoricalSource,validateHistoricalSource} from './historical-library.mjs';
import {readStoredWindow} from './older-history-worker.mjs';
import {storageState} from './storage-policy.mjs';
export const VERSION='CJ_LEVEL6_EXPANSION_V1';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const need=(v,m)=>{if(!v)throw Error(m)};
const PRIORITY=['1d','4h','1h','30m','15m'];
export function expansionWindows(plan){
 need(plan?.admissionReady===true&&plan.closedLoop===true&&plan.projection?.withinGuard===true,'ADMISSION_NOT_READY');
 need(plan.candidates?.length===5&&CANDIDATES.every(s=>plan.candidates.filter(c=>c.symbol===s).length===1),'INVALID_COHORT');
 const jobs=[];
 for(const timeframe of PRIORITY)for(const symbol of CANDIDATES){
  const c=plan.candidates.find(x=>x.symbol===symbol),step=VERIFIED_INTERVALS[timeframe],t=c.targets.find(x=>x.timeframe===timeframe);
  need(c.status==='METADATA_VALID'&&Number.isSafeInteger(c.launchMs)&&t?.symbol===symbol&&t.status==='AWAITING_DOUBLE_READ'&&t.startMs===Math.max(RANGE.startMs,Math.ceil(c.launchMs/step)*step+3*step)&&t.endMs===RANGE.endMs&&t.expectedBars===(t.endMs-t.startMs)/step&&t.expectedBars>=160,'INVALID_TARGET');
  for(let p=t.startMs;p<t.endMs;){
   let bars=Math.min(480,(t.endMs-p)/step);const rem=(t.endMs-p)/step-bars;if(rem>0&&rem<4)bars-=4-rem;
   need(Number.isInteger(bars)&&bars>=4&&bars<=480,'INVALID_WINDOW');
   const endMs=p+bars*step,id=hash([VERSION,symbol,timeframe,p,endMs]);
   jobs.push({id,symbol,timeframe,startMs:p,endMs,bars,launchMs:c.launchMs,priority:jobs.length});p=endMs;
  }
 }
 need(jobs.reduce((n,j)=>n+j.bars,0)===plan.expectedNewBars,'PLAN_COUNT_MISMATCH');
 return jobs;
}
export async function initializeExpansionQueue(db,plan){
 const jobs=expansionWindows(plan);
 await initializeHistoricalLibrary(db);
 await db.query("CREATE TABLE IF NOT EXISTS cj_l6_expansion_windows (id char(64) PRIMARY KEY,protocol text NOT NULL,symbol text NOT NULL,timeframe text NOT NULL,start_ms bigint NOT NULL,end_ms bigint NOT NULL,bars integer NOT NULL,priority integer NOT NULL,status text NOT NULL DEFAULT 'PENDING',attempts integer NOT NULL DEFAULT 0,lease_token text,lease_until timestamptz,source_sha256 char(64),inserted_bars integer NOT NULL DEFAULT 0,error text,updated_at timestamptz NOT NULL DEFAULT now())");
 await db.query("INSERT INTO cj_l6_expansion_windows(id,protocol,symbol,timeframe,start_ms,end_ms,bars,priority) SELECT id,$2,symbol,timeframe,\"startMs\",\"endMs\",bars,priority FROM jsonb_to_recordset($1::jsonb) AS j(id text,symbol text,timeframe text,\"startMs\" bigint,\"endMs\" bigint,bars int,priority int) ON CONFLICT(id) DO NOTHING",[JSON.stringify(jobs),VERSION]);
 const q=await db.query("SELECT trim(id) AS id,symbol,timeframe,start_ms,end_ms,bars FROM cj_l6_expansion_windows WHERE protocol=$1",[VERSION]);
 const byId=new Map(jobs.map(j=>[j.id,j]));
 need(q.rows.length===jobs.length&&q.rows.every(r=>{const j=byId.get(r.id);return j&&r.symbol===j.symbol&&r.timeframe===j.timeframe&&Number(r.start_ms)===j.startMs&&Number(r.end_ms)===j.endMs&&Number(r.bars)===j.bars;}),'PERSISTED_PLAN_MISMATCH');
 return byId;
}
export async function runExpansionBatch(db,{limit=3,elapsedBudgetMs=45000,preflight=runExpansionPreflight,fetchWindow=fetchBitunixDataPilot,fetchPage=makeBitunixFetchPage({fetchImpl:(url,opts)=>fetch(url,{...opts,signal:AbortSignal.timeout(12000),cache:'no-store',credentials:'omit'})})}={}){
 need(Number.isInteger(limit)&&limit>=1&&limit<=6,'INVALID_BATCH');
 if(process.memoryUsage().rss>350*1024*1024)return {status:'PAUSED_MEMORY',noTrading:true};
 const plan=await preflight(db);if(!plan.admissionReady)return {status:'ADMISSION_PAUSED',reason:plan.status,projection:plan.projection,noTrading:true};
 const jobs=await initializeExpansionQueue(db,plan),launched=Date.now(),results=[];
 await db.query("UPDATE cj_l6_expansion_windows SET status='BLOCKED',error='FINAL_LEASE_EXPIRED',lease_token=NULL,lease_until=NULL WHERE protocol=$1 AND status='RUNNING' AND attempts>=5 AND lease_until<=now()",[VERSION]);
 for(let i=0;i<limit&&(i===0||Date.now()-launched<elapsedBudgetMs);i++){
  const size=await db.query('SELECT pg_database_size(current_database())::bigint AS bytes');
  if(storageState(Number(size.rows[0]?.bytes)).warning||process.memoryUsage().rss>350*1024*1024)break;
  const token=randomUUID();
  const q=await db.query("WITH next AS (SELECT id FROM cj_l6_expansion_windows WHERE protocol=$1 AND attempts<5 AND (status='PENDING' OR (status IN ('RUNNING','RETRY') AND lease_until<=now())) ORDER BY attempts,priority FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE cj_l6_expansion_windows j SET status='RUNNING',attempts=attempts+1,lease_token=$2,lease_until=now()+interval '15 minutes',updated_at=now() FROM next WHERE j.id=next.id RETURNING trim(j.id) AS id,j.symbol,j.timeframe,j.start_ms,j.end_ms,j.bars",[VERSION,token]);
  if(!q.rowCount)break;
  const x=q.rows[0],j=jobs.get(x.id);
  need(j&&j.symbol===x.symbol&&j.timeframe===x.timeframe&&j.startMs===Number(x.start_ms)&&j.endMs===Number(x.end_ms)&&j.bars===Number(x.bars),'LEASE_PLAN_MISMATCH');
  const key='level6-bitunix|'+j.symbol+'|'+j.timeframe+'|'+j.startMs;
  try{
   let sha=await readStoredWindow(db,j,key),inserted=0;
   if(!sha){
    const guardedFetch=async opts=>{
     const step=VERIFIED_INTERVALS[j.timeframe];
     need(opts.symbol===j.symbol&&opts.timeframe===j.timeframe&&opts.closedBars===j.bars&&opts.historicalEndExclusiveMs===j.endMs&&j.startMs-opts.anchorBars*step>=Math.ceil(j.launchMs/step)*step,'FETCH_SCOPE');
     return fetchWindow({...opts,expansionOnly:true});
    };
    const z=await fetchHourlyVerifiedWindow({symbol:j.symbol,timeframe:j.timeframe,closedBars:j.bars,nowMs:Date.now(),historicalEndExclusiveMs:j.endMs,fetchPage,retries:1},{fetchWindow:guardedFetch});
    need(z.readback.status==='STABLE_TWO_READS','EXPANSION_SOURCE_'+(z.first?.reason??z.readback.reason));
    const v=validateHistoricalSource(z.first,z.readback,{expansionOnly:true});
    need(v.symbol===j.symbol&&v.timeframe===j.timeframe&&v.startMs===j.startMs&&v.endMs===j.endMs&&v.rows.length===j.bars,'WINDOW_PROOF_MISMATCH');
    const saved=await ingestVerifiedHistoricalSource(db,{first:z.first,repeat:z.readback,sourceKey:key,archiveEvidence:true,expansionOnly:true});
    inserted=saved.insertedBars;sha=await readStoredWindow(db,j,key);need(sha,'EXPANSION_RECEIPT_MISSING');
   }
   const save=await db.query("UPDATE cj_l6_expansion_windows SET status='VERIFIED',source_sha256=$3,inserted_bars=$4,lease_token=NULL,lease_until=NULL,error=NULL,updated_at=now() WHERE id=$1 AND lease_token=$2 RETURNING id",[j.id,token,sha,inserted]);
   need(save.rowCount===1,'LEASE_LOST');
   results.push({symbol:j.symbol,timeframe:j.timeframe,bars:j.bars,inserted,status:'VERIFIED',sourceSha256:sha});
  }catch(e){
   const reason=String(e?.message??e).slice(0,180);
   await db.query("UPDATE cj_l6_expansion_windows SET status=CASE WHEN attempts>=5 THEN 'BLOCKED' ELSE 'RETRY' END,error=$3,lease_token=NULL,lease_until=now()+interval '1 hour'*power(2,LEAST(attempts-1,4)),updated_at=now() WHERE id=$1 AND lease_token=$2",[j.id,token,reason]);
   results.push({symbol:j.symbol,timeframe:j.timeframe,bars:j.bars,status:'BLOCKED',reason});
   if(/CAPACITY_GUARD|STORAGE_BUDGET|STORAGE_USAGE_UNKNOWN/.test(reason))break;
  }
 }
 const q=await db.query("SELECT status,count(*)::int AS windows,coalesce(sum(bars),0)::int AS bars FROM cj_l6_expansion_windows WHERE protocol=$1 GROUP BY status",[VERSION]);
 const verified=q.rows.find(x=>x.status==='VERIFIED');
 const total=await db.query('SELECT count(*)::bigint AS bars FROM cj_historical_candles');
 return {status:'EXPANSION_BATCH_COMPLETE',attempted:results.length,inserted:results.reduce((n,x)=>n+(x.inserted??0),0),verifiedBars:Number(verified?.bars??0),targetBars:plan.expectedNewBars,bitunixCanonicalRows:Number(total.rows[0]?.bars),counts:q.rows,samples:results,noTrading:true,noPromotion:true};
}
