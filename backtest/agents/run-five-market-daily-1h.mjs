/*
 * Five-market 1h × last CLOSED 1D Vector comparison on real Bitunix data.
 * Deliberately not a site deployment or a multi-market parameter optimizer.
 * For each contract, both histories are independently read twice, with
 * raw/derived SHA checks inside the comparative research module.
 */
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {DAILY_INTRADAY_RESEARCH_SYMBOLS,fetchBitunixDataPilot}
 from './bitunix-data-pilot.mjs';
import {auditDailyVectorMarket} from './daily-vector-research.mjs';
import {compareBitunixReadbacks} from './bitunix-readback-consistency.mjs';
import {compareDailyAlignedVector} from './vector-daily-intraday-alignment.mjs';
import {measureCausalDailyTrendPersistence} from './daily-trend-persistence.mjs';
import {readCryptoJujuWatchlist,fetchOpenContractMetadata}
 from './market-universe-50.mjs';
const out=resolve(process.argv[2]??'daily-five-market-reports');
await mkdir(out,{recursive:true});
const nowMs=Date.now();
const save=(name,value)=>writeFile(join(out,name),JSON.stringify(value,null,2)+'\n');
const timeframes=['1h'];
const summary={
 protocol:'CJ_FIVE_MARKET_DAILY_TREND_SOFT_VS_STRICT_1H_V1',
 startedUtc:new Date(nowMs).toISOString(),
 source:'Bitunix LAST_PRICE, public REST, no keys',
 status:'BLOCKED_OR_PARTIAL',symbols:[...DAILY_INTRADAY_RESEARCH_SYMBOLS],
 intradayTimeframes:timeframes,
 dailyDepthPolicy:[365,180],intradayBarsRequested:960,
 events:[],passed:0,blocked:0,
 siteModified:false,mainModified:false,
 ordersPlaced:false,versionPromoted:null,
 researchOnly:true,
 warnings:[
  'The 90% trend-persistence anecdote is a hypothesis, not a verified win rate.',
  'Strict daily gate and soft mixed-day gate share historical price windows.',
  'Only completed Daily candles are used, with an unmeasured 120-second availability buffer.',
  'Inspected holdouts and small trade samples cannot prove future performance.',
  'BTC fixed fees/slippage are not validated execution costs for meme, stock or metal contracts.',
  'No funded trades, no production deploy, no automatic model selection.'
 ]};
