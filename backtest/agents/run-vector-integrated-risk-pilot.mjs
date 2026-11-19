/*
 * Live public Bitunix SOURCE, offline integrated paper trading.
 * BTC/HYPE/1000PEPE × 1h 960 CLOSED bars, paired with verified 1D.
 * Four fixed competing signal policies, identical ATR, capital and friction.
 */
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fetchBitunixDataPilot} from './bitunix-data-pilot.mjs';
import {auditDailyVectorMarket} from './daily-vector-research.mjs';
import {compareBitunixReadbacks} from './bitunix-readback-consistency.mjs';
import {readCryptoJujuWatchlist,fetchOpenContractMetadata} from './market-universe-50.mjs';
import {compareDailyAlignedVector,indexCompletedDaily,filterVectorAgainstCompletedDaily}
 from './vector-daily-intraday-alignment.mjs';
import {vectorRegimeFeatures} from '../vector-v13-regime.mjs';
import {vectorAIT} from '../vector-ait-v1.mjs';
import {applyVectorConfirmation} from '../vector-antiwhipsaw-v12.mjs';
import {buildEmaConfirmedDailyRecovery,runIntegratedVectorRiskStudy,INTEGRATED_RECOVERY_LOCK}
 from './vector-integrated-risk.mjs';
const dir=resolve(process.argv[2]??'vector-integrated-portfolio-research');
await mkdir(dir,{recursive:true});
const record=(name,value)=>writeFile(join(dir,name),JSON.stringify(value,null,2)+'\n');
const nowMs=Date.now(),ONE_HOUR=3600000;
const out={
 protocol:'CJ_VECTOR_1H_THREE_MARKET_INTEGRATED_RISK_V1',
 status:'PARTIAL_OR_BLOCKED',generatedAtUtc:new Date(nowMs).toISOString(),
 description:'One-position portfolio with ATR14, 1.5 ATR stop, 2R target, 12-bar timeout; 1% nominal risk, 100% maximum notional (no leverage).',
 symbols:[...INTEGRATED_RECOVERY_LOCK.symbols],
 modes:[...INTEGRATED_RECOVERY_LOCK.strategyIds],
 source:'Bitunix public LAST_PRICE, 2 independent reads for daily and 1h',
 timeframe:'1h',expectedClosedBars:960,
 verified:0,blocked:0,cases:[],
 tradingEnabled:false,mainChanged:false,
 automaticallyPromoted:false
};
try{
 const watchlist=readCryptoJujuWatchlist(await readFile(resolve('index.html'),'utf8'));
 const available=await fetchOpenContractMetadata();
 const listed=new Set(watchlist.symbols);
 for(const symbol of INTEGRATED_RECOVERY_LOCK.symbols){
  const item={
    symbol,status:'BLOCKED',reason:null,
    dailyClosedBars:0,hourlyClosedBars:0,
    recoveryCandidates:0,recovered:0,holdout:{},train:{},
    sourceSha256:{},versionPromoted:null
  };
  try{
   const matches=available.filter(x=>x.symbol===symbol&&x.symbolStatus==='OPEN');
   if(!listed.has(symbol)||matches.length!==1||
      !Number.isInteger(Number(matches[0].quotePrecision))||
      Number(matches[0].quotePrecision)<0||Number(matches[0].quotePrecision)>12)
    throw Error('Missing exact OPEN Bitunix contract with official price precision / site watchlist');
   const quotePrecision=Number(matches[0].quotePrecision);
   const contract={symbol,quotePrecision,priceStep:10**(-quotePrecision),
     source:'BITUNIX_PUBLIC_TRADING_PAIRS',
     stepStatus:'RESEARCH_PRICE_PRECISION_NOT_TV_MINTICK'};
   const day=await auditDailyVectorMarket({symbol,contract,nowMs});
   await record(symbol+'-daily-two-reads.json',day);
   if(day.status!=='DAILY_RESEARCH_COMPLETE')
    throw Error('Daily closed history not accepted: '+day.reason);
   const input={symbol,timeframe:'1h',closedBars:960,anchorBars:3,nowMs};
   const first=await fetchBitunixDataPilot(input);
   await record(symbol+'-hourly-read-one.json',first);
   if(first.status!=='DATA_READY_FOR_RESEARCH_ONLY')
    throw Error('Hourly source failed first read: '+first.reason);
   const second=await fetchBitunixDataPilot(input);
   await record(symbol+'-hourly-read-two.json',second);
   const check=compareBitunixReadbacks(first,second);
   await record(symbol+'-hourly-repeatability.json',check);
   if(second.status!=='DATA_READY_FOR_RESEARCH_ONLY'||
      check.status!=='STABLE_TWO_READS'||check.checkedDerived!==960)
    throw Error('Hourly double read does not match');
   const verified=compareDailyAlignedVector({
    intraday:first,intradayReadback:check,
    daily:day.source,dailyReadback:day.readback,contract
   });
   if(verified.status!=='RESEARCH_COMPARISON_ONLY'||
      verified.causal.baselineReproduced!==true||
      verified.causal.noFutureDailyBarUsed!==true)
    throw Error('Source and baseline failed original causal Vector comparison');
   const bars=first.acceptedCandles,raw=vectorAIT(bars,{minTick:contract.priceStep});
   const events=applyVectorConfirmation(bars,raw,'baseline_v11').events;
   const indexed=indexCompletedDaily(day.source);
   const strict=filterVectorAgainstCompletedDaily({
    lowerBars:bars,events,dailyIndex:indexed,intervalMs:ONE_HOUR,
    safetyDelayMs:120000
   });
   const soft=filterVectorAgainstCompletedDaily({
    lowerBars:bars,events,dailyIndex:indexed,intervalMs:ONE_HOUR,
    safetyDelayMs:120000,neutralPolicy:'allow_mixed'
   });
   if(strict.stats.seen!==verified.filters.v11_daily_aligned.seen||
      strict.stats.accepted!==verified.filters.v11_daily_aligned.accepted||
      soft.stats.accepted!==verified.filters.v11_daily_soft.accepted)
    throw Error('Recomputed confirmation signals do not match locked original study');
   const recovery=buildEmaConfirmedDailyRecovery({
    strictSignals:strict.signals,observations:strict.observations,
    features:vectorRegimeFeatures(bars),bars,intervalMs:ONE_HOUR
   });
   const baseline=events.flatMap((e,i)=>e.signal&&i<bars.length-1?
     [{time:e.time,side:e.signal}]:[]);
   const commandsByVariant={
    v11_original:baseline,
    v11_daily_strict:strict.signals,
    v11_daily_soft:soft.signals,
    v13_ema_confirmed_recovery:recovery.signals
   };
   await record(symbol+'-causal-confirmed-commands.json',{
    source:'Vector V1.1, Daily last closed, EMA regime at confirmed bar',
    strategies:commandsByVariant,
    stats:{strict:strict.stats,soft:soft.stats,recovery:recovery.stats},
    promotedVersion:null
   });
   const paper=runIntegratedVectorRiskStudy({
     bars,market:first.market,historyWindow:first.historyWindow,commandsByVariant
   });
   await record(symbol+'-integrated-portfolio-trades.json',paper);
   item.dailyClosedBars=day.depth;item.hourlyClosedBars=960;
   item.sourceSha256={daily:day.source.provenance.rawSha256,
     hourly:first.provenance.rawSha256};
   item.recoveryCandidates=recovery.stats.recoveryCandidates;
   item.recovered=recovery.stats.recovered;
   for(const cost of ['base','stress']){
    item.holdout[cost]=Object.fromEntries(
     Object.entries(paper.scenarios[cost]).map(([mode,phases])=>[mode,{
       tradeCount:phases.holdout.tradeCount,
       returnPct:phases.holdout.returnPct,
       finalCapital:phases.holdout.finalCapital,
       winRatePct:phases.holdout.winRatePct,
       closeMarkedMaxDrawdownPct:phases.holdout.closeMarkedMaxDrawdownPct,
       sampleAdequacy:phases.holdout.tradeCount>=20?'DESCRIPTIVE_ONLY':'INSUFFICIENT_TRADES',
       automaticPromotion:false
     }]));
    item.train[cost]=Object.fromEntries(
     Object.entries(paper.scenarios[cost]).map(([mode,phases])=>[mode,{
       tradeCount:phases.training.tradeCount,returnPct:phases.training.returnPct
     }]));
   }
   item.status='SIMULATED_ONE_POSITION_PORTFOLIO_ONLY';
  }catch(e){item.reason=String(e?.message??e)}
  out.cases.push(item);
  await record(symbol+'-research-summary.json',item);
  console.log('INTEGRATED_VECTOR '+JSON.stringify({
   symbol,status:item.status,reason:item.reason,
   dailyBars:item.dailyClosedBars,hourlyBars:item.hourlyClosedBars,
   recovered:item.recovered,candidates:item.recoveryCandidates,
   baseHoldout:item.holdout.base?
    Object.fromEntries(Object.entries(item.holdout.base).map(([mode,a])=>[
       mode,{trades:a.tradeCount,returnPct:a.returnPct,ddPct:a.closeMarkedMaxDrawdownPct}
    ])):null
  }));
 }
}catch(e){out.error=String(e?.message??e)}
out.verified=out.cases.filter(x=>x.status==='SIMULATED_ONE_POSITION_PORTFOLIO_ONLY').length;
out.blocked=out.symbols.length-out.verified;
out.status=out.blocked===0?'THREE_MARKETS_INTEGRATED_PAPER_READY':'PARTIAL_OR_BLOCKED';
await record('integrated-portfolio-summary.json',out);
const fmt=v=>Number.isFinite(v)?v.toFixed(2)+' %':'—';
const lines=[
 '# CryptoJuju — Portefeuille intégré Vector + Daily (BTC, HYPE, PEPE en 1H)',
 '',
 '**'+out.status+'** — '+out.verified+' / 3 marchés.',
 '',
 'Comparaison figée avant ce nouveau test : Vector V1.1 original, V1.1 Daily strict, V1.1 Daily souple, et V1.3 expérimental qui récupère un rejet opposé SEULEMENT si les EMA 21/34/50 de la 1H fermée confirment le sens du Vector.',
 '',
 'Simulation : une position par marché et par variante; stop 1,5 ATR (Wilder 14), objectif 2R, timeout 12 bougies, signal à la prochaine ouverture; stop prioritaire si high et low touchent les deux cibles dans une même bougie.',
 '',
 '| Marché | Daily fermées | 1H fermées | Signaux opposés candidats | Signaux récupérés | Statut |',
 '|---|---:|---:|---:|---:|---|',
 ...out.cases.map(x=>'| '+x.symbol+' | '+x.dailyClosedBars+' | '+
  x.hourlyClosedBars+' | '+x.recoveryCandidates+' | '+x.recovered+' | '+x.status+
  (x.reason?' ('+x.reason+')':'')+' |'),
 '',
 '## Comparaison par VARIANTE de portefeuille, partie historique déjà inspectée',
 '| Marché | Frais | Stratégie | Transactions | Rendement net simulé | DD sur clôtures | Suffisance |',
 '|---|---|---|---:|---:|---:|---|',
 ...out.cases.flatMap(x=>['base','stress'].flatMap(cost=>
   INTEGRATED_RECOVERY_LOCK.strategyIds.map(mode=>{
    const t=x.holdout?.[cost]?.[mode];
    return '| '+x.symbol+' | '+cost+' | '+mode+' | '+
     (t?.tradeCount??'—')+' | '+fmt(t?.returnPct)+' | '+
     fmt(t?.closeMarkedMaxDrawdownPct)+' | '+
     (t?.sampleAdequacy??'BLOQUÉ')+' |';
   }))),
 '',
 'Attention : base = 0,06 % frais + 0,05 % slippage par côté; stress = 0,10 % + 0,20 %. Ce sont des hypothèses et non des coûts mesurés. Rendements non combinables entre marchés ou variantes.',
 '',
 'Les dernières fenêtres ont déjà été analysées lors du développement : PAS de validation prospective ni preuve de rentabilité. On ne choisit aucun gagnant avec ces résultats.',
 '',
 'Aucun ordre, aucun déploiement et aucune modification de Vector V1.1, de main ou du site public.'
];
await writeFile(join(dir,'integrated-portfolio-summary.md'),lines.join('\n')+'\n');
console.log('INTEGRATED_VECTOR_SUMMARY '+JSON.stringify({
 status:out.status,verified:out.verified,blocked:out.blocked,
 error:out.error??null
}));
if(out.blocked)process.exitCode=2;
