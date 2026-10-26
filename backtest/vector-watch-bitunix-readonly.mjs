/* Read-only fresh Bitunix snapshot for WATCH staging smoke checks.
 * This is NOT a replay/synthetic signal generator; no keys, no orders.
 * Official exchange endpoint first through CryptoJuju proxy, direct Bitunix
 * only on transport failure. No cross-exchange fallback.
 */
import {pathToFileURL} from 'node:url';
import {makeCryptoJujuFetchPage} from './cryptojuju-adapter.mjs';
import {readVectorWatchState} from './vector-watch-browser.mjs';
const H=3600000;
export const LIVE_WATCH_LOCK=Object.freeze({
 protocol:'vector-watch-real-bitunix-futures-readonly-smoke-v1',
 symbols:['BTCUSDT','ETHUSDT','SOLUSDT'],
 timeframe:'1h',requestedBars:180,
 maxDataAgeBars:2,minContinuousClosedBars:55,limit:200,
 allowOtherExchanges:false,execution:false
});
const strict=(n,label)=>{const v=Number(n);if(!Number.isFinite(v))throw Error('Invalid '+label);return v;};
function convert(k){
 const a=Array.isArray(k);
 const time=strict(a?k[0]:(k.time??k.ts??k.openTime),'time');
 return {time:time<1e11?time*1000:time,
  open:strict(a?k[1]:k.open,'open'),high:strict(a?k[2]:k.high,'high'),
  low:strict(a?k[3]:k.low,'low'),close:strict(a?k[4]:k.close,'close'),
  volume:strict(a?k[5]:(k.baseVol??k.volume??0),'volume')};
}
async function upstream(symbol,startTime,endTime,fetchImpl){
 const u=new URL('https://fapi.bitunix.com/api/v1/futures/market/kline');
 for(const [k,v] of Object.entries({symbol,interval:'1h',startTime,endTime,
  limit:200,type:'LAST_PRICE'}))u.searchParams.set(k,String(v));
 const resp=await fetchImpl(u.href,{cache:'no-store',credentials:'omit'});
 if(!resp.ok)throw Error('Bitunix direct HTTP '+resp.status);
 const json=await resp.json();
 if(json.code!==undefined&&!['0','200'].includes(String(json.code)))
  throw Error('Bitunix direct response code '+json.code);
 const raw=json?.data?.list??json?.data;
 if(!Array.isArray(raw))throw Error('Unexpected Bitunix direct response');
 return raw.map(convert);
}
export function assessBitunixPage(rows,nowMs,{symbol='BTCUSDT',source='Bitunix'}={}){
 if(!Array.isArray(rows)||!Number.isSafeInteger(nowMs))
  throw Error('Invalid OHLC assessment');
 const bars=rows.map(convert).sort((a,b)=>a.time-b.time);
 if(bars.length<LIVE_WATCH_LOCK.minContinuousClosedBars)
  throw Error(symbol+' insufficient Bitunix raw OHLC');
 const unique=new Map(),excludedInvalid=[];
 for(const b of bars){
  if(unique.has(b.time))throw Error(symbol+' duplicate Bitunix OHLC');
  unique.set(b.time,b);
  if(b.time%H!==0 || b.time<=0 || b.time>nowMs||
    b.low<=0||b.high<b.low||b.high<Math.max(b.open,b.close)||
    b.low>Math.min(b.open,b.close)||b.volume<0){
   // Never repair an impossible OHLC candle; quarantine the entire bar.
   // The final continuous CLOSED tail must still have >=55 bars.
   excludedInvalid.push({time:b.time,open:b.open,high:b.high,low:b.low,close:b.close});
  }
 }
 const bad=new Set(excludedInvalid.map(b=>b.time));
 const nowSeconds=Math.floor(nowMs/1000);
 const closed=bars.filter(b=>!bad.has(b.time)&&b.time+H<=nowMs),contiguous=[];
 for(let i=closed.length-1;i>=0;i--){
  if(contiguous.length && contiguous[0].time-closed[i].time!==H)break;
  contiguous.unshift(closed[i]);
 }
 const ageMs=closed.length?nowMs-(closed.at(-1).time+H):Infinity;
 if(ageMs>LIVE_WATCH_LOCK.maxDataAgeBars*H)
  throw Error(symbol+' stale Bitunix last CLOSED bar '+Math.round(ageMs/H)+'h');
 if(contiguous.length<LIVE_WATCH_LOCK.minContinuousClosedBars)
  throw Error(symbol+' last continuous Bitunix candles only '+contiguous.length);
 const normalized=contiguous.map(b=>({...b,time:b.time/1000}));
 const state=readVectorWatchState(normalized,'1h',nowSeconds);
 if(!['possible','confirmed_idle','neutral'].includes(state.status))
  throw Error(symbol+' cannot evaluate WATCH from fresh Bitunix closed candles: '+state.status);
 return {symbol,source,latestClosedUtc:new Date(contiguous.at(-1).time).toISOString(),
  barsReceived:bars.length,excludedInvalidCount:excludedInvalid.length,
  excludedInvalidPreview:excludedInvalid.slice(0,4),
  continuousClosed:contiguous.length,
  dataAgeSeconds:Math.floor(ageMs/1000),WATCH:state,ohlc:normalized};
}
async function timedFetch(url,opts={}) {
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),18000);
 try{return await fetch(url,{...opts,signal:c.signal});}finally{clearTimeout(timer);}
}
export async function captureRealBitunix({nowMs=Date.now(),fetchPage=null,directFetch=timedFetch}={}){
 const end=Math.floor(nowMs/H)*H + H;
 const start=end-190*H;
 const proxy=fetchPage??makeCryptoJujuFetchPage({fetchImpl:timedFetch});
 const results=[];
 for(const symbol of LIVE_WATCH_LOCK.symbols){
  const failures=[];let verified=null;
  for(const source of ['CryptoJuju proxy / Bitunix','Bitunix direct']){
   try{
    const page=source.startsWith('CryptoJuju')?
     await proxy({symbol,interval:'1h',startTime:start,endTime:end,limit:200}):
     await upstream(symbol,start,end,directFetch);
    verified=assessBitunixPage(page,nowMs,{symbol,source});
    break;
   }catch(e){failures.push({source,error:String(e?.message??e)});}
  }
  if(!verified) results.push({symbol,status:'BLOCKED',failures});
  else results.push({status:'BITUNIX_VERIFIED',...verified,
   transportProblems:failures});
 }
 const status=results.every(x=>x.status==='BITUNIX_VERIFIED')?
  'BITUNIX_FRESH_SNAPSHOT_VERIFIED':'PARTIAL_OR_BLOCKED';
 return {status,protocol:LIVE_WATCH_LOCK.protocol,
  asOfUtc:new Date(nowMs).toISOString(),exchange:'Bitunix Futures',
  sourcePolicy:'Bitunix only, read-only, proxy before direct',
  symbols:results,
  caution:'Closed OHLC snapshot, NOT live websocket verification or a profitable strategy.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const r=await captureRealBitunix();
 process.stdout.write(JSON.stringify(r,null,2));
 if(r.status!=='BITUNIX_FRESH_SNAPSHOT_VERIFIED')process.exitCode=1;
}
