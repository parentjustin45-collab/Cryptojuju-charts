/*
 * CryptoJuju: three-arm closed-bar 1H research, Bitunix public
 * read-only LAST_PRICE. Matched source, costs, ATR trade model and split.
 * Never send orders, declare TradingView parity or pick a winner.
 */
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fetchBitunixDataPilot} from './bitunix-data-pilot.mjs';
import {compareBitunixReadbacks} from './bitunix-readback-consistency.mjs';
import {auditRealVectorV11} from './vector-v11-real-research.mjs';
import {readCryptoJujuWatchlist,fetchOpenContractMetadata}
 from './market-universe-50.mjs';
import {buildMomentumVectorVariants,MOMENTUM_VECTOR_PILOT_LOCK}
 from './momentum-vector-integrated.mjs';
import {runIntegratedVectorRiskStudy,INTEGRATED_MOMENTUM_IDS}
 from './vector-integrated-risk.mjs';

const folder=resolve(process.argv[2]??'momentum-vector-integrated-research');
await mkdir(folder,{recursive:true});
const store=(name,obj)=>writeFile(join(folder,name),JSON.stringify(obj,null,2)+'\n');
const nowMs=Date.now();
const out={
 protocol:'CJ_MOMFUSION_VECTOR_1H_INTEGRATED_PILOT_V1',
 generatedAtUtc:new Date(nowMs).toISOString(),
 status:'BLOCKED',
 source:'Bitunix public Futures LAST_PRICE only; two exact 960-bar reads',
 symbols:[...MOMENTUM_VECTOR_PILOT_LOCK.symbols],
 timeframe:'1h',closedBars:960,momentumSourceParity:'UNVERIFIED_PINE_TV',
 comparisonLock:MOMENTUM_VECTOR_PILOT_LOCK,
 cases:[],validated:0,blocked:0,
 ordersPlaced:false,deployments:false,mainTouched:false,autoPromoted:false
};
try{
 const html=await readFile(resolve('index.html'),'utf8');
 const watch=readCryptoJujuWatchlist(html),site=new Set(watch.symbols);
 const active=await fetchOpenContractMetadata();
 for(const symbol of MOMENTUM_VECTOR_PILOT_LOCK.symbols){
  const item={symbol,status:'BLOCKED',reason:null,bars:0,
   sourceRawSha256:null,sourceDerivedSha256:null,
   candidateCounts:null,holdout:{},training:{},noTrades:true};
  try{
   const matches=active.filter(c=>c.symbol===symbol&&c.symbolStatus==='OPEN');
   if(!site.has(symbol)||matches.length!==1||
      !Number.isInteger(Number(matches[0].quotePrecision))||
      Number(matches[0].quotePrecision)<0||
      Number(matches[0].quotePrecision)>12)
    throw Error('No exact OPEN watchlist+Bitunix precision contract');
   const contract={symbol,quotePrecision:Number(matches[0].quotePrecision),
    priceStep:10**(-Number(matches[0].quotePrecision)),
    source:'BITUNIX_PUBLIC_TRADING_PAIRS',
    stepStatus:'RESEARCH_PRICE_PRECISION_NOT_TV_MINTICK'};
   const opts={symbol,timeframe:'1h',closedBars:960,anchorBars:3,nowMs};
   const first=await fetchBitunixDataPilot(opts);
   await store(symbol+'-source-first.json',first);
   if(first.status!=='DATA_READY_FOR_RESEARCH_ONLY')
    throw Error('First 1H source blocked: '+first.reason);
   const second=await fetchBitunixDataPilot(opts);
   await store(symbol+'-source-second.json',second);
   const readback=compareBitunixReadbacks(first,second);
   await store(symbol+'-double-read.json',readback);
   if(second.status!=='DATA_READY_FOR_RESEARCH_ONLY'||
      readback.status!=='STABLE_TWO_READS'||readback.checkedDerived!==960)
    throw Error('Second 1H source does not verify stable 960-bar readback');
   const checkVector=auditRealVectorV11({
    source:first,repeatability:readback,contract
   });
   if(!checkVector||checkVector.signalCount===undefined)
    throw Error('Existing V1.1 research baseline did not validate');
   const comparison=buildMomentumVectorVariants({
    bars:first.acceptedCandles,contract
   });
   await store(symbol+'-confirmed-signals-and-rejection-audit.json',comparison);
   const portfolio=runIntegratedVectorRiskStudy({
    bars:first.acceptedCandles,market:first.market,
    historyWindow:first.historyWindow,
    commandsByVariant:comparison.commandsByVariant,
    strategyIds:INTEGRATED_MOMENTUM_IDS
   });
   await store(symbol+'-integrated-risk-portfolio.json',portfolio);
   item.status='RESEARCH_THREE_STRATEGIES_COMPLETED';
   item.bars=first.acceptedCandles.length;
   item.sourceRawSha256=first.provenance.rawSha256;
   item.sourceDerivedSha256=first.provenance.derivedSha256;
   item.candidateCounts=comparison.counts;
   item.window=first.historyWindow;
   item.splitAtUtc=portfolio.splitAtUtc;
   item.baselineVectorSourceSignalCount=checkVector.signalCount;
   for(const cost of ['base','stress']){
    const phase=(part)=>Object.fromEntries(INTEGRATED_MOMENTUM_IDS.map(id=>{
     const x=portfolio.scenarios[cost][id][part];
     return [id,{trades:x.tradeCount,
      returnPct:x.returnPct,
      winRatePct:x.winRatePct,
      markedDrawdownPct:x.closeMarkedMaxDrawdownPct,
      finalCapital:x.finalCapital,
      sampleAdequacy:x.tradeCount>=20?'DESCRIPTIVE_ONLY':'INSUFFICIENT_TRADES'}];
    }));
    item.holdout[cost]=phase('holdout');
    item.training[cost]=phase('training');
   }
   item.noTrades=Object.values(item.holdout.base).every(x=>x.trades===0);
  }catch(e){
   item.reason=String(e?.message??e);
  }
  out.cases.push(item);
  await store(symbol+'-summary.json',item);
  console.log('MOMENTUM_VECTOR_CASE '+JSON.stringify({
   symbol,status:item.status,reason:item.reason,
   bars:item.bars,counts:item.candidateCounts,
   baseHoldout:item.holdout.base??null,
   stressHoldout:item.holdout.stress??null
  }));
 }
}catch(e){out.fatalError=String(e?.message??e)}
out.validated=out.cases.filter(x=>x.status==='RESEARCH_THREE_STRATEGIES_COMPLETED').length;
out.blocked=out.symbols.length-out.validated;
out.status=out.blocked===0?'THREE_MARKETS_MOMENTUM_VECTOR_RESEARCH_COMPLETE':
 'PARTIAL_OR_BLOCKED_MOMENTUM_VECTOR';
