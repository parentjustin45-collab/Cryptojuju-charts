/* Historical window validator: 7 days BTCUSDT 15m, 200 bars per request.
   Read-only; does not infer missing data or repair inconsistent prices. */
import {makeBitunixFetchPage} from './bitunix-adapter.mjs';
import {makeCryptoJujuFetchPage} from './cryptojuju-adapter.mjs';
const intervalMs=15*60*1000;
const endTime=Math.floor(Date.now()/intervalMs)*intervalMs;
const startTime=endTime-7*24*60*60*1000;
const windowBars=190; // Leave headroom for inclusive API boundaries.
const expected=(endTime-startTime)/intervalMs;
const sources=[['bitunixDirect',makeBitunixFetchPage()],['cryptojujuProxy',makeCryptoJujuFetchPage()]];
async function load(name,fetchPage){
 const candles=new Map(),invalid=[],outside=[],duplicates=[];
 let pages=0;
 for(let from=startTime;from<endTime;from+=windowBars*intervalMs){
  const to=Math.min(endTime,from+windowBars*intervalMs);
  const rows=await fetchPage({symbol:'BTCUSDT',interval:'15m',startTime:from,endTime:to,limit:200});
  pages++;
  if(!Array.isArray(rows))throw Error(name+' non-array response');
  for(const row of rows){
   const c={time:Number(row.time),open:Number(row.open),high:Number(row.high),low:Number(row.low),close:Number(row.close),volume:Number(row.volume??0)};
   if(!Number.isSafeInteger(c.time)||c.time<from||c.time>=to){outside.push(row.time);continue;}
   if(!Object.values(c).every(Number.isFinite)||c.time%intervalMs!==0||c.open<=0||c.low<=0||c.high<Math.max(c.open,c.close)||c.low>Math.min(c.open,c.close)||c.volume<0){invalid.push(row.time);continue;}
   if(candles.has(c.time))duplicates.push(c.time);
   candles.set(c.time,c);
  }
 }
 const missing=[];
 for(let t=startTime;t<endTime;t+=intervalMs)if(!candles.has(t))missing.push(t);
 return {candles,quality:{pages,receivedUnique:candles.size,invalid:invalid.length,outside:outside.length,duplicates:duplicates.length,missing:missing.length,missingSamples:missing.slice(0,8).map(t=>new Date(t).toISOString()),invalidSamples:invalid.slice(0,8).map(t=>new Date(t).toISOString())}};
}
const out={symbol:'BTCUSDT',interval:'15m',periodDays:7,expected,startUTC:new Date(startTime).toISOString(),endUTC:new Date(endTime).toISOString(),sources:{}};
const loaded={};
for(const [name,fetchPage] of sources){
 try{loaded[name]=await load(name,fetchPage);out.sources[name]=loaded[name].quality;}
 catch(error){out.sources[name]={error:String(error.message??error)};}
}
if(loaded.bitunixDirect&&loaded.cryptojujuProxy){
 let compared=0,mismatches=0;
 for(const [t,a] of loaded.bitunixDirect.candles){
  const b=loaded.cryptojujuProxy.candles.get(t);
  if(!b)continue;
  compared++;
  if(['open','high','low','close'].some(k=>Math.abs(a[k]-b[k])>Math.max(1e-8,Math.abs(a[k])*1e-9)))mismatches++;
 }
 out.comparison={compared,priceMismatches:mismatches};
}
out.status=Object.keys(loaded).length===2&&Object.values(loaded).every(x=>x.quality.missing===0&&x.quality.invalid===0)&&out.comparison?.compared===expected&&out.comparison.priceMismatches===0?'PASS':'FAIL';
console.log(JSON.stringify(out,null,2));
if(out.status!=='PASS')process.exitCode=1;
