/*
 * CryptoJuju historical library bridge (DEV).
 * Archive -> verified, deduplicated, canonical PostgreSQL candles.
 * Fail closed on missing two-read evidence, OHLC conflicts or disk budget.
 * No trading, LLM modification, purge, public endpoints or network access.
 */
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {FIVE_CASES,FIVE_TIMEFRAMES} from './five-by-five.mjs';
import {CANDIDATES,RANGE} from './level6-expansion-plan.mjs';
import {VERIFIED_INTERVALS} from '../research-batch.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const valid=(s,t)=>FIVE_CASES.some(x=>x.symbol===s&&x.timeframe===t);
const SHA=/^[a-f0-9]{64}$/i;
const SOURCE_PREFIX='hourly-bitunix|';
import {DEFAULT_STORAGE_BUDGET,storageBudget,storageState} from './storage-policy.mjs';
export const STORAGE_BUDGET=DEFAULT_STORAGE_BUDGET;
const FIELDS=['open','high','low','close','volume'];
export function validateHistoricalSource(first,repeat,{expansionOnly=false}={}){
  const m=first?.market??{},p=first?.provenance??{},w=first?.historyWindow??{};
  const bars=first?.acceptedCandles;
  const expansion=expansionOnly===true&&CANDIDATES.includes(m.symbol)&&FIVE_TIMEFRAMES.includes(m.timeframe)&&w.startTime>=RANGE.startMs&&w.endTime<=RANGE.endMs;
  if(!(valid(m.symbol,m.timeframe)||expansion)||m.exchange!=='Bitunix'||
    m.priceType!=='LAST_PRICE'||first.status!=='DATA_READY_FOR_RESEARCH_ONLY'||
    p.source!=='Bitunix public Futures REST'||p.priceType!=='LAST_PRICE'||
    p.formingBarExcluded!==true||first.role1?.status!=='PASS'||
    !SHA.test(p.rawSha256??'')||!SHA.test(p.derivedSha256??'')||
    !Array.isArray(first.rawRows)||!Array.isArray(bars)||
    bars.length<4||bars.length>960||first.quality?.unresolved!==0||
    sha(Buffer.from(JSON.stringify(first.rawRows)))!==p.rawSha256||
    sha(Buffer.from(JSON.stringify(bars)))!==p.derivedSha256)
    throw Error('UNVERIFIED_SOURCE_AND_SHA256');
  const n=bars.length,step=VERIFIED_INTERVALS[m.timeframe];
  if(w.intervalMs!==step||!Number.isSafeInteger(w.startTime)||
    w.startTime%step!==0||!Number.isSafeInteger(w.endTime)||
    w.endTime-w.startTime!==n*step||w.endTime>Date.now()+step)
    throw Error('INVALID_CLOSED_CANDLE_WINDOW');
  if(repeat?.status!=='STABLE_TWO_READS'||repeat.checkedDerived!==n||
    repeat.differenceCount!==0||repeat.firstRawSha256!==p.rawSha256||
    !SHA.test(repeat.overlapRawSha256First??'')||
    repeat.overlapRawSha256First!==repeat.overlapRawSha256Second||
    repeat.market?.symbol!==m.symbol||repeat.market?.timeframe!==m.timeframe||
    repeat.market?.exchange!=='Bitunix'||
    repeat.historyWindow?.startTime!==w.startTime||
    repeat.historyWindow?.endTime!==w.endTime||
    repeat.historyWindow?.intervalMs!==step)
    throw Error('DOUBLE_READ_PROVENANCE_INVALID');
  const rows=[];
  for(let i=0;i<n;i++){
    const c=bars[i],time=w.startTime+i*step;
    const x=FIELDS.map(k=>Number(c?.[k]));
    if(c?.time!==time||x.some(v=>!Number.isFinite(v))||
      x[0]<=0||x[3]<=0||x[2]<=0||x[4]<0||
      x[2]>Math.min(x[0],x[3])||x[1]<Math.max(x[0],x[3]))
      throw Error('INVALID_OR_NONCAUSAL_OHLC');
    rows.push({open_ms:time,open:x[0],high:x[1],low:x[2],
      close:x[3],volume:x[4],
      candle_sha256:sha(Buffer.from(JSON.stringify([m.symbol,m.timeframe,time,...x])))});
  }
  return {symbol:m.symbol,timeframe:m.timeframe,startMs:w.startTime,endMs:w.endTime,
    rawSha:p.rawSha256,derivedSha:p.derivedSha256,rows};
}
export async function initializeHistoricalLibrary(db){
  await db.query("CREATE TABLE IF NOT EXISTS cj_historical_candles ("+
    "symbol text NOT NULL,timeframe text NOT NULL,open_ms bigint NOT NULL,"+
    "open_price double precision NOT NULL,high_price double precision NOT NULL,"+
    "low_price double precision NOT NULL,close_price double precision NOT NULL,"+
    "volume double precision NOT NULL,candle_sha256 char(64) NOT NULL,"+
    "original_source_sha256 char(64) NOT NULL,"+
    "inserted_at timestamptz NOT NULL DEFAULT now(),"+
    "PRIMARY KEY(symbol,timeframe,open_ms),"+
    "CONSTRAINT cj_hist_ohlc_valid CHECK ("+
    "open_price>0 AND close_price>0 AND volume>=0 AND low_price>0 AND "+
    "high_price>=GREATEST(open_price,close_price) AND "+
    "low_price<=LEAST(open_price,close_price)))");
  await db.query("CREATE TABLE IF NOT EXISTS cj_historical_source_receipts ("+
    "source_key text PRIMARY KEY,symbol text NOT NULL,timeframe text NOT NULL,"+
    "start_ms bigint NOT NULL,end_ms bigint NOT NULL,"+
    "raw_sha256 char(64) NOT NULL,derived_sha256 char(64) NOT NULL,"+
    "checked_bars integer NOT NULL,inserted_bars integer NOT NULL,"+
    "verified_at timestamptz NOT NULL DEFAULT now(),"+
    "status text NOT NULL DEFAULT 'VERIFIED_TWO_READS')");
  await db.query("CREATE TABLE IF NOT EXISTS cj_historical_backfill_evidence ("+
    "source_key text PRIMARY KEY REFERENCES cj_historical_source_receipts(source_key),"+
    "first_sha256 char(64) NOT NULL,repeat_sha256 char(64) NOT NULL,"+
    "first_gzip bytea NOT NULL,repeat_gzip bytea NOT NULL,"+
    "first_raw_bytes integer NOT NULL,repeat_raw_bytes integer NOT NULL,"+
    "created_at timestamptz NOT NULL DEFAULT now())");
}
export async function ingestVerifiedHistoricalSource(db,{first,repeat,sourceKey,
  diskBudgetBytes=storageBudget(),archiveEvidence=false,expansionOnly=false}={}){
  if(typeof sourceKey!=='string'||sourceKey.length>220||sourceKey.length<10||
    !/^[A-Za-z0-9|:._/-]+$/.test(sourceKey))throw Error('INVALID_HISTORICAL_SOURCE_KEY');
  const v=validateHistoricalSource(first,repeat,{expansionOnly});
  if(expansionOnly&&(!CANDIDATES.includes(v.symbol)||!archiveEvidence||sourceKey!=='level6-bitunix|'+v.symbol+'|'+v.timeframe+'|'+v.startMs))throw Error('INVALID_EXPANSION_INGEST_SCOPE');
  if(!Number.isSafeInteger(diskBudgetBytes)||diskBudgetBytes<1e6)
    throw Error('INVALID_STORAGE_BUDGET');
  const client=await db.connect();
  try{
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('CJ_HISTORICAL_LIBRARY_V1'))");
    const r=await client.query('SELECT pg_database_size(current_database())::bigint AS bytes');
    const bytes=Number(r.rows[0]?.bytes);
    if(storageState(bytes,diskBudgetBytes).warning)
      throw Error('HISTORICAL_DATABASE_CAPACITY_GUARD');
    const prior=await client.query(
      'SELECT raw_sha256,derived_sha256,checked_bars FROM cj_historical_source_receipts WHERE source_key=$1',
      [sourceKey]);
    if(prior.rowCount){
      const p=prior.rows[0];
      if(String(p.raw_sha256).trim()!==v.rawSha||
        String(p.derived_sha256).trim()!==v.derivedSha||
        Number(p.checked_bars)!==v.rows.length)
        throw Error('HISTORICAL_SOURCE_KEY_CONFLICT');
      await client.query('COMMIT');
      return {status:'ALREADY_RECONCILED',sourceKey,checkedBars:v.rows.length,
        insertedBars:0,databaseBytesBefore:bytes};
    }
    const rows=v.rows.map(x=>({...x,symbol:v.symbol,timeframe:v.timeframe,
      original_source_sha256:v.rawSha}));
    const insertSql="INSERT INTO cj_historical_candles ("+
      "symbol,timeframe,open_ms,open_price,high_price,low_price,close_price,"+
      "volume,candle_sha256,original_source_sha256) "+
      "SELECT v.symbol,v.timeframe,v.open_ms,v.open,v.high,v.low,v.close,"+
      "v.volume,v.candle_sha256,v.original_source_sha256 "+
      "FROM jsonb_to_recordset($1::jsonb) AS v("+
      "symbol text,timeframe text,open_ms bigint,open double precision,"+
      "high double precision,low double precision,close double precision,"+
      "volume double precision,candle_sha256 text,original_source_sha256 text) "+
      "ON CONFLICT(symbol,timeframe,open_ms) DO NOTHING RETURNING open_ms";
    const ins=await client.query(insertSql,[JSON.stringify(rows)]);
    const readback=await client.query(
      'SELECT open_ms,trim(candle_sha256) AS fingerprint FROM cj_historical_candles '+
      'WHERE symbol=$1 AND timeframe=$2 AND open_ms>=$3 AND open_ms<$4 ORDER BY open_ms',
      [v.symbol,v.timeframe,v.startMs,v.endMs]);
    const found=new Map(readback.rows.map(x=>[Number(x.open_ms),x.fingerprint]));
    if(found.size!==rows.length||rows.some(x=>found.get(x.open_ms)!==x.candle_sha256))
      throw Error('HISTORICAL_OHLC_CONFLICT_OR_READBACK_MISSING');
    await client.query("INSERT INTO cj_historical_source_receipts ("+
      "source_key,symbol,timeframe,start_ms,end_ms,raw_sha256,derived_sha256,"+
      "checked_bars,inserted_bars) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [sourceKey,v.symbol,v.timeframe,v.startMs,v.endMs,v.rawSha,v.derivedSha,
        rows.length,ins.rowCount]);
    if(archiveEvidence){
      const body1=Buffer.from(JSON.stringify(first));
      const body2=Buffer.from(JSON.stringify(repeat));
      if(body1.length>16*1024*1024||body2.length>16*1024*1024)
        throw Error('HISTORICAL_BACKFILL_EVIDENCE_TOO_LARGE');
      const zipped1=gzipSync(body1,{level:6}),zipped2=gzipSync(body2,{level:6});
      await client.query("INSERT INTO cj_historical_backfill_evidence ("+
        "source_key,first_sha256,repeat_sha256,first_gzip,repeat_gzip,"+
        "first_raw_bytes,repeat_raw_bytes) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [sourceKey,sha(body1),sha(body2),zipped1,zipped2,
          body1.length,body2.length]);
    }
    await client.query('COMMIT');
    return {status:'RECONCILED',sourceKey,symbol:v.symbol,timeframe:v.timeframe,
      checkedBars:rows.length,insertedBars:ins.rowCount,
      reusedBars:rows.length-ins.rowCount,databaseBytesBefore:bytes};
  }catch(e){try{await client.query('ROLLBACK');}catch{}throw e;}
  finally{client.release();}
}
const FILE=/^data\/(BTCUSDT|ETHUSDT|SOLUSDT|HYPEUSDT|1000PEPEUSDT)-(15m|30m|1h|4h|1d)[.]json$/;
function unpack(row,prefix=''){
  const hash=String(row[prefix+'sha256']??'').trim();
  const bytes=Number(row[prefix+'raw_bytes']);
  const blob=row[prefix+'content'];
  if(!SHA.test(hash)||!Number.isSafeInteger(bytes)||bytes<2||
    bytes>16*1024*1024||!Buffer.isBuffer(blob))
    throw Error('ARCHIVE_META_INVALID');
  const out=gunzipSync(blob,{maxOutputLength:16*1024*1024});
  if(out.length!==bytes||sha(out)!==hash)throw Error('ARCHIVE_SHA256_MISMATCH');
  return JSON.parse(out.toString('utf8'));
}
export async function reconcileHourlyArchives(db,{limit=2,commit=false}={}){
  if(!Number.isInteger(limit)||limit<1||limit>25)throw Error('INVALID_BRIDGE_BATCH');
  const sql="SELECT m.slot,m.path,trim(m.sha256) AS sha256,"+
    "o.raw_bytes,o.content,trim(n.sha256) AS repeat_sha256,"+
    "r.raw_bytes AS repeat_raw_bytes,r.content AS repeat_content "+
    "FROM cj_archive_manifest m "+
    "JOIN cj_archive_objects o ON o.sha256=m.sha256 "+
    "LEFT JOIN cj_archive_manifest n ON n.agent=m.agent AND n.slot=m.slot "+
    "AND n.path=regexp_replace(m.path,'[.]json$','-repeatability.json') "+
    "LEFT JOIN cj_archive_objects r ON r.sha256=n.sha256 "+
    "LEFT JOIN cj_historical_source_receipts h ON h.source_key=("+
      "'hourly-bitunix|'||to_char(m.slot AT TIME ZONE 'UTC',"+
      "'YYYY-MM-DD\"T\"HH24:MI:SS')||'Z|'||m.path) "+
    "WHERE m.agent='bitunix-data' "+
    "AND m.path ~ '^data/(BTCUSDT|ETHUSDT|SOLUSDT|HYPEUSDT|1000PEPEUSDT)-(15m|30m|1h|4h|1d)[.]json$' "+
    "AND h.source_key IS NULL ORDER BY m.slot DESC,m.path LIMIT $1";
  const r=await db.query(sql,[limit]);
  const results=[];
  for(const row of r.rows){
    const parts=FILE.exec(row.path);if(!parts)continue;
    const sourceKey=SOURCE_PREFIX+new Date(row.slot).toISOString().replace('.000Z','Z')+
      '|'+row.path;
    try{
      if(!row.repeat_content)throw Error('ARCHIVED_DOUBLE_READ_MISSING');
      const first=unpack(row),repeat=unpack(row,'repeat_');
      const v=validateHistoricalSource(first,repeat);
      if(v.symbol!==parts[1]||v.timeframe!==parts[2])
        throw Error('ARCHIVE_MARKET_MISMATCH');
      const result=commit
        ?await ingestVerifiedHistoricalSource(db,{first,repeat,sourceKey})
        :{status:'DRY_RUN_VERIFIED',checkedBars:v.rows.length,insertedBars:0};
      results.push({sourceKey,...result});
    }catch(e){results.push({sourceKey,status:'BLOCKED',
      reason:String(e?.message??e).slice(0,180)});}
  }
  return {status:'CJ_HISTORICAL_BRIDGE_BATCH',scanned:r.rows.length,
    dryRun:!commit,results};
}
/*
 * Legacy 13-artifact bridge, bounded and optional.
 * Each source must carry a second independent readback within SAME artifact.
 * Never confuse stored summaries with verified raw/normalized OHLC.
 */
