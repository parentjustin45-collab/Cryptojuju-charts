/* Level 6.1 preflight, read-only. Existing cohort is immutable.
 * Candidate selection is not admission. No history writes or paid calls.
 */
import {createHash} from 'node:crypto';
import {FIVE_CRYPTO_SYMBOLS,FIVE_TIMEFRAMES} from './five-by-five.mjs';
import {storageState} from './storage-policy.mjs';
export const CANDIDATES=Object.freeze(['BNBUSDT','XRPUSDT','DOGEUSDT','ADAUSDT','AVAXUSDT']);
export const RANGE=Object.freeze({startMs:Date.UTC(2024,10,24),endMs:Date.UTC(2026,10,24)});
const INTERVALS={'1d':86400000,'4h':14400000,'1h':3600000,'30m':1800000,'15m':900000};
const PRIORITY=['1d','4h','1h','30m','15m'];
const ENDPOINT='https://fapi.bitunix.com/api/v1/futures/market/trading_pairs';
const need=(v,m)=>{if(!v)throw Error(m)};
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function normalizeContracts(payload){
 need(['0','200'].includes(String(payload?.code))&&Array.isArray(payload?.data),'INVALID_METADATA');
 return CANDIDATES.map(symbol=>{
  const rows=payload.data.filter(r=>r?.symbol===symbol);
  if(rows.length!==1)return {symbol,status:'BLOCKED_MISSING_OR_DUPLICATE'};
  const r=rows[0],quotePrecision=Number(r.quotePrecision),launchMs=Number(r.launchTime);
  if(r.symbolStatus!=='OPEN'||r.quotePrecision==null||!Number.isInteger(quotePrecision)||quotePrecision<0||quotePrecision>12||
     r.launchTime==null||!Number.isSafeInteger(launchMs)||launchMs<Date.UTC(2010,0,1)||launchMs>=RANGE.endMs)
   return {symbol,status:'BLOCKED_CONTRACT_METADATA'};
  return {symbol,status:'METADATA_VALID',launchMs,quotePrecision,priceStep:10**(-quotePrecision)};
 });
}
export function planCandidate(contract){
 need(CANDIDATES.includes(contract?.symbol)&&!FIVE_CRYPTO_SYMBOLS.includes(contract.symbol),'INVALID_EXPANSION_SYMBOL');
 if(contract.status!=='METADATA_VALID')return {...contract,targets:[]};
 need(Number.isSafeInteger(contract.launchMs)&&contract.launchMs<RANGE.endMs,'INVALID_LAUNCH');
 const targets=PRIORITY.map(timeframe=>{
  const step=INTERVALS[timeframe],startMs=Math.max(RANGE.startMs,Math.ceil(contract.launchMs/step)*step+3*step);
  const bars=Math.max(0,(RANGE.endMs-startMs)/step);
  return {symbol:contract.symbol,timeframe,startMs,endMs:RANGE.endMs,expectedBars:bars,coverageKind:startMs===RANGE.startMs?'FULL_TWO_YEAR':'LISTING_ADJUSTED_WITH_THREE_ANCHORS',status:bars>=160?'AWAITING_DOUBLE_READ':'BLOCKED_INSUFFICIENT_HISTORY'};
 });
 return {...contract,targets};
}
export async function preflightExpansion({db,fetchImpl=fetch}){
 const url=new URL(ENDPOINT);url.searchParams.set('symbols',CANDIDATES.join(','));
 const read=async()=>{const r=await fetchImpl(url.href,{method:'GET',cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(18000)});need(r.ok,'METADATA_HTTP');return normalizeContracts(await r.json());};
 const a=await read(),b=await read();need(sha(a)===sha(b),'METADATA_NOT_STABLE');
 const cap=await db.query('SELECT pg_database_size(current_database())::bigint AS bytes');
 const capacity=storageState(Number(cap.rows[0]?.bytes));
 const base=await db.query("SELECT symbol,timeframe,count(*)::int AS reports FROM cj_multiyear_replay_reports WHERE symbol=ANY($1::text[]) AND engine_version='CJ_FIVE_INDICATOR_TWO_YEAR_REPLAY_V1_20261124' GROUP BY symbol,timeframe",[FIVE_CRYPTO_SYMBOLS]);
 const baseKeys=new Set(base.rows.filter(r=>Number(r.reports)===1).map(r=>r.symbol+'|'+r.timeframe));
 const baseComplete=FIVE_CRYPTO_SYMBOLS.every(s=>FIVE_TIMEFRAMES.every(t=>baseKeys.has(s+'|'+t)));
 const exists=await db.query("SELECT to_regclass('public.cj_llm_structured_executions') AS t");
 let closedLoop=false;
 if(exists.rows[0]?.t){
  const q=await db.query("SELECT report,trim(report_sha256) AS sha FROM cj_llm_structured_executions WHERE status='COMPLETED' AND report::jsonb ? 'refinement' ORDER BY created_at DESC LIMIT 1");
  if(q.rowCount){const row=q.rows[0],x=JSON.parse(row.report);closedLoop=createHash('sha256').update(row.report).digest('hex')===row.sha&&x.refinement?.round>=1&&x.noTrading===true&&x.noPromotion===true&&x.holdoutUsed===false;}
 }
 const candidates=a.map(planCandidate),expectedNewBars=candidates.flatMap(c=>c.targets).filter(t=>t.status==='AWAITING_DOUBLE_READ').reduce((n,t)=>n+t.expectedBars,0);
 return {status:capacity.warning?'PAUSED_STORAGE':!baseComplete?'BASELINE_NOT_COMPLETE':!closedLoop?'WAITING_LEVEL55_REAL_CYCLE':'PREFLIGHT_READY_FOR_ADMISSION_REVIEW',existingSymbols:FIVE_CRYPTO_SYMBOLS,baselineArchivedPairs:baseKeys.size,metadataSha256:sha(a),candidates,expectedNewBars,capacity,closedLoop,noHistoryWrites:true,noTrading:true};
}
