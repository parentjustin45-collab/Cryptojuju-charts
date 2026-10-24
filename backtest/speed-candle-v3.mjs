/* SPEED Candle V3.0 historical classification, transcribed from index.html.
   Research mapping: bullish event => long, bearish event => short.
   Colors alone are NOT buy/sell recommendations. Closed candles only. */
export function classifySpeedCandleV3(candles,{minTick=Number.EPSILON}={}) {
 if(!Number.isFinite(minTick)||minTick<=0)throw Error('Positive minTick required');
 if (!Array.isArray(candles)) throw Error('Candles array required');
 const result=[];
 for(let i=0;i<candles.length;i++){
  const c=candles[i],o=Number(c.open),h=Number(c.high),l=Number(c.low),cl=Number(c.close),v=Number(c.volume);
  if(![o,h,l,cl,v].every(Number.isFinite)||o<=0||l<=0||l>Math.min(o,cl)||h<Math.max(o,cl)||v<0)throw Error('Invalid OHLC at '+i);
  const from=Math.max(0,i-19),sample=candles.slice(from,i+1);
  const avgVol=i>=19?sample.reduce((s,x)=>s+Number(x.volume),0)/20:v;
  const avgRange=i>=19?sample.reduce((s,x)=>s+(Number(x.high)-Number(x.low)),0)/20:Math.max(h-l,minTick);
  const volumePercent=v/Math.max(avgVol,1)*100;
  const speedPercent=Math.max(h-l,minTick)/Math.max(avgRange,minTick)*100;
  const level=volumePercent>=200?'High':volumePercent>=150?'Mid':null;
  const direction=cl>o?'bull':cl<o?'bear':null;
  result.push({time:Number(c.time),color:level&&direction?direction+level:null,volumePercent,speedPercent,closed:true});
 }
 return result;
}
export function speedCandleResearchSignals(candles,{minWarmupBars=20}={}){
 if(!Number.isInteger(minWarmupBars)||minWarmupBars<20)throw Error('Warmup must be >=20 bars');
 return classifySpeedCandleV3(candles).slice(minWarmupBars-1)
  .filter(x=>x.color).map(x=>({time:x.time,side:x.color.startsWith('bull')?'long':'short'}));
}
