/* DEV ONLY: strict Bitunix 1H page audit and targeted refetch.
   Never fabricate candles or change frozen prospective research. */
import {classifyHistory} from './quality-gate.mjs';
const H=3600000;
export async function auditBitunixBlocks(fetchPage,{symbol,startTime,endTime,blockBars=180,retries=2}={}){
 if(typeof fetchPage!=='function'||!/^[A-Z0-9_]{3,40}$/.test(symbol??'')||
  ![startTime,endTime].every(Number.isSafeInteger)||startTime>=endTime||
  startTime%H||endTime%H||!Number.isInteger(blockBars)||blockBars<1||blockBars>200||
  !Number.isInteger(retries)||retries<0||retries>5)throw Error('Invalid diagnostic configuration');
 const raw=[],blocks=[],attempts=[];
 const request=async (from,to,kind,round)=>{
  try{
   const page=await fetchPage({symbol,interval:'1h',startTime:from,endTime:to,limit:Math.min(200,(to-from)/H)});
   if(!Array.isArray(page))throw Error('Non-array page');
   const kept=page.filter(x=>Number.isSafeInteger(Number(x?.time))&&Number(x.time)>=from&&Number(x.time)<to);
   raw.push(...kept);
   attempts.push({kind,round,from,to,received:page.length,kept:kept.length,status:'OK'});
  }catch(e){attempts.push({kind,round,from,to,status:'ERROR',error:String(e?.message??e)});}
 };
 for(let from=startTime;from<endTime;from+=blockBars*H){
  const to=Math.min(endTime,from+blockBars*H),before=raw.length;
  await request(from,to,'initial',0);
  blocks.push({from,to,expected:(to-from)/H,received:raw.length-before});
 }
 const initial=classifyHistory(raw,{startTime,endTime,intervalMs:H});
 // Refetch missing and invalid timestamps in contiguous ranges. Never overwrite
 // contradictory duplicate timestamps: quarantine them for manual inspection.
 const retryTimes=new Set([...initial.missing,...initial.issues.map(x=>x.time)]);
 for(let round=1;round<=retries&&retryTimes.size;round++){
  const sorted=[...retryTimes].sort((a,b)=>a-b);
  retryTimes.clear();
  let groups=[],from=null,prev=null;
  for(const t of sorted){
   if(from===null){from=t;prev=t;}
   else if(t===prev+H&&t-from<199*H)prev=t;
   else{groups.push([from,prev+H]);from=t;prev=t;}
  }
  if(from!==null)groups.push([from,prev+H]);
  for(const [a,b] of groups)await request(a,b,'targeted',round);
  const current=classifyHistory(raw,{startTime,endTime,intervalMs:H});
  for(const t of [...current.missing,...current.issues.map(x=>x.time)])
   if(!current.duplicates.includes(t))retryTimes.add(t);
 }
 const final=classifyHistory(raw,{startTime,endTime,intervalMs:H});
 const duplicateTimes=[...new Set(final.duplicates)].sort((a,b)=>a-b);
 const quarantined=new Set([...final.unusable,...duplicateTimes]);
 const clean=final.candles.filter(x=>!quarantined.has(x.time));
 return {symbol,window:{startTime,endTime},blocks,attempts,
  initial:{expected:initial.quality.expected,missing:initial.missing.length,invalid:initial.issues.length,duplicates:initial.duplicates.length},
  final:{expected:final.quality.expected,received:raw.length,validUnique:clean.length,
   missing:final.missing,invalid:final.issues.map(x=>({time:x.time,reasons:x.reasons})),
   duplicateTimes,quarantinedTimes:[...quarantined].sort((a,b)=>a-b),
   coveragePct:100*clean.length/final.quality.expected,
   status:quarantined.size?'PARTIAL_QUARANTINED':'READY'},
  cleanCandles:clean,policy:'NO_SYNTHETIC_OHLC_NO_DUPLICATE_ACCEPTANCE'};
}
