import {planCleanBacktestWindows} from './quarantine.mjs';
import {runBacktest} from './engine.mjs';
import {speedCandleResearchSignals} from './speed-candle-v3.mjs';
/* Experimental color-to-position mapping; reset capital and indicator warmup per clean segment. */
export function backtestSpeedCandleV3({rows,historyWindow,options={}}){
 if(!Array.isArray(rows)||!historyWindow)throw Error('History required');
 const plan=planCleanBacktestWindows(rows,historyWindow,{minBars:22});
 const segments=plan.eligibleWindows.map(w=>{
  const signals=speedCandleResearchSignals(w.candles);
  const result=runBacktest(w.candles,signals,{...options,historyWindow:{startTime:w.startTime,endTime:w.endTime,intervalMs:historyWindow.intervalMs}});
  return {startTime:w.startTime,endTime:w.endTime,bars:w.bars,signalCount:signals.length,result};
 });
 const trades=segments.flatMap(s=>s.result.trades);
 return {indicator:'SPEED Candle V3.0',status:plan.status==='READY'?'READY':segments.length?'PARTIAL_QUARANTINED':'BLOCKED',quality:plan.quality,issues:plan.issues,missing:plan.missing,excludedBars:plan.excludedBars,segments,summary:{testedWindows:segments.length,signalCount:segments.reduce((n,s)=>n+s.signalCount,0),tradeCount:trades.length,winRatePct:trades.length?100*trades.filter(t=>t.pnl>0).length/trades.length:null},assumptions:{execution:'next-bar-open',warmupBars:20,noCrossGapTrades:true,capitalResetPerSegment:true},warning:'Research only. Indicator candle colors are not validated trade signals; segment returns cannot be added together.'};
}
