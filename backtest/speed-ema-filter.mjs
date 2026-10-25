/* Closed-candle EMA trend confirmation for SPEED research.
   EMA warmup restarts at every quarantined history gap; no future candles used. */
import {classifySpeedCandleV3} from './speed-candle-v3.mjs';
import {runBacktest} from './engine.mjs';
export function emaSeries(candles,period){
 if(!Number.isSafeInteger(period)||period<2||!Array.isArray(candles))throw Error('Invalid EMA inputs');
 const out=Array(candles.length).fill(null);let sum=0,ema=null;
 for(let i=0;i<candles.length;i++){
  const price=Number(candles[i].close);
  if(!Number.isFinite(price)||price<=0)throw Error('Invalid close at '+i);
  if(i<period){sum+=price;if(i===period-1)ema=sum/period;}
  else ema+=(2/(period+1))*(price-ema);
  if(ema!==null)out[i]=ema;
 }
 return out;
}
export function compareSpeedEmaFilter(candles,{feeRate=0.0006,slippageRate=0}={}){
 if(!Array.isArray(candles)||candles.length<2)throw Error('History too short');
 const classified=classifySpeedCandleV3(candles);
 const ema=Object.fromEntries([13,50,100,200].map(p=>[p,emaSeries(candles,p)]));
 const signals={unfiltered:[],ema200:[],emaStack:[]};
 const counts={events:0,eligible200:0,eligibleStack:0};
 for(let i=19;i<candles.length-1;i++){
  const event=classified[i];if(!event.color)continue;
  const side=event.color.startsWith('bull')?'long':'short';
  const signal={time:Number(candles[i].time),side};
  signals.unfiltered.push(signal);counts.events++;
  const price=Number(candles[i].close);
  const e200=ema[200][i];
  if(e200===null)continue;
  const pass200=side==='long'?price>e200:price<e200;
  if(pass200){signals.ema200.push(signal);counts.eligible200++;}
  const a=ema[13][i],b=ema[50][i],c=ema[100][i],d=e200;
  const stack=side==='long'?price>a&&a>b&&b>c&&c>d:price<a&&a<b&&b<c&&c<d;
  if(stack){signals.emaStack.push(signal);counts.eligibleStack++;}
 }
 const results=Object.fromEntries(Object.entries(signals).map(([key,s])=>[key,runBacktest(candles,s,{initialCapital:100,feeRate,slippageRate})]));
 return {counts,results,assumptions:{closedCandlesOnly:true,execution:'next-bar-open',emaSeed:'SMA of first N closes',warmup200:200,comparison:'SPEED MID/HIGH directional events; EMA filter controls which entry/reversal commands are issued',warning:'Exploratory comparison, not a causal matched-trade test. Filtered strategies may hold positions longer; end-of-window exit is artificial.'}};
}
