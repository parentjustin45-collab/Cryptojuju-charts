/* DEV ONLY: one-shot read-only Bitunix comparison, no strategy execution. */
import {auditBitunixBlocks} from './bitunix-block-diagnostic.mjs';
import {makeCryptoJujuFetchPage} from './cryptojuju-adapter.mjs';
const H=3600000,now=Math.floor(Date.now()/H)*H,start=now-24*H*14;
const fetchPage=makeCryptoJujuFetchPage();
const results=[];
for(const symbol of ['BTCUSDT','ETHUSDT','SOLUSDT']){
 try{
  const r=await auditBitunixBlocks(fetchPage,{symbol,startTime:start,endTime:now,blockBars:180,retries:2});
  results.push({symbol,initial:r.initial,final:{...r.final,missing:r.final.missing.slice(0,30),invalid:r.final.invalid.slice(0,30),duplicateTimes:r.final.duplicateTimes.slice(0,30),quarantinedTimes:r.final.quarantinedTimes.slice(0,30)},blocks:r.blocks,attempts:r.attempts});
 }catch(e){results.push({symbol,error:String(e?.stack??e)});}
}
const report={generatedAtUtc:new Date().toISOString(),period:{start:new Date(start).toISOString(),end:new Date(now).toISOString()},source:'public Bitunix through existing readonly CryptoJuju proxy',results};
console.log(JSON.stringify(report,null,2));
if(results.some(x=>x.error))process.exitCode=1;
