/*
 * Descriptive-only CryptoJuju Vector confirmation audit. Nothing here changes
 * a past signal, guesses a counterfactual profit or chooses a winner.
 * "Rapid flip" = opposite confirmations <= N CLOSED candles apart, NOT proof
 * that either confirmation was false. Next-open execution and split boundaries
 * are respected. Bitunix source already passed the upstream V1.2 quality gate.
 */
import {vectorAIT} from '../vector-ait-v1.mjs';
import {FIVE_CRYPTO_SYMBOLS,FIVE_TIMEFRAMES} from './render/five-by-five.mjs';
import {applyVectorConfirmation,VECTOR_CONFIRMATION_MODES} from '../vector-antiwhipsaw-v12.mjs';

const MODES=VECTOR_CONFIRMATION_MODES.map(x=>x.id);
const sum=a=>a.reduce((x,y)=>x+y,0);
const round=n=>Math.round(n*10000)/10000;
function scan(events,baselineByIndex,bars,cut,flipBars){
  const phases={training:[],holdout:[]};
  let lastBarExcluded=0,boundaryExcluded=0;
  for(let i=0;i<events.length;i++){
    const e=events[i];
    if(!e.signal)continue;
    if(!['long','short'].includes(e.signal)||
       !Number.isInteger(e.sourceIndex)||e.sourceIndex<0||e.sourceIndex>i||
       e.delayBars!==i-e.sourceIndex||e.time!==bars[i].time)
      throw Error('Non-causal or invalid confirmation record');
    if(i===bars.length-1){lastBarExcluded++;continue;}
    const phase=i+1<cut?'training':'holdout';
    // Do not treat a training-origin confirmation as a new holdout entry.
    if(i===cut-1||(phase==='holdout'&&e.sourceIndex<cut)){
      boundaryExcluded++;continue;
    }
    const b=baselineByIndex.get(e.sourceIndex);
    let priceDisadvantagePct=null;
    if(b?.side===e.signal&&e.sourceIndex+1<bars.length){
      const originalEntry=Number(bars[e.sourceIndex+1].open);
      const laterEntry=Number(bars[i+1].open);
      if(!Number.isFinite(originalEntry)||originalEntry<=0||
         !Number.isFinite(laterEntry)||laterEntry<=0)
        throw Error('Invalid next-open diagnostic price');
      priceDisadvantagePct=100*(e.signal==='long'?laterEntry-originalEntry:
        originalEntry-laterEntry)/originalEntry;
    }
    phases[phase].push({index:i,side:e.signal,sourceIndex:e.sourceIndex,
      delayBars:e.delayBars,priceDisadvantagePct});
  }
  const result={};
  for(const [key,list] of Object.entries(phases)){
    const delays=list.map(x=>x.delayBars);
    const match=list.filter(x=>x.priceDisadvantagePct!==null);
    let pairs=0,quick=0;
    for(let j=1;j<list.length;j++){
      if(list[j].side===list[j-1].side)continue;
      pairs++;
      if(list[j].index-list[j-1].index<=flipBars)quick++;
    }
    result[key]={
      executableSignals:list.length,
      matchedBaselineOrigins:match.length,
      unmatchedOrigins:list.length-match.length,
      delayedSignals:delays.filter(x=>x>0).length,
      meanConfirmationDelayBars:list.length?round(sum(delays)/list.length):null,
      maxConfirmationDelayBars:list.length?Math.max(...delays):null,
      rapidFlipPairs:quick,oppositeFlipPairs:pairs,
      rapidFlipPct:pairs?round(100*quick/pairs):null,
      meanNextOpenPriceDisadvantagePct:match.length?
        round(sum(match.map(x=>x.priceDisadvantagePct))/match.length):null,
      earlyLatePricePairsCompared:match.length,
      note:'A rapid opposite flip is a whipsaw proxy, not a proven bad trade.'
    };
  }
  return {phases:result,lastBarExcluded,boundaryExcluded};
}
export function diagnoseVectorV12Timing({
  source,comparison,contract,flipBars=3
}={}){
  if(!Number.isSafeInteger(flipBars)||flipBars<1||flipBars>12)
    throw Error('Invalid rapid reversal interval');
  if(source?.status!=='DATA_READY_FOR_RESEARCH_ONLY' ||
     comparison?.status!=='CANDIDATES_EVALUATED_RESEARCH_ONLY' ||
     comparison?.baselineReproduced!==true||
     comparison?.promotedVariant!==null ||
     source?.provenance?.rawSha256!==comparison.sourceRawSha256 ||
     source?.provenance?.derivedSha256!==comparison.sourceDerivedSha256 ||
     source.market?.symbol!==comparison.market?.symbol ||
     source.market?.timeframe!==comparison.market?.timeframe ||
     source.acceptedCandles?.length!==comparison.closedBars||
     contract?.symbol!==source.market.symbol ||
     !Number.isFinite(contract.priceStep)||contract.priceStep<=0)
    throw Error('Blocked/mismatched Vector comparison or source');
  const bars=source.acceptedCandles,window=source.historyWindow;
  if(!window||bars.length<160||!Number.isSafeInteger(window.intervalMs)||
     window.endTime-window.startTime!==bars.length*window.intervalMs)
    throw Error('Invalid complete closed OHLC window');
  const cut=Math.floor(bars.length*0.7);
  const base=vectorAIT(bars,{minTick:contract.priceStep});
  const baselineByIndex=new Map(
    base.flatMap((v,i)=>v.signal&&i<bars.length-1?
      [[i,{side:v.signal}]]:[])
  );
  const modes=Object.fromEntries(MODES.map(mode=>{
    const events=applyVectorConfirmation(bars,base,mode).events;
    return [mode,scan(events,baselineByIndex,bars,cut,flipBars)];
  }));
  return {
    protocol:'CJ_NATIVE_VECTOR_V12_TIMING_DIAGNOSTIC_V1',
    status:'RESEARCH_DIAGNOSTIC_ONLY',
    market:source.market,
    sourceRawSha256:source.provenance.rawSha256,
    closedBars:bars.length,
    flipThresholdBars:flipBars,
    chronologicalSplitAtOpenMs:bars[cut].time,
    modes,
    risks:[
      'Quick opposing signals are a proxy for whipsaw, NOT an independently validated false-signal rate.',
      'Price disadvantage measures candidate versus baseline next OPEN for matched originating signals only; not forgone profit.',
      'Training/holdout have been inspected and cannot establish prospective superiority.',
      'An extra confirmation candle may reduce flips while delaying or missing useful entries.',
      'No TradingView test required; no real trade, version promotion or production deployment.'
    ]
  };
}
export function renderVectorTimingDiagnosticsMarkdown(items){
  if(!Array.isArray(items)||![9,25].includes(items.length))throw Error('Expected nine or 25 market/timeframe diagnostics');
  const lines=[
    '# CryptoJuju — Retournements rapides et retards Vector',
    '',
    'Données Bitunix fermées · indicateurs calculés dans CryptoJuju seulement.',
    'Comparaison descriptive et non promotionnelle : aucun test TradingView requis.',
    'Un retournement opposé en trois chandelles ou moins est un indicateur de bruit, **pas la preuve d’un faux signal**.',
    '',
    '| Marché | UT | Mode | Phase | Signaux exécutables | Inversions rapides / opposées | Délai moyen (barres) | Prix entrée retardée vs base (%) | Origines appariées |',
    '|---|---|---|---|---:|---:|---:|---:|---:|'
  ];
  for(const item of items){
    if(item?.status==='BLOCKED'){
      lines.push('| '+String(item.symbol??'?')+' | '+String(item.timeframe??'?')+
        ' | **BLOQUÉ** | — | — | — | — | — | — |');
      continue;
    }
    if(item?.protocol!=='CJ_NATIVE_VECTOR_V12_TIMING_DIAGNOSTIC_V1'||
       item?.status!=='RESEARCH_DIAGNOSTIC_ONLY'||
       !FIVE_CRYPTO_SYMBOLS.includes(item.market?.symbol)||
       !FIVE_TIMEFRAMES.includes(item.market?.timeframe))
      throw Error('Invalid Vector diagnostic report');
    for(const mode of MODES){
      const stats=item.modes?.[mode]?.phases;
      if(!stats?.training||!stats?.holdout)throw Error('Missing diagnostic mode');
      for(const phase of ['training','holdout']){
        const x=stats[phase];
        const fmt=n=>Number.isFinite(n)?n.toFixed(2):'—';
        lines.push('| '+item.market.symbol+' | '+item.market.timeframe+' | '+mode+
          ' | '+phase+' | '+x.executableSignals+' | '+x.rapidFlipPairs+' / '+
          x.oppositeFlipPairs+' | '+fmt(x.meanConfirmationDelayBars)+' | '+
          fmt(x.meanNextOpenPriceDisadvantagePct)+' | '+x.earlyLatePricePairsCompared+' |');
      }
    }
  }
  lines.push('', '> Les nombres faibles et les résultats déjà inspectés ne permettent pas de classer les variantes.',
    '> Ces statistiques n’incluent aucun ordre réel, ni preuve de profit ou d’autonomie continue.');
  return lines.join('\n')+'\n';
}
