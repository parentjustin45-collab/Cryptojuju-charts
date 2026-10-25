/* Experimental EMA dynamic support/resistance event classifier.
   Closed-candle inputs only. EMA values are seeded from past closes.
   A tolerance band defines proximity; no future candles or repaint. */
import {emaSeries} from './speed-ema-filter.mjs';
import {classifySpeedCandleV3} from './speed-candle-v3.mjs';

export function classifySpeedEmaInteractions(candles,{periods=[13,50,100,200],tolerancePct=0.2}={}){
 if(!Array.isArray(candles)||!Array.isArray(periods)||!periods.length||
   !periods.every(p=>Number.isSafeInteger(p)&&p>=2)||
   !Number.isFinite(tolerancePct)||tolerancePct<0||tolerancePct>10)throw Error('Invalid inputs');
 const colors=classifySpeedCandleV3(candles);
 const series=new Map(periods.map(p=>[p,emaSeries(candles,p)]));
 const events=[];
 for(let i=1;i<candles.length-1;i++){
  const c=candles[i],prev=candles[i-1],close=Number(c.close),open=Number(c.open),
        high=Number(c.high),low=Number(c.low),prevClose=Number(prev.close);
  if(!colors[i].color)continue;
  const side=colors[i].color.startsWith('bull')?'long':'short';
  for(const period of periods){
   const ema=series.get(period)[i],prevEma=series.get(period)[i-1];
   if(ema===null||prevEma===null)continue;
   const band=ema*tolerancePct/100;
   const touched=low<=ema+band&&high>=ema-band;
   const prevAbove=prevClose>prevEma,above=close>ema;
   const breakout=side==='long'?!prevAbove&&above:prevAbove&&!above;
   const bounce=touched&&(side==='long'?above&&close>open:!above&&close<open)&&!breakout;
   const rejection=touched&&(side==='long'?above&&open<ema&&close>ema:!above&&open>ema&&close<ema)&&!breakout;
   // Rejection is a stricter body-cross subset of bounce; categories are exclusive.
   const type=breakout?'breakout':rejection?'rejection':bounce?'bounce':null;
   if(type)events.push({time:Number(c.time),side,period,type,color:colors[i].color,ema,tolerancePct,closed:true});
  }
 }
 return events;
}
export function emaInteractionSignals(events,{period=200,type='bounce'}={}){
 if(!['bounce','breakout','rejection'].includes(type))throw Error('Invalid interaction');
 return events.filter(e=>e.period===period&&e.type===type&&e.closed===true)
  .map(e=>({time:e.time,side:e.side}));
}
