/*
 * After read-only Bitunix ingestion, observe actual Vector V1.1 signals
 * on accepted closed candles and simulate next-open historical fills.
 * Zero orders, zero tokens, zero production effects.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {PILOT_SYMBOLS,PILOT_TIMEFRAMES} from './bitunix-data-pilot.mjs';
import {readBitunixContractPrecision} from './bitunix-contract-precision.mjs';
import {auditRealVectorV11} from './vector-v11-real-research.mjs';

const folder=resolve(process.argv[2]??'bitunix-data-pilot-report');
const summary={
 protocol:'CJ_REAL_BITUNIX_VECTOR_V11_UNVERIFIED_RESEARCH_V1',
 runUtc:new Date().toISOString(),
 officialExchangeMetadata:true,
 independentTradingViewParity:false,
 tradingEnabled:false,
 continuousService:false,
 cases:[]
};
let contracts;
try {
 const metadata=await readBitunixContractPrecision();
 contracts=metadata.contracts;
 await writeFile(resolve(folder,'vector-v11-contract-precision.json'),
  JSON.stringify(metadata,null,2)+'\n');
}catch(e){
 summary.metadataError=String(e?.message??e);
 contracts=[];
}
for(const symbol of PILOT_SYMBOLS){
 for(const timeframe of PILOT_TIMEFRAMES){
   const id=`${symbol}-${timeframe}`;
   let result;
   try{
     const source=JSON.parse(await readFile(resolve(folder,`${id}.json`),'utf8'));
     const repeatability=JSON.parse(await readFile(resolve(folder,`${id}-repeatability.json`),'utf8'));
     const contract=contracts.find(x=>x.symbol===symbol);
     result=auditRealVectorV11({source,repeatability,contract});
   }catch(e){
     result={protocol:'CJ_BITUNIX_VECTOR_V11_RESEARCH_V1',
       status:'BLOCKED',market:{symbol,timeframe},
       reason:String(e?.message??e),signalEvents:[],
       warning:'No Vector research signals are authorized on this blocked configuration.'};
   }
   await writeFile(resolve(folder,`${id}-vector-v11.json`),JSON.stringify(result,null,2)+'\n');
   const entry={symbol,timeframe,status:result.status,
     signals:result.signalCount??0,
     trainingTrades:result.researchSimulation?.training.tradeCount??null,
     holdoutTrades:result.researchSimulation?.holdout.tradeCount??null,
     noLookaheadPrefixChecks:result.noLookaheadSampledPrefixes??0,
     reason:result.reason??null};
   summary.cases.push(entry);
   console.log('VECTOR_V11 '+JSON.stringify(entry));
 }
}
summary.passed=summary.cases.filter(x=>x.status==='RESEARCH_ONLY_UNVERIFIED_TV_PARITY').length;
summary.blocked=summary.cases.length-summary.passed;
summary.status=summary.blocked?'BLOCKED_OR_PARTIAL':'RESEARCH_SIGNAL_REPLAY_COMPLETE';
summary.warning='Actual Bitunix closed OHLC with a JS Vector V1.1 port. No independent TradingView parity, profitability certification, future prediction or autonomous trading.';
await writeFile(resolve(folder,'vector-v11-summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log('VECTOR_SUMMARY '+JSON.stringify({status:summary.status,passed:summary.passed,blocked:summary.blocked,metadataError:summary.metadataError??null}));
if(summary.blocked)process.exitCode=2;
