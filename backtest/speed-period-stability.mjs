/* Non-overlapping chronological blocks. Every event is scored inside its own block;
   no outcome crosses a block or a quarantined segment boundary. */
import {compareSpeedMidToOrdinary} from './speed-matched-baseline.mjs';
export function studySpeedByPeriod(windows,{intervalMs,periodDays=15,horizons=[3,5,10]}={}){
 if(!Array.isArray(windows)||!Number.isFinite(intervalMs)||intervalMs<=0||!Number.isSafeInteger(periodDays)||periodDays<1)throw Error('Invalid period study');
 const periodMs=periodDays*86400000,periods=new Map();
 for(const window of windows){
  for(const candle of window.candles){
   const t=Number(candle.time),bucket=Math.floor(t/periodMs)*periodMs;
   if(!periods.has(bucket))periods.set(bucket,[]);
  }
  let current=[],lastBucket=null;
  const flush=()=>{
   if(current.length>=22){
    const result=compareSpeedMidToOrdinary(current,{horizons});
    const key=lastBucket;
    const aggregate=periods.get(key);
    aggregate.push(result.byDirection);
   }
  };
  for(const candle of window.candles){
   const bucket=Math.floor(Number(candle.time)/periodMs)*periodMs;
   if(lastBucket!==null&&bucket!==lastBucket){flush();current=[];}
   current.push(candle);lastBucket=bucket;
  }
  if(current.length)flush();
 }
 return [...periods.entries()].sort((a,b)=>a[0]-b[0]).map(([startTime,parts])=>{
  const result={};
  for(const direction of ['bull','bear']){
   result[direction]={};
   for(const h of horizons){
    const speed={n:0,breaks:0},ordinary={n:0,breaks:0};
    for(const p of parts)for(const group of ['speed','ordinary']){
     const source=p[direction][h][group],target=group==='speed'?speed:ordinary;
     target.n+=source.n;target.breaks+=source.breaks;
    }
    const speedPct=speed.n?100*speed.breaks/speed.n:null;
    const ordinaryPct=ordinary.n?100*ordinary.breaks/ordinary.n:null;
    result[direction][h]={speed,ordinary,speedPct,ordinaryPct,liftPp:speedPct!==null&&ordinaryPct!==null?speedPct-ordinaryPct:null};
   }
  }
  return {startTime,endTime:startTime+periodMs,byDirection:result};
 });
}
