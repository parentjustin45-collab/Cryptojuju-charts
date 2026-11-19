/*
 * Reproducible, historical, non-overlapping OHLC-closed 1h test windows.
 * Earlier periods are additional backtest periods, NOT fresh prospective
 * out-of-sample evidence. All cutoffs are midnight UTC, not local time.
 */
export const HOUR_MS=3600000;
export const DAY_MS=86400000;
export const HOUR_BARS=960;
export const ANCHOR_UTC='2026-11-19T00:00:00.000Z';
export const HISTORICAL_SYMBOLS=Object.freeze([
  'BTCUSDT','HYPEUSDT','1000PEPEUSDT'
]);
export const PRIOR_WINDOW_IDS=Object.freeze(['older_40d','older_80d']);
export function planPriorHourlyWindows({
  anchorUtc=ANCHOR_UTC,barCount=HOUR_BARS,periods=2
}={}){
 const date=new Date(anchorUtc),anchorMs=date.getTime();
 if(!Number.isSafeInteger(anchorMs)||!date.toISOString().startsWith(anchorUtc)||
    anchorMs%DAY_MS!==0||
    !Number.isSafeInteger(barCount)||barCount<160||barCount>960||
    barCount%24!==0||
    !Number.isSafeInteger(periods)||periods<1||periods>3)
   throw Error('Only closed UTC 1h disjoint history blocks allowed');
 const daySpan=barCount/24,windows=[];
 for(let n=1;n<=periods;n++){
   const endTime=anchorMs-n*daySpan*DAY_MS;
   const startTime=endTime-barCount*HOUR_MS;
   const item={
     id:PRIOR_WINDOW_IDS[n-1]??'older_'+(n*daySpan)+'d',
     asOfMs:endTime+60000,utcStart:new Date(startTime).toISOString(),
     utcEndExclusive:new Date(endTime).toISOString(),
     startTime,endTime,intervalMs:HOUR_MS,requestedBars:barCount,
     latestStudyEndExclusiveUtc:anchorUtc
   };
   if(item.asOfMs>=anchorMs||startTime>=endTime||
      (windows.length&&windows.at(-1).startTime!==item.endTime))
     throw Error('Historical windows overlap or include latest research');
   windows.push(item);
 }
 return windows;
}
export function auditPriorResultShape(report,windows){
 if(!Array.isArray(windows)||windows.length<1||
    report?.protocol!=='CJ_VECTOR_DAILY_PRIOR_WINDOWS_RESEARCH_V1'||
    report?.ordersPlaced!==false||report?.promotedVersion!==null||
    report?.cases?.length!==windows.length*HISTORICAL_SYMBOLS.length)
  throw Error('Incomplete historical validation manifest');
 const known=new Set();
 for(const entry of report.cases){
  const window=windows.find(w=>w.id===entry.windowId);
  if(!window||!HISTORICAL_SYMBOLS.includes(entry.symbol)||
     known.has(entry.symbol+':'+entry.windowId)||
     !['RESEARCH_COMPARISON_ONLY','BLOCKED'].includes(entry.status))
    throw Error('Invalid or duplicate historical research case');
  known.add(entry.symbol+':'+entry.windowId);
  if(entry.status==='RESEARCH_COMPARISON_ONLY'&&
     (entry.hourlyBars!==window.requestedBars||
      entry.hourlyStartTime!==window.startTime||
      entry.hourlyEndTime!==window.endTime||
      entry.holdoutModes?.length!==6||
      entry.holdoutModes.some(x=>x.promoted!==false)))
     throw Error('Historical source mismatch or automatic promotion');
 }
 return true;
}
