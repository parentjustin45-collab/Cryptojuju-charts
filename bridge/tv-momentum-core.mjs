/* TradingView -> CryptoJuju isolated Momentum Fusion CLOSED-BAR ingestion.
 * Reference-only, no API keys, no trading orders, no production routes.
 * Authentication happens before ANY storage; auth is never persisted.
 */
export const TV_PROTOCOL='cj-tv-momfusion-closedbar-v1';
export const TV_PROFILE='momfusion-pine-v6-defaults-2026-10-26';
export const TF_MS=Object.freeze({'15':900000,'30':1800000,'60':3600000,'240':14400000});
export const NUM_FIELDS=Object.freeze(['composite','rsi','stochRsi','momRaw','momentumRank','emaFast','emaSlow']);
export const BOOL_FIELDS=Object.freeze(['bullSignal','bearSignal','pivotLowConfirmed','pivotHighConfirmed']);
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const allowed=keys=>new Set(keys);
function exactKeys(o,fields,what){
 if(o===null||typeof o!=='object'||Array.isArray(o)||
    Object.keys(o).length!==fields.length||
    fields.some(k=>!Object.hasOwn(o,k)))
  throw Error('Invalid '+what+' structure');
}
export function validateTradingViewBar(raw,{nowMs=Date.now()}={}){
 const fields=['auth','protocol','profile','source','symbol','timeframe',
  'barOpenMs','barCloseMs','ohlc','values'];
 exactKeys(raw,fields,'payload');
 if(raw.protocol!==TV_PROTOCOL||raw.profile!==TV_PROFILE||raw.source!=='TradingView')
  throw Error('Unknown Pine source or protocol');
 if(typeof raw.symbol!=='string'||raw.symbol.length>80||
   !/^[A-Za-z0-9:_./-]{3,80}$/.test(raw.symbol)||
   !raw.symbol.includes(':'))
  throw Error('TradingView exchange:ticker required');
 const step=TF_MS[raw.timeframe];
 if(!step)throw Error('Unsupported timeframe: 15, 30, 60 or 240 required');
 const start=raw.barOpenMs,end=raw.barCloseMs;
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||
    start<=0||start%step!==0||end-start!==step)
  throw Error('Non-aligned or non-closed candle');
 if(!Number.isSafeInteger(nowMs)||nowMs<end-120000||nowMs>end+48*3600000)
  throw Error('Bar close time outside accepted delivery window');
 exactKeys(raw.ohlc,['open','high','low','close'],'OHLC');
 const o=raw.ohlc;
 if(![o.open,o.high,o.low,o.close].every(finite)||
    o.open<=0||o.close<=0||o.low<=0||
    o.high<Math.max(o.open,o.close)||o.low>Math.min(o.open,o.close))
  throw Error('Invalid price OHLC');
 exactKeys(raw.values,[...NUM_FIELDS,...BOOL_FIELDS],'indicator values');
 for(const k of NUM_FIELDS){
  const x=raw.values[k];
  if(x!==null&&!finite(x))throw Error('Invalid numeric field '+k);
  if(x!==null&&(k==='composite'||k==='rsi'||k==='stochRsi'||k==='momentumRank')&&
     (x<-.0001||x>100.0001))throw Error('Out of range '+k);
 }
 for(const k of BOOL_FIELDS)
  if(typeof raw.values[k]!=='boolean')throw Error('Invalid boolean '+k);
 if(typeof raw.auth!=='string'||raw.auth.length>256)
  throw Error('Invalid authentication field');
 // Never persist the credential or the untrusted incoming JSON.
 return {protocol:TV_PROTOCOL,profile:TV_PROFILE,source:'TradingView',
  symbol:raw.symbol,timeframe:raw.timeframe,barOpenMs:start,barCloseMs:end,
  ohlc:Object.fromEntries(['open','high','low','close'].map(k=>[k,o[k]])),
  values:Object.fromEntries([...NUM_FIELDS,...BOOL_FIELDS].map(k=>[k,raw.values[k]]))};
}
export function observationId(r){
 return [r.profile,r.symbol,r.timeframe,r.barOpenMs].join('|');
}
export function canonicalObservation(r){
 return JSON.stringify(r);
}
