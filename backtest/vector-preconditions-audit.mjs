/* Vector contextual PRECONDITIONS audit — research only, no signal modifications.
   For every rejected V1.1 reversal, calculate ONLY info observable by signal
   close, then compare retrospectively to pre-registered 12h labels.
   Anchored to exact previous event ledger OHLC period (fixed 90 days).
   Never classify a future outcome in live logic. */
import {pathToFileURL} from 'node:url';
import {vectorAtr} from './vector-v14-hysteresis.mjs';
import {vectorRegimeFeatures} from './vector-v13-regime.mjs';
import {auditReversalWindows,LEDGER_LOCK} from './vector-event-ledger.mjs';
import {planCleanBacktestWindows} from './quarantine.mjs';
import {makeCryptoJujuFetchPage} from './cryptojuju-adapter.mjs';

const H=3600000,D=24*H,round=x=>x==null?null:Number(x.toFixed(6));
export const PRECONDITIONS_LOCK=Object.freeze({
 protocol:'vector-preconditions-rejected-reversal-context-v1',
 sourceProtocol:LEDGER_LOCK.protocol,
 periodStart:Date.parse('2026-07-28T01:00:00Z'),
 periodEnd:Date.parse('2026-10-26T01:00:00Z'),
 cutoff:Date.parse('2026-09-11T01:00:00Z'),
 timeframe:'1h',symbols:['BTCUSDT','ETHUSDT','SOLUSDT'],
 modes:['v14_hysteresis_structure_momentum_v1',
  'vector-v15-two-closed-bar-recovery-exploratory-v1'],
 groups:['potential_missed_move','possibly_avoided_loss','ambiguous','censored'],
 features:['signedEma50SlopePct','signedDistanceEma50Atr','signedPrior3hPct',
  'signedPrior6hPct','atrPct','bodyAtr','relativeVolume20',
  'directionalStructure4','efficiency6','currentCandleStrongVector'],
 efficiencyBins:[0.35,0.65],minPerLabelForComparison:10,
 maxExamplesPerLabel:8,reviewCases:[
  {symbol:'BTCUSDT',side:'short',time:Date.parse('2026-09-11T14:00:00Z')},
  {symbol:'BTCUSDT',side:'long',time:Date.parse('2026-10-08T18:00:00Z')}],
 conclusion:'Descriptive analysis only; history/labels already reviewed, NOT a prediction, probability, optimization or unused holdout.'
});
const abs=x=>Math.abs(x);
const groupOf=r=>r.hindsightLabel??'censored';
function ordered(a){return [...a].sort((x,y)=>x-y);}
function median(values){if(!values.length)return null;const s=ordered(values),m=Math.floor(s.length/2);
 return s.length%2?s[m]:(s[m-1]+s[m])/2;}