const LEGACY_PAIR=/^(BTCUSDT|ETHUSDT|SOLUSDT|HYPEUSDT|1000PEPEUSDT)-(15m|30m|1h|4h|1d)(-first)?[.]json$/;
export async function reconcileLegacyArchives(db,{limit=5,offset=0,commit=false}={}){
  if(!Number.isInteger(limit)||limit<1||limit>50||
    !Number.isInteger(offset)||offset<0||offset>5000)
    throw Error('INVALID_LEGACY_BRIDGE_CURSOR');
  const sourceSql="SELECT l.dataset,l.artifact_id,l.original_path,"+
    "trim(l.sha256) AS sha256,o.raw_bytes,o.content "+
    "FROM cj_legacy_file_refs l "+
    "JOIN cj_archive_objects o ON o.sha256=l.sha256 "+
    "WHERE l.original_path ~ '(^|/)(BTCUSDT|ETHUSDT|SOLUSDT|HYPEUSDT|1000PEPEUSDT)-(15m|30m|1h|4h|1d)(-first)?[.]json$' "+
    "ORDER BY l.artifact_id DESC,l.original_path LIMIT $1 OFFSET $2";
  const q=await db.query(sourceSql,[limit,offset]);
  const results=[];
  for(const row of q.rows){
    const basename=row.original_path.split('/').at(-1);
    const match=LEGACY_PAIR.exec(basename);
    if(!match)continue;
    const sourceKey='legacy-bitunix|'+row.artifact_id+'|'+basename;
    const secondPath=row.original_path.endsWith('-first.json')
      ?row.original_path.replace(/-first[.]json$/,'-readback.json')
      :row.original_path.replace(/[.]json$/,'-repeatability.json');
    try{
      const pair=await db.query("SELECT trim(l.sha256) AS sha256,o.raw_bytes,o.content "+
        "FROM cj_legacy_file_refs l JOIN cj_archive_objects o ON o.sha256=l.sha256 "+
        "WHERE l.dataset=$1 AND l.artifact_id=$2 AND l.original_path=$3 LIMIT 1",
        [row.dataset,row.artifact_id,secondPath]);
      if(pair.rowCount!==1)throw Error('LEGACY_DOUBLE_READ_NOT_ARCHIVED');
      const first=unpack(row),repeat=unpack(pair.rows[0]);
      const v=validateHistoricalSource(first,repeat);
      if(v.symbol!==match[1]||v.timeframe!==match[2])
        throw Error('LEGACY_FILENAME_MARKET_MISMATCH');
      const result=commit
        ?await ingestVerifiedHistoricalSource(db,{first,repeat,sourceKey})
        :{status:'DRY_RUN_VERIFIED',checkedBars:v.rows.length,insertedBars:0};
      results.push({sourceKey,...result});
    }catch(e){
      results.push({sourceKey,status:'BLOCKED',
        reason:String(e?.message??e).slice(0,150)});
    }
  }
  return {status:'CJ_LEGACY_HISTORY_BRIDGE',scanned:q.rows.length,
    offset,limit,dryRun:!commit,results};
}
/*
 * Indexed source for four-indicator replay: fully contiguous and individually
 * SHA-256 verified bars. Missing windows and modified candles fail closed.
 */
