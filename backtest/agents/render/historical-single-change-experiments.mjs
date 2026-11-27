/* Fixed, predeclared single-change research candidates. Training 70% only.
 * No future bars in signal generation; no parameter search or promotion.
 * Closed-bar event study, not a portfolio simulation.
 */
import {vectorAIT} from '../../vector-ait-v1.mjs';
import {calculateMomentumFusion} from '../../momentum-fusion-v1.mjs';
import {classifySpeedCandleV3} from '../../speed-candle-v3.mjs';
import {calculateCjCipherWaveTrend} from '../cj-cipher-wavetrend-v1.mjs';
import {calculateFrankTestV22} from '../frank-test-v22-research.mjs';
import {traceFrank} from './state-frank-trace.mjs';
import {atr14,findPivots} from './state-pivot-observer.mjs';
export const SPEC=Object.freeze({version:'CJ_SINGLE_CHANGE_EXPERIMENTS_V1',trainingFraction:.7,folds:3,matchBars:3,horizonBars:12,roundTripCostsBps:[0,10,20],candidates:{vector:'minimumConfirmations 4 -> 3',momentum:'EMA 21/55 -> 13/34',speed:'suppress same-side color within 2 bars of last emitted event',cipher:'WT2 smoothing 4 -> 3',frank_cross:'EMA 8/21 -> 5/13; divergence unchanged'}});
export const CHANNELS=Object.keys(SPEC.candidates);
const ev=(time,side,tag)=>({time,side,tag});
const valid=x=>typeof x==='number'&&Number.isFinite(x);
const side=x=>x==='long'||x==='short';
const insist=(x,m)=>{if(!x)throw Error(m)};
function ema(close,n){let prior=NaN;const k=2/(n+1);return close.map(x=>prior=valid(prior)?x*k+prior*(1-k):x);}
export function generate(ch,bars,priceStep,candidate=false){
 if(ch==='vector'){
  const rows=vectorAIT(bars,{minTick:priceStep,...(candidate?{minimumConfirmations:3}:{})});
  return {signals:rows.filter(x=>side(x.signal)).map(x=>ev(x.time,x.signal,'vector_v11')),direction:rows.map(x=>x.direction)};
 }
 if(ch==='momentum'){
  const rows=calculateMomentumFusion(bars,candidate?{emaFastLen:13,emaSlowLen:34}:{});
  return {signals:rows.filter(x=>x.bullSignal||x.bearSignal).map(x=>ev(x.time,x.bullSignal?'long':'short','momentum_fusion'))};
 }
 if(ch==='speed'){
  const rows=classifySpeedCandleV3(bars,{minTick:priceStep});const signals=[];let last=-Infinity,lastSide=null;
  for(let i=0;i<rows.length;i++){
   const x=rows[i];if(!x.color)continue;const s=x.color.startsWith('bull')?'long':'short';
   if(candidate&&s===lastSide&&i-last<=2)continue;
   signals.push(ev(x.time,s,x.color));last=i;lastSide=s;
  }
  return {signals};
 }
 if(ch==='cipher'){
  const rows=calculateCjCipherWaveTrend(bars,candidate?{signalSmoothing:3}:{});
  return {signals:rows.filter(x=>side(x.signal)).map(x=>ev(x.time,x.signal,'cj_cipher_wt'))};
 }
 if(ch==='frank_cross'){
  if(!candidate){const x=calculateFrankTestV22(bars);return {signals:[...x.buy,...x.sell].map(e=>ev(e.confirmedAt,e.side,'frank_cross_webapp')).sort((a,b)=>a.time-b.time)};}
  const x=traceFrank(bars),c=bars.map(b=>b.close),ef=ema(c,5),es=ema(c,13),signals=[];
  for(let i=1;i<bars.length;i++){
   const t=x.oscillator[i],p=x.oscillator[i-1],k=x.k[i],prev=x.k[i-1];
   if(!valid(t)||!valid(p))continue;
   const buy=(t>22&&p<=22)||(t<18&&t>p&&k>prev);
   const sell=(t<76&&p>=76)||(t>82&&t<p&&k<prev);
   if(buy&&ef[i]>es[i])signals.push(ev(bars[i].time,'long','frank_cross_webapp'));
   if(sell&&ef[i]<es[i])signals.push(ev(bars[i].time,'short','frank_cross_webapp'));
  }
  return {signals};
 }
 throw Error('UNKNOWN_CHANNEL');
}
function blank(){return {events:0,excluded:0,eligible:0,early:0,on:0,late:0,redundant:0,outside:0,pivots:0,missed:0,alreadyAligned:0,samples:0,positive0:0,positive10:0,positive20:0,sumGrossBps:0,sumMfeAtr:0,sumMaeAtr:0};}
export function scoreFold(bars,atr,positions,pivots,generated,start,end){
 const stats={long:blank(),short:blank()},pmap=new Map(pivots.map(p=>[p.side+'|'+p.index,p]));
 const near=new Set(),matched=new Set(),used=new Set(),candidates=[],eligible=[];
 for(const p of pivots){const s=stats[p.side];s.pivots++;if(generated.direction&&generated.direction[p.index-1]===(p.side==='long'?1:-1))s.alreadyAligned++;}
 for(let k=0;k<generated.signals.length;k++){
  const e=generated.signals[k],i=positions.get(e.time);insist(Number.isInteger(i)&&side(e.side),'INVALID_SIGNAL');if(i<start||i>=end)continue;
  const s=stats[e.side];s.events++;
  if(i<Math.max(start+12,14)||i>=end-12||!(atr[i]>0)){s.excluded++;continue;}
  s.eligible++;eligible.push(k);
  for(let d=-3;d<=3;d++){const key=e.side+'|'+(i+d);if(pmap.has(key)){candidates.push({k,key,delta:-d});near.add(k);}}
  const sign=e.side==='long'?1:-1,entry=bars[i+1].open,exit=bars[i+12].close;
  let hi=-Infinity,lo=Infinity;for(let j=i+1;j<=i+12;j++){hi=Math.max(hi,bars[j].high);lo=Math.min(lo,bars[j].low);}
  const gross=10000*sign*(exit-entry)/entry;
  s.samples++;s.positive0+=Number(gross>0);s.positive10+=Number(gross>10);s.positive20+=Number(gross>20);s.sumGrossBps+=gross;
  s.sumMfeAtr+=(sign===1?hi-entry:entry-lo)/atr[i];s.sumMaeAtr+=(sign===1?entry-lo:hi-entry)/atr[i];
 }
 candidates.sort((a,b)=>Math.abs(a.delta)-Math.abs(b.delta)||a.k-b.k||a.key.localeCompare(b.key));
 for(const c of candidates){if(matched.has(c.k)||used.has(c.key))continue;matched.add(c.k);used.add(c.key);stats[generated.signals[c.k].side][c.delta<0?'early':c.delta>0?'late':'on']++;}
 for(const k of eligible)if(!matched.has(k))stats[generated.signals[k].side][near.has(k)?'redundant':'outside']++;
 for(const s of Object.values(stats)){
  s.missed=s.pivots-s.early-s.on-s.late;
  insist(s.events===s.excluded+s.eligible&&s.eligible===s.early+s.on+s.late+s.redundant+s.outside&&s.samples===s.eligible&&s.missed>=0,'COUNT_MISMATCH');
 }
 return stats;
}
export function experimentChannel(ch,bars,report){
 const n=Math.floor(bars.length*.7),training=bars.slice(0,n),step=report.priceStep;
 insist(n>=150&&valid(step)&&step>0,'INVALID_TRAINING');
 const before=generate(ch,training,step,false),after=generate(ch,training,step,true);
 const expected=report.indicators[ch].signals.filter(x=>x.time<training.at(-1).time+1);
 insist(JSON.stringify(before.signals)===JSON.stringify(expected),'ARCHIVE_TRAINING_PARITY_'+ch);
 const cut1=Math.floor(n/3),cut2=Math.floor(n*2/3),cuts=[0,cut1,cut2,n];
 // Recompute prefixes independently, reject changes to earlier signals or state.
 for(const cut of [cut1,cut2]){
  const prefix=generate(ch,training.slice(0,cut),step,true);
  insist(JSON.stringify(prefix.signals)===JSON.stringify(after.signals.filter(x=>x.time<=training[cut-1].time)),'CANDIDATE_PREFIX_PARITY_'+ch);
  if(after.direction)insist(JSON.stringify(prefix.direction)===JSON.stringify(after.direction.slice(0,cut)),'CANDIDATE_DIRECTION_PARITY');
 }
 const atr=atr14(training),positions=new Map(training.map((x,i)=>[x.time,i])),folds=[];
 for(let i=0;i<3;i++){
  const start=cuts[i],end=cuts[i+1],pivots=findPivots(training,atr,start,end);
  folds.push({fold:i+1,startTime:training[start].time,endTime:training[end-1].time,pivots:pivots.length,baseline:scoreFold(training,atr,positions,pivots,before,start,end),candidate:scoreFold(training,atr,positions,pivots,after,start,end)});
 }
 return {channel:ch,trainingBars:n,baselineEvents:before.signals.length,candidateEvents:after.signals.length,prefixChecks:2,folds};
}
