/*
 * Opt-in bounded reconciliation after hourly diagnostics.
 * Never changes the five research agents, API routes, existing archives or
 * main. Default OFF; explicit CJ_HISTORICAL_BRIDGE_ENABLED=1 required.
 * Each cycle uses source receipts and a cursor to avoid archive re-scans.
 */
import {initializeHistoricalLibrary,reconcileHourlyArchives,
  reconcileLegacyArchives,historicalCoverage} from './historical-library.mjs';
const safeLimit=(value,fallback,max)=>{
  const num=value===undefined?fallback:Number(value);
  if(!Number.isInteger(num)||num<1||num>max)throw Error('INVALID_BRIDGE_CYCLE_LIMIT');
  return num;
};
export async function runHistoricalBridgeBatch(db,{hourlyLimit=2,
  legacyLimit=5}={}){
  hourlyLimit=safeLimit(hourlyLimit,2,25);
  legacyLimit=safeLimit(legacyLimit,5,25);
  await initializeHistoricalLibrary(db);
  await db.query("CREATE TABLE IF NOT EXISTS cj_historical_bridge_progress ("+
    "stream text PRIMARY KEY,next_offset integer NOT NULL,"+
    "updated_at timestamptz NOT NULL DEFAULT now())");
  // The hourly cohort is live: import a bounded number of archived sources
  // without making a second public Bitunix API request.
  const hourly=await reconcileHourlyArchives(db,{limit:hourlyLimit,commit:true});
  const cursor=await db.query("SELECT next_offset FROM cj_historical_bridge_progress "+
    "WHERE stream='legacy-13-artifacts'");
  const offset=cursor.rowCount?Number(cursor.rows[0].next_offset):0;
  let legacy={status:'LEGACY_SCAN_FINISHED',scanned:0,results:[]};
  if(offset>=0){
    legacy=await reconcileLegacyArchives(db,{limit:legacyLimit,offset,commit:true});
    // The index is stable: the legacy scanner does not filter out ingested
    // objects from its source query. A shorter final batch means complete.
    const next=legacy.scanned<legacyLimit?-1:offset+legacy.scanned;
    await db.query("INSERT INTO cj_historical_bridge_progress(stream,next_offset) "+
      "VALUES('legacy-13-artifacts',$1) "+
      "ON CONFLICT(stream) DO UPDATE SET next_offset=excluded.next_offset,updated_at=now()",
      [next]);
  }
  const coverage=await historicalCoverage(db);
  const dbSize=await db.query('SELECT pg_database_size(current_database())::bigint AS bytes');
  const summary=x=>({
    scanned:x.scanned,
    insertedBars:x.results.reduce((n,r)=>n+(r.insertedBars??0),0),
    validatedSources:x.results.filter(r=>['RECONCILED','ALREADY_RECONCILED'].includes(r.status)).length,
    blocked:x.results.filter(r=>r.status==='BLOCKED').map(r=>({
      key:r.sourceKey,reason:r.reason
    })).slice(0,8)
  });
  return {status:'HISTORICAL_BRIDGE_BATCH_COMPLETED',
    timestamp:new Date().toISOString(),
    hourly:summary(hourly),legacy:summary(legacy),
    nextLegacyOffset:offset<0?-1:
      (legacy.scanned<legacyLimit?-1:offset+legacy.scanned),
    indexedPairs:coverage.length,
    indexedUniqueBars:coverage.reduce((n,x)=>n+x.uniqueBars,0),
    databaseBytes:Number(dbSize.rows[0].bytes),
    noTrading:true,source:'verified archived Bitunix LAST_PRICE'};
}
export async function runHistoricalBridgeIfEnabled(db,{env=process.env}={}){
  if(env.CJ_HISTORICAL_BRIDGE_ENABLED!=='1')
    return {status:'HISTORICAL_BRIDGE_DISABLED'};
  return runHistoricalBridgeBatch(db,{
    hourlyLimit:safeLimit(env.CJ_HISTORICAL_HOURLY_BATCH,2,25),
    legacyLimit:safeLimit(env.CJ_HISTORICAL_LEGACY_BATCH,5,25)
  });
}
