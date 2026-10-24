/* Diagnostic read-only: preserve original OHLC; measure exact envelope violations. */
import {makeBitunixFetchPage} from './bitunix-adapter.mjs';
import {makeCryptoJujuFetchPage} from './cryptojuju-adapter.mjs';
const step=900000,end=Math.floor(Date.now()/step)*step,start=end-7*86400000;
const sources=[['bitunixDirect',makeBitunixFetchPage()],['cryptojujuProxy',makeCryptoJujuFetchPage()]];
async function inspect(name,fetchPage){
 const rowsByTime=new Map(),errors=[];
 for(let from=start;from<end;from+=190*step){
  const to=Math.min(end,from+190*step);
  try{
   const rows=await fetchPage({symbol:'BTCUSDT',interval:'15m',startTime:from,endTime:to,limit:200});
   for(const r of rows){
    const t=Number(r.time);
    if(t>=from&&t<to&&Number.isSafeInteger(t))rowsByTime.set(t,r);
   }
  }catch(e){errors.push({windowStart:new Date(from).toISOString(),message:String(e.message??e)});}
 }
 const anomalies=[],missing=[];
 for(let t=start;t<end;t+=step){
  const r=rowsByTime.get(t);
  if(!r){missing.push(new Date(t).toISOString());continue;}
  const [o,h,l,c,v]=[r.open,r.high,r.low,r.close,r.volume??0].map(Number);
  if(![o,h,l,c,v].every(Number.isFinite)){anomalies.push({utc:new Date(t).toISOString(),reason:'NON_FINITE',raw:r});continue;}
  const highDeficit=Math.max(0,Math.max(o,c)-h),lowExcess=Math.max(0,l-Math.min(o,c));
  if(highDeficit||lowExcess||o<=0||l<=0||v<0){
   anomalies.push({utc:new Date(t).toISOString(),raw:{open:r.open,high:r.high,low:r.low,close:r.close,volume:r.volume},highDeficitUSDT:highDeficit,lowExcessUSDT:lowExcess,highDeficitPct:o>0?100*highDeficit/o:null,lowExcessPct:o>0?100*lowExcess/o:null,withinOneTenthUSDT:highDeficit<=0.10000001&&lowExcess<=0.10000001});
  }
 }
 return {count:rowsByTime.size,missing,anomalies,errors};
}
const report={symbol:'BTCUSDT',interval:'15m',startUTC:new Date(start).toISOString(),endUTC:new Date(end).toISOString(),sources:{}};
for(const [name,fetchPage] of sources)report.sources[name]=await inspect(name,fetchPage);
const a=report.sources.bitunixDirect,b=report.sources.cryptojujuProxy;
const map=new Map(b.anomalies.map(x=>[x.utc,x]));
report.anomalyComparison=a.anomalies.map(x=>({utc:x.utc,bitunix:x,proxy:map.get(x.utc)??null,rawMatch:JSON.stringify(x.raw)===JSON.stringify(map.get(x.utc)?.raw)}));
report.summary={bitunixAnomalies:a.anomalies.length,proxyAnomalies:b.anomalies.length,bitunixWithinOneTenth:a.anomalies.filter(x=>x.withinOneTenthUSDT).length,rawMatchingAnomalies:report.anomalyComparison.filter(x=>x.rawMatch).length,errors:a.errors.length+b.errors.length};
const summary = {
 symbol:report.symbol, interval:report.interval, startUTC:report.startUTC, endUTC:report.endUTC,
 directCandles:a.count, proxyCandles:b.count, directMissing:a.missing.length, proxyMissing:b.missing.length,
 ...report.summary,
 identicalRawAnomalies:report.summary.rawMatchingAnomalies===a.anomalies.length&&a.anomalies.length===b.anomalies.length,
 largestHighDeficitUSDT:Math.max(0,...a.anomalies.map(x=>x.highDeficitUSDT??0)),
 largestLowExcessUSDT:Math.max(0,...a.anomalies.map(x=>x.lowExcessUSDT??0)),
 sampleUTC:a.anomalies.slice(0,8).map(x=>x.utc),
 quality:report.summary.errors?'FETCH_ERROR':(a.missing.length||b.missing.length||a.anomalies.length||b.anomalies.length)?'UNSAFE_FOR_STRICT_BACKTEST':'CLEAN'
};
console.log(JSON.stringify(summary,null,2));
if(process.env.OHLC_VERBOSE==='1')console.log(JSON.stringify(report,null,2));
if(summary.quality!=='CLEAN')console.warn('Raw candles preserved; do not silently repair OHLC or treat this history as clean.');
if(report.summary.errors)process.exitCode=1;
