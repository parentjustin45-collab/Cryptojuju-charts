/* Reproduce Momentum Fusion on TradingView's OWN same-source OHLC stream.
 * Read-only parity report. No forward P&L, no external API calls, no orders.
 */
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {calculateMomentumFusion} from '../backtest/momentum-fusion-v1.mjs';
import {NUM_FIELDS,BOOL_FIELDS,TF_MS,observationId}
 from './tv-momentum-core.mjs';

const WARMUP=150,MIN_BARS=200;
function isnumber(v){return typeof v==='number'&&Number.isFinite(v);}
export function compareWebhookObservations(events,{
 warmup=WARMUP,minBars=MIN_BARS
}={}){
 if(!Array.isArray(events)||!Number.isSafeInteger(warmup)||
   !Number.isSafeInteger(minBars)||warmup<0||minBars<=warmup)
  throw Error('Invalid read-only comparison inputs');
 const by=new Map(),dedupe=new Set();
 for(const e of events){
  const id=observationId(e);
  if(dedupe.has(id))throw Error('Duplicate persisted observation '+id);
  dedupe.add(id);
  const label=e.symbol+' '+e.timeframe;
  if(!by.has(label))by.set(label,[]);
  by.get(label).push(e);
 }
 const report=[];
 for(const [market,items] of by){
  const tf=TF_MS[items[0].timeframe];
  if(!tf)throw Error('Unknown stored timeframe');
  items.sort((a,b)=>a.barOpenMs-b.barOpenMs);
  let previous=null,segments=[],current=[],gapCount=0;
  for(const e of items){
   if(previous!==null&&e.barOpenMs-previous!==tf){
    gapCount++;if(current.length)segments.push(current);
    current=[];
   }
   current.push(e);
   previous=e.barOpenMs;
  }
  if(current.length)segments.push(current);
  const scores=Object.fromEntries([...NUM_FIELDS,...BOOL_FIELDS].map(k=>
   [k,{checked:0,matched:0,different:0,referenceMissing:0,
    examples:[]}]));
  let evaluatedBars=0,eligibleSegments=0,latestBarMs=items.at(-1)?.barOpenMs??null;
  for(const segment of segments){
   if(segment.length<minBars)continue;
   eligibleSegments++;
   const ohlc=segment.map(b=>({time:b.barOpenMs,...b.ohlc,volume:0}));
   const predicted=calculateMomentumFusion(ohlc);
   for(let i=warmup;i<segment.length;i++){
    evaluatedBars++;
    for(const k of [...NUM_FIELDS,...BOOL_FIELDS]){
     const actual=segment[i].values[k];
     const local=k==='momRaw'?
      ohlc[i].close-ohlc[i-10].close:predicted[i][k];
     const row=scores[k];
     if(actual===null||local===null){
      row.referenceMissing++;continue;
     }
     const lhs=typeof local==='boolean'?Number(local):local;
     const rhs=typeof actual==='boolean'?Number(actual):actual;
     if(!isnumber(lhs)||!isnumber(rhs)){
      row.different++;continue;
     }
     row.checked++;
     const within=BOOL_FIELDS.includes(k)?lhs===rhs:
      Math.abs(lhs-rhs)<=0.0002+1e-6*Math.max(Math.abs(lhs),Math.abs(rhs));
     if(within)row.matched++;
     else{
      row.different++;
      if(row.examples.length<5)row.examples.push({
       openUtc:new Date(ohlc[i].time).toISOString(),
       pine:rhs,cryptojuju:lhs,absoluteDifference:Math.abs(lhs-rhs)
      });
     }
    }
   }
  }
  const compared=Object.values(scores).reduce((s,v)=>s+v.checked,0),
   mismatch=Object.values(scores).reduce((s,v)=>s+v.different,0);
  const allFields=Object.values(scores).every(s=>s.checked>0);
  report.push({market,receivedBars:items.length,lastReceivedBarOpenUtc:
   latestBarMs===null?null:new Date(latestBarMs).toISOString(),
   segmentLengths:segments.map(s=>s.length),gapCount,eligibleSegments,
   evaluatedBars,comparedValues:compared,mismatchedValues:mismatch,
   status:!eligibleSegments?'COLLECTING_CONTIGUOUS_OHLC':
    !allFields?'INCOMPLETE_COMPARISON':
    mismatch?'PINE_JS_MISMATCH':'MATCHED_SAME_SOURCE_WITHIN_TOLERANCE',
   fields:scores});
 }
 return {protocol:'cj-tv-momentum-same-source-parity-v1',
  warmup,minBars,markets:report,
  warnings:['TradingView Pine reference requires 200 consecutive realtime webhooks per chart before this parity check.',
   'Replay events never count twice; gaps restart indicator warmup.',
   'Does NOT validate Bitunix price equality or real trade outcomes.',
   'The tested model remains the original Momentum Fusion; Vector prospective unchanged.',
   'TradingView reference and our JS calculations share THESE webhook OHLC only.']};
}
export function readWebhookStore(filePath){
 const content=fs.readFileSync(filePath,'utf8');
 if(!content.endsWith('\n')&&content.length)
  throw Error('Incomplete NDJSON store, refusing partial event');
 return content.split('\n').filter(Boolean).map(x=>JSON.parse(x));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const file=process.argv[2];
 if(!file)throw Error('Usage: node bridge/tv-momentum-report.mjs /durable/alerts.ndjson');
 console.log(JSON.stringify(compareWebhookObservations(readWebhookStore(file)),null,2));
}
