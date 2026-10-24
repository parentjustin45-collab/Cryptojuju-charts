/* Matched baseline: same confirmed pivot trend and same breakout target.
   Compare MID signal candles against ordinary non-SPEED candles, not against
   arbitrary market bars. No future information is used for cohort selection. */
import {classifySpeedCandleV3} from './speed-candle-v3.mjs';
export function compareSpeedMidToOrdinary(candles,{leftBars=2,rightBars=2,horizons=[3,5,10],warmup=20}={}){
 if(!Array.isArray(candles)||![leftBars,rightBars,warmup].every(Number.isSafeInteger)||leftBars<1||rightBars<1||warmup<20||!Array.isArray(horizons)||!horizons.length||horizons.some(n=>!Number.isSafeInteger(n)||n<1))throw Error('Invalid settings');
 const colors=classifySpeedCandleV3(candles);
 const highs=[],lows=[],result={};
 for(const direction of ['bull','bear'])result[direction]=Object.fromEntries(horizons.map(h=>[h,{speed:{n:0,breaks:0},ordinary:{n:0,breaks:0}}]));
 for(let i=0;i<candles.length;i++){
  const p=i-rightBars;
  if(p>=leftBars){
   const window=candles.slice(p-leftBars,p+rightBars+1);
   const hi=Number(candles[p].high),lo=Number(candles[p].low);
   if(window.every((c,j)=>j===leftBars||hi>Number(c.high)))highs.push(hi);
   if(window.every((c,j)=>j===leftBars||lo<Number(c.low)))lows.push(lo);
  }
  if(i<warmup-1||highs.length<2||lows.length<2)continue;
  const down=highs.at(-1)<highs.at(-2)&&lows.at(-1)<lows.at(-2);
  const up=highs.at(-1)>highs.at(-2)&&lows.at(-1)>lows.at(-2);
  const bull=Number(candles[i].close)>Number(candles[i].open);
  const bear=Number(candles[i].close)<Number(candles[i].open);
  const direction=down&&bull?'bull':up&&bear?'bear':null;
  if(!direction)continue;
  const color=colors[i].color;
  const isSpeed=direction==='bull'?color==='bullMid':color==='bearMid';
  const ordinary=color===null;
  if(!isSpeed&&!ordinary)continue; // exclude HIGH to avoid contaminating controls
  const level=direction==='bull'?highs.at(-1):lows.at(-1);
  for(const h of horizons){
   if(i+h>=candles.length)continue;
   const cohort=isSpeed?result[direction][h].speed:result[direction][h].ordinary;
   cohort.n++;
   let broken=false;
   for(let j=i+1;j<=i+h;j++)if(direction==='bull'?Number(candles[j].close)>level:Number(candles[j].close)<level){broken=true;break;}
   if(broken)cohort.breaks++;
  }
 }
 for(const d of Object.values(result))for(const x of Object.values(d)){
  for(const c of [x.speed,x.ordinary])c.ratePct=c.n?100*c.breaks/c.n:null;
  x.liftPp=x.speed.n&&x.ordinary.n?x.speed.ratePct-x.ordinary.ratePct:null;
 }
 return {byDirection:result,definition:'Same confirmed trend, same candle direction, same prior swing breakout, horizons 3/5/10. Ordinary controls exclude any colored SPEED candles. Unadjusted observational comparison; controls are not volatility/volume matched.'};
}
