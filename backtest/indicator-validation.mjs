/* Validate an indicator's closed-candle signals on independent clean history windows.
   Each window starts flat with fresh capital; never combine trade PnL as if continuous.
   Indicator implementations must supply their own reproducible signal arrays. */
import {planCleanBacktestWindows} from './quarantine.mjs';
import {runBacktest} from './engine.mjs';
export function validateIndicator({id,rows,historyWindow,signals,options={},minBars=3}={}){
 if(typeof id!=='string'||!id.trim())throw Error('Indicator id required');
 if(!Array.isArray(signals))throw Error('Signal array required');
 const plan=planCleanBacktestWindows(rows,historyWindow,{minBars});
 const seen=new Set();
 for(const s of signals){
  const time=Number(s?.time);
  if(!Number.isSafeInteger(time)||!['long','short','flat'].includes(s?.side)||seen.has(time))throw Error('Invalid or duplicate indicator signal');
  seen.add(time);
 }
 const results=plan.eligibleWindows.map(w=>{
  const segmentSignals=signals.filter(s=>Number(s.time)>=w.startTime&&Number(s.time)<w.endTime);
  const report=runBacktest(w.candles,segmentSignals,{...options,historyWindow:{startTime:w.startTime,endTime:w.endTime,intervalMs:historyWindow.intervalMs}});
  return {startTime:w.startTime,endTime:w.endTime,bars:w.bars,signalCount:segmentSignals.length,report};
 });
 const tradeCount=results.reduce((n,x)=>n+x.report.tradeCount,0);
 const wins=results.reduce((n,x)=>n+x.report.trades.filter(t=>t.pnl>0).length,0);
 return {indicator:id,status:plan.status==='READY'?'TESTABLE':results.length?'PARTIAL_DATA':'BLOCKED',quality:plan.quality,issues:plan.issues,missing:plan.missing,duplicateTimes:plan.duplicateTimes,excludedBars:plan.excludedBars,segments:results,summary:{testedWindows:results.length,tradeCount,winRatePct:tradeCount?100*wins/tradeCount:null},disclaimer:'No indicator accuracy or profitability is established without a validated signal implementation and out-of-sample evaluation. Segment capital resets; returns must not be added together.'};
}
