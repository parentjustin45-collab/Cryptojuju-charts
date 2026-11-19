/*
 * Isolated BTC 1D-trend → intraday Vector proof-of-concept.
 * Makes independent Bitunix REST reads of 365 closed Daily and 960 closed
 * intraday 15m/1h/4h candles. No TradingView, orders, production or Render.
 */
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fetchBitunixDataPilot} from './bitunix-data-pilot.mjs';
import {compareBitunixReadbacks} from './bitunix-readback-consistency.mjs';
import {readBitunixContractPrecision} from './bitunix-contract-precision.mjs';
import {compareDailyAlignedVector,DAILY_ALIGNMENT_LOCK}
 from './vector-daily-intraday-alignment.mjs';
const folder=resolve(process.argv[2]??'daily-multi-timeframe-reports');
await mkdir(folder,{recursive:true});
const nowMs=Date.now();
const log=async(name,obj)=>writeFile(join(folder,name),
 JSON.stringify(obj,null,2)+'\n');
const summary={
 protocol:'CJ_BTC_DAILY_TREND_GATE_INTRADAY_V1',
 source:'Bitunix public Futures LAST_PRICE',startedUtc:new Date(nowMs).toISOString(),
 status:'BLOCKED',symbol:'BTCUSDT',
 closedDailyBarsRequested:DAILY_ALIGNMENT_LOCK.dailyDepth,
 closedIntradayBarsRequested:DAILY_ALIGNMENT_LOCK.intradayDepth,
 dailyLatencySafetyAssumptionMs:DAILY_ALIGNMENT_LOCK.dailyCloseSafetyDelayMs,
 versionPromoted:null,tradeOrdersPlaced:false,
 sitePublicModified:false,tradingViewRequired:false,
 reports:[],warnings:[
  'A bullish Daily does not force bullish 15m, 1h and 4h price moves.',
  'Comparison is research on an inspected historical window; no independent prospective validation.',
  'The Daily +120s availability buffer is a safety assumption, not measured production latency.',
  'Fixed fee/slippage approximations do not include spread, funding, liquidity and executable fill evidence.',
  'Daily vetoes trigger FLAT on rejected opposite signals to avoid lingering exposure.',
  'No live trading, automatic model selection or real-money performance certification.'
 ]
};
let daily=null,dailyRepeat=null,contract=null;
async function readPair(timeframe,closedBars){
 const base={symbol:'BTCUSDT',timeframe,closedBars,nowMs,anchorBars:3};
 const first=await fetchBitunixDataPilot(base);
 if(first.status!=='DATA_READY_FOR_RESEARCH_ONLY')
  return {first,second:null,repeatability:null,status:'BLOCKED_INITIAL_DATA'};
 const second=await fetchBitunixDataPilot(base);
 const repeatability=compareBitunixReadbacks(first,second);
 const status=second.status==='DATA_READY_FOR_RESEARCH_ONLY'&&
  repeatability.status==='STABLE_TWO_READS'&&
  repeatability.checkedDerived===closedBars?
  'STABLE_PAIR':'BLOCKED_SECOND_READ';
 return {first,second,repeatability,status};
}
try{
 const metadata=await readBitunixContractPrecision({symbols:['BTCUSDT']});
 contract=metadata.contracts[0];
 await log('BTCUSDT-official-contract-metadata.json',metadata);
 const pair=await readPair('1d',DAILY_ALIGNMENT_LOCK.dailyDepth);
 daily=pair.first;dailyRepeat=pair.repeatability;
 await log('BTCUSDT-1d-first.json',pair.first);
 await log('BTCUSDT-1d-second.json',pair.second);
 await log('BTCUSDT-1d-repeatability.json',pair.repeatability);
 if(pair.status!=='STABLE_PAIR')
  throw Error('Daily 1D source rejected: '+pair.status);
 for(const tf of DAILY_ALIGNMENT_LOCK.timeframes){
  let result;
  try{
   const q=await readPair(tf,DAILY_ALIGNMENT_LOCK.intradayDepth);
   await log('BTCUSDT-'+tf+'-first.json',q.first);
   await log('BTCUSDT-'+tf+'-second.json',q.second);
   await log('BTCUSDT-'+tf+'-repeatability.json',q.repeatability);
   if(q.status!=='STABLE_PAIR')throw Error('Intraday source rejected: '+q.status);
   result=compareDailyAlignedVector({
     intraday:q.first,intradayReadback:q.repeatability,
     daily,dailyReadback:dailyRepeat,contract
   });
  }catch(e){
   result={protocol:'CJ_DAILY_CAUSAL_ALIGNMENT_WITH_VECTOR_V1',
    status:'BLOCKED',market:{symbol:'BTCUSDT',timeframe:tf},
    reason:String(e?.message??e),tradingEnabled:false,promotedVariant:null};
  }
  await log('BTCUSDT-'+tf+'-daily-alignment.json',result);
  const simple={
   timeframe:tf,status:result.status,
   reason:result.reason??null,
   dailyV11:result.filters?.v11_daily_aligned??null,
   dailyBreak:result.filters?.break_daily_aligned??null,
   modes:result.holdout?Object.entries(result.holdout).map(([mode,r])=>({
      mode,holdoutTrades:r.tradeCount,
      holdoutSimulatedReturnPct:r.returnPct,
      holdoutSimulatedDrawdownPct:r.maxDrawdownPct,
      sufficientTradeSample:r.tradeCount>=20
   })):[]
  };
  console.log('DAILY_MTF '+JSON.stringify(simple));
  summary.reports.push(simple);
 }
}catch(e){
 summary.error=String(e?.message??e);
}
summary.passed=summary.reports.filter(x=>x.status==='RESEARCH_COMPARISON_ONLY').length;
summary.blocked=DAILY_ALIGNMENT_LOCK.timeframes.length-summary.passed;
summary.status=summary.blocked===0?'ALL_THREE_RESEARCH_COMPARISONS_COMPLETED':'BLOCKED_OR_PARTIAL';
await log('BTCUSDT-daily-mtf-summary.json',summary);
const pct=n=>Number.isFinite(n)?n.toFixed(2)+' %':'—';
const lines=[
 '# CryptoJuju — Filtre Daily 1D sur Vector intraday (BTC)',
 '',
 '**'+summary.status+'** · '+summary.passed+' / 3 unités de temps acceptées.',
 '',
 'Daily et 15M/1H/4H : Bitunix LAST_PRICE, fenêtres fermées et double lecture.',
 'Dernière journée Daily fermée seulement, avec hypothèse de 120 secondes avant disponibilité.',
 'Une position opposée est fermée (FLAT) à la prochaine ouverture quand un retournement est refusé.',
 '',
 '| UT | Mode | Trades holdout | Rendement net simulé | Drawdown simulé | Échantillon |',
 '|---|---|---:|---:|---:|---|',
 ...summary.reports.flatMap(r=>r.modes.length?r.modes.map(x=>
   '| '+r.timeframe+' | '+x.mode+' | '+x.holdoutTrades+
   ' | '+pct(x.holdoutSimulatedReturnPct)+' | '+pct(x.holdoutSimulatedDrawdownPct)+
   ' | '+(x.sufficientTradeSample?'Descriptif':'INSUFFISANT')+' |'):
   ['| '+r.timeframe+' | **BLOQUÉ** | — | — | — | '+r.reason+' |']),
 '',...summary.warnings.map(s=>'- '+s),
 '','Aucun paramètre promu; aucune transaction et aucun déploiement.'
];
await writeFile(join(folder,'BTCUSDT-daily-mtf-summary.md'),lines.join('\n')+'\n');
console.log('DAILY_MTF_SUMMARY '+JSON.stringify({
 status:summary.status,passed:summary.passed,blocked:summary.blocked,
 error:summary.error??null
}));
if(summary.blocked)process.exitCode=2;
