/* Read-only CryptoJuju proxy adapter for historical Bitunix klines.
   Uses the deployed /api/bitunix/proxy?url= route verified by diagnostics.
   All requests target the official Bitunix public kline endpoint.
*/
export function makeCryptoJujuFetchPage({fetchImpl=globalThis.fetch}={}){
 if(typeof fetchImpl!=='function')throw Error('fetch unavailable');
 return async ({symbol,interval,startTime,endTime,limit=200,signal})=>{
  if(!/^[A-Z0-9_]{3,40}$/.test(symbol))throw Error('Invalid symbol');
  if(!/^(1m|3m|5m|15m|30m|1h|2h|4h|6h|12h|1d|1w)$/.test(interval))throw Error('Invalid interval');
  if(!Number.isInteger(limit)||limit<1||limit>200)throw Error('Invalid limit');
  if(![startTime,endTime].every(Number.isSafeInteger)||startTime>=endTime)throw Error('Invalid range');
  const upstream=new URL('https://fapi.bitunix.com/api/v1/futures/market/kline');
  for(const [k,v] of Object.entries({symbol,interval,startTime,endTime,limit,type:'LAST_PRICE'}))upstream.searchParams.set(k,String(v));
  const url=new URL('https://cryptojuju-api.onrender.com/api/bitunix/proxy');
  url.searchParams.set('url',upstream.href);
  const response=await fetchImpl(url.href,{signal,cache:'no-store',credentials:'omit'});
  if(!response.ok)throw Error('CryptoJuju proxy HTTP '+response.status);
  const json=await response.json();
  if(json.code!==undefined&&!['0','200'].includes(String(json.code)))throw Error('CryptoJuju proxy Bitunix code '+json.code);
  const raw=json?.data?.list??json?.data;
  if(!Array.isArray(raw))throw Error('Unexpected CryptoJuju proxy response');
  return raw.map(k=>{
   const t=Number(Array.isArray(k)?k[0]:(k.time??k.ts??k.openTime));
   return {time:t<1e11?t*1000:t,open:Array.isArray(k)?k[1]:k.open,high:Array.isArray(k)?k[2]:k.high,low:Array.isArray(k)?k[3]:k.low,close:Array.isArray(k)?k[4]:k.close,volume:Array.isArray(k)?k[5]:(k.baseVol??k.volume??0)};
  });
 };
}
