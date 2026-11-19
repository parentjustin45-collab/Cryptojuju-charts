/*
 * Five-market Daily (1D) pilot. Official public Bitunix LAST_PRICE,
 * verified closed UTC candles, same-window double read. Research only.
 * Fully independent of the nine-market 15M/1H/4H ingestion pipeline.
 */
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {makeBitunixFetchPage} from '../bitunix-adapter.mjs';
import {DAILY_RESEARCH_SYMBOLS} from './bitunix-data-pilot.mjs';
import {readCryptoJujuWatchlist,fetchOpenContractMetadata} from './market-universe-50.mjs';
import {auditDailyVectorMarket} from './daily-vector-research.mjs';

const folder=resolve(process.argv[2]??'daily-bitunix-research-report');
await mkdir(folder,{recursive:true});
const nowMs=Date.now();
const out={
 protocol:'CJ_5_MARKET_DAILY_BITUNIX_VECTOR_RESEARCH_V1',
 status:'BLOCKED',testedAtUtc:new Date(nowMs).toISOString(),
 branch:process.env.GITHUB_REF_NAME??'dev/ai-agents-phase1',
 source:'Bitunix official public Futures LAST_PRICE',
 chartTimeframe:'1d',requestedClosedBars:365,allowedShorterDepth:180,
 fourTimeframeResearchSupport:true,
 productionChanged:false,tradingEnabled:false,autoPromotion:false,
 independentTradingViewParity:false,
 samples:[]
};
const costsWarning='Fixed historical backtest fees/slippage do NOT verify actual commodity, stock-linked, meme-token spread, funding, market hours or execution.';
const store=async(name,value)=>writeFile(join(folder,name),JSON.stringify(value,null,2)+'\n');
const fetchPage=makeBitunixFetchPage({
 fetchImpl:(url,options)=>fetch(url,{
  ...options,signal:AbortSignal.timeout(18000),cache:'no-store',credentials:'omit'
 })
});
let watchlist,contracts;
try{
 const html=await readFile(resolve('index.html'),'utf8');
 watchlist=readCryptoJujuWatchlist(html);
 contracts=await fetchOpenContractMetadata();
 out.siteWatchlistEntries=watchlist.total;
 out.siteUniqueSymbols=watchlist.unique;
 out.siteWatchlistSha256=watchlist.sha256;
 out.exchangeMetadataCount=contracts.length;
}catch(e){
 out.error='Cannot verify site watchlist or official Bitunix registry: '+
  String(e?.message??e);
}
if(watchlist&&contracts){
 const site=new Set(watchlist.symbols);
 for(const symbol of DAILY_RESEARCH_SYMBOLS){
   const exact=contracts.filter(c=>c?.symbol===symbol&&c?.symbolStatus==='OPEN');
   let result;
   if(!site.has(symbol)||exact.length!==1 ||
      !Number.isInteger(Number(exact[0]?.quotePrecision))||
      Number(exact[0].quotePrecision)<0||Number(exact[0].quotePrecision)>12){
     result={status:'BLOCKED',symbol,reason:'NO_SINGLE_OPEN_CONTRACT_WITH_OFFICIAL_PRECISION_OR_WATCHLIST',
       source:null,readback:null,baseline:null,comparison:null};
   }else{
     const precision=Number(exact[0].quotePrecision);
     const contract={
       symbol,quotePrecision:precision,priceStep:10**(-precision),
       source:'BITUNIX_PUBLIC_TRADING_PAIRS',
       stepStatus:'RESEARCH_PRICE_PRECISION_NOT_TV_MINTICK'
     };
     try{
       result=await auditDailyVectorMarket({symbol,contract,fetchPage,nowMs});
     }catch(e){
       result={status:'BLOCKED',symbol,reason:'UNHANDLED_DAILY_RESEARCH_ERROR',
         error:String(e?.message??e)};
     }
   }
   await store(symbol+'-1d-evidence.json',result);
   const x={
     symbol,status:result.status,reason:result.reason??null,
     closedBars:result.depth??0,
     endExclusiveUtc:result.source?.provenance?.historyEndExclusiveUtc??null,
     repeatability:result.readback?.status??'NOT_VERIFIED',
     signalsV11:result.baseline?.signalCount??null,
     causalPrefixChecks:result.baseline?.noLookaheadSampledPrefixes??null,
     variants:result.comparison?.modes.map(m=>({
       mode:m.mode,confirmedSignals:m.signalCount,
       trainingTrades:result.comparison.results.training[m.mode]?.tradeCount??null,
       holdoutTrades:result.comparison.results.holdout[m.mode]?.tradeCount??null,
       holdoutNetSimulatedReturnPct:result.comparison.results.holdout[m.mode]?.returnPct??null,
       holdoutSampleSufficient:(result.comparison.results.holdout[m.mode]?.tradeCount??0)>=20,
       promotionAllowed:false
     }))??[]
   };
   out.samples.push(x);
   console.log('DAILY_VECTOR '+JSON.stringify(x));
 }
}
out.validated=out.samples.filter(x=>x.status==='DAILY_RESEARCH_COMPLETE').length;
out.blocked=DAILY_RESEARCH_SYMBOLS.length-out.validated;
out.status=out.blocked===0?'PASS_FIVE_DAILY_RESEARCH_WINDOWS':'PARTIAL_OR_BLOCKED_DAILY_RESEARCH';
out.warnings=[
 costsWarning,
 'A 365-day, or explicitly fallback 180-day, historical slice is NOT an independent prospective holdout.',
 'No confirmed daily-bar signal can use the still-forming UTC day.',
 'These markets are derivatives, and their price feeds are not automatically interchangeable with underlying assets.',
 'No daily filter on intraday signals was deployed; that remains a separate causal experiment.',
 'No TradingView dependency, real orders, production updates or paid Render services.'
];
await store('daily-vector-summary.json',out);
const fmt=n=>Number.isFinite(n)?Number(n).toFixed(2)+' %':'—';
const md=[
 '# CryptoJuju — laboratoire Daily 1D sur cinq marchés',
 '',
 'Statut : **'+out.status+'** · fenêtres Daily validées : '+out.validated+' / '+DAILY_RESEARCH_SYMBOLS.length,
 '',
 'Données publiques Bitunix vérifiées par deux lectures identiques pour chaque marché accepté.',
 'La journée UTC encore ouverte est exclue.',
 '',
 '| Marché | Journées fermées vérifiées | Statut | Signaux Vector V1.1 |',
 '|---|---:|---|---:|',
 ...DAILY_RESEARCH_SYMBOLS.map(sym=>{
   const x=out.samples.find(a=>a.symbol===sym);
   return '| '+sym+' | '+(x?.closedBars??0)+' | '+(x?.status??'BLOCKED_METADATA')+
     (x?.reason?' ('+x.reason+')':'')+' | '+(x?.signalsV11??'—')+' |';
 }),
 '',
 '## Comparaison expérimentale (portion de validation historique)',
 '| Marché | Version | Trades simulés | Rendement net simulé | Échantillon |',
 '|---|---|---:|---:|---|',
 ...out.samples.flatMap(m=>m.variants.map(v=>
   '| '+m.symbol+' | '+v.mode+' | '+v.holdoutTrades+' | '+
   fmt(v.holdoutNetSimulatedReturnPct)+' | '+
   (v.holdoutSampleSufficient?'Descriptif':'Insuffisant')+' |')),
 '',
 ...out.warnings.map(s=>'- '+s),
 '',
 'Aucune version automatiquement promue. Aucun trading. Aucune modification du site public.'
];
await writeFile(join(folder,'daily-vector-summary.md'),md.join('\n')+'\n');
console.log('DAILY_SUMMARY '+JSON.stringify({
 status:out.status,validated:out.validated,blocked:out.blocked,
 exchangeMetadataCount:out.exchangeMetadataCount,
 siteWatchlistEntries:out.siteWatchlistEntries,
 error:out.error??null
}));
if(out.blocked>0)process.exitCode=2;
