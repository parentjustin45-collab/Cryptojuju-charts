/* Same-risk comparison of Vector AIT and SPEED. Clean windows only.
   Signals at closed bar; fills at next open; no cross-gap trades. */
import {vectorAIT} from './vector-ait-v1.mjs';
import {classifySpeedCandleV3} from './speed-candle-v3.mjs';
export function studyVectorSpeed(windows,{cutoffTime,feeRate=0.0006,stopPct=1.5,takePct=3,maxBars=12,minTrades=30}={}){
 if(!Number.isFinite(cutoffTime))throw Error('cutoffTime required');
 const names=['speed','vector_entry','speed_vector_direction','speed_vector_flip'];
 const result=Object.fromEntries(names.flatMap(n=>['long','short'].map(side=>[n+'_'+side,{train:{trades:0,wins:0,sumNetPct:0},test:{trades:0,wins:0,sumNetPct:0}}])));
 let usableWindows=0;
 for(const w of windows){
  const bars=w.candles??w;if(bars.length<22)continue;usableWindows++;
  const vector=vectorAIT(bars),speed=classifySpeedCandleV3(bars);
  const events=Object.fromEntries(Object.keys(result).map(k=>[k,[]]));
  for(let i=19;i<bars.length-1;i++){
   const v=vector[i],s=speed[i],side=s.color?(s.color.startsWith('bull')?'long':'short'):null;
   if(side){
    events['speed_'+side].push(i);
    if(v.direction===(side==='long'?1:-1))events['speed_vector_direction_'+side].push(i);
    if(v.signal===side)events['speed_vector_flip_'+side].push(i);
   }
   if(v.signal)events['vector_entry_'+v.signal].push(i);
  }
  for(const [key,indices] of Object.entries(events)){
   const direction=key.endsWith('_long')?1:-1;let occupied=-1;
   for(const i of indices){
    const start=i+1;if(start<=occupied)continue;
    const period=Number(bars[start].time)<cutoffTime?'train':'test';
    const entry=Number(bars[start].open),stop=entry*(1-direction*stopPct/100),take=entry*(1+direction*takePct/100);
    let end=Math.min(start+maxBars-1,bars.length-1);
    if(period==='train')while(end>=start&&Number(bars[end].time)>=cutoffTime)end--;
    if(end<start)continue;
    let exit=Number(bars[end].close),last=end;
    for(let j=start;j<=end;j++){
     const b=bars[j],o=Number(b.open),h=Number(b.high),l=Number(b.low);
     if(direction===1){
      if(o<=stop){exit=o;last=j;break;}
      if(o>=take){exit=o;last=j;break;}
      if(l<=stop){exit=stop;last=j;break;}
      if(h>=take){exit=take;last=j;break;}
     }else{
      if(o>=stop){exit=o;last=j;break;}
      if(o<=take){exit=o;last=j;break;}
      if(h>=stop){exit=stop;last=j;break;}
      if(l<=take){exit=take;last=j;break;}
     }
    }
    const net=100*(direction*(exit-entry)/entry-feeRate*(1+exit/entry));
    const b=result[key][period];b.trades++;b.wins+=Number(net>0);b.sumNetPct+=net;occupied=last;
   }
  }
 }
 for(const pair of Object.values(result))for(const b of Object.values(pair)){b.winRatePct=b.trades?100*b.wins/b.trades:null;b.meanNetPct=b.trades?b.sumNetPct/b.trades:null;b.status=b.trades>=minTrades?'sample_threshold_met':'insufficient_trades';}
 return {strategies:result,diagnostics:{windows:windows.length,usableWindows,minTrades},assumptions:{cutoffTime,feeRate,stopPct,takePct,maxBars,execution:'next-bar-open',sameBarStopTake:'stop-first',capital:'independent net percent per trade',note:'Exploratory: Vector Pine parity not independently verified; no slippage; sample correlation and selection bias remain.'}};
}
