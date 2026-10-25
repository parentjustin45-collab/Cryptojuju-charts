// Chronological robustness check. Each quarantined window is indivisible;
// returns are per-window percentage points, NOT compounded portfolio returns.
export function summarizeExitHoldout(windows, exitComparison, {cutoffTime}={}) {
 if (!Array.isArray(windows)||!exitComparison||!Number.isSafeInteger(cutoffTime)) throw Error('Invalid holdout inputs');
 const result={cutoffTime,train:{},holdout:{},warning:'Exploratory chronological split, not an untouched out-of-sample test. Entire clean windows are assigned by their start time; windows crossing the cutoff are excluded. Per-window capital resets; mean returns are not compounded.'};
 for(const [key,values] of Object.entries(exitComparison)){
  if(!Array.isArray(values)||values.length!==windows.length)throw Error('Exit comparison and window count mismatch: '+key);
  for(const group of ['train','holdout']){
   const selected=values.filter((v,i)=>group==='train'?windows[i].endTime<=cutoffTime:windows[i].startTime>=cutoffTime);
   const trades=selected.reduce((n,v)=>n+v.tradeCount,0);
   const weightedWins=selected.reduce((n,v)=>n+(v.winRatePercent??0)*v.tradeCount/100,0);
   result[group][key]={windows:selected.length,trades,winRatePct:trades?Number((100*weightedWins/trades).toFixed(2)):null,meanWindowReturnPct:selected.length?Number((selected.reduce((n,v)=>n+v.returnPercent,0)/selected.length).toFixed(4)):null,positiveWindows:selected.filter(v=>v.returnPercent>0).length,maxDrawdownPct:selected.length?Number(Math.max(...selected.map(v=>v.maxDrawdownPercent)).toFixed(4)):null};
  }
 }
 return result;
}
