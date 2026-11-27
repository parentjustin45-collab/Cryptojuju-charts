/* Hourly 480-bar repair: only extend real context, never change the study window.
 * All observations are preserved and conflicting reads remain blocked. */
import {fetchBitunixDataPilot} from './bitunix-data-pilot.mjs';
import {compareBitunixReadbacks} from './bitunix-readback-consistency.mjs';
import {VERIFIED_INTERVALS} from './research-batch.mjs';
const ANCHORS=[3,4,5,6,8,12];
const HYPE_LAUNCH=Date.UTC(2025,2,27,8);
const blocked=(reason,extra={})=>({status:'BLOCKED',reason,...extra});
export function canExtendOldestAnchor(first,selector,anchorBars){
 const step=VERIFIED_INTERVALS[selector.timeframe],q=first?.quality;
 const oldest=selector.historicalEndExclusiveMs-(selector.closedBars+anchorBars)*step;
 return first?.reason==='OHLC_PROVENANCE_OR_CONTINUITY_FAILED'&&
  q?.rawCount===selector.closedBars+anchorBars&&q.rawMissing===0&&q.rawDuplicates===0&&q.rawOutOfRange===0&&
  q.unresolved===1&&first.normalizationIssues?.length===1&&
  first.normalizationIssues[0].time===oldest&&first.normalizationIssues[0].reason==='UNCONFIRMED_OPEN_ENVELOPE'&&
  first.normalizationIssues[0].previousClose===null&&!first.requests?.some(x=>x.error);
}
function overlapUnchanged(oldRows,newRows){
 const map=new Map(newRows.map(x=>[x.time,JSON.stringify(x)]));
 return oldRows.every(x=>map.get(x.time)===JSON.stringify(x));
}
export async function fetchHourlyVerifiedWindow(options,{fetchWindow=fetchBitunixDataPilot,now=()=>Date.now()}={}){
 const step=VERIFIED_INTERVALS[options.timeframe];
 const end=options.historicalEndExclusiveMs??Math.floor(options.nowMs/step)*step;
 const selector={...options,historicalEndExclusiveMs:end};
 const attempts=[];
 let first,second=null,readback,previous=null,anchorBars=3;
 const safeFetch=async(anchor)=>{
  try{return await fetchWindow({...selector,nowMs:now(),anchorBars:anchor});}
  catch(e){return {market:{symbol:selector.symbol,timeframe:selector.timeframe},status:'BLOCKED',reason:'UNHANDLED_FETCH_OR_VALIDATION_ERROR',error:String(e?.message??e).slice(0,220),acceptedCandles:[]};}
 };
 for(const anchor of ANCHORS){
  if(anchor>3&&selector.symbol==='HYPEUSDT'&&end-(selector.closedBars+anchor)*step<Math.ceil(HYPE_LAUNCH/step)*step)break;
  anchorBars=anchor;
  first=await safeFetch(anchor);
  if(previous&&(!Array.isArray(first.rawRows)||!overlapUnchanged(previous.rawRows,first.rawRows))){
   readback=blocked('ANCHOR_EXTENSION_CHANGED_OR_MISSING_RAW_ROWS');
   break;
  }
  if(first.status==='DATA_READY_FOR_RESEARCH_ONLY')break;
  if(!canExtendOldestAnchor(first,selector,anchor))break;
  if(anchor===ANCHORS.at(-1))break;
  attempts.push({anchorBars:anchor,first});
  previous=first;
 }
 if(!readback&&first?.status==='DATA_READY_FOR_RESEARCH_ONLY'){
  second=await safeFetch(anchorBars);
  readback=compareBitunixReadbacks(first,second);
  if(readback.status==='STABLE_TWO_READS'&&(
   readback.checkedRaw!==selector.closedBars+anchorBars||
   readback.checkedDerived!==selector.closedBars||
   readback.overlapRawSha256First!==readback.overlapRawSha256Second||
   first.historyWindow?.endTime!==end||first.historyWindow?.startTime!==end-selector.closedBars*step||
   second.historyWindow?.startTime!==first.historyWindow?.startTime||
   first.provenance?.anchorBars!==anchorBars||second.provenance?.anchorBars!==anchorBars))
    readback=blocked('FULL_FIXED_WINDOW_PROOF_MISMATCH');
  if(readback.status!=='STABLE_TWO_READS'){
   readback.secondReadStatus=second.status;readback.secondReadReason=second.reason??null;
   readback.secondReadQuality=second.quality??null;
   readback.secondReadIssues=second.normalizationIssues?.slice(0,6)??[];
  }
 }
 readback??=blocked('FIRST_READ_NOT_READY');
 return {first,second,readback,anchorBars,attempts,recovered:anchorBars>3&&readback.status==='STABLE_TWO_READS'};
}
export function summarizeHourlyFailure(first,readback){
 return {firstReason:first?.reason??null,repeatReason:readback?.reason??null,secondReason:readback?.secondReadReason??null,
  issues:first?.normalizationIssues?.slice(0,4).map(x=>({time:x.time,reason:x.reason,previousClose:x.previousClose??null}))??[],
  secondIssues:readback?.secondReadIssues?.slice(0,4).map(x=>({time:x.time,reason:x.reason,previousClose:x.previousClose??null}))??[],
  differences:readback?.differences?.slice(0,4).map(x=>({time:x.time,field:x.field,cause:x.cause}))??[],
  requestErrors:first?.requests?.filter(x=>x.error).slice(0,3).map(x=>({startTime:x.startTime,endTime:x.endTime,error:String(x.error).slice(0,120)}))??[]};
}
