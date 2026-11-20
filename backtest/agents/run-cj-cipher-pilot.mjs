/*
 * CJ Cipher - WaveTrend V1.0 research-only Bitunix pilot.
 * 3 × 960 completed 1H bars, two reads, strict OHLC validation.
 * Standalone CJ Cipher vs unchanged Vector vs simple WT agreement
 * on identical next-open reversal-only simulator.
 *
 * This intentionally is NOT the ATR stop/target portfolio: compare only
 * like-for-like within this protocol; do not compare return percentages
 * to the separate Vector ATR portfolio. No funding/liquidity assumptions.
 */
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fetchBitunixDataPilot} from './bitunix-data-pilot.mjs';
import {compareBitunixReadbacks} from './bitunix-readback-consistency.mjs';
import {readCryptoJujuWatchlist,fetchOpenContractMetadata}
 from './market-universe-50.mjs';
import {auditRealVectorV11} from './vector-v11-real-research.mjs';
import {runFixedHoldout} from './fixed-holdout.mjs';
import {buildCjCipherComparison,CIPHER_COMPARISON_LOCK}
 from './cj-cipher-comparison.mjs';

const folder=resolve(process.argv[2]??'cj-cipher-wt-v1-audit');
await mkdir(folder,{recursive:true});
const store=(name,x)=>writeFile(join(folder,name),JSON.stringify(x,null,2)+'\n');
const nowMs=Date.now(),symbols=['BTCUSDT','HYPEUSDT','1000PEPEUSDT'];
const friction={
 base:{initialCapital:1000,allocation:1,feeRate:0.0006,slippageRate:0.0005},
 stress:{initialCapital:1000,allocation:1,feeRate:0.001,slippageRate:0.002}
};
const report={
 protocol:'CJ_CIPHER_WT_V1_ORIGINAL_BITUNIX_RESEARCH',
 generatedAtUtc:new Date(nowMs).toISOString(),
 status:'BLOCKED',source:'Bitunix LAST_PRICE 1H closed double-read',
 symbols,timeframe:'1h',expectedBars:960,
 strategies:CIPHER_COMPARISON_LOCK.strategyIds,model:CIPHER_COMPARISON_LOCK,
 scenarioFriction:friction,
 cases:[],validated:0,blocked:0,
 fundingModel:false,atrRiskStops:false,pineParityVerified:false,
 tradingEnabled:false,siteModified:false,autoPromotion:false
};
const summary=x=>Object.fromEntries(CIPHER_COMPARISON_LOCK.strategyIds.map(id=>{
 const y=x?.[id];
 return [id,y?{
   tradeCount:y.tradeCount,returnPct:y.returnPct,
   winRatePct:y.winRatePct,maxDrawdownPct:y.maxDrawdownPct,
   signalCount:y.signalCount,
   sampleGate:y.tradeCount>=20?'DESCRIPTIVE_ONLY':'INSUFFICIENT_TRADES'
 }:null];
}));
try{
 const site=readCryptoJujuWatchlist(await readFile(resolve('index.html'),'utf8'));
 const siteSymbols=new Set(site.symbols);
 const listing=await fetchOpenContractMetadata();
 for(const symbol of symbols){
  const row={symbol,status:'BLOCKED',reason:null,bars:0,counts:null,
   training:{},holdout:{},sourceSha256:null,causalReadback:null};
  try{
   const matched=listing.filter(x=>x.symbol===symbol&&x.symbolStatus==='OPEN');
   const precision=matched.length===1?Number(matched[0].quotePrecision):NaN;
   if(!siteSymbols.has(symbol)||matched.length!==1||
      !Number.isInteger(precision)||precision<0||precision>12)
    throw Error('Symbol not verified on public OPEN contract list and watchlist');
   const contract={symbol,quotePrecision:precision,
    priceStep:10**(-precision),source:'BITUNIX_PUBLIC_TRADING_PAIRS',
    stepStatus:'RESEARCH_PRICE_PRECISION_NOT_TV_MINTICK'};
   const opts={symbol,timeframe:'1h',closedBars:960,anchorBars:3,nowMs};
   const a=await fetchBitunixDataPilot(opts);
   await store(symbol+'-source-first.json',a);
   if(a.status!=='DATA_READY_FOR_RESEARCH_ONLY')
    throw Error('Source first read blocked: '+a.reason);
   const b=await fetchBitunixDataPilot(opts);
   await store(symbol+'-source-second.json',b);
   const repeatability=compareBitunixReadbacks(a,b);
   await store(symbol+'-readback.json',repeatability);
   if(b.status!=='DATA_READY_FOR_RESEARCH_ONLY'||
      repeatability.status!=='STABLE_TWO_READS'||
      repeatability.checkedDerived!==960)
    throw Error('Double-read BTC/HYPE/PEPE source mismatch');
   const reference=auditRealVectorV11({
    source:a,repeatability,contract
   });
   const comparison=buildCjCipherComparison(a.acceptedCandles,{
    priceStep:contract.priceStep
   });
   const cut=a.historyWindow.startTime+Math.floor(960*.7)*3600000;
   for(const [caseId,costs] of Object.entries(friction)){
    const data=runFixedHoldout({
     market:a.market,historyWindow:a.historyWindow,
     candles:a.acceptedCandles,
     holdoutStartTime:cut,costs,
     experiments:CIPHER_COMPARISON_LOCK.strategyIds.map(id=>({
      id,signalTimeConvention:'confirmation-bar-open',
      indicatorParity:'UNVERIFIED',signals:comparison.signals[id]
     }))
    });
    row.training[caseId]=summary(data.training);
    row.holdout[caseId]=summary(data.holdout);
    await store(symbol+'-portfolio-'+caseId+'.json',data);
    if(caseId==='base'){
     const original=reference.researchSimulation;
     if(data.training.vector_v11.returnPct!==original.training.returnPct||
        data.holdout.vector_v11.returnPct!==original.holdout.returnPct)
      throw Error('Unmodified Vector V1.1 baseline results did not reproduce');
    }
   }
   await store(symbol+'-cipher-and-vector-commands.json',{
    ...comparison,vectorOriginalSignalCount:reference.signalCount
   });
   row.status='RESEARCH_CAUSAL_FIRST_PILOT_READY';
   row.bars=960;
   row.counts=comparison.signalCounts;
   row.sourceSha256={
    raw:a.provenance.rawSha256,derived:a.provenance.derivedSha256
   };
   row.causalReadback=repeatability.status;
   row.splitAtUtc=new Date(cut).toISOString();
  }catch(e){row.reason=String(e?.message??e)}
  report.cases.push(row);
  await store(symbol+'-summary.json',row);
  console.log('CIPHER_PILOT_CASE '+JSON.stringify({
   symbol,status:row.status,reason:row.reason,
   counts:row.counts,holdout:row.holdout.base
  }));
 }
}catch(e){report.fatalError=String(e?.message??e)}
report.validated=report.cases.filter(x=>x.status==='RESEARCH_CAUSAL_FIRST_PILOT_READY').length;
report.blocked=report.symbols.length-report.validated;
report.status=report.blocked===0?'CIPHER_3_MARKETS_FIRST_PILOT_COMPLETE':
 'PARTIAL_OR_BLOCKED_CIPHER_PILOT';
