/* CryptoJuju V1.26.0: Bitunix candle history pagination.
   Supply a fetchPage({symbol,interval,startTime,endTime,limit}) adapter for
   the currently verified Bitunix API; no credentials are stored here.
   Times are milliseconds UTC. Candle times represent bar OPEN times.
*/
export async function loadBitunixHistory({symbol,interval,startTime,endTime,intervalMs,fetchPage,limit=200,maxPages=100,signal}){
 if(!symbol||!interval||typeof fetchPage!=='function')throw Error('Missing symbol, interval or fetchPage');
 if(![startTime,endTime,intervalMs].every(Number.isSafeInteger)||startTime>=endTime||intervalMs<=0)throw Error('Invalid time range');
 if(!Number.isInteger(limit)||limit<1||limit>200||!Number.isInteger(maxPages)||maxPages<1)throw Error('Invalid pagination');
 const collected=new Map(),duplicates=[],invalid=[];
 let cursor=startTime,pages=0;
 while(cursor<endTime&&pages<maxPages){
  if(signal?.aborted)throw Error('History request aborted');
  const raw=await fetchPage({symbol,interval,startTime:cursor,endTime,limit,signal});
  pages++;
  if(!Array.isArray(raw))throw Error('fetchPage must return an array of normalized candles');
  if(!raw.length)break;
  let maxTime=-Infinity;
  for(const source of raw){
   const c={time:Number(source.time),open:Number(source.open),high:Number(source.high),low:Number(source.low),close:Number(source.close),volume:Number(source.volume??0)};
   if(!Object.values(c).every(Number.isFinite)||c.time<startTime||c.time>=endTime||c.open<=0||c.low<=0||c.high<Math.max(c.open,c.close)||c.low>Math.min(c.open,c.close)||c.volume<0){
    invalid.push(source.time);continue;
   }
   maxTime=Math.max(maxTime,c.time);
   if(collected.has(c.time))duplicates.push(c.time);
   else collected.set(c.time,c);
  }
  if(!Number.isFinite(maxTime)||maxTime<cursor)throw Error('No forward progress in Bitunix history');
  const next=maxTime+intervalMs;
  if(next<=cursor)throw Error('Non-progressing pagination');
  cursor=next;
  if(raw.length<limit)break; // API may have exhausted the requested window.
 }
 const candles=[...collected.values()].sort((a,b)=>a.time-b.time);
 const gaps=[];
 for(let i=1;i<candles.length;i++){
  const delta=candles[i].time-candles[i-1].time;
  if(delta!==intervalMs)gaps.push({after:candles[i-1].time,before:candles[i].time,missing:delta>intervalMs?Math.round(delta/intervalMs)-1:0,irregular:delta%intervalMs!==0});
 }
 return {candles,quality:{pages,duplicates,invalid,gaps,truncated:cursor<endTime&&pages>=maxPages,requested:{symbol,interval,startTime,endTime,intervalMs}}};
}
