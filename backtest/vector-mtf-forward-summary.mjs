/* Independent read-only cohort report from the LOCKED Vector prospective report.
 * Do not resimulate, select, or filter orders: observe original closed trades only.
 * Add this AFTER the Oct-26 locked run without modifying its original assumptions. */
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const START=Date.parse('2026-10-26T00:00:00Z');
const HOUR=3600000;
export const VECTOR_MTF_FORWARD_LOCK=Object.freeze({
 protocol:'vector-mtf-forward-cohorts-v1',
 sourceProtocol:'vector-v12-btc1h-short-2026-10-26',
 startTime:START,
 symbol:'BTCUSDT',entryInterval:'1h',side:'short',
 candidate:'break_extreme_2',reference:'baseline_v11',
 primaryQuestion:'Does last COMPLETED 4H Vector bearish direction distinguish better BTC 1H SHORT signals?',
 hypothesis:'4h=BEAR at the next-open entry; 1D descriptive, not a mandatory filter',
 cohorts:['all','h4_bear','h4_not_bear','d1_bear','h4_and_d1_bear','context_unknown'],
 minCompletedTrades:30,
 interpretation:'Subsets of the same fixed, non-overlapping strategy trades. No new trade scheduling; prospective observation, not trade authorization.'
});
const mkBucket=()=>({trades:0,wins:0,sumNetPct:0,losses:0});
const validDirections=new Set(['bear','bull','neutral',null]);
const fixed6=n=>Number(n.toFixed(6));
function finish(b){
 return {trades:b.trades,wins:b.wins,losses:b.losses,
  winRatePct:b.trades?fixed6(100*b.wins/b.trades):null,
  meanNetPct:b.trades?fixed6(b.sumNetPct/b.trades):null,
  sufficientSample:b.trades>=VECTOR_MTF_FORWARD_LOCK.minCompletedTrades};
}
function match(trade){
 const {h4,d1}=trade.context;
 return {
  all:true,h4_bear:h4==='bear',h4_not_bear:h4==='bull'||h4==='neutral',
  d1_bear:d1==='bear',h4_and_d1_bear:h4==='bear'&&d1==='bear',
  context_unknown:h4===null||d1===null
 };
}
function summarizeTrades(trades,asOfTime){
 if(!Array.isArray(trades))throw Error('Expected completed trades');
 const buckets=Object.fromEntries(VECTOR_MTF_FORWARD_LOCK.cohorts.map(k=>[k,mkBucket()]));
 for(const trade of trades){
  const {sourceTime,signalTime,entryTime,exitTime,netPct,context}=trade;
  if(![sourceTime,signalTime,entryTime,exitTime].every(Number.isSafeInteger)
   ||![sourceTime,signalTime,entryTime,exitTime].every(t=>t%HOUR===0)
   ||sourceTime<START||signalTime<sourceTime||entryTime<=signalTime
   ||exitTime<entryTime||exitTime+HOUR>asOfTime
   ||!Number.isFinite(netPct)||typeof context!=='object'||context===null
   ||!validDirections.has(context.h4)||!validDirections.has(context.d1))
    throw Error('Invalid or pre-start trade in prospective input');
  const membership=match(trade);
  for(const [name,include] of Object.entries(membership)){
   if(!include)continue;
   const b=buckets[name];b.trades++;b.wins+=Number(netPct>0);
   b.losses+=Number(netPct<=0);b.sumNetPct+=netPct;
  }
 }
 return Object.fromEntries(Object.entries(buckets).map(([name,b])=>[name,finish(b)]));
}
export function summarizeVectorMtfForward(original){
 if(!original||typeof original!=='object')throw Error('Missing Vector prospective report');
 if(original.locked?.protocol!==VECTOR_MTF_FORWARD_LOCK.sourceProtocol
   ||original.locked.symbol!=='BTCUSDT'||original.locked.side!=='short'
   ||original.locked.interval!=='1h'||original.locked.candidate!=='break_extreme_2'
   ||original.locked.startTime!==START
   ||!Number.isSafeInteger(original.asOfTime))
   throw Error('Not the expected frozen Vector BTC 1H SHORT experiment');
 const metadata={schemaVersion:1,lock:VECTOR_MTF_FORWARD_LOCK,
  sourceRunId:original.runId??null,sourceCommit:original.commit??null,
  sourceAsOfTime:original.asOfTime,sourceStatus:original.status??null,
  sourceCoverage:original.coverage??null};
 if(original.asOfTime<=START){
  if(original.status!=='NOT_STARTED')throw Error('Premature start mismatch');
  return {...metadata,status:'NOT_STARTED',cohorts:null};
 }
 const result=original.results;
 if(!result||!result.baseline||!result.candidate)
  return {...metadata,status:'SOURCE_INCOMPLETE',cohorts:null};
 const cohorts={};
 for(const [modeName,key] of [['reference','baseline'],['candidate','candidate']]){
  cohorts[modeName]={};
  for(const scenario of ['baseline','stress']){
   const trades=result[key][scenario]?.trades;
   cohorts[modeName][scenario]=summarizeTrades(trades,original.asOfTime);
  }
 }
 const c=cohorts.candidate.stress,r=cohorts.reference.stress;
 const comparisons=Object.fromEntries(VECTOR_MTF_FORWARD_LOCK.cohorts.map(name=>{
  const a=c[name],b=r[name];
  return [name,{candidateTrades:a.trades,referenceTrades:b.trades,
   meanNetDeltaPp:a.meanNetPct===null||b.meanNetPct===null?null:fixed6(a.meanNetPct-b.meanNetPct),
   sufficientBoth:a.sufficientSample&&b.sufficientSample}];
 }));
 return {...metadata,status:c.h4_bear.sufficientSample&&r.h4_bear.sufficientSample?
  'MINIMUM_COHORT_SAMPLE_MET':'INSUFFICIENT_TRADES',
  cohorts,comparisons,
  warning:'Descriptive, overlapping prospective cohorts; not randomized, not paired, not a compounded portfolio. NO strategy promotion; compare unknown contexts and censoring separately. No TradingView Pine parity proven.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(!process.argv[2])throw Error('Prospective JSON path required');
  const source=JSON.parse(readFileSync(process.argv[2],'utf8'));
  console.log(JSON.stringify(summarizeVectorMtfForward(source),null,2));
 }catch(error){console.error('VECTOR_MTF_FORWARD_ERROR='+String(error.message??error));process.exitCode=1;}
}
