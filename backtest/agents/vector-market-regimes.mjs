/*
 * CryptoJuju-only Vector market-regime observatory.
 * Separates deterministic, CAUSAL chart descriptions from indicator efficacy.
 * No TradingView dependency, no selection/optimization, no trades/deployments.
 */
import {createHash} from 'node:crypto';
import {vectorAIT} from '../vector-ait-v1.mjs';
import {vectorRegimeFeatures} from '../vector-v13-regime.mjs';
import {applyVectorConfirmation,VECTOR_CONFIRMATION_MODES} from '../vector-antiwhipsaw-v12.mjs';
import {classifyHistory,requireCleanHistory} from '../quality-gate.mjs';

const REGIMES=Object.freeze(['uptrend','downtrend','range_candidate','mixed','warmup']);
const MODES=VECTOR_CONFIRMATION_MODES.map(x=>x.id);
const sha256=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const round=n=>Math.round(n*10000)/10000;
function emptyBucket(){
 return {signals:0,longSignals:0,shortSignals:0,delayedSignals:0,
  sumDelayBars:0,quickOppositePairs:0,oppositePairs:0};
}
export function describeClosedBarRegimes(bars,{lookback=20,rangeEfficiencyLimit=0.30}={}){
 if(!Array.isArray(bars)||bars.length<60||
    !Number.isSafeInteger(lookback)||lookback<5||lookback>40||
    typeof rangeEfficiencyLimit!=='number'||!Number.isFinite(rangeEfficiencyLimit)||
    rangeEfficiencyLimit<=0||rangeEfficiencyLimit>=1)
   throw Error('Unsupported causal regime parameters');
 const features=vectorRegimeFeatures(bars);
 return bars.map((bar,i)=>{
   if(i<Math.max(52,lookback)||features[i].regime==='unknown')
     return {time:bar.time,regime:'warmup',efficiency:null};
   let movement=0;
   for(let j=i-lookback+1;j<=i;j++)
     movement+=Math.abs(Number(bars[j].close)-Number(bars[j-1].close));
   const efficiency=movement>0?
     Math.abs(Number(bar.close)-Number(bars[i-lookback].close))/movement:0;
   const regime=efficiency<=rangeEfficiencyLimit?'range_candidate':
     features[i].regime==='bull_stack'?'uptrend':
     features[i].regime==='bear_stack'?'downtrend':'mixed';
   return {time:bar.time,regime,efficiency:round(efficiency)};
 });
}
export function diagnoseVectorMarketRegimes({
 source,comparison,contract,lookback=20,rangeEfficiencyLimit=0.30,
 blockBars=240,quickFlipBars=3
}={}){
 const bars=source?.acceptedCandles,win=source?.historyWindow;
 if(source?.status!=='DATA_READY_FOR_RESEARCH_ONLY'||
    comparison?.status!=='CANDIDATES_EVALUATED_RESEARCH_ONLY'||
    comparison?.baselineReproduced!==true||
    comparison?.promotedVariant!==null||
    comparison?.sourceRawSha256!==source.provenance?.rawSha256||
    comparison?.sourceDerivedSha256!==source.provenance?.derivedSha256||
    !Array.isArray(bars)||bars.length<160||
    comparison?.closedBars!==bars.length||
    !win||!Number.isSafeInteger(win.intervalMs)||win.intervalMs<=0||
    win.endTime-win.startTime!==bars.length*win.intervalMs||
    source.market?.symbol!==comparison.market?.symbol||
    source.market?.timeframe!==comparison.market?.timeframe||
    source.provenance?.derivedSha256!==sha256(bars)||
    contract?.symbol!==source.market?.symbol||
    contract?.source!=='BITUNIX_PUBLIC_TRADING_PAIRS'||
    contract?.priceStep!==10**(-contract.quotePrecision)||
    !Number.isSafeInteger(blockBars)||blockBars<40||blockBars>960||
    !Number.isSafeInteger(quickFlipBars)||quickFlipBars<1||quickFlipBars>12||
    comparison.modes?.length!==MODES.length||
    comparison.modes.some((v,i)=>v.mode!==MODES[i]))
   throw Error('Blocked or mismatched Bitunix/Vector regime input');
 requireCleanHistory(classifyHistory(bars,win));
 const barRegimes=describeClosedBarRegimes(bars,{lookback,rangeEfficiencyLimit});
 const raw=vectorAIT(bars,{minTick:contract.priceStep});
 const split=Math.floor(bars.length*0.7);
 const blocks=Array.from({length:Math.ceil(bars.length/blockBars)},(_,i)=>{
   const first=i*blockBars,last=Math.min(bars.length,(i+1)*blockBars)-1;
   const mix=Object.fromEntries(REGIMES.map(x=>[x,0]));
   for(let j=first;j<=last;j++)mix[barRegimes[j].regime]++;
   return {index:i+1,fromOpenUtc:new Date(bars[first].time).toISOString(),
     toExclusiveUtc:new Date(bars[last].time+win.intervalMs).toISOString(),
     candleCount:last-first+1,marketComposition:mix};
 });
 const modes={};
 for(const mode of MODES){
   const events=applyVectorConfirmation(bars,raw,mode).events;
   const buckets=Object.fromEntries(REGIMES.map(r=>[r,emptyBucket()]));
   const byBlock=blocks.map((b,i)=>({index:i+1,
     training:0,holdout:0,
     byRegime:Object.fromEntries(REGIMES.map(r=>[r,emptyBucket()]))}));
   let noNextOpen=0;
   // Previous accepted signals are tracked per time-block/regime, so a fast
   // flip cannot cross a segment boundary and impersonate a local result.
   const prior=new Map();
   for(let i=0;i<events.length;i++){
     const e=events[i];
     if(!e?.signal)continue;
     if(!['long','short'].includes(e.signal)||
        !Number.isSafeInteger(e.sourceIndex)||e.sourceIndex<0||
        e.sourceIndex>i||e.delayBars!==i-e.sourceIndex||
        e.time!==bars[i].time)
       throw Error('Noncausal Vector signal in regime diagnostic');
     if(i===bars.length-1){noNextOpen++;continue}
     const segment=Math.floor(i/blockBars),r=barRegimes[i].regime;
     const key=segment+':'+r;
     const update=(obj,priorSignal)=>{
       obj.signals++;
       if(e.signal==='long')obj.longSignals++;else obj.shortSignals++;
       obj.sumDelayBars+=e.delayBars;
       if(e.delayBars>0)obj.delayedSignals++;
       if(priorSignal&&priorSignal.signal!==e.signal){
         obj.oppositePairs++;
         if(i-priorSignal.index<=quickFlipBars)obj.quickOppositePairs++;
       }
     };
     const previous=prior.get(key);
     update(buckets[r],previous);
     update(byBlock[segment].byRegime[r],previous);
     if(i<split)byBlock[segment].training++;
     else byBlock[segment].holdout++;
     prior.set(key,{index:i,signal:e.signal});
   }
   const finalize=b=>({
     signals:b.signals,longSignals:b.longSignals,shortSignals:b.shortSignals,
     delayedSignals:b.delayedSignals,
     meanDelayBars:b.signals?round(b.sumDelayBars/b.signals):null,
     quickOppositePairs:b.quickOppositePairs,oppositePairs:b.oppositePairs,
     quickOppositePct:b.oppositePairs?
       round(100*b.quickOppositePairs/b.oppositePairs):null
   });
   modes[mode]={overallByRegime:Object.fromEntries(REGIMES.map(r=>[r,finalize(buckets[r])])),
     byBlock:byBlock.map(b=>({...b,byRegime:Object.fromEntries(
       REGIMES.map(r=>[r,finalize(b.byRegime[r])]))})),noNextOpen};
 }
 return {
   protocol:'CJ_VECTOR_MARKET_REGIMES_RESEARCH_V1',
   status:'DESCRIPTIVE_ONLY_NO_WINNER',
   market:source.market,
   rawSha256:source.provenance.rawSha256,
   derivedSha256:source.provenance.derivedSha256,
   closedBars:bars.length,blockBars,lookback,rangeEfficiencyLimit,quickFlipBars,
   splitAtOpenUtc:new Date(bars[split].time).toISOString(),
   blocks,modes,promotedVariant:null,
   limitations:[
     'Range candidate uses <=30% trailing 20-bar directional efficiency; not a ground-truth range label.',
     'Uptrend/downtrend use only completed EMA21/34/50 alignment and EMA50 positive/negative slope.',
     'Regime at SIGNAL CONFIRMATION time is descriptive, never a future-derived filter.',
     'Four chronological blocks may be partially in the already-inspected 70/30 holdout.',
     'Signal and whipsaw counts are not trade returns, hit rates, causal profit estimates or statistical significance.',
     'No TradingView parity test, no automatic parameter optimization or production/trading permission.'
   ]
 };
}
export function formatVectorRegimesMarkdown(reports){
 if(!Array.isArray(reports)||reports.length!==9)
   throw Error('Nine case reports required');
 const lines=[
 '# CryptoJuju — Vector : tendances, range probable et périodes chronologiques',
 '',
 '**Bitunix, CryptoJuju seulement** · recherche descriptive, aucune version promue.',
 'Une inversion opposée rapide (3 chandelles ou moins) n\'est pas forcément un mauvais signal.',
 'Une zone range_candidate repose sur l\'efficacité directionnelle passée, sans vérification indépendante.',
 '',
 '| Marché | UT | Mode | Régime au signal | Signaux | LONG / SHORT | Retournements rapides / opposés | Retard moyen en barres |',
 '|---|---|---|---|---:|---:|---:|---:|'
 ];
 for(const report of reports){
   if(report?.status==='BLOCKED'){
     lines.push('| '+String(report.symbol??'?')+' | '+String(report.timeframe??'?')+
       ' | **BLOQUÉ** | — | — | — | — | — |');
     continue;
   }
   if(report?.protocol!=='CJ_VECTOR_MARKET_REGIMES_RESEARCH_V1'||
      report.status!=='DESCRIPTIVE_ONLY_NO_WINNER'||
      !['BTCUSDT','ETHUSDT','SOLUSDT'].includes(report.market?.symbol)||
      !['15m','1h','4h'].includes(report.market?.timeframe)||
      report.promotedVariant!==null)
     throw Error('Invalid or promoted regime report');
   for(const mode of MODES)for(const r of REGIMES){
     const s=report.modes[mode].overallByRegime[r];
     lines.push('| '+report.market.symbol+' | '+report.market.timeframe+
       ' | '+mode+' | '+r+' | '+s.signals+' | '+s.longSignals+
       ' / '+s.shortSignals+' | '+s.quickOppositePairs+' / '+s.oppositePairs+
       ' | '+(s.meanDelayBars===null?'—':s.meanDelayBars.toFixed(2))+' |');
   }
 }
 lines.push('', '## Notes méthodologiques',
   'Les mêmes blocs chronologiques non chevauchants sont conservés dans les fichiers JSON par marché.',
   'Les régimes utilisent uniquement les chandelles déjà closes au moment du signal.',
   'Ces résultats ne démontrent aucune supériorité de V1.2 ou de V1.3 et ne sélectionnent aucun gagnant.',
   'Les données futures/prospectives restent nécessaires pour une validation indépendante.');
 return lines.join('\n')+'\n';
}
