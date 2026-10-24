/* CryptoJuju API historical candles adapter — read-only.
   The chart already uses /candles; this adapter is for comparison/diagnostics.
   The backend response is not assumed to be a complete requested date range.
*/
export function makeCryptoJujuFetchPage({fetchImpl=globalThis.fetch}={}){
 if(typeof fetchImpl!=='function')throw Error('fetch unavailable');
 return async ({symbol,interval,limit=200,signal})=>{
  if(!/^[A-Z0-9_]{3,40}$/.test(symbol))throw Error('Invalid symbol');
  if(!/^(1m|3m|5m|15m|30m|1h|2h|4h|6h|12h|1d|1w)$/.test(interval))throw Error('Invalid interval');
  if(!Number.isInteger(limit)||limit<1||limit>500)throw Error('Invalid limit');
  const url=new URL('https://cryptojuju-api.onrender.com/candles');
  url.searchParams.set('symbol',symbol);
  url.searchParams.set('interval',interval);
  url.searchParams.set('limit',String(limit));
  const response=await fetchImpl(url.href,{signal,cache:'no-store',credentials:'omit'});
  if(!response.ok)throw Error('CryptoJuju API HTTP '+response.status);
  const j=await response.json();
  if(j?.ok===false)throw Error('CryptoJuju candles endpoint reported failure');
  const payload=j?.data??j;
  const raw=payload?.data?.list??payload?.data??payload?.list??payload;
  if(!Array.isArray(raw))throw Error('Unexpected CryptoJuju candles response');
  return raw.map(k=>{
   const t=Number(Array.isArray(k)?k[0]:(k.time??k.ts??k.t??k.openTime));
   return {time:t<1e11?t*1000:t,open:Array.isArray(k)?k[1]:(k.open??k.o),high:Array.isArray(k)?k[2]:(k.high??k.h),low:Array.isArray(k)?k[3]:(k.low??k.l),close:Array.isArray(k)?k[4]:(k.close??k.c),volume:Array.isArray(k)?k[5]:(k.baseVol??k.volume??k.v??0)};
  });
 };
}
