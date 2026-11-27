/* Bounded source-specific PostgreSQL streaming, no writes. */
import {createHash} from 'node:crypto';
import {VERIFIED_INTERVALS} from '../research-batch.mjs';
import {FIVE_CASES} from './five-by-five.mjs';
import {createStreamingReplay} from './streaming-originals.mjs';
const need=(x,m)=>{if(!x)throw Error(m)};
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export async function streamVerifiedPeriod(db,{exchange,symbol,timeframe,startMs,endMs,priceStep,pageSize=1000,onRow}){
 const step=VERIFIED_INTERVALS[timeframe];
 need(['Bitunix','Binance'].includes(exchange)&&FIVE_CASES.some(x=>x.symbol===symbol&&x.timeframe===timeframe)&&Number.isInteger(pageSize)&&pageSize>=100&&pageSize<=5000&&Number.isSafeInteger(startMs)&&Number.isSafeInteger(endMs)&&startMs%step===0&&endMs%step===0&&endMs>startMs&&endMs<=Math.floor(Date.now()/step)*step,'INVALID_SOURCE_PERIOD');
 const expected=(endMs-startMs)/step;need(expected<=2000000,'PERIOD_LIMIT');
 const bin=exchange==='Binance',table=bin?'cj_binance_um_candles':'cj_historical_candles';
 const replay=createStreamingReplay({priceStep,intervalMs:step}),seq=createHash('sha256');
 let cursor=startMs,pages=0;
 while(cursor<endMs){
  const count=Math.min(pageSize,(endMs-cursor)/step);
  const q=await db.query('SELECT open_ms,open_price,high_price,low_price,close_price,volume,trim(candle_sha256) AS fingerprint FROM '+table+' WHERE symbol=$1 AND timeframe=$2 AND open_ms >=$3 AND open_ms<$4 ORDER BY open_ms LIMIT $5',[symbol,timeframe,cursor,endMs,count]);
  need(q.rows.length===count,'SOURCE_GAP_AT_'+cursor);
  for(const r of q.rows){
   const b={time:Number(r.open_ms),open:Number(r.open_price),high:Number(r.high_price),low:Number(r.low_price),close:Number(r.close_price),volume:Number(r.volume)};
   need(b.time===cursor,'SOURCE_GAP_AT_'+cursor);
   const hash=sha([...(bin?['BINANCE_UM']:[]),symbol,timeframe,b.time,b.open,b.high,b.low,b.close,b.volume]);
   need(hash===r.fingerprint,'SOURCE_SHA_CONFLICT_AT_'+cursor);
   seq.update(hash+'\n');const out=replay.consume(b);onRow?.(out,b);cursor+=step;
  }pages++;
 }
 return {exchange,symbol,timeframe,startMs,endMs,expected,pages,sequenceSha256:seq.digest('hex'),...replay.finish()};
}
