/* Older Bitunix history ONLY, listing-adjusted. Separate durable queue.
 * Never modifies the two-year target, its reports, or prospective candidates.
 * Older samples reserved for separate evaluation, not autonomous tuning.
 */
import {createHash,randomUUID} from 'node:crypto';
import {FIVE_CASES} from './five-by-five.mjs';
import {VERIFIED_INTERVALS} from '../research-batch.mjs';
import {fetchHourlyVerifiedWindow} from '../hourly-bitunix-recovery.mjs';
import {fetchBitunixDataPilot} from '../bitunix-data-pilot.mjs';
import {makeBitunixFetchPage} from '../../bitunix-adapter.mjs';
import {initializeHistoricalLibrary,ingestVerifiedHistoricalSource,validateHistoricalSource} from './historical-library.mjs';
import {storageState} from './storage-policy.mjs';
export const LAUNCH=Object.freeze({"BTCUSDT":1719403200000,"ETHUSDT":1719403200000,"SOLUSDT":1719403200000,"HYPEUSDT":1743062400000,"1000PEPEUSDT":1710403200000});
export const EXTENSION_END=Date.UTC(2024,10,24),EXTENSION_REQUESTED_START=Date.UTC(2021,10,24);
export const VERSION='CJ_BITUNIX_OLDER_LISTING_ADJUSTED_V1';
const hash=x=>createHash('sha256').update(x).digest('hex');
const require=(v,m)=>{if(!v)throw Error(m)};
export function extensionWindows(){
 const rows=[];
 for(const {symbol,timeframe} of [...FIVE_CASES].sort((a,b)=>['1d','4h','1h','30m','15m'].indexOf(a.timeframe)-['1d','4h','1h','30m','15m'].indexOf(b.timeframe))){
  const step=VERIFIED_INTERVALS[timeframe],start=Math.max(EXTENSION_REQUESTED_START,Math.ceil(LAUNCH[symbol]/step)*step+3*step);
  for(let p=start;p<EXTENSION_END;){
   let n=Math.min(480,(EXTENSION_END-p)/step);
   const rem=(EXTENSION_END-p)/step-n;if(rem>0&&rem<4)n-=4-rem;
   require(Number.isInteger(n)&&n>=4&&n<=480,'INVALID_EXTENSION_WINDOW');
   const end=p+n*step,id=hash(JSON.stringify([VERSION,symbol,timeframe,p,end]));
   rows.push({id,symbol,timeframe,startMs:p,endMs:end,bars:n});p=end;
  }
 }
 return rows;
}
export async function initializeExtensionQueue(db){
 await initializeHistoricalLibrary(db);
 await db.query("CREATE TABLE IF NOT EXISTS cj_older_history_windows (id char(64) PRIMARY KEY,protocol text NOT NULL,symbol text NOT NULL,timeframe text NOT NULL,start_ms bigint NOT NULL,end_ms bigint NOT NULL,bars integer NOT NULL,priority integer NOT NULL,status text NOT NULL DEFAULT 'PENDING',attempts integer NOT NULL DEFAULT 0,lease_token text,lease_until timestamptz,source_sha256 char(64),inserted_bars integer NOT NULL DEFAULT 0,error text,updated_at timestamptz NOT NULL DEFAULT now())");
 const jobs=extensionWindows().map((x,priority)=>({...x,priority}));
 await db.query("INSERT INTO cj_older_history_windows(id,protocol,symbol,timeframe,start_ms,end_ms,bars,priority) SELECT id,$2,symbol,timeframe,\"startMs\",\"endMs\",bars,priority FROM jsonb_to_recordset($1::jsonb) AS j(id text,symbol text,timeframe text,\"startMs\" bigint,\"endMs\" bigint,bars int,priority int) ON CONFLICT(id) DO NOTHING",[JSON.stringify(jobs),VERSION]);
}
export async function readStoredWindow(db,j,key){
 const r=await db.query("SELECT trim(raw_sha256) AS sha,checked_bars FROM cj_historical_source_receipts WHERE source_key=$1 AND symbol=$2 AND timeframe=$3 AND start_ms=$4 AND end_ms=$5 AND status='VERIFIED_TWO_READS'",[key,j.symbol,j.timeframe,j.startMs,j.endMs]);
 if(!r.rowCount)return null;
 require(Number(r.rows[0].checked_bars)===j.bars&&/^[a-f0-9]{64}$/.test(r.rows[0].sha),'EXTENSION_RECEIPT_INVALID');
 const q=await db.query("SELECT open_ms,open_price,high_price,low_price,close_price,volume,trim(candle_sha256) AS sha FROM cj_historical_candles WHERE symbol=$1 AND timeframe=$2 AND open_ms>=$3 AND open_ms<$4 ORDER BY open_ms",[j.symbol,j.timeframe,j.startMs,j.endMs]);
 require(q.rows.length===j.bars,'EXTENSION_READBACK_COUNT');
 const step=VERIFIED_INTERVALS[j.timeframe];
 for(let i=0;i<q.rows.length;i++){
  const x=q.rows[i],time=Number(x.open_ms),vals=[x.open_price,x.high_price,x.low_price,x.close_price,x.volume].map(Number);
  require(time===j.startMs+i*step&&vals.every(Number.isFinite)&&hash(JSON.stringify([j.symbol,j.timeframe,time,...vals]))===x.sha,'EXTENSION_READBACK_SHA');
 }
 return r.rows[0].sha;
}
export async function runOlderHistoryBatch(db,{limit=12,elapsedBudgetMs=65000,fetchPage=makeBitunixFetchPage({fetchImpl:(url,opts)=>fetch(url,{...opts,signal:AbortSignal.timeout(18000),cache:'no-store',credentials:'omit'})}),fetchWindow=fetchBitunixDataPilot}={}){
 require(Number.isInteger(limit)&&limit>=1&&limit<=12,'INVALID_EXTENSION_BATCH');
 const launched=Date.now();let results=[];
 const size=await db.query('SELECT pg_database_size(current_database())::bigint AS bytes');
 if(storageState(Number(size.rows[0]?.bytes)).warning)return {status:'PAUSED_STORAGE',noTrading:true};
 if(process.memoryUsage().rss>350*1024*1024)return {status:'PAUSED_MEMORY',noTrading:true};
 await initializeExtensionQueue(db);
 await db.query("UPDATE cj_older_history_windows SET status='BLOCKED',error='FINAL_LEASE_EXPIRED',lease_token=NULL,lease_until=NULL WHERE protocol=$1 AND status='RUNNING' AND attempts>=5 AND lease_until<=now()",[VERSION]);
 for(let i=0;i<limit&&(i===0||Date.now()-launched<elapsedBudgetMs);i++){
  const token=randomUUID();
  const q=await db.query("WITH next AS (SELECT id FROM cj_older_history_windows WHERE protocol=$1 AND attempts<5 AND (status='PENDING' OR (status IN ('RUNNING','RETRY') AND lease_until<=now())) ORDER BY attempts,priority FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE cj_older_history_windows j SET status='RUNNING',attempts=attempts+1,lease_token=$2,lease_until=now()+interval '15 minutes',updated_at=now() FROM next WHERE j.id=next.id RETURNING trim(j.id) AS id,j.symbol,j.timeframe,j.start_ms,j.end_ms,j.bars,j.attempts",[VERSION,token]);
  if(!q.rowCount)break;const x=q.rows[0],j={...x,startMs:Number(x.start_ms),endMs:Number(x.end_ms)};
  const key='older-bitunix|'+j.symbol+'|'+j.timeframe+'|'+j.startMs;
  try{
   require(j.endMs<=EXTENSION_END&&j.startMs>=Math.ceil(LAUNCH[j.symbol]/VERIFIED_INTERVALS[j.timeframe])*VERIFIED_INTERVALS[j.timeframe]+3*VERIFIED_INTERVALS[j.timeframe],'OLDER_WINDOW_BOUNDARY');
   let sha=await readStoredWindow(db,j,key),inserted=0;
   if(!sha){
    const guardedFetch=async opts=>{
     const step=VERIFIED_INTERVALS[j.timeframe],first=opts.historicalEndExclusiveMs-(opts.closedBars+opts.anchorBars)*step;
     if(first<Math.ceil(LAUNCH[j.symbol]/step)*step)throw Error('PRE_LISTING_CONTEXT_FORBIDDEN');
     return fetchWindow(opts);
    };
    const z=await fetchHourlyVerifiedWindow({symbol:j.symbol,timeframe:j.timeframe,closedBars:j.bars,nowMs:Date.now(),historicalEndExclusiveMs:j.endMs,fetchPage,retries:1},{fetchWindow:guardedFetch});
    require(z.readback.status==='STABLE_TWO_READS','OLDER_SOURCE_'+(z.first?.reason??z.readback.reason));
    const v=validateHistoricalSource(z.first,z.readback);
    require(v.startMs===j.startMs&&v.endMs===j.endMs&&v.rows.length===j.bars,'OLDER_WINDOW_PROOF_MISMATCH');
    const saved=await ingestVerifiedHistoricalSource(db,{first:z.first,repeat:z.readback,sourceKey:key,archiveEvidence:true});
    inserted=saved.insertedBars;sha=await readStoredWindow(db,j,key);require(sha,'OLDER_RECEIPT_MISSING');
   }
   const save=await db.query("UPDATE cj_older_history_windows SET status='VERIFIED',source_sha256=$3,inserted_bars=$4,lease_token=NULL,lease_until=NULL,error=NULL,updated_at=now() WHERE id=$1 AND lease_token=$2 RETURNING id",[j.id,token,sha,inserted]);
   require(save.rowCount===1,'OLDER_LEASE_LOST');
   results.push({symbol:j.symbol,timeframe:j.timeframe,bars:j.bars,inserted,status:'VERIFIED'});
  }catch(e){
   const reason=String(e?.message??e).slice(0,180);
   await db.query("UPDATE cj_older_history_windows SET status=CASE WHEN attempts>=5 THEN 'BLOCKED' ELSE 'RETRY' END,error=$3,lease_token=NULL,lease_until=now()+interval '1 hour'*power(2,LEAST(attempts-1,4)),updated_at=now() WHERE id=$1 AND lease_token=$2",[j.id,token,reason]);
   results.push({symbol:j.symbol,timeframe:j.timeframe,bars:j.bars,status:'BLOCKED',reason});
   if(/CAPACITY_GUARD|STORAGE_BUDGET|STORAGE_USAGE_UNKNOWN/.test(reason))break;
  }
 }
 const q=await db.query("SELECT status,count(*)::int AS windows,coalesce(sum(bars),0)::int AS bars FROM cj_older_history_windows WHERE protocol=$1 GROUP BY status",[VERSION]);
 const verified=q.rows.find(x=>x.status==='VERIFIED');
 return {status:'OLDER_HISTORY_BATCH_COMPLETE',attempted:results.length,inserted:results.reduce((n,x)=>n+(x.inserted??0),0),verifiedBars:Number(verified?.bars??0),targetBars:123517,counts:q.rows,samples:results,noTrading:true,reservedForIndependentEvaluation:true};
}