await store('cj-cipher-pilot-summary.json',report);
const fmt=x=>Number.isFinite(x)?x.toFixed(2)+' %':'—';
const lines=[
 '# CJ Cipher — Première étude WaveTrend WT1/WT2 sur Bitunix',
 '',
 '**'+report.status+'** ('+report.validated+' / 3 marchés).',
 '',
 'Port fidèle à la formule fournie en Pine Script v6, sans divergences ni changements de paramètres : ESA EMA10, déviation EMA10, CI normalisé /0,015, WT1 EMA21, WT2 SMA4. Seuls les CROISEMENTS WT1/WT2 à clôture confirmée forment des événements. Les niveaux 60/53 et −60/−53 sont VISUELS, aucun filtre implicite.',
 '',
 'Trois bras pré-déclarés : Cipher seul (croisements); Vector V1.1 seul (signaux originaux); Vector filtré par le signe WT1−WT2 à la même clôture (refus opposé = FLAT). Aucune sélection ni optimisation de paramètres sur les résultats.',
 '',
 'Les trois bras partagent le moteur de portefeuilles RÉVERSAL-ONLY de la phase fixed-holdout, avec 70 % entraînement / 30 % historique réexaminé, même frais/contrôles. Cette première recherche NE teste PAS de stop ATR/objectif, donc NE DOIT PAS être comparée numériquement aux résultats du moteur ATR Vector précédent.',
 '',
 'Sources strictes : Futures LAST_PRICE Bitunix public, 960 chandelles 1H terminées par marché, double lecture prouvée, contrôle de continuité et SHA. Parité exacte Pine/TradingView **non vérifiée** : l’absence de simulation intrabar est volontaire (confirmClose=true par défaut).',
 '',
 '| Marché | Source validée | Cipher LONG | Cipher SHORT | Vector événements | Vector admis par WT |',
 '|---|---|---:|---:|---:|---:|',
 ...report.cases.map(x=>('| '+x.symbol+' | '+x.status+
  ' | '+(x.counts?.cipherLong??'—')+
  ' | '+(x.counts?.cipherShort??'—')+
  ' | '+(x.counts?.vectorAll??'—')+
  ' | '+(x.counts?.vectorAgreement??'—')+' |')),
 '',
 '## Portion historique 30 % déjà observée — résultats uniquement exploratoires',
 '| Marché | Frais | Mode | Trades | Retour hypothétique | Drawdown | Suffisance |',
 '|---|---|---|---:|---:|---:|---|',
 ...report.cases.flatMap(x=>['base','stress'].flatMap(caseId=>
  CIPHER_COMPARISON_LOCK.strategyIds.map(id=>{
   const z=x.holdout?.[caseId]?.[id];
   return '| '+x.symbol+' | '+caseId+' | '+id+
    ' | '+(z?.tradeCount??'—')+' | '+fmt(z?.returnPct)+
    ' | '+fmt(z?.maxDrawdownPct)+
    ' | '+(z?.sampleGate??'BLOQUÉ')+' |';
  }))),
 '',
 'Base : 0,06 % frais + 0,05 % slippage par côté; stress : 0,10 % + 0,20 %. 1000 $ fictifs par phase, allocation max 100 %; aucune taille de lot ou funding réels. Les signaux de confirmation n’impliquent PAS des probabilités de réussite.',
 '',
 'Ne pas promouvoir un gagnant sur une période déjà inspectée; futurs travaux : mesurer strictement la parité WT1/WT2 TradingView, passer à une gestion ATR identique, étudier ensuite SPEED et Frank Test sur des périodes prospectives distinctes.',
 '',
 'Aucun ordre, aucun changement main/site public, aucune promotion automatique.'
];
await writeFile(join(folder,'cj-cipher-pilot-summary.md'),lines.join('\n')+'\n');
console.log('CIPHER_PILOT_FINAL '+JSON.stringify({
 status:report.status,validated:report.validated,
 blocked:report.blocked,fatalError:report.fatalError??null
}));
if(report.blocked)process.exitCode=2;