try {
 const site=readCryptoJujuWatchlist(await readFile(resolve('index.html'),'utf8'));
 const allContracts=await fetchOpenContractMetadata();
 summary.watchlistCount=site.total;
 summary.bitunixContractCount=allContracts.length;
 const siteSymbols=new Set(site.symbols);
 for(const symbol of DAILY_INTRADAY_RESEARCH_SYMBOLS){
   const event={symbol,timeframe:'1h',status:'BLOCKED',dailyBars:0,hourlyBars:0,
     modes:[],filterDiagnostics:null,reason:null};
   try{
     const metadata=allContracts.filter(c=>c?.symbol===symbol&&c?.symbolStatus==='OPEN');
     if(!siteSymbols.has(symbol)||metadata.length!==1||
        !Number.isInteger(Number(metadata[0].quotePrecision))||
        Number(metadata[0].quotePrecision)<0||Number(metadata[0].quotePrecision)>12)
       throw Error('No unique active Bitunix contract with usable quotePrecision in CryptoJuju watchlist');
     const quotePrecision=Number(metadata[0].quotePrecision);
     const contract={symbol,quotePrecision,priceStep:10**(-quotePrecision),
       source:'BITUNIX_PUBLIC_TRADING_PAIRS',
       stepStatus:'RESEARCH_PRICE_PRECISION_NOT_TV_MINTICK'};
     const daily=await auditDailyVectorMarket({symbol,contract,nowMs});
     await save(symbol+'-daily-double-read-evidence.json',daily);
     if(daily.status!=='DAILY_RESEARCH_COMPLETE')throw Error('Daily not verified: '+daily.reason);
     const opts={symbol,timeframe:'1h',closedBars:960,anchorBars:3,nowMs};
     const first=await fetchBitunixDataPilot(opts);
     await save(symbol+'-1h-first.json',first);
     if(first.status!=='DATA_READY_FOR_RESEARCH_ONLY')
       throw Error('1H history blocked: '+(first.reason??'unknown'));
     const second=await fetchBitunixDataPilot(opts);
     await save(symbol+'-1h-second.json',second);
     const repeat=compareBitunixReadbacks(first,second);
     await save(symbol+'-1h-double-read.json',repeat);
     if(second.status!=='DATA_READY_FOR_RESEARCH_ONLY'||
        repeat.status!=='STABLE_TWO_READS'||repeat.checkedDerived!==960)
       throw Error('1H repeated OHLC did not match the first accepted window');
     const research=compareDailyAlignedVector({
       intraday:first,intradayReadback:repeat,
       daily:daily.source,dailyReadback:daily.readback,contract
     });
     await save(symbol+'-daily-1h-comparison.json',research);
     const persistence=measureCausalDailyTrendPersistence({
       dailySource:daily.source,hourlySource:first,comparison:research
     });
     await save(symbol+'-daily-1h-persistence.json',persistence);
     event.persistence={
       dailyTrendRetentionPct:persistence.dailyDirectionRetainedNextDayPct,
       dailyTrendTransitions:persistence.dailyTrendDayTransitions,
       hourlyTrain:persistence.phases.training,
       hourlyHoldout:persistence.phases.holdout,
       researchOnly:true
     };
     event.status=research.status;event.dailyBars=daily.depth;
     event.hourlyBars=first.acceptedCandles.length;
     event.pricePrecision=quotePrecision;
     event.filterDiagnostics=research.filters;
     event.modes=Object.entries(research.holdout).map(([mode,r])=>({
       mode,trainTrades:research.training[mode].tradeCount,
       holdoutTrades:r.tradeCount,
       holdoutReturnPct:r.returnPct,holdoutMaxDrawdownPct:r.maxDrawdownPct,
       holdoutSampleSufficient:r.tradeCount>=20,
       automaticPromotion:false
     }));
   }catch(err){event.reason=String(err?.message??err);}
   summary.events.push(event);
   console.log('FIVE_DAILY_MTF '+JSON.stringify({
     symbol,status:event.status,reason:event.reason,
     dailyBars:event.dailyBars,acceptedStrict:event.filterDiagnostics?.v11_daily_aligned?.accepted??null,
     acceptedSoft:event.filterDiagnostics?.v11_daily_soft?.accepted??null,
     seen:event.filterDiagnostics?.v11_daily_aligned?.seen??null,
     dailyTrendRetentionPct:event.persistence?.dailyTrendRetentionPct??null,
     hourlyDirectionalAgreementPct:event.persistence?.hourlyHoldout?.directionalHourlyAlignmentPct??null,
     hourlyPriceDirectionAgreementPct:event.persistence?.hourlyHoldout?.hourlyPriceDirectionAgreementPct??null,
     trades:event.modes.map(x=>({mode:x.mode,holdoutTrades:x.holdoutTrades,holdoutReturnPct:x.holdoutReturnPct}))
   }));
 }
}catch(err){summary.error=String(err?.message??err);}
summary.passed=summary.events.filter(x=>x.status==='RESEARCH_COMPARISON_ONLY').length;
summary.blocked=DAILY_INTRADAY_RESEARCH_SYMBOLS.length-summary.passed;
summary.status=summary.blocked===0?'FIVE_MARKETS_VALIDATED':'PARTIAL_OR_BLOCKED';
await save('five-market-daily-1h-summary.json',summary);
const fmt=n=>Number.isFinite(n)?Number(n).toFixed(2)+' %':'—';
const lines=[
 '# CryptoJuju — Daily 1D → Vector 1H sur cinq familles',
 '',
 '**'+summary.status+'** | '+summary.passed+' / 5 marchés vérifiés',
 '',
 'Données Bitunix publiques, double lecture des 1D et 1H avec exclusion des chandelles en formation.',
 'Filtres : direction Daily stricte; direction Daily permissive seulement quand le Daily est MIXED.',
 '',
 '| Marché | 1D fermées | Signaux Vector vus | Strict acceptés | Mixte admis acceptés |',
 '|---|---:|---:|---:|---:|',
 ...summary.events.map(x=>'| '+x.symbol+' | '+x.dailyBars+' | '+
  (x.filterDiagnostics?.v11_daily_aligned?.seen??'—')+' | '+
  (x.filterDiagnostics?.v11_daily_aligned?.accepted??'—')+' | '+
  (x.filterDiagnostics?.v11_daily_soft?.accepted??'—')+' |'),
 '',
 '## Persistance Daily et alignement réel en 1H (ne sont PAS des taux de réussite des trades)',
 '| Marché | Daily garde la direction le jour suivant | 1H EMA alignées avec Daily (holdout) | Bougies 1H dans le sens Daily (holdout) |',
 '|---|---:|---:|---:|',
 ...summary.events.map(x=>'| '+x.symbol+' | '+
   fmt(x.persistence?.dailyTrendRetentionPct)+' | '+
   fmt(x.persistence?.hourlyHoldout?.directionalHourlyAlignmentPct)+' | '+
   fmt(x.persistence?.hourlyHoldout?.hourlyPriceDirectionAgreementPct)+' |'),
 '',
 'Un marché haussier Daily ne signifie pas que 90 % des chandelles 1H montent; ces taux ont des dénominateurs différents.',
 '',
 '## Simulation holdout déjà inspectée (descriptive seulement)',
 '| Marché | Variante | Transactions | Rendement net simulé | Drawdown simulé | Suffisance |',
 '|---|---|---:|---:|---:|---|',
 ...summary.events.flatMap(x=>x.modes.length?x.modes.map(v=>
  '| '+x.symbol+' | '+v.mode+' | '+v.holdoutTrades+' | '+fmt(v.holdoutReturnPct)+
  ' | '+fmt(v.holdoutMaxDrawdownPct)+' | '+(v.holdoutSampleSufficient?'descriptif':'insuffisant')+' |'):
  ['| '+x.symbol+' | **BLOQUÉ** | — | — | — | '+x.reason+' |']),
 '',
 ...summary.warnings.map(x=>'- '+x),
 '',
 'Aucune version gagnante, aucun trading ni publication sur main.'
];
await writeFile(join(out,'five-market-daily-1h-summary.md'),lines.join('\n')+'\n');
console.log('FIVE_DAILY_MTF_SUMMARY '+JSON.stringify({
 status:summary.status,passed:summary.passed,blocked:summary.blocked,
 error:summary.error??null
}));
if(summary.blocked)process.exitCode=2;