export async function loadContiguousHistoricalWindow(db,{symbol,timeframe,
  endMs,bars=480}={}){
  if(!valid(symbol,timeframe)||!Number.isInteger(bars)||bars<160||
    bars>960||!Number.isSafeInteger(endMs))
    throw Error('INVALID_HISTORICAL_REPLAY_REQUEST');
  const step=VERIFIED_INTERVALS[timeframe];
  if(endMs%step!==0||endMs>Math.floor(Date.now()/step)*step)
    throw Error('HISTORICAL_REPLAY_WINDOW_NOT_CLOSED');
  const startMs=endMs-bars*step;
  const q=await db.query(
    'SELECT open_ms,open_price,high_price,low_price,close_price,volume,'+
    'trim(candle_sha256) AS fingerprint FROM cj_historical_candles '+
    'WHERE symbol=$1 AND timeframe=$2 AND open_ms>=$3 AND open_ms<$4 '+
    'ORDER BY open_ms',[symbol,timeframe,startMs,endMs]);
  if(q.rows.length!==bars)throw Error('HISTORICAL_REPLAY_WINDOW_HAS_GAPS');
  const candles=[];
  for(let i=0;i<bars;i++){
    const r=q.rows[i],time=Number(r.open_ms);
    const c={time,open:Number(r.open_price),high:Number(r.high_price),
      low:Number(r.low_price),close:Number(r.close_price),volume:Number(r.volume)};
    const proof=sha(Buffer.from(JSON.stringify([symbol,timeframe,time,
      c.open,c.high,c.low,c.close,c.volume])));
    if(time!==startMs+i*step||r.fingerprint!==proof)
      throw Error('HISTORICAL_REPLAY_HASH_OR_CHRONOLOGY_MISMATCH');
    candles.push(c);
  }
  return {source:'CJ_HISTORICAL_POSTGRES_TWO_READ_VERIFIED_V1',
    market:{exchange:'Bitunix',priceType:'LAST_PRICE',symbol,timeframe},
    historyWindow:{startTime:startMs,endTime:endMs,intervalMs:step},
    candles,tradingEnabled:false};
}
export async function historicalCoverage(db,{
  startMs=Date.UTC(2024,10,24),endMs=Date.UTC(2026,10,24)
}={}){
  const r=await db.query('SELECT symbol,timeframe,count(*)::int AS unique_bars,'+
    'min(open_ms)::bigint AS first_open_ms,max(open_ms)::bigint AS last_open_ms '+
    'FROM cj_historical_candles WHERE open_ms>=$1 AND open_ms<$2 '+
    'GROUP BY symbol,timeframe ORDER BY symbol,timeframe',[startMs,endMs]);
  return r.rows.map(x=>({symbol:x.symbol,timeframe:x.timeframe,
    uniqueBars:Number(x.unique_bars),firstOpenMs:Number(x.first_open_ms),
    lastOpenMs:Number(x.last_open_ms)}));
}
