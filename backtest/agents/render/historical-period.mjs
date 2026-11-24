/* CryptoJuju multi-year verified PostgreSQL OHLC reader, DEV only.
 * Loads a continuous UTC range using bounded SQL pages. It never extrapolates
 * holes, changes historical values, or claims pre-listing coverage.
 */
import {createHash} from 'node:crypto';
import {FIVE_CASES} from './five-by-five.mjs';
import {VERIFIED_INTERVALS} from '../research-batch.mjs';

const accepted=(s,t)=>FIVE_CASES.some(x=>x.symbol===s&&x.timeframe===t);
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export const TWO_YEAR_RANGE=Object.freeze({
  startMs:Date.UTC(2024,10,24),endMs:Date.UTC(2026,10,24)
});
export function expectedHistoricalBars({timeframe,startMs,endMs}){
  const step=VERIFIED_INTERVALS[timeframe];
  if(!step||!Number.isSafeInteger(startMs)||!Number.isSafeInteger(endMs)||
    startMs%step!==0||endMs%step!==0||endMs<=startMs)
    throw Error('INVALID_HISTORICAL_RANGE');
  const n=(endMs-startMs)/step;
  if(!Number.isSafeInteger(n)||n<160||n>80000)throw Error('UNSUPPORTED_HISTORICAL_BAR_COUNT');
  return n;
}
export async function loadHistoricalPeriod(db,{symbol,timeframe,
  startMs=TWO_YEAR_RANGE.startMs,endMs=TWO_YEAR_RANGE.endMs,
  pageSize=2000}={}){
  if(!accepted(symbol,timeframe)||!Number.isInteger(pageSize)||
    pageSize<100||pageSize>5000)throw Error('INVALID_HISTORICAL_PERIOD_REQUEST');
  const count=expectedHistoricalBars({timeframe,startMs,endMs});
  const step=VERIFIED_INTERVALS[timeframe];
  if(endMs>Math.floor(Date.now()/step)*step)
    throw Error('HISTORICAL_PERIOD_NOT_FULLY_CLOSED');
  const candles=[];
  const fullHash=createHash('sha256');
  let next=startMs,pages=0;
  while(next<endMs){
    const limit=Math.min(pageSize,(endMs-next)/step);
    const q=await db.query(
      'SELECT open_ms,open_price,high_price,low_price,close_price,volume,'+
      'trim(candle_sha256) AS fingerprint FROM cj_historical_candles '+
      'WHERE symbol=$1 AND timeframe=$2 AND open_ms >=$3 AND open_ms<$4 '+
      'ORDER BY open_ms LIMIT $5',[symbol,timeframe,next,endMs,limit]);
    if(q.rows.length!==limit)
      throw Error('HISTORICAL_PERIOD_HAS_MISSING_BARS_AT_'+next);
    for(const row of q.rows){
      const time=Number(row.open_ms),c={
        time,open:Number(row.open_price),high:Number(row.high_price),
        low:Number(row.low_price),close:Number(row.close_price),volume:Number(row.volume)
      };
      const vals=[c.open,c.high,c.low,c.close,c.volume];
      if(time!==next||vals.some(v=>!Number.isFinite(v))||
        c.open<=0||c.low<=0||c.close<=0||c.volume<0||
        c.high<Math.max(c.open,c.close)||c.low>Math.min(c.open,c.close))
        throw Error('HISTORICAL_PERIOD_INVALID_ROW_AT_'+next);
      const digest=sha([symbol,timeframe,time,...vals]);
      if(row.fingerprint!==digest)
        throw Error('HISTORICAL_PERIOD_SHA256_CONFLICT_AT_'+next);
      fullHash.update(digest+'\n');
      candles.push(c);
      next+=step;
    }
    pages++;
  }
  if(candles.length!==count)throw Error('HISTORICAL_PERIOD_LENGTH_MISMATCH');
  return {source:'CJ_HISTORICAL_POSTGRES_TWO_READ_VERIFIED_V1',
    status:'CONTIGUOUS_SHA256_VERIFIED_UTC',
    market:{exchange:'Bitunix',priceType:'LAST_PRICE',symbol,timeframe},
    historyWindow:{startTime:startMs,endTime:endMs,intervalMs:step},
    barCount:count,pages,sequenceSha256:fullHash.digest('hex'),
    candles,ordersPlaced:0};
}
