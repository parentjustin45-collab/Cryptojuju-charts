/* CryptoJuju V1.26.0: deterministic, read-only OHLC parity gate.
 * All candle timestamps are UTC OPEN times in milliseconds.
 * Compare only COMPLETE historical candles; never fill gaps or modify prices.
 */
export const STEP_MS=Object.freeze({'15m':900000,'1h':3600000,'4h':14400000});
export const PRICE_TOLERANCE_USDT=0.011;
export const KEYS=Object.freeze(['open','high','low','close']);
export function closedWindow(now,interval,count=48,skipRecentCompleted=1){
 const step=STEP_MS[interval];
 if(!step||!Number.isSafeInteger(now)||!Number.isInteger(count)||count<1||count>150||
    !Number.isInteger(skipRecentCompleted)||skipRecentCompleted<0||skipRecentCompleted>8)
   throw Error('Unsupported or unsafe OHLC window');
 const currentOpen=Math.floor(now/step)*step;
 const end=currentOpen-skipRecentCompleted*step;
 return {startTime:end-count*step,endTime:end,intervalMs:step,currentOpen,expected:count,
  omittedMostRecentClosedBars:skipRecentCompleted};
}
export function normalizeCandles(rows,{startTime,endTime,intervalMs},label='unknown'){
 if(!Array.isArray(rows)||!Number.isSafeInteger(startTime)||!Number.isSafeInteger(endTime)||
   !Number.isSafeInteger(intervalMs)||intervalMs<=0||startTime>=endTime||
   (endTime-startTime)%intervalMs!==0)throw Error('Invalid OHLC normalization input');
 const bars=new Map(),invalid=[],duplicates=[],outOfRange=[];
 for(const raw of rows){
  const t=Number(raw?.time),time=t<1e11?t*1000:t;
  if(!Number.isSafeInteger(time)||time<startTime||time>=endTime||
    (time-startTime)%intervalMs!==0){
   outOfRange.push(raw?.time??null);continue;
  }
  const bar={time};
  for(const k of KEYS)bar[k]=Number(raw?.[k]);
  bar.volume=Number(raw?.volume??0);
  const reasons=[];
  if(![time,...KEYS.map(k=>bar[k]),bar.volume].every(Number.isFinite))
   reasons.push('NON_FINITE');
  else{
   if(bar.open<=0||bar.high<=0||bar.low<=0||bar.close<=0)reasons.push('NON_POSITIVE');
   if(bar.high<Math.max(bar.open,bar.close))reasons.push('HIGH_BELOW_OPEN_OR_CLOSE');
   if(bar.low>Math.min(bar.open,bar.close))reasons.push('LOW_ABOVE_OPEN_OR_CLOSE');
   if(bar.low>bar.high)reasons.push('HIGH_BELOW_LOW');
   if(bar.volume<0)reasons.push('NEGATIVE_VOLUME');
  }
  if(bars.has(time)){duplicates.push(time);continue}
  bars.set(time,bar);
  if(reasons.length)invalid.push({time,utc:new Date(time).toISOString(),reasons,bar});
 }
 const missing=[];
 for(let t=startTime;t<endTime;t+=intervalMs)if(!bars.has(t))missing.push(t);
 const badTimes=new Set([...invalid.map(x=>x.time),...duplicates]);
 return {label,bars,invalid,duplicates,missing,outOfRange,badTimes,
  count:bars.size,expected:(endTime-startTime)/intervalMs,
  quality:(invalid.length||duplicates.length||missing.length)?'BLOCKED':'CLEAN'};
}
export function compareCandleSets(a,b,window,{priceTolerance=PRICE_TOLERANCE_USDT}={}){
 if(!a?.bars||!b?.bars||!window||!Number.isFinite(priceTolerance)||priceTolerance<0)
  throw Error('Invalid parity comparison');
 const mismatches=[],missingInA=[],missingInB=[],matched=[];
 let maxDifference=0;
 for(let t=window.startTime;t<window.endTime;t+=window.intervalMs){
  const x=a.bars.get(t),y=b.bars.get(t);
  if(!x){missingInA.push(t);continue}
  if(!y){missingInB.push(t);continue}
  if(a.badTimes.has(t)||b.badTimes.has(t))continue;
  const diffs=[];
  for(const k of KEYS){
   const delta=Number(Math.abs(x[k]-y[k]).toFixed(10));
   maxDifference=Math.max(maxDifference,delta);
   if(delta>priceTolerance)diffs.push({field:k,left:x[k],right:y[k],delta});
  }
  if(diffs.length)mismatches.push({time:t,utc:new Date(t).toISOString(),differences:diffs,left:x,right:y});
  else matched.push(t);
 }
 const blocked=a.quality!=='CLEAN'||b.quality!=='CLEAN';
 const status=blocked?'BLOCKED_DATA_QUALITY':mismatches.length?'PRICE_MISMATCH':'MATCH';
 return {status,labels:{left:a.label,right:b.label},expected:window.expected,
  matched:matched.length,priceMismatches:mismatches.length,
  maxDifferenceUSDT:maxDifference,missingInA:missingInA.length,
  missingInB:missingInB.length,quality:{left:a.quality,right:b.quality},
  samples:mismatches.slice(0,12),missingTimestamps:{left:missingInA.slice(0,12),right:missingInB.slice(0,12)},
  toleranceUSDT:priceTolerance};
}
export function publicQuality(x){
 return {label:x.label,count:x.count,expected:x.expected,quality:x.quality,
  missing:x.missing.length,duplicates:x.duplicates.length,invalid:x.invalid.length,
  outOfRange:x.outOfRange.length,invalidSamples:x.invalid.slice(0,10)};
}
export function parityCsvRow(t,a,b){
 const x=a.bars.get(t),y=b.bars.get(t);
 const str=v=>v===undefined||v===null?'':String(v);
 const cols=[new Date(t).toISOString(),str(t),a.label,b.label];
 for(const c of [x,y])for(const k of KEYS)cols.push(str(c?.[k]));
 for(const k of KEYS)cols.push(x&&y?str(Number((x[k]-y[k]).toFixed(10))):'');
 return cols.join(',');
}
export const PARITY_CSV_HEADER='utc,epochMs,leftSource,rightSource,leftOpen,leftHigh,leftLow,leftClose,rightOpen,rightHigh,rightLow,rightClose,deltaOpen,deltaHigh,deltaLow,deltaClose';
