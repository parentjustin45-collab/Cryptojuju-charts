/* Immutable Binance USD-M LAST_PRICE archive library, entirely separate from Bitunix.
 * Frozen inventory scope, published SHA256 + full CSV continuity + transactional readback.
 */
import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {inflateRawSync} from 'node:zlib';
import {storageState} from './storage-policy.mjs';
import {VERIFIED_INTERVALS} from '../research-batch.mjs';
const INV=JSON.parse(await readFile(new URL('../../research/binance-five-year-inventory-2026-11-27.json',import.meta.url),'utf8'));
export const PROTOCOL='CJ_BINANCE_UM_ARCHIVES_20261127_V1',TARGET=1280806;
const sha=x=>createHash('sha256').update(x).digest('hex');
const insist=(x,m)=>{if(!x)throw Error(m)};
const MAX_ZIP=4*1024*1024,MAX_CSV=16*1024*1024;
const ISO=x=>new Date(x).toISOString();
export function planArchives(){
 const jobs=[];
 for(const r of [...INV.results].sort((a,b)=>['1d','4h','1h','30m','15m'].indexOf(a.timeframe)-['1d','4h','1h','30m','15m'].indexOf(b.timeframe)||a.symbol.localeCompare(b.symbol))){
  insist(r.status==='INVENTORY_READY'&&!r.internalMissing.length,'INVENTORY_NOT_READY');
  const step=VERIFIED_INTERVALS[r.timeframe];let cursor=r.firstAvailableMs, count=0;
  while(cursor<r.endMs){
   const d=new Date(cursor),daily=d.getUTCFullYear()===2026&&d.getUTCMonth()===10;
   const period=ISO(cursor).slice(0,daily?10:7),start=daily?Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()):Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1);
   const end=daily?start+86400000:Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1);
   const name=r.symbol+'-'+r.timeframe+'-'+period+'.zip',key='data/futures/um/'+(daily?'daily':'monthly')+'/klines/'+r.symbol+'/'+r.timeframe+'/'+name;
   const endMs=Math.min(end,r.endMs),bars=(endMs-cursor)/step;
   insist(Number.isInteger(bars)&&bars>0&&bars<=3000,'BAD_TARGET');
   const boundary=r.samples.find(x=>x.key===key);
   jobs.push({key,symbol:r.symbol,timeframe:r.timeframe,startMs:cursor,endMs,bars,archiveStart:start,archiveEnd:end,expectedSha:boundary?.sha256??null,priority:jobs.length});
   cursor=endMs;count++;
  }
  insist(count===r.archiveCount,'ARCHIVE_COUNT_MISMATCH');
 }
 insist(jobs.length===1775&&jobs.reduce((n,x)=>n+x.bars,0)===TARGET&&new Set(jobs.map(x=>x.key)).size===1775,'INVENTORY_TOTAL_MISMATCH');
 return jobs;
}
export function extractCsv(zip,filename){
 // A single standard ZIP entry; support stored/deflate, reject encrypted/ZIP64/multi-entry.
 insist(Buffer.isBuffer(zip)&&zip.length>=22&&zip.length<=MAX_ZIP,'ZIP_SIZE');
 let end=-1;for(let i=zip.length-22;i>=Math.max(0,zip.length-65557);i--)if(zip.readUInt32LE(i)===0x06054b50&&i+22+zip.readUInt16LE(i+20)===zip.length){end=i;break;}
 insist(end>=0&&zip.readUInt16LE(end+4)===0&&zip.readUInt16LE(end+6)===0&&zip.readUInt16LE(end+8)===1&&zip.readUInt16LE(end+10)===1,'ZIP_DIRECTORY');
 const len=zip.readUInt32LE(end+12),c=zip.readUInt32LE(end+16);
 insist(c+len===end&&c+46<=end&&zip.readUInt32LE(c)===0x02014b50,'ZIP_CENTRAL');
 const flags=zip.readUInt16LE(c+8),method=zip.readUInt16LE(c+10),compressed=zip.readUInt32LE(c+20),size=zip.readUInt32LE(c+24),n=zip.readUInt16LE(c+28),extra=zip.readUInt16LE(c+30),comment=zip.readUInt16LE(c+32),local=zip.readUInt32LE(c+42);
 insist(!(flags&1)&&[0,8].includes(method)&&size>0&&size<=MAX_CSV&&compressed<=MAX_ZIP&&c+46+n+extra+comment===end&&zip.subarray(c+46,c+46+n).toString()===filename,'ZIP_ENTRY');
 insist(local===0&&zip.readUInt32LE(local)===0x04034b50&&zip.readUInt16LE(local+8)===method&&zip.readUInt16LE(local+6)===flags,'ZIP_LOCAL');
 const ln=zip.readUInt16LE(local+26),le=zip.readUInt16LE(local+28),start=local+30+ln+le;
 insist(zip.subarray(local+30,local+30+ln).toString()===filename&&start+compressed<=c,'ZIP_LOCAL_ENTRY');
 const bytes=zip.subarray(start,start+compressed),out=method===0?bytes:inflateRawSync(bytes,{maxOutputLength:MAX_CSV});
 insist(out.length===size,'ZIP_DECOMPRESSED_SIZE');return out.toString('utf8').replace(/^\uFEFF/,'');
}
export function parseArchive(j,zip,digest){
 insist(/^[0-9a-f]{64}$/.test(digest)&&sha(zip)===digest&&(!j.expectedSha||j.expectedSha===digest),'ARCHIVE_SHA_MISMATCH');
 const csv=extractCsv(zip,j.key.split('/').at(-1).replace(/\.zip$/,'.csv'));
 const step=VERIFIED_INTERVALS[j.timeframe],rows=[];let prior=null,first=null,last=null,total=0;
 for(const [i,line] of csv.trimEnd().split(/\r?\n/).entries()){
  const a=line.split(',');if(i===0&&['open_time','Open time','openTime'].includes(a[0]))continue;
  insist(a.length===12&&a.slice(0,7).every(x=>x.trim()!==''),'CSV_FIELDS');
  const t=Number(a[0]),[o,h,l,c,v]=a.slice(1,6).map(Number),close=Number(a[6]);
  insist(Number.isSafeInteger(t)&&t%step===0&&t>=j.archiveStart&&t<j.archiveEnd&&close===t+step-1&&[o,h,l,c,v].every(Number.isFinite)&&Math.min(o,l,c)>0&&h>=Math.max(o,c)&&l<=Math.min(o,c)&&v>=0&&(prior===null||t===prior+step),'CSV_OHLC_OR_GAP');
  prior=t;first??=t;last=t;total++;
  if(t>=j.startMs&&t<j.endMs)rows.push({open_ms:t,open:o,high:h,low:l,close:c,volume:v,candle_sha256:sha(JSON.stringify(['BINANCE_UM',j.symbol,j.timeframe,t,o,h,l,c,v]))});
 }
 insist(rows.length===j.bars&&rows.every((x,i)=>x.open_ms===j.startMs+i*step),'ARCHIVE_TARGET_GAP');
 const seq=createHash('sha256');for(const x of rows)seq.update(x.candle_sha256+'\n');
 return {rows,first,last,total,sequenceSha256:seq.digest('hex')};
}
async function boundedFetch(url,max,fetchImpl){
 const r=await fetchImpl(url,{signal:AbortSignal.timeout(8000),redirect:'error',cache:'no-store',credentials:'omit'});
 insist(r.ok,'BINANCE_HTTP_'+r.status);const reader=r.body.getReader();let size=0,parts=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;insist(size<=max,'DOWNLOAD_LIMIT');parts.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
 return Buffer.concat(parts);
}
export async function downloadArchive(j,fetchImpl=fetch){
 const url='https://data.binance.vision/'+j.key,check=(await boundedFetch(url+'.CHECKSUM',4096,fetchImpl)).toString().trim().split(/\s+/);
 insist(check.length===2&&check[1].replace(/^\*/,'')===j.key.split('/').at(-1)&&/^[a-f0-9]{64}$/i.test(check[0]),'CHECKSUM_FILE_INVALID');
 const zip=await boundedFetch(url,MAX_ZIP,fetchImpl),digest=check[0].toLowerCase();
 return {zip,digest,...parseArchive(j,zip,digest)};
}
export async function initBinance(db){
 await db.query("CREATE TABLE IF NOT EXISTS cj_binance_um_archive_queue (archive_key text PRIMARY KEY,protocol text NOT NULL,symbol text NOT NULL,timeframe text NOT NULL,start_ms bigint NOT NULL,end_ms bigint NOT NULL,bars integer NOT NULL,priority integer NOT NULL,status text NOT NULL DEFAULT 'PENDING',attempts integer NOT NULL DEFAULT 0,lease_token text,lease_until timestamptz,error text,updated_at timestamptz NOT NULL DEFAULT now())");
 await db.query("CREATE TABLE IF NOT EXISTS cj_binance_um_receipts (archive_key text PRIMARY KEY REFERENCES cj_binance_um_archive_queue(archive_key),zip_sha256 char(64) NOT NULL,sequence_sha256 char(64) NOT NULL,zip_bytes bytea NOT NULL,bars integer NOT NULL,verified_at timestamptz NOT NULL DEFAULT now())");
 await db.query("CREATE TABLE IF NOT EXISTS cj_binance_um_candles (symbol text NOT NULL,timeframe text NOT NULL,open_ms bigint NOT NULL,open_price double precision NOT NULL,high_price double precision NOT NULL,low_price double precision NOT NULL,close_price double precision NOT NULL,volume double precision NOT NULL,candle_sha256 char(64) NOT NULL,archive_key text NOT NULL REFERENCES cj_binance_um_receipts(archive_key),PRIMARY KEY(symbol,timeframe,open_ms),CHECK(open_price>0 AND close_price>0 AND low_price>0 AND volume>=0 AND high_price>=GREATEST(open_price,close_price) AND low_price<=LEAST(open_price,close_price)))");
 const jobs=planArchives();
 await db.query("INSERT INTO cj_binance_um_archive_queue(archive_key,protocol,symbol,timeframe,start_ms,end_ms,bars,priority) SELECT key,$2,symbol,timeframe,\"startMs\",\"endMs\",bars,priority FROM jsonb_to_recordset($1::jsonb) AS j(key text,symbol text,timeframe text,\"startMs\" bigint,\"endMs\" bigint,bars int,priority int) ON CONFLICT(archive_key) DO NOTHING",[JSON.stringify(jobs),PROTOCOL]);
 return new Map(jobs.map(x=>[x.key,x]));
}
async function persist(db,j,token,data){
 const c=await db.connect();
 try{
  await c.query('BEGIN');
  await c.query("SELECT pg_advisory_xact_lock(hashtext('CJ_BINANCE_UM_LIBRARY_V1'))");
  const q=await c.query("SELECT status,lease_token FROM cj_binance_um_archive_queue WHERE archive_key=$1 FOR UPDATE",[j.key]);
  insist(q.rows[0]?.status==='RUNNING'&&q.rows[0]?.lease_token===token,'LEASE_LOST');
  const size=await c.query('SELECT pg_database_size(current_database())::bigint AS bytes');
  insist(!storageState(Number(size.rows[0]?.bytes),undefined,data.zip.length+data.rows.length*1024).warning,'BINANCE_CAPACITY_GUARD');
  await c.query("INSERT INTO cj_binance_um_receipts(archive_key,zip_sha256,sequence_sha256,zip_bytes,bars) VALUES($1,$2,$3,$4,$5)",[j.key,data.digest,data.sequenceSha256,data.zip,j.bars]);
  const ins=await c.query("INSERT INTO cj_binance_um_candles(symbol,timeframe,open_ms,open_price,high_price,low_price,close_price,volume,candle_sha256,archive_key) SELECT $2,$3,v.open_ms,v.open,v.high,v.low,v.close,v.volume,v.candle_sha256,$4 FROM jsonb_to_recordset($1::jsonb) AS v(open_ms bigint,open double precision,high double precision,low double precision,close double precision,volume double precision,candle_sha256 text)",[JSON.stringify(data.rows),j.symbol,j.timeframe,j.key]);
  insist(ins.rowCount===j.bars,'INSERT_COUNT');
  const got=await c.query("SELECT open_ms,open_price,high_price,low_price,close_price,volume,trim(candle_sha256) AS sha FROM cj_binance_um_candles WHERE symbol=$1 AND timeframe=$2 AND open_ms>=$3 AND open_ms<$4 ORDER BY open_ms",[j.symbol,j.timeframe,j.startMs,j.endMs]);
  insist(got.rowCount===j.bars&&got.rows.every((x,i)=>Number(x.open_ms)===data.rows[i].open_ms&&x.sha===data.rows[i].candle_sha256&&sha(JSON.stringify(['BINANCE_UM',j.symbol,j.timeframe,Number(x.open_ms),...['open_price','high_price','low_price','close_price','volume'].map(k=>Number(x[k]))]))===x.sha),'DB_READBACK_SHA');
  const receipt=await c.query("SELECT zip_bytes,trim(zip_sha256) AS sha,trim(sequence_sha256) AS seq,bars FROM cj_binance_um_receipts WHERE archive_key=$1",[j.key]);
  insist(receipt.rowCount===1&&sha(receipt.rows[0].zip_bytes)===data.digest&&receipt.rows[0].sha===data.digest&&receipt.rows[0].seq===data.sequenceSha256&&Number(receipt.rows[0].bars)===j.bars,'RECEIPT_READBACK');
  await c.query("UPDATE cj_binance_um_archive_queue SET status='VERIFIED',lease_token=NULL,lease_until=NULL,error=NULL,updated_at=now() WHERE archive_key=$1 AND lease_token=$2",[j.key,token]);
  await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export async function runBinanceBatch(db,{limit=6,elapsedBudgetMs=20000,fetchImpl=fetch}={}){
 insist(Number.isInteger(limit)&&limit>=1&&limit<=6,'BAD_BATCH');
 if(process.memoryUsage().rss>350*1024*1024)return {status:'PAUSED_MEMORY'};
 const size=await db.query('SELECT pg_database_size(current_database())::bigint AS bytes');
 if(storageState(Number(size.rows[0]?.bytes)).warning)return {status:'PAUSED_STORAGE'};
 const jobs=await initBinance(db),start=Date.now(),results=[];
 await db.query("UPDATE cj_binance_um_archive_queue SET status='BLOCKED',error='FINAL_LEASE_EXPIRED',lease_token=NULL,lease_until=NULL WHERE protocol=$1 AND status='RUNNING' AND attempts>=5 AND lease_until<=now()",[PROTOCOL]);
 for(let i=0;i<limit&&(i===0||Date.now()-start<elapsedBudgetMs);i++){
  const token=randomUUID(),q=await db.query("WITH next AS (SELECT archive_key FROM cj_binance_um_archive_queue WHERE protocol=$1 AND attempts<5 AND (status='PENDING' OR (status IN ('RUNNING','RETRY') AND lease_until<=now())) ORDER BY attempts,priority FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE cj_binance_um_archive_queue j SET status='RUNNING',attempts=attempts+1,lease_token=$2,lease_until=now()+interval '10 minutes',updated_at=now() FROM next WHERE j.archive_key=next.archive_key RETURNING j.archive_key,j.bars,j.symbol,j.timeframe,j.start_ms,j.end_ms",[PROTOCOL,token]);
  if(!q.rowCount)break;
  const x=q.rows[0],j=jobs.get(x.archive_key);
  try{
   insist(j&&j.bars===Number(x.bars)&&j.symbol===x.symbol&&j.timeframe===x.timeframe&&j.startMs===Number(x.start_ms)&&j.endMs===Number(x.end_ms),'QUEUE_CONFLICT');
   const data=await downloadArchive(j,fetchImpl);await persist(db,j,token,data);
   results.push({key:j.key,bars:j.bars,status:'VERIFIED',sha:data.digest});
  }catch(e){const reason=String(e.message).slice(0,160);
   await db.query("UPDATE cj_binance_um_archive_queue SET status=CASE WHEN attempts>=5 THEN 'BLOCKED' ELSE 'RETRY' END,error=$3,lease_token=NULL,lease_until=now()+interval '1 hour'*power(2,LEAST(attempts-1,4)),updated_at=now() WHERE archive_key=$1 AND lease_token=$2",[x.archive_key,token,reason]);
   results.push({key:x.archive_key,status:'FAILED',reason});if(/CAPACITY|HTTP_429|HTTP_403|HTTP_451/.test(reason))break;
  }
 }
 const counts=(await db.query("SELECT status,count(*)::int AS archives,sum(bars)::int AS bars FROM cj_binance_um_archive_queue WHERE protocol=$1 GROUP BY status",[PROTOCOL])).rows;
 const verified=counts.find(x=>x.status==='VERIFIED');
 return {status:'BINANCE_BATCH_COMPLETE',verifiedBars:verified?.bars??0,verifiedArchives:verified?.archives??0,targetBars:TARGET,targetArchives:1775,counts,results,noTrading:true};
}
