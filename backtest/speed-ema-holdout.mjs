/* Chronological holdout for selected SPEED + EMA hypotheses.
   Training/validation split uses an absolute cutoff, and all EMA values
   are computed causally on the entire clean window for warmup only. */
import {classifySpeedCandleV3} from './speed-candle-v3.mjs';
import {emaSeries} from './speed-ema-filter.mjs';
import {classifySpeedEmaInteractions} from './speed-ema-interactions.mjs';
import {runBacktest} from './engine.mjs';
export function compareSpeedEmaHoldout(candles,{cutoffTime,feeRate=0.0006,slippageRate=0}={}){
 if(!Array.isArray(candles)||candles.length<202) return {status:'insufficient_ema200_warmup',bars:candles?.length??0};
 if(!Number.isFinite(cutoffTime))throw Error('Absolute cutoffTime required');
 const classified=classifySpeedCandleV3(candles);
 const ema=Object.fromEntries([13,50,100,200].map(p=>[p,emaSeries(candles,p)]));
 const reactions=new Set(classifySpeedEmaInteractions(candles).filter(e=>(e.period===50&&e.type==='breakout')||(e.period===13&&e.type==='bounce')).map(e=>e.time+':'+e.period+':'+e.type));
 const signals={speed:[],ema50_breakout:[],ema13_bounce:[],emaStack:[]};
 for(let i=200;i<candles.length-1;i++){
  const c=classified[i];if(!c.color)continue;
  const side=c.color.startsWith('bull')?'long':'short',time=Number(candles[i].time),close=Number(candles[i].close);
  const s={time,side};signals.speed.push(s);
  if(reactions.has(time+':50:breakout'))signals.ema50_breakout.push(s);
  if(reactions.has(time+':13:bounce'))signals.ema13_bounce.push(s);
  const [a,b,d,e]=[13,50,100,200].map(p=>ema[p][i]);
  if([a,b,d,e].every(Number.isFinite)&&(side==='long'?close>a&&a>b&&b>d&&d>e:close<a&&a<b&&b<d&&d<e))signals.emaStack.push(s);
 }
 const cut=candles.findIndex(c=>Number(c.time)>=cutoffTime);
 if(cut<202||cut>=candles.length-2)return {status:'insufficient_split',bars:candles.length,cutoffTime};
 const results={};
 for(const [name,events] of Object.entries(signals))for(const side of ['long','short']){
  const key=name+'_'+side;
  results[key]={};
  for(const [period,start,end] of [['train',0,cut],['test',cut,candles.length]]){
   const sample=candles.slice(start,end),times=new Set(sample.slice(0,-1).map(c=>Number(c.time)));
   const selected=events.filter(e=>e.side===side&&times.has(e.time));
   const r=runBacktest(sample,selected,{initialCapital:100,feeRate,slippageRate});
   results[key][period]={signals:selected.length,trades:r.tradeCount,wins:r.trades.filter(t=>t.pnl>0).length,returnPct:r.returnPct,maxDrawdownPct:r.maxDrawdownPct};
  }
 }
 return {status:'ok',bars:candles.length,cutoffTime,trainBars:cut,testBars:candles.length-cut,results,assumptions:{feeRate,slippageRate,execution:'next-bar-open',split:'absolute chronological cutoff',emaWarmup:'causal full-window historical prefix',finalExit:'last close of each partition',warning:'Exploratory; segment capital resets. No cross-gap compounding. Test partitions do not carry open train positions.'}};
}
