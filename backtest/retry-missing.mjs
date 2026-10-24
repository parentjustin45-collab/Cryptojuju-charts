/* Retry only missing/invalid 15m candles. Never fabricate OHLC values. */
import {makeBitunixFetchPage} from './bitunix-adapter.mjs';
import {makeCryptoJujuFetchPage} from './cryptojuju-adapter.mjs';
const intervalMs=900000,endTime=Math.floor(Date.now()/900000)*900000,startTime=endTime-7*86400000;
const expected=(endTime-startTime)/intervalMs,windowBars=190;
const sources=[['bitunixDirect',makeBitunixFetchPage()],['cryptojujuProxy',makeCryptoJujuFetchPage()]];
const validate=(r,t)=>{const c={time:Number(r.time),open:Number(r.open),high:Number(r.high),low:Number(r.low),close:Number(r.close),volume:Number(r.volume??0)};
 return c.time===t&&Object.values(c).every(Number.isFinite)&&c.open>0&&c.low>0&&c.high>=Math.max(c.open,c.close)&&c.low<=Math.min(c.open,c.close)&&c.volume>=0?c:null;};
async function check(name,fetchPage){
 const bars=new Map(),rejected=new Set(),outOfRange=[],rejectionDetails=new Map(),rawCounts=new Map();
 const explain=(r,t)=>{const o=Number(r.open),h=Number(r.high),l=Number(r.low),cl=Number(r.close),v=Number(r.volume??0);
  if(![o,h,l,cl,v].every(Number.isFinite))return 'NON_FINITE';
  if(o<=0||l<=0||v<0)return 'NON_POSITIVE_PRICE_OR_NEGATIVE_VOLUME';
  if(h<Math.max(o,cl))return 'HIGH_BELOW_OPEN_OR_CLOSE';
  if(l>Math.min(o,cl))return 'LOW_ABOVE_OPEN_OR_CLOSE';
  return 'OTHER_INVALID';};
 const record=(r,t,stage)=>{rawCounts.set(t,(rawCounts.get(t)??0)+1);const c=validate(r,t);if(c){bars.set(t,c);return true;}
  rejected.add(t);const reason=explain(r,t);const item=rejectionDetails.get(t)??{utc:new Date(t).toISOString(),reasons:[],samples:[]};
  if(!item.reasons.includes(reason))item.reasons.push(reason);
  if(item.samples.length<3)item.samples.push({stage,open:r.open,high:r.high,low:r.low,close:r.close,volume:r.volume});
  rejectionDetails.set(t,item);return false;};
 for(let from=startTime;from<endTime;from+=windowBars*intervalMs){
  const to=Math.min(endTime,from+windowBars*intervalMs);
  const rows=await fetchPage({symbol:'BTCUSDT',interval:'15m',startTime:from,endTime:to,limit:200});
  for(const r of rows){
   const t=Number(r.time);
   if(t<from||t>=to||!Number.isSafeInteger(t)){outOfRange.push(t);continue;}
   record(r,t,'initial');
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
     if(record(r,t,'retry-'+attempts)){resolved=true;break;}
     invalidSeen=true;
    }
   }catch(e){retryDetails.push({utc:new Date(t).toISOString(),attempt:attempts,error:String(e.message??e)});}
   if(resolved)break;
  }
  retryDetails.push({utc:new Date(t).toISOString(),resolved,attempts,invalidSeen});
 }
 const after=before.filter(t=>!bars.has(t));
 return {bars,quality:{initialValid:expected-before.length,missingBefore:before.length,recovered:before.length-after.length,missingAfter:after.length,rejectedUnique:rejected.size,outOfRange:outOfRange.length,unresolved:after.map(t=>new Date(t).toISOString()),retryDetails,unresolvedDiagnostics:after.map(t=>({utc:new Date(t).toISOString(),classification:rejectionDetails.has(t)?'REJECTED_INVALID_OHLC':'NOT_RETURNED',...(rejectionDetails.get(t)??{}),rawOccurrences:rawCounts.get(t)??0})),rejectionReasonCounts:[...rejectionDetails.values()].flatMap(x=>x.reasons).reduce((a,k)=>(a[k]=(a[k]??0)+1,a),{})}};
}
const results={},report={symbol:'BTCUSDT',interval:'15m',periodDays:7,expected,sources:{}};
for(const [name,fn] of sources){
 try{results[name]=await check(name,fn);report.sources[name]=results[name].quality;}
 catch(e){report.sources[name]={error:String(e.message??e)};}
}
if(results.bitunixDirect&&results.cryptojujuProxy){
 let compared=0,mismatches=0;
 for(const [t,a] of results.bitunixDirect.bars){const b=results.cryptojujuProxy.bars.get(t);if(!b)continue;compared++;if(['open','high','low','close'].some(k=>Math.abs(a[k]-b[k])>Math.max(1e-8,Math.abs(a[k])*1e-9)))mismatches++;}
 const onlyBitunix=[...results.bitunixDirect.bars.keys()].filter(t=>!results.cryptojujuProxy.bars.has(t));
 const onlyProxy=[...results.cryptojujuProxy.bars.keys()].filter(t=>!results.bitunixDirect.bars.has(t));
 report.comparison={compared,priceMismatches:mismatches,onlyBitunix:onlyBitunix.map(t=>new Date(t).toISOString()),onlyProxy:onlyProxy.map(t=>new Date(t).toISOString())};
}
report.status=report.comparison?.compared===expected&&report.comparison.priceMismatches===0?'PASS':'INCOMPLETE';
console.log(JSON.stringify(report,null,2));
if(report.status!=='PASS')process.exitCode=1;
