/*
 * Launch ONE limited, extended BTC 15m pilot after the usual 9x480 checks.
 * Writes traceable raw input, repeatability and CryptoJuju-only comparison.
 * Fails closed; no credentials, broker actions, production deployments.
 */
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {makeBitunixFetchPage} from '../bitunix-adapter.mjs';
import {readBitunixContractPrecision} from './bitunix-contract-precision.mjs';
import {runVectorDepthResearch,DEPTH_PILOT} from './vector-depth-research.mjs';
const folder=resolve(process.argv[2]??'bitunix-data-pilot-report');
await mkdir(folder,{recursive:true});
const summary={
 protocol:'CJ_BITUNIX_VECTOR_960_DEPTH_V1',
 status:'BLOCKED',pilot:DEPTH_PILOT,
 source:'Bitunix public Futures LAST_PRICE',tradingEnabled:false,
 autonomousAgents:false,independentTradingViewParity:false,
 atUtc:new Date().toISOString(),
 reason:null
};
async function archive(name,data){
 await writeFile(resolve(folder,name),JSON.stringify(data,null,2)+'\n');
}
try{
 const metadata=await readBitunixContractPrecision({symbols:['BTCUSDT']});
 await archive('vector-depth-BTC15m-contract-metadata.json',metadata);
 const contract=metadata.contracts[0];
 const fetchPage=makeBitunixFetchPage({
   fetchImpl:(url,opts)=>fetch(url,{
     ...opts,signal:AbortSignal.timeout(18000),
     cache:'no-store',credentials:'omit'
   })
 });
 const result=await runVectorDepthResearch({nowMs:Date.now(),fetchPage,contract});
 await archive('vector-depth-BTC15m-first-read.json',result.first);
 await archive('vector-depth-BTC15m-second-read.json',result.second);
 await archive('vector-depth-BTC15m-repeatability.json',result.repeatability);
 await archive('vector-depth-BTC15m-v11.json',result.baseline);
 await archive('vector-depth-BTC15m-v12-comparison.json',result.comparison);
 await archive('vector-depth-BTC15m-scorecard.json',result.scorecard);
 summary.status=result.status;
 summary.reason=result.reason;
 summary.error=result.error??null;
 summary.closedBars=result.first?.acceptedCandles?.length??0;
 summary.repeatedClosedBars=result.repeatability?.checkedDerived??0;
 summary.repeatDifferences=result.repeatability?.differenceCount??null;
 summary.modes=result.comparison?.modes.map(x=>({
   id:x.mode,signals:x.signalCount,
   meanDelayBars:x.timingDiagnostics?.meanConfirmationDelayBars,
   quickOppositeReversals:x.timingDiagnostics?.quickOppositeReversalPairs
 }))??[];
 summary.holdout=result.scorecard?.variants.map(x=>({
   mode:x.mode,trades:x.holdout.tradeCount,
   simulatedNetReturnPct:x.holdout.returnPct,
   simulatedDrawdownPct:x.holdout.maxDrawdownPct,
   sampleStatus:x.sampleStatus,
   promotionAuthorized:false
 }))??[];
}catch(e){
 summary.status='BLOCKED';
 summary.reason='PUBLIC_METADATA_OR_INGEST_EXCEPTION';
 summary.error=String(e?.message??e);
}
summary.disclaimer='Research on Bitunix closed historical bars only. The old 480 overlap is already inspected; no independent holdout or profit claim. No TradingView comparison or real trades.';
await archive('vector-depth-BTC15m-summary.json',summary);
const md=[
 '# CryptoJuju — Vector BTC 15m, extension à 960 chandelles',
 '',
 'État : **'+summary.status+'** · '+(summary.closedBars??0)+' chandelles acceptées',
 '',
 '| Variante | Trades holdout | Rendement net simulé | Drawdown simulé | Qualité |',
 '|---|---:|---:|---:|---|',
 ...(summary.holdout??[]).map(x=>[
   '| '+x.mode,x.trades,
   x.simulatedNetReturnPct.toFixed(2)+' %',
   x.simulatedDrawdownPct.toFixed(2)+' %',
   x.sampleStatus+' |'
 ].join(' | ')),
 '',
 'Aucune version promue; comparaison descriptive sur historique déjà partiellement inspecté.',
 'Source Bitunix seulement; sans TradingView, sans exécution réelle ni Render payant.'
];
await writeFile(resolve(folder,'vector-depth-BTC15m-report.md'),md.join('\n')+'\n');
console.log('DEPTH_VECTOR '+JSON.stringify({
 status:summary.status,closedBars:summary.closedBars,
 repeatedClosedBars:summary.repeatedClosedBars,
 repeatDifferences:summary.repeatDifferences,
 modes:summary.modes,holdout:summary.holdout,reason:summary.reason,error:summary.error
}));
if(summary.status!=='COMPLETE_RESEARCH_ONLY')process.exitCode=2;
