/* Research-only, strict matched controls. Comparisons are within one clean
   historical segment, same direction and confirmed pivot trend. Features
   (relative volume/range) use only current and prior CLOSED bars.
   Match without replacement; report unmatched signals, never force a match. */
import {classifySpeedCandleV3} from './speed-candle-v3.mjs';
export function compareSpeedMatchedFeatures(candles,{horizons=[3,5,10],leftBars=2,rightBars=2,warmup=20,maxVolumeLogGap=Math.log(1.5),maxRangeLogGap=Math.log(1.5)}={}){
 if(!Array.isArray(candles)||!Array.isArray(horizons)||!horizons.length||horizons.some(h=>!Number.isSafeInteger(h)||h<1)||![leftBars,rightBars,warmup].every(Number.isSafeInteger)||leftBars<1||rightBars<1||warmup<20||![maxVolumeLogGap,maxRangeLogGap].every(v=>Number.isFinite(v)&&v>=0))throw Error('Invalid matching configuration');
 const classes=classifySpeedCandleV3(candles);
 const highs=[],lows=[],events=[];
 for(let i=0;i<candles.length;i++){
  const p=i-rightBars;
  if(p>=leftBars){
   const w=candles.slice(p-leftBars,p+rightBars+1),hi=Number(candles[p].high),lo=Number(candles[p].low);
   if(w.every((c,j)=>j===leftBars||hi>Number(c.high)))highs.push(hi);
   if(w.every((c,j)=>j===leftBars||lo<Number(c.low)))lows.push(lo);
  }
  if(i<warmup-1||highs.length<2||lows.length<2)continue;
  const down=highs.at(-1)<highs.at(-2)&&lows.at(-1)<lows.at(-2);
  const up=highs.at(-1)>highs.at(-2)&&lows.at(-1)>lows.at(-2);
  const bullish=Number(candles[i].close)>Number(candles[i].open),bearish=Number(candles[i].close)<Number(candles[i].open);
  const direction=down&&bullish?'bull':up&&bearish?'bear':null;
  if(!direction)continue;
  const color=classes[i].color,isSpeed=direction==='bull'?color==='bullMid':color==='bearMid';
  if(!isSpeed&&color!==null)continue;
  const v=classes[i].volumePercent,r=classes[i].speedPercent;
  if(!(v>0&&r>0))continue;
  events.push({i,direction,isSpeed,volume:v,range:r,level:direction==='bull'?highs.at(-1):lows.at(-1)});
 }
 const output={};
 for(const direction of ['bull','bear']){
  const signals=events.filter(e=>e.direction===direction&&e.isSpeed);
  const controls=events.filter(e=>e.direction===direction&&!e.isSpeed);
  const used=new Set(),pairs=[];
  for(const signal of signals){
   let best=null,bestDistance=Infinity;
   for(const control of controls){
    if(used.has(control.i))continue;
    const vd=Math.abs(Math.log(signal.volume/control.volume));
    const rd=Math.abs(Math.log(signal.range/control.range));
    if(vd>maxVolumeLogGap||rd>maxRangeLogGap)continue;
    const distance=vd+rd;
    if(distance<bestDistance){best=control;bestDistance=distance;}
   }
   if(best){used.add(best.i);pairs.push([signal,best]);}
  }
  const byHorizon={};
  for(const h of horizons){
   let eligible=0,speedBreaks=0,controlBreaks=0;
   for(const [signal,control] of pairs){
    if(signal.i+h>=candles.length||control.i+h>=candles.length)continue;
    eligible++;
    const broken=e=>{for(let j=e.i+1;j<=e.i+h;j++)if(e.direction==='bull'?Number(candles[j].close)>e.level:Number(candles[j].close)<e.level)return true;return false;};
    if(broken(signal))speedBreaks++;
    if(broken(control))controlBreaks++;
   }
   byHorizon[h]={pairs:eligible,speedBreaks,controlBreaks,speedRatePct:eligible?100*speedBreaks/eligible:null,controlRatePct:eligible?100*controlBreaks/eligible:null,liftPp:eligible?100*(speedBreaks-controlBreaks)/eligible:null};
  }
  output[direction]={signals:signals.length,matched:pairs.length,unmatched:signals.length-pairs.length,byHorizon};
 }
 return {byDirection:output,definition:'One-to-one nearest controls without replacement, same confirmed trend and candle direction; log(relative volume) and log(relative range) each within ln(1.5). Matching uses no future prices; outcomes use only subsequent closed bars inside each clean segment. Observational, potentially sparse and not statistically independent.'};
}
