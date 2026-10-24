/* Retry only missing/invalid 15m candles. Never fabricate OHLC values. */
import {makeBitunixFetchPage} from './bitunix-adapter.mjs';
import {makeCryptoJujuFetchPage} from './cryptojuju-adapter.mjs';
const intervalMs=900000,endTime=Math.floor(Date.now()/900000)*900000,startTime=endTime-7*86400000;
const expected=(endTime-startTime)/intervalMs,windowBars=190;
const sources=[['bitunixDirect',makeBitunixFetchPage()],['cryptojujuProxy',makeCryptoJujuFetchPage()]];
const validate=(r,t)=>{const c={time:Number(r.time),open:Number(r.open),high:Number(r.high),low:Number(r.low),close:Number(r.close),volume:Number(r.volume??0)};
 return c.time===t&&Object.values(c).every(Number.isFinite)&&c.open>0&&c.low>0&&c.high>=Math.max(c.open,c.close)&&c.low<=Math.min(c.open,c.close)&&c.volume>=0?c:null;};
async function check(name,fetchPage){
 const bars=new Map(),rejected=new Set(),outOfRange=[];
 for(let from=startTime;from<endTime;from+=windowBars*intervalMs){
  const to=Math.min(endTime,from+windowBars*intervalMs);
  const rows=await fetchPage({symbol:'BTCUSDT',interval:'15m',startTime:from,endTime:to,limit:200});
  for(const r of rows){
   const t=Number(r.time);
   if(t<from||t>=to||!Number.isSafeInteger(t)){outOfRange.push(t);continue;}
   const c=validate(r,t);
   if(c)bars.set(t,c);else rejected.add(t);
  }
 }
 const before=[];
 for(let t=startTime;t<endTime;t+=intervalMs)if(!bars.has(t))before.push(t);
 const retryDetails=[];
 for(const t of before){
  let resolved=false,attempts=0,invalidSeen=false;
  for(const margin of [intervalMs,3*intervalMs]){
   attempts++;
   try{
    const rows=await fetchPage({symbol:'BTCUSDT',interval:'15m',startTime:t-margin,endTime:t+margin,limit:20});
    for(const r of rows){
     if(Number(r.time)!==t)continue;
     const c=validate(r,t);
     if(c){bars.set(t,c);resolved=true;break;}
     invalidSeen=true;
    }
   }catch(e){retryDetails.push({utc:new Date(t).toISOString(),attempt:attempts,error:String(e.message??e)});}
   if(resolved)break;
  }
  retryDetails.push({utc:new Date(t).toISOString(),resolved,attempts,invalidSeen});
 }
 const after=before.filter(t=>!bars.has(t));
 return {bars,quality:{initialValid:expected-before.length,missingBefore:before.length,recovered:before.length-after.length,missingAfter:after.length,rejectedUnique:rejected.size,outOfRange:outOfRange.length,unresolved:after.map(t=>new Date(t).toISOString()),retryDetails}};
}
const results={},report={symbol:'BTCUSDT',interval:'15m',periodDays:7,expected,sources:{}};
for(const [name,fn] of sources){
 try{results[name]=await check(name,fn);report.sources[name]=results[name].quality;}
 catch(e){report.sources[name]={error:String(e.message??e)};}
}
if(results.bitunixDirect&&results.cryptojujuProxy){
 let compared=0,mismatches=0;
 for(const [t,a] of results.bitunixDirect.bars){const b=results.cryptojujuProxy.bars.get(t);if(!b)continue;compared++;if(['open','high','low','close'].some(k=>Math.abs(a[k]-b[k])>Math.max(1e-8,Math.abs(a[k])*1e-9)))mismatches++;}
 report.comparison={compared,priceMismatches:mismatches};
}
report.status=report.comparison?.compared===expected&&report.comparison.priceMismatches===0?'PASS':'INCOMPLETE';
console.log(JSON.stringify(report,null,2));
if(report.status!=='PASS')process.exitCode=1;