await store('momentum-vector-summary.json',out);
const f=x=>Number.isFinite(x)?x.toFixed(2)+' %':'—';
const report=[
 '# CryptoJuju — Momentum Fusion V1, Vector V1.1 et combinaison (même portefeuille ATR)',
 '',
 '**'+out.status+'** — '+out.validated+' / 3 marchés en 1H.',
 '',
 'Vector V1.1 : événements originaux; Momentum seul : bullSignal/bearSignal du port V1 utilisateur; combiné : Vector confirmé au même CLOSE par Momentum composite>50 + EMA21/55 concordantes; sinon si inversion opposée rejetée, FLAT à la prochaine ouverture.',
 '',
 'Cette dernière règle de confirmation provient de la précédente étude rétrospective d’octobre 2026, où les événements acceptés avaient été rares et non convaincants. **On ne la présente pas comme un filtre prometteur pré-validé**. Les paramètres Momentum ne sont pas réoptimisés et la parité numérique avec TradingView reste NON PROUVÉE.',
 '',
 'Trois stratégies, 960 bougies 1H fermées par marché, filtre de warmup commun 168 barres; même portefeuille à une position, ATR Wilder(14), stop 1,5 ATR, objectif 2R, limite 12 barres, 1 % risque nominal, nominal max 100 %, entraînement/holdout 70/30 sans report de position.',
 '',
 'Frais base par côté : 0,06 % + slippage 0,05 %. Stress : 0,10 % + slippage 0,20 %. Funding, spread réel, lot minimum et liquidation non mesurés.',
 '',
 '| Marché | Bougies | V1.1 candidats | Momentum LONG/SHORT | Vector acceptés | Vector rejetés |',
 '|---|---:|---:|---|---:|---:|',
 ...out.cases.map(x=>('| '+x.symbol+' | '+x.bars+
  ' | '+(x.candidateCounts?.vectorCandidates??'—')+
  ' | '+(x.candidateCounts?x.candidateCounts.momentumLongSignals+'/'+
   x.candidateCounts.momentumShortSignals:'—')+
  ' | '+(x.candidateCounts?.vectorAcceptedByMomentum??'—')+
  ' | '+(x.candidateCounts?.vectorRejectedByMomentum??'—')+' |')),
 '',
 '## Portion 30 % historique déjà inspectée — résultats fictifs, NON prospectifs',
 '| Marché | Scénario | Stratégie | Transactions | Retour après frais | Drawdown marqué aux clôtures | Échantillon |',
 '|---|---|---|---:|---:|---:|---|',
 ...out.cases.flatMap(x=>['base','stress'].flatMap(cost=>
  INTEGRATED_MOMENTUM_IDS.map(id=>{
   const s=x.holdout[cost]?.[id];
   return '| '+x.symbol+' | '+cost+' | '+id+' | '+
    (s?.trades??'—')+' | '+f(s?.returnPct)+' | '+
    f(s?.markedDrawdownPct)+' | '+(s?.sampleAdequacy??'BLOQUÉ')+' |';
  }))),
 '',
 'Ne pas additionner ces rendements, ni sélectionner un gagnant sur les fenêtres inspectées. Un résultat 0 % avec zéro transaction **ne prouve pas** que l’indicateur fonctionne.',
 '',
 'Préparation du prochain essai : verrouiller un horizon entièrement futur, puis tester la combinaison séparée avec le Daily uniquement après validation causalité/TradingView sur mêmes OHLC.',
 '',
 'Aucune commande de trading, aucune clé, aucune promotion, aucun coût de serveur ou déploiement public.'
];
await writeFile(join(folder,'momentum-vector-summary.md'),report.join('\n')+'\n');
console.log('MOMENTUM_VECTOR_SUMMARY '+JSON.stringify({
 status:out.status,validated:out.validated,blocked:out.blocked,
 error:out.fatalError??null
}));
if(out.blocked)process.exitCode=2;
