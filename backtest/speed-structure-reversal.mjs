/* Strict, causal swing-structure reversal study. No future candles used to detect an event.
   A reversal requires a prior trend of confirmed pivots and a later structure break.
   Pivot confirmation requires rightBars CLOSED bars. */
import {classifySpeedCandleV3} from './speed-candle-v3.mjs';
export function studySpeedStructureReversals(candles,{leftBars=2,rightBars=2,horizons=[3,5,10],warmup=20}={}){
 if(!Array.isArray(candles)||![leftBars,rightBars,warmup].every(Number.isSafeInteger)||leftBars<1||rightBars<1||warmup<20||!Array.isArray(horizons)||!horizons.length||horizons.some(n=>!Number.isSafeInteger(n)||n<1))throw Error('Invalid study configuration');
 const colors=classifySpeedCandleV3(candles);
 const pivotsHigh=[],pivotsLow=[],contexts=[];
 for(let i=0;i<candles.length;i++){
  const p=i-rightBars;
  if(p>=leftBars){
   const h=Number(candles[p].high),l=Number(candles[p].low);
   const window=candles.slice(p-leftBars,p+rightBars+1);
   if(window.every((x,j)=>j===leftBars||h>Number(x.high)))pivotsHigh.push({index:p,price:h,confirmedAt:i});
   if(window.every((x,j)=>j===leftBars||l<Number(x.low)))pivotsLow.push({index:p,price:l,confirmedAt:i});
  }
  const highs=pivotsHigh.slice(-2),lows=pivotsLow.slice(-2);
  const up=highs.length===2&&lows.length===2&&highs[1].price>highs[0].price&&lows[1].price>lows[0].price;
  const down=highs.length===2&&lows.length===2&&highs[1].price<highs[0].price&&lows[1].price<lows[0].price;
  contexts.push({up,down,priorSwingHigh:highs.at(-1)?.price??null,priorSwingLow:lows.at(-1)?.price??null});
 }
 const result={bullMid:{},bearMid:{}};
 for(const k of Object.keys(result))for(const h of horizons)result[k][h]={eligible:0,confirmed:0,unconfirmed:0,ratePct:null};
 for(let i=warmup-1;i<candles.length;i++){
  const color=colors[i].color;if(color!=='bullMid'&&color!=='bearMid')continue;
  // Trend context is known on signal close; require an opposite established trend.
  const context=contexts[i];
  const bullish=color==='bullMid';
  if(bullish?!context.down:!context.up)continue;
  const level=bullish?context.priorSwingHigh:context.priorSwingLow;
  if(level===null)continue;
  for(const h of horizons){
   if(i+h>=candles.length)continue;
   const bucket=result[color][h];bucket.eligible++;
   let broken=false;
   for(let j=i+1;j<=i+h;j++){
    if(bullish?Number(candles[j].close)>level:Number(candles[j].close)<level){broken=true;break;}
   }
   if(broken)bucket.confirmed++;else bucket.unconfirmed++;
  }
 }
 for(const groups of Object.values(result))for(const v of Object.values(groups))v.ratePct=v.eligible?100*v.confirmed/v.eligible:null;
 return {horizons,byColor:result,definition:'Strict structure reversal: signal after two confirmed lower highs/lows (blue) or higher highs/lows (pink), followed by close breaking last confirmed opposite swing within N candles. Swing pivots are only available after rightBars closed candles; no crossing quarantined gaps. Retrospective outcome, not a trade execution rule.'};
}
