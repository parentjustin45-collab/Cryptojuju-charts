/* Bitunix REST adapter for the V1.26.0 backtest loader.
   Uses the same official kline endpoint as index.html V1.25.2.
   No fallback exchange: failures are reported, not silently substituted.
*/
export function makeBitunixFetchPage({fetchImpl=globalThis.fetch,baseUrl='https://fapi.bitunix.com'}={}){
 const endpoint=new URL('/api/v1/futures/market/kline',baseUrl);
 if(endpoint.origin!=='https://fapi.bitunix.com')throw Error('Only official Bitunix endpoint permitted');
 if(typeof fetchImpl!=='function')throw Error('fetch unavailable');
 return async ({symbol,interval,startTime,endTime,limit=200,signal})=>{
  if(!/^[A-Z0-9_]{3,40}$/.test(symbol))throw Error('Invalid Bitunix symbol');
  if(!/^(1m|3m|5m|15m|30m|1h|2h|4h|6h|12h|1d|1w)$/.test(interval))throw Error('Unsupported interval');
  const url=new URL(endpoint);
  for(const [key,value] of Object.entries({symbol,interval,startTime,endTime,limit,type:'LAST_PRICE'}))url.searchParams.set(key,String(value));
  const response=await fetchImpl(url.href,{signal,cache:'no-store',credentials:'omit'});
  if(!response.ok)throw Error('Bitunix HTTP '+response.status);
  const json=await response.json();
  if(json.code!==undefined&&String(json.code)!=='0'&&String(json.code)!=='200')throw Error('Bitunix API code '+String(json.code));
  const data=json?.data?.list??json?.data;
  if(!Array.isArray(data))throw Error('Unexpected Bitunix kline response');
  return data.map(k=>{
   const t=Number(Array.isArray(k)?k[0]:(k.time??k.ts??k.openTime));
   return {time:t<1e11?t*1000:t,open:Array.isArray(k)?k[1]:k.open,high:Array.isArray(k)?k[2]:k.high,low:Array.isArray(k)?k[3]:k.low,close:Array.isArray(k)?k[4]:k.close,volume:Array.isArray(k)?k[5]:(k.baseVol??k.volume??0)};
  });
 };
}
