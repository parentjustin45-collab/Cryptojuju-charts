/* Classify raw historical candles without changing OHLC prices.
   Strict backtests require every expected timestamp to be present and valid. */
export function classifyHistory(rows,{startTime,endTime,intervalMs}={}){
 if(!Array.isArray(rows)||![startTime,endTime,intervalMs].every(Number.isSafeInteger)||intervalMs<=0||startTime>=endTime||(endTime-startTime)%intervalMs!==0)throw Error('Invalid history window');
 const valid=new Map(),invalid=new Map(),duplicates=[],outOfRange=[];
 for(const raw of rows){
  const time=Number(raw?.time);
  if(!Number.isSafeInteger(time)||time<startTime||time>=endTime||(time-startTime)%intervalMs!==0){outOfRange.push(raw?.time);continue;}
  const c={time,open:Number(raw.open),high:Number(raw.high),low:Number(raw.low),close:Number(raw.close),volume:Number(raw.volume??0)};
  const reasons=[];
  if(!Object.values(c).every(Number.isFinite))reasons.push('NON_FINITE');
  else{
   if(c.open<=0||c.high<=0||c.low<=0||c.close<=0||c.volume<0)reasons.push('NON_POSITIVE_PRICE_OR_NEGATIVE_VOLUME');
   if(c.high<Math.max(c.open,c.close))reasons.push('HIGH_BELOW_OPEN_OR_CLOSE');
   if(c.low>Math.min(c.open,c.close))reasons.push('LOW_ABOVE_OPEN_OR_CLOSE');
   if(c.low>c.high)reasons.push('LOW_ABOVE_HIGH');
  }
  if(valid.has(time)||invalid.has(time))duplicates.push(time);
  if(reasons.length){valid.delete(time);invalid.set(time,{time,reasons,raw});}
  else if(!invalid.has(time))valid.set(time,c);
 }
 const missing=[],unusable=[];
 for(let t=startTime;t<endTime;t+=intervalMs){
  if(!valid.has(t)){
   unusable.push(t);
   if(!invalid.has(t))missing.push(t);
  }
 }
 const candles=[...valid.values()].sort((a,b)=>a.time-b.time);
 const issues=[...invalid.values()].sort((a,b)=>a.time-b.time);
 const status=unusable.length?'BLOCKED':'READY';
 return {status,candles,issues,missing,unusable,quality:{expected:(endTime-startTime)/intervalMs,valid:candles.length,invalid:issues.length,missing:missing.length,duplicates:duplicates.length,outOfRange:outOfRange.length,coveragePct:100*candles.length/((endTime-startTime)/intervalMs)},canBacktest:status==='READY'};
}
export function requireCleanHistory(classification){
 if(!classification?.canBacktest)throw Error('Backtest blocked: missing or invalid OHLC candles');
 return classification.candles;
}
