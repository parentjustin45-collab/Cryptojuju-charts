/* Role 1: strict Bitunix historical OHLC acceptance. */
import {classifyHistory} from '../../quality-gate.mjs';
import {VERIFIED_INTERVALS} from '../research-batch.mjs';
import {record} from './shared.mjs';
export function auditData(input) {
  const market=input?.market,window=input?.historyWindow,candles=input?.candles;
  if (!market || market.exchange!=='Bitunix' || market.priceType!=='LAST_PRICE'
      || !/^[A-Z0-9_]{3,40}$/.test(market.symbol??'')
      || !Object.hasOwn(VERIFIED_INTERVALS,market.timeframe)
      || !window || window.intervalMs!==VERIFIED_INTERVALS[market.timeframe])
    return record('bitunix-data','BLOCKED',{reason:'Unsupported or non-verified market/timeframe'});
  try {
    const audit=classifyHistory(candles,window);
    return record('bitunix-data',audit.status==='READY' && audit.quality.outOfRange===0?'PASS':'BLOCKED',{
      status:audit.status,quality:audit.quality,
      examples:{invalid:audit.issues.slice(0,3),missing:audit.missing.slice(0,3),duplicates:audit.quality.duplicates}
    });
  } catch (err) {
    return record('bitunix-data','BLOCKED',{reason:String(err?.message??err)});
  }
}
