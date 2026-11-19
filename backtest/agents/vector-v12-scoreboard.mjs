/*
 * CryptoJuju-only Vector V1.2 comparison scorecard.
 * Describes matched research simulations, never elects a winner.
 * Bitunix remains the source. TradingView is not a required test gate.
 */
const MODES=Object.freeze(['baseline_v11','follow_close_1','break_extreme_2']);
const FIELDS=['tradeCount','returnPct','maxDrawdownPct','signalCount'];
const numeric=(n)=>typeof n==='number'&&Number.isFinite(n);
const mean=(n)=>Math.round(n*10000)/10000;
const safe=(x)=>String(x??'').replace(/[|\n\r]/g,' ');
function phase(data,id) {
  const x=data?.[id];
  if (!x||!FIELDS.every(k=>numeric(x[k]))||
      !Number.isSafeInteger(x.tradeCount)||x.tradeCount<0||
      !Number.isSafeInteger(x.signalCount)||x.signalCount<0||
      x.maxDrawdownPct<0||x.maxDrawdownPct>100)
    throw Error('Invalid '+id+' research phase');
  return {tradeCount:x.tradeCount,signalCount:x.signalCount,
    returnPct:mean(x.returnPct),maxDrawdownPct:mean(x.maxDrawdownPct)};
}
export function summarizeVectorV12Comparison(report,{minimumHoldoutTrades=20}={}) {
  if(!Number.isSafeInteger(minimumHoldoutTrades)||minimumHoldoutTrades<1)
    throw Error('Invalid minimum holdout sample');
  if(report?.protocol!=='CJ_VECTOR_V12_BITUNIX_ISOLATED_COMPARISON_V1'
   ||report?.status!=='CANDIDATES_EVALUATED_RESEARCH_ONLY'
   ||report?.baselineReproduced!==true
   ||report?.promotedVariant!==null
   ||report?.checks?.noAutomaticSelection!==true
   ||report?.checks?.noRealTrades!==true
   ||report?.checks?.independentTradingViewParity!==false
   ||report?.modes?.length!==MODES.length
   ||report.modes.some((x,i)=>x.mode!==MODES[i])
   ||!['BTCUSDT','ETHUSDT','SOLUSDT'].includes(report.market?.symbol)
   ||!['15m','1h','4h'].includes(report.market?.timeframe))
   throw Error('Unverified, promoted or mismatched Vector experiment');
  const baseline=phase(report.results?.holdout,'baseline_v11');
  const variants=MODES.map(mode=>{
    const train=phase(report.results?.training,mode);
    const holdout=phase(report.results?.holdout,mode);
    const adequate=holdout.tradeCount>=minimumHoldoutTrades
      &&baseline.tradeCount>=minimumHoldoutTrades;
    return {
      mode,training:train,holdout,
      holdoutReturnDifferencePp:mean(holdout.returnPct-baseline.returnPct),
      holdoutDrawdownDifferencePp:mean(holdout.maxDrawdownPct-baseline.maxDrawdownPct),
      sampleStatus:adequate?'DESCRIPTIVE_ONLY':'INSUFFICIENT_HOLDOUT_TRADES',
      promotionAuthorized:false
    };
  });
  return {
    protocol:'CJ_VECTOR_V12_NATIVE_SCOREBOARD_V1',
    symbol:report.market.symbol,timeframe:report.market.timeframe,
    sourceRawSha256:report.sourceRawSha256,
    closedBars:report.closedBars,
    minimumHoldoutTrades,
    trainingAndHoldoutWerePreviouslyInspected:true,
    independentTradingViewParity:false,
    promotionAuthorized:false,
    variants,
    warning:'Research metrics only, using one inspected history window. No independent prospective validation, no automated version choice.'
  };
}
export function renderVectorV12ScoreboardMarkdown(items) {
  if(!Array.isArray(items)||items.length!==9 ||
     items.some(x=>!x||!['BTCUSDT','ETHUSDT','SOLUSDT'].includes(x.symbol)||
       !['15m','1h','4h'].includes(x.timeframe)||![
         'CJ_VECTOR_V12_NATIVE_SCOREBOARD_V1','BLOCKED'
       ].includes(x.protocol)))
    throw Error('Nine market/timeframe scores or explicit blocked cases required');
  const lines=[
    '# CryptoJuju — Tableau comparatif Vector V1.1 / V1.2',
    '',
    '## Bitunix seulement · CryptoJuju seulement',
    '',
    '**Comparaison exploratoire**, avec frais et slippage simulés identiques.',
    'Ce tableau ne classe ni ne promeut automatiquement une version et **ne requiert aucun test TradingView**.',
    'Le holdout historique a déjà été inspecté : aucun gagnant statistiquement indépendant ne peut en être déduit.',
    '',
    '| Marché | UT | Variante | Trades entraînement | Trades holdout | Rendement net holdout simulé | Δ rendement vs V1.1 (points) | Drawdown holdout simulé | Δ drawdown (points) | Qualité échantillon |',
    '|---|---|---|---:|---:|---:|---:|---:|---:|---|'
  ];
  const format=n=>numeric(n)?n.toFixed(2)+' %':'—';
  for(const item of items) {
    if(item.protocol==='BLOCKED') {
      lines.push('| '+safe(item.symbol)+' | '+safe(item.timeframe)+
        ' | **BLOQUÉ** | — | — | — | — | — | — | '+safe(item.reason??'non vérifié')+' |');
      continue;
    }
    if(item.variants?.length!==MODES.length||
       item.variants.some((v,i)=>v.mode!==MODES[i]||v.promotionAuthorized!==false))
      throw Error('Unexpected candidate scorecard');
    for(const row of item.variants)lines.push([
      '| '+safe(item.symbol),safe(item.timeframe),safe(row.mode),
      row.training.tradeCount,row.holdout.tradeCount,
      format(row.holdout.returnPct),format(row.holdoutReturnDifferencePp),
      format(row.holdout.maxDrawdownPct),format(row.holdoutDrawdownDifferencePp),
      safe(row.sampleStatus)+' |'
    ].join(' | '));
  }
  lines.push('','> Échantillons inférieurs à 20 transactions holdout : comparaison insuffisante pour conclure.',
    '> Les différences de rendement ou de drawdown sont descriptives, pas des preuves d’amélioration.',
    '> Source Bitunix LAST_PRICE; aucune transaction réelle ni déploiement en production.');
  return lines.join('\n')+'\n';
}
