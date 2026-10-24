/* Manual Bitunix historical-data smoke test; no trades, keys or orders.
   Usage: node backtest/bitunix-smoke.mjs
*/
import {validateBitunixHistory} from './history-validation.mjs';
import {makeBitunixFetchPage} from './bitunix-adapter.mjs';

const intervalMs=15*60*1000;
const endTime=Math.floor((Date.now()-intervalMs)/intervalMs)*intervalMs;
const startTime=endTime-2*24*60*60*1000;
const fetchImpl=async(url,options)=>{
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),12000);
 try {
  const response=await fetch(url,{...options,signal:controller.signal});
  if(!response.ok)throw Error('Bitunix HTTP '+response.status);
  return response;
 } finally {clearTimeout(timeout);}
};
try{
 const report=await validateBitunixHistory({
  symbol:'BTCUSDT',interval:'15m',startTime,endTime,
  fetchPage:makeBitunixFetchPage({fetchImpl}),limit:200,maxPages:10
 });
 const {history,...summary}=report;
 console.log(JSON.stringify({...summary,firstUTC:report.first===null?null:new Date(report.first).toISOString(),lastUTC:report.last===null?null:new Date(report.last).toISOString()},null,2));
 if(report.status!=='PASS')process.exitCode=1;
}catch(error){
 console.error('Bitunix smoke test failed:',error?.message??String(error));
 process.exitCode=1;
}
