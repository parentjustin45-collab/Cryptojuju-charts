/* Conservative event-based SPEED/EMA validation over clean, disconnected windows.
   Signals are closed-candle, entries at next open, stops take priority on ties.
   Independent trades, no overlapping positions per strategy/direction/window.
   Never compounds returns across gaps or symbols. Research only. */
import {classifySpeedCandleV3} from './speed-candle-v3.mjs';
import {emaSeries} from './speed-ema-filter.mjs';
import {classifySpeedEmaInteractions} from './speed-ema-interactions.mjs';
export function studySpeedEmaRiskHoldout(windows,{cutoffTime,feeRate=0.0006,slippageRate=0,stopPct=1.5,takePct=3,maxBars=12,minTrades=30}={}){
 if(!Number.isFinite(cutoffTime))throw Error('cutoffTime required');
 if(!(stopPct>0&&takePct>0&&Number.isInteger(maxBars)&&maxBars>0&&minTrades>0))throw Error('Invalid risk configuration');
 const names=['speed','ema50_breakout','ema13_bounce','emaStack'];
 const keys=names.flatMap(n=>['long','short'].map(s=>n+'_'+s));
 const blank=()=>({trades:0,wins:0,sumNetPct:0,sumNetPctSq:0,losses:0,stops:0,takes:0,timeouts:0});
 const result=Object.fromEntries(keys.map(k=>[k,{train:blank(),test:blank()}]));
 let excludedShort=0,usableWindows=0;
 for(const window of windows){
  const candles=window.candles??window;
  if(!Array.isArray(candles)||candles.length<202){excludedShort++;continue;}
  usableWindows++;
  const cls=classifySpeedCandleV3(candles),ema=Object.fromEntries([13,50,100,200].map(p=>[p,emaSeries(candles,p)]));
  const reactions=new Set(classifySpeedEmaInteractions(candles).filter(e=>(e.period===50&&e.type==='breakout')||(e.period===13&&e.type==='bounce')).map(e=>e.time+':'+e.period+':'+e.type));
  const signals=Object.fromEntries(keys.map(k=>[k,[]]));
  for(let i=200;i<candles.length-1;i++){
   const c=cls[i];if(!c.color)continue;
   const side=c.color.startsWith('bull')?'long':'short',time=Number(candles[i].time),close=Number(candles[i].close);
   signals['speed_'+side].push(i);
   if(reactions.has(time+':50:breakout'))signals['ema50_breakout_'+side].push(i);
   if(reactions.has(time+':13:bounce'))signals['ema13_bounce_'+side].push(i);
   const [a,b,d,e]=[13,50,100,200].map(p=>ema[p][i]);
   if([a,b,d,e].every(Number.isFinite)&&(side==='long'?close>a&&a>b&&b>d&&d>e:close<a&&a<b&&b<d&&d<e))signals['emaStack_'+side].push(i);
  }
  for(const [key,indices] of Object.entries(signals)){
   const dir=key.endsWith('_long')?1:-1;
   let occupiedThrough=-1;
   for(const i of indices){
    const entryIdx=i+1;
    if(entryIdx<=occupiedThrough)continue;
    const entryBar=candles[entryIdx],entryTime=Number(entryBar.time);
    const period=entryTime<cutoffTime?'train':'test';
    const entry=Number(entryBar.open)*(1+dir*slippageRate);
    const stop=entry*(1-dir*stopPct/100),take=entry*(1+dir*takePct/100);
    const end=Math.min(candles.length-1,entryIdx+maxBars-1);
    // Do not carry positions across the train/test boundary.
    let last=end;
    for(let j=entryIdx;j<=end;j++)if(Number(candles[j].time)>=cutoffTime&&period==='train'){last=j-1;break;}
    if(last<entryIdx)continue;
    let exit=null,reason='timeout',exitIdx=last;
    for(let j=entryIdx;j<=last;j++){
     const bar=candles[j],open=Number(bar.open),low=Number(bar.low),high=Number(bar.high);
     // Gap through stop/take: fill at open, not an unattainable trigger.
     if(dir===1){
      if(open<=stop){exit=open;reason='stop';exitIdx=j;break;}
      if(open>=take){exit=open;reason='take';exitIdx=j;break;}
      if(low<=stop){exit=stop;reason='stop';exitIdx=j;break;}
      if(high>=take){exit=take;reason='take';exitIdx=j;break;}
     }else{
      if(open>=stop){exit=open;reason='stop';exitIdx=j;break;}
      if(open<=take){exit=open;reason='take';exitIdx=j;break;}
      if(high>=stop){exit=stop;reason='stop';exitIdx=j;break;}
      if(low<=take){exit=take;reason='take';exitIdx=j;break;}
     }
    }
    if(exit===null)exit=Number(candles[exitIdx].close);
    const executedExit=exit*(1-dir*slippageRate);
    const netPct=100*(dir*(executedExit-entry)/entry-feeRate*(1+executedExit/entry));
    const bucket=result[key][period];bucket.trades++;bucket.wins+=netPct>0?1:0;bucket.losses+=netPct<=0?1:0;
    bucket.sumNetPct+=netPct;bucket.sumNetPctSq+=netPct*netPct;
    if(reason==='stop')bucket.stops++;else if(reason==='take')bucket.takes++;else bucket.timeouts++;
    occupiedThrough=exitIdx;
   }
  }
 }
 for(const pair of Object.values(result))for(const bucket of Object.values(pair)){
  bucket.winRatePct=bucket.trades?100*bucket.wins/bucket.trades:null;
  bucket.meanNetPct=bucket.trades?bucket.sumNetPct/bucket.trades:null;
  bucket.status=bucket.trades>=minTrades?'sample_threshold_met':'insufficient_trades';
 }
 return {strategies:result,diagnostics:{windows:windows.length,usableWindows,excludedShort,minTrades},assumptions:{cutoffTime,feeRate,slippageRate,stopPct,takePct,maxBars,execution:'next-bar-open',intrabarTie:'stop-first',fees:'both-sides',validation:'absolute-time split across all clean windows',capital:'non-compounded per-trade percentage',warning:'Research only. Same-candle stop and take assumed stop first; no tick-level ordering. No trading across gaps. Small or correlated samples do not establish profitability.'}};
}
