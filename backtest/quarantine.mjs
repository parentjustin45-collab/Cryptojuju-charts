/* Read-only Bitunix historical quarantine.
   Preserve raw OHLC; identify continuous, clean windows suitable for strict backtests.
   Never stitch across rejected or missing candles. */
import {classifyHistory} from './quality-gate.mjs';
export function planCleanBacktestWindows(rows,window,{minBars=3}={}){
 if(!Number.isSafeInteger(minBars)||minBars<2)throw Error('Invalid minBars');
 const quality=classifyHistory(rows,window);
 const {startTime,endTime,intervalMs}=window;
 const byTime=new Map(quality.candles.map(c=>[c.time,c]));
 const duplicateTimes=new Set();
 const counts=new Map();
 for(const r of rows){const t=Number(r?.time);counts.set(t,(counts.get(t)??0)+1);}
 for(const [t,count] of counts)if(count>1)duplicateTimes.add(t);
 const segments=[];let current=[];
 const flush=()=>{if(current.length){segments.push({startTime:current[0].time,endTime:current.at(-1).time+intervalMs,bars:current.length,eligible:current.length>=minBars,candles:current});current=[];}};
 for(let t=startTime;t<endTime;t+=intervalMs){
  const candle=duplicateTimes.has(t)?null:byTime.get(t);
  if(candle)current.push(candle);else flush();
 }
 flush();
 const eligible=segments.filter(x=>x.eligible);
 return {status:quality.canBacktest?'READY':eligible.length?'PARTIAL_QUARANTINED':'BLOCKED',quality:quality.quality,issues:quality.issues,missing:quality.missing,duplicateTimes:[...duplicateTimes].filter(t=>t>=startTime&&t<endTime).sort((a,b)=>a-b),segments:segments.map(({candles,...metadata})=>metadata),eligibleWindows:eligible.map(({candles,...metadata})=>({...metadata,candles})),excludedBars:quality.quality.expected-eligible.reduce((n,x)=>n+x.bars,0),policy:'RAW_UNMODIFIED_NO_CROSS_GAP_TRADES'};
}
