/* CryptoJuju V1.26.0 — historical candle quality gate.
   No signals or trades are evaluated until this data gate passes.
*/
import {loadBitunixHistory} from './bitunix-history.mjs';
import {makeBitunixFetchPage} from './bitunix-adapter.mjs';

const INTERVAL_MS=Object.freeze({'1m':60000,'3m':180000,'5m':300000,'15m':900000,'30m':1800000,'1h':3600000,'2h':7200000,'4h':14400000,'6h':21600000,'12h':43200000,'1d':86400000,'1w':604800000});

export async function validateBitunixHistory({
 symbol='BTCUSDT',interval='15m',startTime,endTime,
 fetchPage=makeBitunixFetchPage(),limit=200,maxPages=100,signal
}={}){
 const intervalMs=INTERVAL_MS[interval];
 if(!intervalMs)throw Error('Unsupported interval for historical validation');
 const history=await loadBitunixHistory({symbol,interval,startTime,endTime,intervalMs,fetchPage,limit,maxPages,signal});
 const {candles,quality}=history;
 const expected=Math.ceil((endTime-startTime)/intervalMs);
 const first=candles[0]?.time??null;
 const last=candles.at(-1)?.time??null;
 const alignedStart=Math.ceil(startTime/intervalMs)*intervalMs;
 const alignedEnd=Math.floor((endTime-1)/intervalMs)*intervalMs;
 const issues=[];
 if(!candles.length)issues.push('NO_CANDLES');
 if(quality.truncated)issues.push('PAGE_LIMIT');
 if(quality.invalid.length)issues.push('INVALID_CANDLES');
 if(quality.duplicates.length)issues.push('DUPLICATES');
 if(quality.gaps.length)issues.push('GAPS');
 if(first!==null&&first>alignedStart)issues.push('MISSING_START');
 if(last!==null&&last<alignedEnd)issues.push('MISSING_END');
 if(candles.some(c=>c.time%intervalMs!==0))issues.push('MISALIGNED_TIMESTAMPS');
 return {
  status:issues.length?'FAIL':'PASS',
  symbol,interval,startTime,endTime,
  expectedApprox:expected,received:candles.length,
  first,last,pages:quality.pages,
  gaps:quality.gaps.length,duplicates:quality.duplicates.length,
  invalid:quality.invalid.length,truncated:quality.truncated,
  issues,history
 };
}