function snapshot(bars){
 if(!Array.isArray(bars)||bars.length<55)throw Error('Context requires 55 contiguous completed OHLC bars');
 if(bars.some((b,i)=>!Number.isSafeInteger(b.time)||
   (i&&b.time-bars[i-1].time!==H)))throw Error('Discontinuous history');
 const ema=vectorRegimeFeatures(bars),atr=vectorAtr(bars,14);
 const volumePrefix=[0],signedCloseMoves=[0];
 for(let i=0;i<bars.length;i++){
  volumePrefix.push(volumePrefix.at(-1)+Number(bars[i].volume??0));
  signedCloseMoves.push(i>0?signedCloseMoves.at(-1)+abs(Number(bars[i].close)-Number(bars[i-1].close)):0);
 }
 const out=[];
 for(let i=0;i<bars.length;i++){
  const b=bars[i],sideClose=Number(b.close),feature=ema[i],a=atr[i],
   valid=i>=53&&a!==null&&Number.isFinite(a)&&a>0;
  if(!valid){out.push(null);continue;}
  const prev3=i>=3?Number(bars[i-3].close):null,
   prev6=i>=6?Number(bars[i-6].close):null;
  const pre=bars.slice(i-4,i),maxHigh=Math.max(...pre.map(x=>Number(x.high))),
    minLow=Math.min(...pre.map(x=>Number(x.low)));
  const daily=(volumePrefix[i+1]-volumePrefix[i+1-20])/20;
  const denominator=signedCloseMoves[i+1]-signedCloseMoves[i+1-6],
   eff=denominator>0?Math.min(1,abs(sideClose-prev6)/denominator):0;
  out.push({time:b.time,atrPct:100*a/sideClose,bodyAtr:abs(sideClose-Number(b.open))/a,
   relativeVolume20:daily>0?Number(b.volume??0)/daily:null,
   efficiency6:eff,
   ema50:feature.ema50,ema50SlopePct:feature.ema50SlopePct,
   close:sideClose,prior3hPct:prev3!==null?100*(sideClose-prev3)/prev3:null,
   prior6hPct:prev6!==null?100*(sideClose-prev6)/prev6:null,
   break4Bull:sideClose>maxHigh,break4Bear:sideClose<minLow,
   currentCandleStrongVector:Math.abs(Number(b.close)-Number(b.open))>=1.25*a,
   distanceEma50Atr:(sideClose-feature.ema50)/a});
 }
 return out;
}
export function causalFeatureRow(bars,i,side){
 if(!['long','short'].includes(side)||!Number.isSafeInteger(i)||i<0||i>=bars.length)
  throw Error('Invalid signal for causal feature calculation');
 const features=snapshot(bars),f=features[i];
 if(!f)return null;
 const d=side==='long'?1:-1;
 return {signedEma50SlopePct:round(d*f.ema50SlopePct),
  signedDistanceEma50Atr:round(d*f.distanceEma50Atr),
  signedPrior3hPct:round(d*f.prior3hPct),
  signedPrior6hPct:round(d*f.prior6hPct),
  atrPct:round(f.atrPct),bodyAtr:round(f.bodyAtr),
  relativeVolume20:round(f.relativeVolume20),efficiency6:round(f.efficiency6),
  directionalStructure4:side==='long'?f.break4Bull:f.break4Bear,
  currentCandleStrongVector:f.currentCandleStrongVector};
}
function summarized(rows){
 const s={count:rows.length};
 for(const key of PRECONDITIONS_LOCK.features){
  if(key==='directionalStructure4'||key==='currentCandleStrongVector'){
   const known=rows.filter(x=>typeof x.features?.[key]==='boolean');
   s[key]={observed:known.length,trueCount:known.filter(x=>x.features[key]).length};
  }else{
   const vals=rows.map(x=>x.features?.[key]).filter(x=>Number.isFinite(x));
   s[key]={observed:vals.length,median:round(median(vals)),
    p25:round(vals.length?ordered(vals)[Math.floor((vals.length-1)*.25)]:null),
    p75:round(vals.length?ordered(vals)[Math.floor((vals.length-1)*.75)]:null)};
  }
 }
 const c=rows.filter(r=>r.features?.efficiency6!==null&&Number.isFinite(r.features?.efficiency6));
 s.efficiencyCategories={chop:c.filter(r=>r.features.efficiency6<.35).length,
  mixed:c.filter(r=>r.features.efficiency6>=.35&&r.features.efficiency6<.65).length,
  directional:c.filter(r=>r.features.efficiency6>=.65).length};
 return s;
}
export function auditPreconditions(windows,{symbol='BTCUSDT',cutoffTime=PRECONDITIONS_LOCK.cutoff}={}){
 if(!Array.isArray(windows)||!Number.isSafeInteger(cutoffTime))
  throw Error('Invalid context audit');
 const results=Object.fromEntries(PRECONDITIONS_LOCK.modes.map(mode=>[mode,[]]));
 let usable=0,excluded=0;
 for(const window of windows){
  const bars=window.candles??window;
  if(!Array.isArray(bars)||bars.length<55||
    bars.some((b,i)=>!Number.isSafeInteger(Number(b.time))||
      (i&&Number(b.time)-Number(bars[i-1].time)!==H))){excluded++;continue;}
  usable++;
  const features=snapshot(bars);
  const audit=auditReversalWindows([{candles:bars}],{symbol,cutoffTime});
  const index=new Map(bars.map((b,i)=>[b.time,i]));
  for(const mode of PRECONDITIONS_LOCK.modes){
   for(const r of audit.byMode[mode].signalLedger){
    if(r.classification!=='rejected')continue;
    const i=index.get(r.time);
    const f=features[i],d=r.side==='long'?1:-1;
    if(!f)continue;
    const record={
     symbol,mode,time:r.time,side:r.side,period:r.period,
     hindsightLabel:groupOf(r),
     gross12hPct:r['next12h']?.grossPct??null,
     mfe12hPct:r['next12h']?.mfePct??null,
     mae12hPct:r['next12h']?.maePct??null,
     features:{
      signedEma50SlopePct:round(d*f.ema50SlopePct),
      signedDistanceEma50Atr:round(d*f.distanceEma50Atr),
      signedPrior3hPct:round(d*f.prior3hPct),
      signedPrior6hPct:round(d*f.prior6hPct),
      atrPct:round(f.atrPct),bodyAtr:round(f.bodyAtr),
      relativeVolume20:round(f.relativeVolume20),
      directionalStructure4:r.side==='long'?f.break4Bull:f.break4Bear,
      efficiency6:round(f.efficiency6),
      currentCandleStrongVector:f.currentCandleStrongVector
     }
    };
    results[mode].push(record);
   }
  }
 }
 const byMode={};
 for(const mode of PRECONDITIONS_LOCK.modes){
  const rows=results[mode];
  const grouped={};
  for(const period of ['earlier','later']){
   grouped[period]={};
   for(const side of ['long','short']){
    grouped[period][side]={};
    for(const label of PRECONDITIONS_LOCK.groups){
     const sub=rows.filter(x=>x.period===period&&x.side===side&&x.hindsightLabel===label);
     grouped[period][side][label]=summarized(sub);
    }
   }
  }
  const examples=[];
  for(const {symbol:caseSymbol,side,time} of PRECONDITIONS_LOCK.reviewCases){
   if(caseSymbol!==symbol)continue;
   const found=rows.find(x=>x.time===time&&x.side===side);
   examples.push({time,side,found:Boolean(found),record:found??null});
  }
  byMode[mode]={count:rows.length,groups:grouped,
   examples,rows,
   samplePolicy:'Pooled medians are exploratory; inspect each side/split and do not select thresholds from these results.'};
 }
 return {schemaVersion:1,status:'EXPLORATORY_PRECONDITION_AUDIT',symbol,cutoffTime,
  cleanWindows:usable,excludedWindows:excluded,byMode,
  warnings:['Every feature uses only data up to and including the signal CLOSE.',
   'Future returns are separate retrospective labels never visible to the signal engine.',
   '90 days, threshold labels and example dates were examined in earlier studies. No untouched sample.',
   'Small subgroups may have no meaningful median; cross-market descriptive contrasts do not imply causality.',
   'No new V1.6, no modification to existing V1.1-V1.5 or prospectively locked studies.']};
}
async function history(fetchPage,symbol,start,end){
 const rows=[];
 for(let x=start;x<end;x+=180*H){
  const stop=Math.min(x+180*H,end);
  const page=await fetchPage({symbol,interval:'1h',startTime:x,endTime:stop,limit:200});
  rows.push(...page.filter(b=>Number(b.time)>=x&&Number(b.time)<stop));
 }
 return rows;
}
export async function runPreconditionAudit({fetchPage=makeCryptoJujuFetchPage(),now=Date.now()}={}){
 const L=PRECONDITIONS_LOCK,results=[];
 for(const symbol of L.symbols){
  try{
   const rows=await history(fetchPage,symbol,L.periodStart,L.periodEnd);
   const plan=planCleanBacktestWindows(rows,{startTime:L.periodStart,endTime:L.periodEnd,intervalMs:H},
    {minBars:LEDGER_LOCK.minWindow});
   const r=auditPreconditions(plan.eligibleWindows,{symbol,cutoffTime:L.cutoff});
   results.push({symbol,status:plan.eligibleWindows.length?'STUDIED':'BLOCKED',
    coverage:{status:plan.status,expected:plan.quality.expected,received:rows.length,
     coveragePct:round(plan.quality.coveragePct),excludedBars:plan.excludedBars,
     cleanWindows:plan.eligibleWindows.length},audit:r});
  }catch(e){results.push({symbol,status:'ERROR',error:String(e?.message??e)});}
 }
 return {status:results.some(r=>r.status==='ERROR')?'PARTIAL_ERROR':
  results.every(r=>r.status==='BLOCKED')?'BLOCKED':'HISTORICAL_COMPLETE',
  schemaVersion:1,generatedAt:new Date(now).toISOString(),
  source:'Bitunix readonly futures OHLC via CryptoJuju',
  commit:process.env.GITHUB_SHA??null,runId:process.env.GITHUB_RUN_ID??null,
  branch:process.env.GITHUB_REF_NAME??null,lock:L,results};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const r=await runPreconditionAudit();console.log(JSON.stringify(r,null,2));
 if(r.status!=='HISTORICAL_COMPLETE')process.exitCode=1;
}
