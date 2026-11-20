/*
 * Replay EXACT original CI archive for CJ Cipher V1.0; no moving
 * market sampling, no new parameters, no live trading.
 * Usage: node backtest/agents/run-cj-cipher-whipsaw-audit.mjs
 *  ARCHIVED_ARTIFACT_FOLDER  REPORT_FOLDER
 */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
import {compareBitunixReadbacks} from './bitunix-readback-consistency.mjs';
import {calculateCjCipherWaveTrend,cjCipherConfirmedCommands}
 from './cj-cipher-wavetrend-v1.mjs';
import {diagnoseCjCipherPhase,CIPHER_DIAGNOSIS_LOCK}
 from './cj-cipher-whipsaw-diagnostic.mjs';
const from=resolve(process.argv[2]??'');
const to=resolve(process.argv[3]??'cj-cipher-whipsaw-report');
if(!process.argv[2])throw Error('Pass the archived Github Actions artifact directory');
await mkdir(to,{recursive:true});
const load=async name=>JSON.parse(await readFile(join(from,name),'utf8'));
const store=async(name,obj)=>writeFile(join(to,name),JSON.stringify(obj,null,2)+'\n');
const policy={
 base:{initialCapital:1000,feeRate:.0006,slippageRate:.0005,allocation:1},
 stress:{initialCapital:1000,feeRate:.001,slippageRate:.002,allocation:1}
};
const sourceReport=await load('cj-cipher-pilot-summary.json');
assert.equal(sourceReport.status,'CIPHER_3_MARKETS_FIRST_PILOT_COMPLETE');
assert.deepEqual(sourceReport.symbols,CIPHER_DIAGNOSIS_LOCK.symbols);
assert.equal(sourceReport.validated,3);
assert.equal(sourceReport.blocked,0);
const result={
 protocol:CIPHER_DIAGNOSIS_LOCK.id,sourceRunId:CIPHER_DIAGNOSIS_LOCK.runId,
 status:'PARTIAL',sourceRunGeneratedAtUtc:sourceReport.generatedAtUtc,
 runAtUtc:new Date().toISOString(),
 symbols:[...CIPHER_DIAGNOSIS_LOCK.symbols],
 cases:[],audited:0,
 futureBarsUsedForSignals:false,
 optimizedParameters:false,
 tradingEnabled:false,
 tradingViewParityClaimed:false,
 referenceCosts:policy
};
for(const symbol of CIPHER_DIAGNOSIS_LOCK.symbols){
 const [first,second,readback,commands,originalBase,originalStress,originalSummary]
  =await Promise.all([
   load(symbol+'-source-first.json'),
   load(symbol+'-source-second.json'),
   load(symbol+'-readback.json'),
   load(symbol+'-cipher-and-vector-commands.json'),
   load(symbol+'-portfolio-base.json'),
   load(symbol+'-portfolio-stress.json'),
   load(symbol+'-summary.json')
  ]);
 const actual=compareBitunixReadbacks(first,second);
 if(first.status!=='DATA_READY_FOR_RESEARCH_ONLY'||
    actual.status!=='STABLE_TWO_READS'||
    actual.checkedDerived!==960||
    first.market.symbol!==symbol||first.market.timeframe!=='1h'||
    first.market.priceType!=='LAST_PRICE'||
    first.historyWindow?.intervalMs!==3600000||
    first.acceptedCandles.length!==960||
    !first.provenance.formingBarExcluded||
    first.provenance.rawSha256!==readback.firstRawSha256||
    second.provenance.rawSha256!==readback.secondRawSha256||
    readback.differenceCount!==0||
    first.provenance.rawSha256!==originalSummary.sourceSha256.raw||
    first.provenance.derivedSha256!==originalSummary.sourceSha256.derived||
    commands.status!=='RESEARCH_CAUSAL_SIGNALS_ONLY'||
    originalSummary.status!=='RESEARCH_CAUSAL_FIRST_PILOT_READY')
  throw Error(symbol+': archived Bitunix source, source report or double read inconsistent');
 const bars=first.acceptedCandles;
 const wave=calculateCjCipherWaveTrend(bars);
 const recreated=cjCipherConfirmedCommands(wave);
 assert.deepEqual(recreated,commands.signals.cj_cipher_wt_v1,
  symbol+': cannot reproduce EXACT archived WaveTrend crosses');
 const a={symbol,sourceRawSha256:first.provenance.rawSha256,
   sourceDerivedSha256:first.provenance.derivedSha256,
   exactCommands:recreated.length,
   originalResearchComparisonsReused:true,
   phases:{},dataQuality:actual.status};
 for(const [costName,costs] of Object.entries(policy)){
  const original=costName==='base'?originalBase:originalStress;
  a.phases[costName]={};
  for(const [phase,phaseBars,waves] of [
   ['training',bars.slice(0,672),wave.slice(0,672)],
   ['holdout',bars.slice(672),wave.slice(672)]]){
   const diag=diagnoseCjCipherPhase({
    bars:phaseBars,wholeSourceSignals:recreated,phase,
    market:first.market,costs,sourceWarmup:waves
   });
   const prior=original[phase]?.cj_cipher_wt_v1;
   if(!prior||
      diag.sourceSignals!==prior.signalCount||
      diag.realizedTradeCount!==prior.tradeCount||
      Math.abs(diag.simulatedReturnPct-prior.returnPct)>1e-5||
      Math.abs(diag.simulatedWinRatePct-prior.winRatePct)>1e-5||
      Math.abs(diag.simulatedMaxDrawdownPct-prior.maxDrawdownPct)>1e-5)
    throw Error(symbol+' '+costName+' '+phase+': original archived portfolio not reproducible');
   a.phases[costName][phase]={
    ...diag,verifiedAgainstOriginalPortfolio:true
   };
  }
 }
 await store(symbol+'-failure-modes.json',a);
 result.cases.push(a);
 result.audited++;
 const h=a.phases.base.holdout,t=a.phases.base.training;
 console.log('CIPHER_FAILURE_CASE '+JSON.stringify({
  symbol,training:{trades:t.realizedTradeCount,
   negativeRawMove:t.grossNegative,rapidOpposite6:t.rapidOpposite6,
   costFlip:t.rawPositiveButNetNegative},
  holdout:{trades:h.realizedTradeCount,
   negativeRawMove:h.grossNegative,rapidOpposite3:h.rapidOpposite3,
   rapidOpposite6:h.rapidOpposite6,
   costFlip:h.rawPositiveButNetNegative,
   medianHoldBars:h.medianHoldBars,
   returnPct:h.simulatedReturnPct}
 }));
}
result.status=result.audited===3?'THREE_MARKETS_ARCHIVED_CIPHER_REPLAY_VERIFIED':'PARTIAL';
await store('cj-cipher-whipsaw-summary.json',result);
const f=n=>Number.isFinite(n)?n.toFixed(2)+' %':'—';
const lines=[
 '# CJ Cipher WT V1.0 — diagnostic historique des croisements',
 '',
 '**'+result.status+'** — '+result.audited+' / 3 marchés en 1H.',
 '',
 'Ce rapport est un **replay exact** du workflow source [44656240484](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/44656240484), dont les SHA et les deux lectures Bitunix sont vérifiés. Les croisements originaux sont recalculés et les portefeuilles base/stress sont reproduits aux centièmes près. Aucune nouvelle donnée de marché, aucun nouveau réglage.',
 '',
 '| Marché | Phase | Trades | Mouvement brut contre la direction | Retournement opposé ≤3h | Retournement opposé ≤6h | Brut favorable mais net perdant | Médiane tenue | Retour fictif net |',
 '|---|---|---:|---:|---:|---:|---:|---:|---:|',
 ...result.cases.flatMap(c=>['training','holdout'].map(phase=>{
  const x=c.phases.base[phase];
  return '| '+c.symbol+' | '+phase+' | '+x.realizedTradeCount+
   ' | '+x.grossNegative+' | '+x.rapidOpposite3+' | '+x.rapidOpposite6+
   ' | '+x.rawPositiveButNetNegative+' | '+x.medianHoldBars+
   ' barres | '+f(x.simulatedReturnPct)+' |';
 })),
 '',
 '## Ce que ces catégories veulent dire',
 '- **Mouvement brut contre la direction** : entre OPEN réel du trade fictif et OPEN du signal opposé (ou dernière CLOSE disponible), le prix a bougé à contresens avant frais et glissement. Cette observation est rétrospective, pas une explication causale automatique.',
 '- **Retournements opposés ≤3h/≤6h** : la position simulée a été inversée par un signal contraire dans cette durée. Ils ne sont pas forcément mauvais; un signal de retournement peut être une bonne sortie.',
 '- **Brut favorable mais net perdant** : variation de prix favorable mais perte après frais/glissement simulés. Montre le coût possible du sur-trading.',
 '- **Zone extrême favorable** (dans les JSON) : WT2≤−53 au signal LONG ou WT2≥+53 au signal SHORT. Ce sont les seuils de référence VISUELS de V1.0, **pas** un filtre sélectionné ni une preuve de prévisibilité.',
 '- Les phases repartent FLAT et à 1 000 $ de capital fictif. Les trades de fin de phase sont soldés artificiellement à la dernière CLOSE; ces clôtures ne sont pas des signaux d’indicateur.',
 '',
 '## Implications expérimentales sans surajustement',
 '',
 '1. Préserver V1.0 originale. Le diagnostic des retournements rapides aide à proposer une **V1.1 anti-bruit** mais aucune valeur de seuil ne doit être choisie d’après cette fenêtre déjà inspectée.',
 '2. Décomposer les fausses entrées, les mauvaises sorties et les pertes liées au coût. Comparer de futurs protocoles à moteur de risque **identique** (ATR, stop, objectif, durée), sans confondre les deux protocoles précédents.',
 '3. Avant toute promotion, enregistrer les règles de V1.1 et les critères d’évaluation; attendre des chandelles FUTURES non utilisées pour le réglage; inclure les trades refusés et les occasions manquées.',
 '4. La parité TradingView détaillée n’est pas une priorité demandée par l’utilisateur. Les contrôles fermés/no-lookahead restent obligatoires. Aucune conclusion de rentabilité réelle ne peut être tirée de ces données.',
 '',
 'Rapport purement rétrospectif. Aucune transaction réelle, aucun déploiement ni modification des indicateurs de production.'
];
await writeFile(join(to,'cj-cipher-whipsaw-summary.md'),lines.join('\n')+'\n');
console.log('CIPHER_FAILURE_SUMMARY '+JSON.stringify({
 status:result.status,markets:result.audited,
 reproducedBaselineAndStress:true,originalCrossesReproduced:true,
 optimizedParameters:false
}));
if(result.audited!==3)process.exitCode=2;
