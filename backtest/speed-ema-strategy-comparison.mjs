/* Compare SPEED directional entries with EMA trend and closed-candle EMA reactions.
   Research only. Each strategy has the same execution, fees and sample window. */
import {classifySpeedCandleV3} from './speed-candle-v3.mjs';
import {emaSeries} from './speed-ema-filter.mjs';
import {classifySpeedEmaInteractions} from './speed-ema-interactions.mjs';
import {runBacktest} from './engine.mjs';
export function compareSpeedEmaInteractions(candles,{feeRate=0.0006,slippageRate=0,tolerancePct=0.2}={}){
 if(!Array.isArray(candles)||candles.length<2)throw Error('History too short');
 const classified=classifySpeedCandleV3(candles);
 const ema=Object.fromEntries([13,50,100,200].map(p=>[p,emaSeries(candles,p)]));
 const interactions=classifySpeedEmaInteractions(candles,{tolerancePct});
 const atTime=new Map();
 for(const e of interactions){
  const key=e.time+':'+e.period+':'+e.type;
  atTime.set(key,e);
 }
 const groups={speed:[],ema200:[],emaStack:[]};
 for(const period of [13,50,100,200])for(const type of ['bounce','breakout','rejection'])groups['ema'+period+'_'+type]=[];
 for(let i=19;i<candles.length-1;i++){
  const c=classified[i];if(!c.color)continue;
  const side=c.color.startsWith('bull')?'long':'short',time=Number(candles[i].time),close=Number(candles[i].close);
  const signal={time,side};
  groups.speed.push(signal);
  const e200=ema[200][i];
  if(e200!==null){
   if(side==='long'?close>e200:close<e200)groups.ema200.push(signal);
   const [a,b,d]=[ema[13][i],ema[50][i],ema[100][i]];
   if(side==='long'?close>a&&a>b&&b>d&&d>e200:close<a&&a<b&&b<d&&d<e200)groups.emaStack.push(signal);
  }
  for(const period of [13,50,100,200])for(const type of ['bounce','breakout','rejection']){
   if(atTime.has(time+':'+period+':'+type))groups['ema'+period+'_'+type].push(signal);
  }
 }
 const strategies=Object.fromEntries(Object.entries(groups).map(([name,signals])=>{
  const result=runBacktest(candles,signals,{initialCapital:100,feeRate,slippageRate});
  return [name,{signals:signals.length,trades:result.tradeCount,winRatePct:result.tradeCount?result.winRate:null,returnPct:result.returnPct,maxDrawdownPct:result.maxDrawdownPct}];
 }));
 return {strategies,assumptions:{execution:'next-bar-open',feeRate,slippageRate,tolerancePct,emaSeed:'SMA',closedCandleOnly:true,warning:'Exploratory strategy comparison; signal filtering changes holding periods. No out-of-sample profitability implied.'}};
}
