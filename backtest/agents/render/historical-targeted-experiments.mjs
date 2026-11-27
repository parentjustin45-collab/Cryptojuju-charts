/* Targeted V2; all rules fixed before measuring their results. */
import {generate as original,scoreFold} from './historical-single-change-experiments.mjs';
import {traceVector} from './state-vector-trace.mjs';
import {traceFrank} from './state-frank-trace.mjs';
import {calculateMomentumFusion} from '../../momentum-fusion-v1.mjs';
import {calculateCjCipherWaveTrend} from '../cj-cipher-wavetrend-v1.mjs';
import {classifySpeedCandleV3} from '../../speed-candle-v3.mjs';
import {atr14,findPivots} from './state-pivot-observer.mjs';
export const SPEC=Object.freeze({version:'CJ_TARGETED_EXPERIMENTS_V2',trainingFraction:.7,folds:3,matchBars:3,horizonBars:12,roundTripCostsBps:[0,10,20],candidates:{
 vector:'4 normal OR exactly 3 including body, directional close strength and one of volume/spread; closed candle alternating state',
 momentum:'original threshold cross, EMA 21/55 aligned OR directional EMA gap compressing two consecutive bars',
 speed:'one-bar same-side cooldown (last emitted event)',
 cipher:'WT1/WT2 original 10/21/4, add causal gap warning <=3, narrowing and directional WT1 slope, replace next confirmed cross in research event stream only if same-side warning within 2 bars',
 frank_cross:'original raw cross, EMA 8/21 aligned OR directional EMA gap compressing two consecutive bars',
 frank_divergence:'one-right-bar provisional divergence against prior confirmed pivots; confirmation remains separate and unchanged'
}});
export const CHANNELS=Object.keys(SPEC.candidates);
const ev=(time,side,tag)=>({time,side,tag});
const valid=x=>typeof x==='number'&&Number.isFinite(x);
const insist=(x,m)=>{if(!x)throw Error(m)};
function compress(g,i,s){
 return i>=2&&[g[i],g[i-1],g[i-2]].every(valid)&&s*g[i]<=0&&s*g[i]>s*g[i-1]&&s*g[i-1]>s*g[i-2];
}
function frankWarning(bars,a){
 const lows=[],highs=[],signals=[],confirms=new Map();
 for(const d of a.divergences)confirms.set(d.pivotIndex+'|'+d.type,true);
 let tested=0,confirmed=0,unresolved=0;
 function pivot(j,s,right){
  if(j<2||j+right>=bars.length)return false;
  for(let k=j-2;k<=j+right;k++)if(k!==j&&(s===1?bars[k].low<=bars[j].low:bars[k].high>=bars[j].high))return false;
  return true;
 }
 function warn(j,s,history){
  if(!pivot(j,s,1)||!valid(a.oscillator[j]))return;
  const price=s===1?bars[j].low:bars[j].high,osc=a.oscillator[j];let type=null;
  for(const p of history.slice(-2)){
   if(s*price<s*p.price&&s*osc>s*p.osc){type=s===1?'R+':'R-';break;}
   if(s*price>s*p.price&&s*osc<s*p.osc){type=s===1?'H+':'H-';break;}
  }
  if(!type)return;
  signals.push(ev(bars[j+1].time,s===1?'long':'short','prealert_'+type));
  // Retrospective measurement only, no feedback into signal generation.
  if(j+2<bars.length){tested++;confirmed+=Number(confirms.has(j+'|'+type));}else unresolved++;
 }
 for(let i=3;i<bars.length;i++){
  const j=i-2;for(const [s,h] of [[1,lows],[-1,highs]])if(pivot(j,s,2)){h.push({price:s===1?bars[j].low:bars[j].high,osc:a.oscillator[j]});if(h.length>10)h.shift();}
  warn(i-1,1,lows);warn(i-1,-1,highs);
 }
 return {signals,warningStats:{tested,confirmed,unresolved}};
}
export function generate(ch,bars,priceStep,candidate=false){
 if(ch==='frank_divergence'){
  const a=traceFrank(bars);
  if(candidate)return frankWarning(bars,a);
  return {signals:a.divergences.map(x=>ev(x.confirmationTime,x.type.endsWith('+')?'long':'short',x.type)).sort((a,b)=>a.time-b.time)};
 }
 if(!candidate)return original(ch,bars,priceStep,false);
 if(ch==='vector'){
  const rows=traceVector(bars,{minTick:priceStep});let dir=0;const signals=[],direction=[];
  for(let i=0;i<rows.length;i++){
   const x=rows[i],t=x.trace,s=Math.sign(bars[i].close-bars[i].open);
   const strength=s===1?t.bullStrength:t.bearStrength;
   const selective=s!==0&&t.common+Number(strength>=.7)===3&&t.bodyRatio>=.6&&strength>=.7&&(t.volumeRatio>=1.5||t.spreadRatio>=1.5);
   if(s&&s!==dir&&(selective||(s===1?x.bullishVector:x.bearishVector))){dir=s;signals.push(ev(x.time,s===1?'long':'short','vector_v11'));}
   direction.push(dir);
  }return {signals,direction};
 }
 if(ch==='momentum'){
  const rows=calculateMomentumFusion(bars),g=rows.map(x=>valid(x.emaFast)&&valid(x.emaSlow)?x.emaFast-x.emaSlow:null);
  return {signals:rows.flatMap((x,i)=>x.crossUpFromOS&&(x.bullTrend||compress(g,i,1))?[ev(x.time,'long','momentum_fusion')]:x.crossDnFromOB&&(x.bearTrend||compress(g,i,-1))?[ev(x.time,'short','momentum_fusion')]:[])};
 }
 if(ch==='speed'){
  const rows=classifySpeedCandleV3(bars,{minTick:priceStep});let last=-Infinity,lastSide=null;const signals=[];
  for(let i=0;i<rows.length;i++){const x=rows[i];if(!x.color)continue;const s=x.color.startsWith('bull')?'long':'short';if(s===lastSide&&i-last<=1)continue;signals.push(ev(x.time,s,x.color));last=i;lastSide=s;}
  return {signals};
 }
 if(ch==='cipher'){
  const rows=calculateCjCipherWaveTrend(bars);let lastWarning=-Infinity,lastSide=null,active=false;const signals=[];
  let tested=0,confirmed=0,unresolved=0;const warnings=[];
  for(let i=1;i<rows.length;i++){
   const x=rows[i],p=rows[i-1],g=x.waveDifference,pg=p.waveDifference;
   if(x.signal){if(!(active&&x.signal===lastSide&&i-lastWarning<=2))signals.push(ev(x.time,x.signal,'cj_cipher_wt'));active=false;continue;}
   if(!valid(g)||!valid(pg))continue;
   const s=g<0?'long':g>0?'short':null,sign=s==='long'?1:-1;
   if(s&&Math.abs(g)<=3&&sign*g>sign*pg&&sign*(x.wt1-p.wt1)>0&&!(active&&lastSide===s&&i-lastWarning<=2)){
    signals.push(ev(x.time,s,'cipher_prealert'));warnings.push({i,s});lastWarning=i;lastSide=s;active=true;
   }
  }
  for(const x of warnings){if(x.i+2<rows.length){tested++;confirmed+=Number(rows.slice(x.i+1,x.i+3).some(y=>y.signal===x.s));}else unresolved++;}
  return {signals,warningStats:{tested,confirmed,unresolved}};
 }
 if(ch==='frank_cross'){
  const a=traceFrank(bars),g=a.trace.ef.map((x,i)=>x-a.trace.es[i]),signals=[];
  for(let i=1;i<bars.length;i++){
   const t=a.oscillator[i],p=a.oscillator[i-1],k=a.k[i],prev=a.k[i-1];if(!valid(t)||!valid(p))continue;
   const buy=(t>22&&p<=22)||(t<18&&t>p&&k>prev),sell=(t<76&&p>=76)||(t>82&&t<p&&k<prev);
   if(buy&&(g[i]>0||compress(g,i,1)))signals.push(ev(bars[i].time,'long','frank_cross_webapp'));
   if(sell&&(g[i]<0||compress(g,i,-1)))signals.push(ev(bars[i].time,'short','frank_cross_webapp'));
  }return {signals};
 }
 throw Error('UNKNOWN_CHANNEL');
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
 return {channel:ch,trainingBars:n,baselineEvents:before.signals.length,candidateEvents:after.signals.length,prefixChecks:2,warningStats:after.warningStats??null,folds};
}
