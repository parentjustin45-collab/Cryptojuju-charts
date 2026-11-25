/*
 * DEV historical 2-year gap collector. OFF by default. Every accepted window
 * is independently fetched twice from Bitunix LAST_PRICE, SHA verified,
 * inserted and archived atomically with its raw + readback evidence.
 * Persistent cursor resumes after restarts; unavailable HYPE history is
 * kept as unresolved gaps, never padded with synthetic candles.
 */
import {FIVE_CASES} from './five-by-five.mjs';
import {historicalTargetFor} from './historical-period.mjs';
import {HISTORICAL_TARGET} from '../historical-backfill-plan.mjs';
import {VERIFIED_INTERVALS} from '../research-batch.mjs';
import {fetchBitunixDataPilot} from '../bitunix-data-pilot.mjs';
import {compareBitunixReadbacks} from '../bitunix-readback-consistency.mjs';
import {makeBitunixFetchPage} from '../../bitunix-adapter.mjs';
import {initializeHistoricalLibrary,ingestVerifiedHistoricalSource}
  from './historical-library.mjs';
export const MAX_WINDOW_ATTEMPTS=5;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const currentFetch=()=>makeBitunixFetchPage({
  fetchImpl:(url,options)=>fetch(url,{...options,
    signal:AbortSignal.timeout(18000),cache:'no-store',credentials:'omit'})
});
async function ensureBackfillSchema(db){
  await initializeHistoricalLibrary(db);
  await db.query("CREATE TABLE IF NOT EXISTS cj_historical_backfill_cursor ("+
    "symbol text NOT NULL,timeframe text NOT NULL,next_ms bigint NOT NULL,"+
    "windows_seen integer NOT NULL DEFAULT 0,"+
    "last_attempt_at timestamptz,PRIMARY KEY(symbol,timeframe))");
  await db.query("CREATE TABLE IF NOT EXISTS cj_historical_backfill_attempts ("+
    "symbol text NOT NULL,timeframe text NOT NULL,"+
    "start_ms bigint NOT NULL,end_ms bigint NOT NULL,"+
    "status text NOT NULL,reason text,source_sha256 text,"+
    "checked_bars integer NOT NULL DEFAULT 0,inserted_bars integer NOT NULL DEFAULT 0,"+
    "attempts integer NOT NULL DEFAULT 1,"+
    "updated_at timestamptz NOT NULL DEFAULT now(),"+
    "PRIMARY KEY(symbol,timeframe,start_ms,end_ms))");
  await db.query("ALTER TABLE cj_historical_backfill_cursor ADD COLUMN IF NOT EXISTS target_start_ms bigint");
  for(const {symbol,timeframe} of FIVE_CASES){
    const target=historicalTargetFor(symbol,timeframe);
    // One-time rebase of HYPE only. Existing valid candles remain untouched;
    // overlap is deduplicated by the existing verified ingestion pipeline.
    await db.query("INSERT INTO cj_historical_backfill_cursor("+
      "symbol,timeframe,next_ms,target_start_ms) VALUES($1,$2,$3,$3) "+
      "ON CONFLICT(symbol,timeframe) DO UPDATE SET "+
      "next_ms=CASE WHEN $4 THEN excluded.next_ms ELSE cj_historical_backfill_cursor.next_ms END,"+
      "target_start_ms=excluded.target_start_ms "+
      "WHERE cj_historical_backfill_cursor.target_start_ms IS DISTINCT FROM excluded.target_start_ms",
      [symbol,timeframe,target.startMs,symbol==='HYPEUSDT']);
    if(symbol==='HYPEUSDT')
      await db.query("UPDATE cj_historical_backfill_attempts SET status=CASE "+
        "WHEN end_ms<=$3 THEN 'OUTSIDE_LISTING_ADJUSTED_TARGET' "+
        "ELSE 'SUPERSEDED_LISTING_BOUNDARY' END "+
        "WHERE symbol=$1 AND timeframe=$2 AND start_ms<$3 AND status='BLOCKED'",
        [symbol,timeframe,target.startMs]);
  }
}
export async function runHistoricalBackfillBatch(db,{
  limit=3,fetchPage=currentFetch(),pause=sleep,now=()=>Date.now(),
  fetchWindow=fetchBitunixDataPilot,elapsedBudgetMs=120000
}={}){
  if(!Number.isInteger(limit)||limit<1||limit>25||
    !Number.isInteger(elapsedBudgetMs)||elapsedBudgetMs<10000||elapsedBudgetMs>180000)
    throw Error('INVALID_BACKFILL_LIMIT_OR_BUDGET');
  const launchedAt=Date.now();
  await ensureBackfillSchema(db);
  const results=[];
  // Retry at most 20% of a batch (one slot minimum). Old BLOCKED rows
  // are the durable queue; no destructive migration or cursor rewind.
  const retryQuota=Math.max(1,Math.floor(limit/5));
  let retriesUsed=0;
  for(let iteration=0;iteration<limit;iteration++){
    if(iteration>0&&Date.now()-launchedAt>=elapsedBudgetMs)break;
    let retry=null;
    if(retriesUsed<retryQuota){
      const due=await db.query(
        "SELECT symbol,timeframe,start_ms,end_ms,attempts FROM cj_historical_backfill_attempts "+
        "WHERE status='BLOCKED' AND attempts<$1 AND "+
        "updated_at <= now() - interval '1 hour' * power(2,LEAST(attempts-1,4)) "+
        "ORDER BY updated_at,symbol,timeframe,start_ms LIMIT 1",[MAX_WINDOW_ATTEMPTS]);
      retry=due.rows[0]??null;
    }
    let pending;
    if(!retry){
      pending=await db.query(
        "SELECT symbol,timeframe,next_ms FROM cj_historical_backfill_cursor "+
        "WHERE next_ms<$1 ORDER BY last_attempt_at ASC NULLS FIRST,symbol,timeframe LIMIT 1",
        [HISTORICAL_TARGET.endTime]);
      if(!pending.rowCount)break;
    }else retriesUsed++;
    const {symbol,timeframe}=retry??pending.rows[0];
    const startMs=Number(retry?retry.start_ms:pending.rows[0].next_ms);
    const step=VERIFIED_INTERVALS[timeframe];
    const target=historicalTargetFor(symbol,timeframe);
    const n=retry?(Number(retry.end_ms)-startMs)/step:
      Math.min(480,(HISTORICAL_TARGET.endTime-startMs)/step);
    const endMs=startMs+n*step;
    if(!Number.isSafeInteger(startMs)||!step||startMs%step!==0||
      !Number.isInteger(n)||n<4||n>480||startMs<target.startMs||
      endMs>HISTORICAL_TARGET.endTime)
      throw Error('INVALID_BACKFILL_CURSOR_OR_FINAL_CHUNK');
    let status='BLOCKED',reason=null,checkedBars=0,insertedBars=0,hash=null;
    let abort=false;
    try{
      const have=await db.query('SELECT count(*)::int AS n FROM cj_historical_candles '+
        'WHERE symbol=$1 AND timeframe=$2 AND open_ms>=$3 AND open_ms<$4',
        [symbol,timeframe,startMs,endMs]);
      if(Number(have.rows[0]?.n)===n){
        status='ALREADY_PRESENT';checkedBars=n;
      }else{
        const selector={symbol,timeframe,closedBars:n,anchorBars:3,
          historicalEndExclusiveMs:endMs,nowMs:now(),fetchPage,retries:1};
        const first=await fetchWindow(selector);
        if(first.status!=='DATA_READY_FOR_RESEARCH_ONLY')
          throw Error('BITUNIX_SOURCE_'+String(first.reason??'NOT_READY'));
        const second=await fetchWindow({...selector,nowMs:now()});
        const repeat=compareBitunixReadbacks(first,second);
        if(repeat.status!=='STABLE_TWO_READS')
          throw Error('BITUNIX_DOUBLE_READ_'+String(repeat.reason??'NOT_STABLE'));
        const sourceKey='backfill-bitunix|'+symbol+'|'+timeframe+'|'+startMs;
        const imported=await ingestVerifiedHistoricalSource(db,{
          first,repeat,sourceKey,archiveEvidence:true});
        status='VERIFIED_TWO_READS_ARCHIVED';
        hash=first.provenance.rawSha256;
        checkedBars=n;insertedBars=imported.insertedBars;
      }
    }catch(e){
      reason=String(e?.message??e).slice(0,170);
      if(/CAPACITY_GUARD|STORAGE_BUDGET|database.*(connection|closed)/i.test(reason)||
        /^(08|53|57P0)/.test(String(e?.code??'')))
        abort=true;
    }
    // Never advance if PostgreSQL capacity is exhausted: avoid falsely
    // recording a gap as 'processed' when there was no space to keep it.
    if(abort)throw Error('HISTORICAL_BACKFILL_PAUSED_'+reason);
    await db.query("INSERT INTO cj_historical_backfill_attempts ("+
      "symbol,timeframe,start_ms,end_ms,status,reason,source_sha256,"+
      "checked_bars,inserted_bars) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) "+
      "ON CONFLICT(symbol,timeframe,start_ms,end_ms) DO UPDATE SET "+
      "status=excluded.status,reason=excluded.reason,"+
      "source_sha256=excluded.source_sha256,checked_bars=excluded.checked_bars,"+
      "inserted_bars=excluded.inserted_bars,attempts=cj_historical_backfill_attempts.attempts+1,"+
      "updated_at=now()",
      [symbol,timeframe,startMs,endMs,status,reason,hash,checkedBars,insertedBars]);
    if(!retry)await db.query("UPDATE cj_historical_backfill_cursor SET next_ms=$3,"+
      "windows_seen=windows_seen+1,last_attempt_at=now() "+
      "WHERE symbol=$1 AND timeframe=$2 AND next_ms=$4",
      [symbol,timeframe,endMs,startMs]);
    results.push({symbol,timeframe,startMs,endMs,status,
      checkedBars,insertedBars,reason,retry:!!retry,attemptNumber:retry?Number(retry.attempts)+1:1});
    if(iteration<limit-1)await pause(250);
  }
  const gaps=await db.query("SELECT count(*) FILTER (WHERE attempts<$1)::int AS queued,"+
    "count(*) FILTER (WHERE attempts>=$1)::int AS exhausted "+
    "FROM cj_historical_backfill_attempts WHERE status='BLOCKED'",[MAX_WINDOW_ATTEMPTS]);
  return {status:'HISTORICAL_TWO_YEAR_BACKFILL_BATCH_COMPLETE',
    targetStartUtc:new Date(HISTORICAL_TARGET.startTime).toISOString(),
    targetEndUtc:new Date(HISTORICAL_TARGET.endTime).toISOString(),
    attempted:results.length,
    verified:results.filter(r=>r.status==='VERIFIED_TWO_READS_ARCHIVED').length,
    alreadyPresent:results.filter(r=>r.status==='ALREADY_PRESENT').length,
    blocked:results.filter(r=>r.status==='BLOCKED').length,
    checkedBars:results.reduce((n,r)=>n+r.checkedBars,0),
    insertedBars:results.reduce((n,r)=>n+r.insertedBars,0),
    retryAttempts:retriesUsed,
    recovered:results.filter(r=>r.retry&&r.status!=='BLOCKED').length,
    queuedGaps:Number(gaps.rows[0]?.queued??0),
    exhaustedGaps:Number(gaps.rows[0]?.exhausted??0),
    listingAdjustedTargets:FIVE_CASES.filter(x=>x.symbol==='HYPEUSDT').map(x=>({...x,...historicalTargetFor(x.symbol,x.timeframe)})),
    samples:results.slice(0,25),noTrading:true,
    warning:'Unresolved gaps remain missing; after five attempts they require review. No synthetic bars or coverage claims.'};
}
