import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {FIVE_TIMEFRAMES,FIVE_CRYPTO_SYMBOLS} from './five-by-five.mjs';
import {VERIFIED_INTERVALS} from '../research-batch.mjs';
import {readBitunixContractPrecision} from '../bitunix-contract-precision.mjs';
import {makeBitunixFetchPage} from '../../bitunix-adapter.mjs';
import {fetchHourlyVerifiedWindow} from '../hourly-bitunix-recovery.mjs';
import {validateHistoricalSource} from './historical-library.mjs';
import {comparePair,START,END,WARMUP} from './cross-exchange-comparison.mjs';
const symbol=process.argv[2];if(!FIVE_CRYPTO_SYMBOLS.includes(symbol))throw Error('BAD_SYMBOL');
const meta=await readBitunixContractPrecision({symbols:[symbol]});const priceStep=meta.contracts[0].priceStep;
const fetchPage=makeBitunixFetchPage({fetchImpl:(url,opts)=>fetch(url,{...opts,signal:AbortSignal.timeout(18000),cache:'no-store',credentials:'omit'})});
const results=[];
for(const timeframe of FIVE_TIMEFRAMES){
 const step=VERIFIED_INTERVALS[timeframe],bin=JSON.parse(await readFile('cross-exchange-input/'+symbol+'-'+timeframe+'.json','utf8'));
 let row;
 try{
  if(bin.status!=='READY')throw Error('BINANCE_'+bin.reason);
  const bit=[],proofs=[];let p=START-WARMUP*step;
  while(p<END){let n=Math.min(480,(END-p)/step);const rem=(END-p)/step-n;if(rem>0&&rem<4)n-=4-rem;
   const stop=p+n*step,z=await fetchHourlyVerifiedWindow({symbol,timeframe,closedBars:n,nowMs:Date.now(),historicalEndExclusiveMs:stop,fetchPage,retries:1});
   if(z.readback.status!=='STABLE_TWO_READS')throw Error('BITUNIX_'+(z.first?.reason??z.readback.reason)+'_'+p);
   const v=validateHistoricalSource(z.first,z.readback);if(v.startMs!==p||v.endMs!==stop||v.rows.length!==n)throw Error('BITUNIX_WINDOW_MISMATCH');
   bit.push(...z.first.acceptedCandles);proofs.push({start:p,end:stop,rawSha256:z.first.provenance.rawSha256,derivedSha256:z.first.provenance.derivedSha256,anchors:z.anchorBars});p=stop;
  }
  row={status:'PASS',symbol,timeframe,...comparePair(bit,bin.rows,step,priceStep),binanceArchives:bin.receipts,bitunixProofs:proofs};
 }catch(e){row={status:'BLOCKED',symbol,timeframe,reason:String(e.message).slice(0,200)};}
 results.push(row);
 const {binanceArchives,bitunixProofs,...summary}=row;console.log('CJ_CROSS_EXCHANGE '+JSON.stringify(summary));
}
await mkdir('cross-exchange-output',{recursive:true});await writeFile('cross-exchange-output/'+symbol+'.json',JSON.stringify({start:START,end:END,warmup:WARMUP,results},null,2));
console.log('CJ_CROSS_EXCHANGE_SUMMARY '+JSON.stringify({symbol,passed:results.filter(x=>x.status==='PASS').length,expected:5,noTrading:true}));
if(results.some(x=>x.status!=='PASS'))process.exitCode=1;
