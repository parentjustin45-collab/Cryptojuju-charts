/* HIGH candle continuation vs non-SPEED controls matched on direction,
   pre-signal trend, relative volume and range. Research only.
   No lookahead for selection; outcomes observed after closed signal candle. */
import {classifySpeedCandleV3} from './speed-candle-v3.mjs';
export function compareSpeedHighContinuation(candles,{horizons=[3,5,10],warmup=20,maxVolumeLogGap=Math.log(1.5),maxRangeLogGap=Math.log(1.5)}={}){
 if(!Array.isArray(candles)||!Array.isArray(horizons)||!horizons.length||horizons.some(h=>!Number.isSafeInteger(h)||h<1)||!Number.isSafeInteger(warmup)||warmup<20)throw Error('Invalid settings');
 const cls=classifySpeedCandleV3(candles),events=[];
 for(let i=warmup-1;i<candles.length;i++){
  const c=candles[i],dir=Number(c.close)>Number(c.open)?'bull':Number(c.close)<Number(c.open)?'bear':null;
  if(!dir)continue;
  const color=cls[i].color,signal=dir==='bull'?color==='bullHigh':color==='bearHigh';
  if(!signal&&color!==null)continue;
  const volume=cls[i].volumePercent,range=cls[i].speedPercent;
  if(!(volume>0&&range>0))continue;
  // Causal context: direction of previous 5-bar closing price change.
  if(i<5)continue;
  const trend=Math.sign(Number(candles[i-1].close)-Number(candles[i-5].close));
  events.push({i,dir,signal,volume,range,trend});
 }
 const out={};
 for(const dir of ['bull','bear']){
  const signals=events.filter(e=>e.dir===dir&&e.signal),controls=events.filter(e=>e.dir===dir&&!e.signal),used=new Set(),pairs=[];
  for(const signal of signals){
   let best=null,score=Infinity;
   for(const control of controls){
    if(used.has(control.i)||control.trend!==signal.trend)continue;
    const v=Math.abs(Math.log(signal.volume/control.volume)),r=Math.abs(Math.log(signal.range/control.range));
    if(v>maxVolumeLogGap||r>maxRangeLogGap)continue;
    if(v+r<score){best=control;score=v+r;}
   }
   if(best){used.add(best.i);pairs.push([signal,best]);}
  }
  const byHorizon={};
  for(const h of horizons){
   let n=0,speedWins=0,controlWins=0,sumSpeed=0,sumControl=0;
   for(const [s,c] of pairs){
    if(s.i+h>=candles.length||c.i+h>=candles.length)continue;
    n++;
    const signed=e=>(Number(candles[e.i+h].close)/Number(candles[e.i].close)-1)*(e.dir==='bull'?1:-1)*100;
    const a=signed(s),b=signed(c);
    if(a>0)speedWins++;if(b>0)controlWins++;
    sumSpeed+=a;sumControl+=b;
   }
   byHorizon[h]={pairs:n,speedWins,controlWins,speedRatePct:n?100*speedWins/n:null,controlRatePct:n?100*controlWins/n:null,liftPp:n?100*(speedWins-controlWins)/n:null,meanSpeedPct:n?sumSpeed/n:null,meanControlPct:n?sumControl/n:null};
  }
  out[dir]={signals:signals.length,matched:pairs.length,unmatched:signals.length-pairs.length,byHorizon};
 }
 return {byDirection:out,definition:'HIGH candle signed close-to-close continuation after 3/5/10 bars; 1:1 non-SPEED controls same candle direction, prior 5-bar trend, volume/range within 1.5x. No trade simulation, no fees; non-independent events.'};
}
