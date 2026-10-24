/* Compare direct Bitunix and CryptoJuju server candles, read-only.
   Only overlapping, CLOSED 15m bars are compared; never places orders.
*/
import {makeBitunixFetchPage} from './bitunix-adapter.mjs';
import {makeCryptoJujuFetchPage} from './cryptojuju-adapter.mjs';
const intervalMs=900000;
const endTime=Math.floor(Date.now()/intervalMs)*intervalMs;
const startTime=endTime-48*3600000;
const normalize=rows=>{
 const map=new Map(),invalid=[];
 for(const row of rows){
  const c={time:Number(row.time),open:Number(row.open),high:Number(row.high),low:Number(row.low),close:Number(row.close),volume:Number(row.volume??0)};
  if(!Object.values(c).every(Number.isFinite)||c.time<startTime||c.time>=endTime||c.time%intervalMs!==0||c.open<=0||c.low<=0||c.high<Math.max(c.open,c.close)||c.low>Math.min(c.open,c.close)||c.volume<0){invalid.push({time:row.time});continue;}
  map.set(c.time,c);
 }
 return {map,invalid};
};
const results=await Promise.allSettled([
 makeBitunixFetchPage()({symbol:'BTCUSDT',interval:'15m',startTime,endTime,limit:200}),
 makeCryptoJujuFetchPage()({symbol:'BTCUSDT',interval:'15m',startTime,endTime,limit:200})
]);
const names=['bitunixDirect','cryptojujuServer'];
const out={requested:{symbol:'BTCUSDT',interval:'15m',startTime,endTime},sources:{}};
for(let i=0;i<results.length;i++){
 const result=results[i];
 if(result.status==='rejected'){out.sources[names[i]]={error:String(result.reason?.message??result.reason)};continue;}
 const {map,invalid}=normalize(result.value);
 out.sources[names[i]]={received:result.value.length,valid:map.size,invalid:invalid.length,first:Math.min(...map.keys()),last:Math.max(...map.keys()),invalidSamples:invalid.slice(0,10)};
 out[names[i]]=map;
}
if(out.bitunixDirect&&out.cryptojujuServer){
 const common=[...out.bitunixDirect.keys()].filter(t=>out.cryptojujuServer.has(t));
 const mismatches=[];
 for(const t of common){
  const a=out.bitunixDirect.get(t),b=out.cryptojujuServer.get(t);
  for(const key of ['open','high','low','close']){
   if(Math.abs(a[key]-b[key])>Math.max(1e-8,Math.abs(a[key])*1e-9)){
    mismatches.push({time:t,field:key,direct:a[key],server:b[key]});break;
   }
  }
 }
 out.comparison={overlapping:common.length,priceMismatches:mismatches.length,samples:mismatches.slice(0,10),onlyDirect:[...out.bitunixDirect.keys()].filter(t=>!out.cryptojujuServer.has(t)).length,onlyServer:[...out.cryptojujuServer.keys()].filter(t=>!out.bitunixDirect.has(t)).length};
}
delete out.bitunixDirect;delete out.cryptojujuServer;
console.log(JSON.stringify(out,null,2));
if(results.some(r=>r.status==='rejected') || !out.comparison || out.comparison.priceMismatches>0) {
 console.error('Comparison incomplete or mismatched: both sources must succeed and prices must agree');
 process.exitCode=1;
}
