/* Exact baseline event parity, causal feature snapshots, training only.
 * Retrospective labels never enter indicator computation. No optimization.
 * Instrumented copies of Vector/Frank expose intermediate values, compared
 * against original outputs at every bar. Other indicators use native output.
 */
import {vectorAIT} from '../../vector-ait-v1.mjs';
import {calculateMomentumFusion} from '../../momentum-fusion-v1.mjs';
import {classifySpeedCandleV3} from '../../speed-candle-v3.mjs';
import {calculateCjCipherWaveTrend} from '../cj-cipher-wavetrend-v1.mjs';
import {calculateFrankTestV22} from '../frank-test-v22-research.mjs';
import {traceVector} from './state-vector-trace.mjs';
import {traceFrank} from './state-frank-trace.mjs';
import {studySignals,CHANNELS} from './state-pivot-observer.mjs';
const insist=(v,m)=>{if(!v)throw Error(m)};
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const ev=(time,side,tag)=>({time,side,tag});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const sideOk=x=>x==='long'||x==='short';
const ratio=(a,b)=>finite(a)&&finite(b)&&b!==0?a/b:null;
const diff=(a,b)=>finite(a)&&finite(b)?a-b:null;
const signed=(v,s)=>finite(v)?v*s:null;
const flag=x=>Number(!!x);
export function analyzeState(bars,report,prior){
 const priceStep=report.priceStep;insist(finite(priceStep)&&priceStep>0,'PRICE_STEP_INVALID');
 const split=Math.floor(bars.length*.7);
 const labels=Object.fromEntries(CHANNELS.map(k=>[k,[]]));
 // Verify exact label totals against prior published result.
 const counts=studySignals(bars,report.indicators,split,x=>{if(x.phase==='training')labels[x.channel].push(x);});
 insist(same(counts,prior),'PIVOT_LABEL_PARITY_FAILED');
 const out={};
 function consume(channel,actual,feature){
  actual.sort((a,b)=>a.time-b.time);
  const expected=report.indicators[channel].signals;
  insist(same(actual,expected),'BASELINE_EVENT_PARITY_'+channel);
  const groups={},samples={};
  for(const l of labels[channel]){
   const s=l.side==='long'?1:-1;
   // Anchor on signal confirmation; for missed pivots, on pivot bar.
   // Record same features at t-2, t-1, t; never use future features.
   const g=l.category+'|'+l.side;
   const stats=groups[g]??={count:0,offsets:{}};
   stats.count++;
   const example={category:l.category,side:l.side,time:bars[l.index].time,pivotTime:Number.isInteger(l.pivotIndex)?bars[l.pivotIndex].time:null,tag:l.event?.tag??null,features:{}};
   for(const offset of [-2,-1,0]){
    if(l.index+offset<0)continue;
    const features=feature(l.index+offset,s);
    const dest=stats.offsets[offset]??={};
    for(const [key,v] of Object.entries(features)){
     const a=dest[key]??={n:0,sum:0,sumSq:0};
     if(finite(v)){a.n++;a.sum+=v;a.sumSq+=v*v;}
    }
    example.features[offset]=features;
   }
   // First chronological example per category/direction, not cherry-picked.
   if(!samples[g]||example.time<samples[g].time)samples[g]=example;
  }
  const wanted=prior.training.channels[channel];
  for(const cat of ['early','onPivot','late','redundant','outsidePivot','missed']){
   insist(Object.entries(groups).filter(([k])=>k.startsWith(cat+'|')).reduce((n,[,v])=>n+v.count,0)===wanted[cat],'STATE_LABEL_COUNT_'+channel+'_'+cat);
  }
  out[channel]={events:actual.length,groups,samples};
 }
 {
  const a=vectorAIT(bars,{minTick:priceStep}),t=traceVector(bars,{minTick:priceStep});
  insist(a.length===t.length,'VECTOR_LENGTH');
  for(let i=0;i<a.length;i++){const {trace,...row}=t[i];insist(same(row,a[i]),'VECTOR_TRACE_PARITY_'+i);}
  consume('vector',a.filter(x=>sideOk(x.signal)).map(x=>ev(x.time,x.signal,'vector_v11')),(i,s)=>{
   const x=t[i].trace;return {volumeRatio:x.volumeRatio,spreadRatio:x.spreadRatio,bodyRatio:x.bodyRatio,rangeAtr:x.rangeAtr,closeStrength:s===1?x.bullStrength:x.bearStrength,confirmations:x.common+Number((s===1?x.bullStrength:x.bearStrength)>=.7),alreadySameDirection:flag(x.priorDirection===s),vectorCondition:flag(s===1?t[i].bullishVector:t[i].bearishVector)};
  });
 }
 {
  const a=calculateMomentumFusion(bars);
  consume('momentum',a.filter(x=>x.bullSignal||x.bearSignal).map(x=>ev(x.time,x.bullSignal?'long':'short','momentum_fusion')),(i,s)=>{
   const x=a[i],p=a[i-1];return {rsi:x.rsi,stochRsi:x.stochRsi,momentumRank:x.momentumRank,composite:x.composite,compositeSlope:signed(diff(x.composite,p?.composite),s),emaGapPct:signed(ratio(diff(x.emaFast,x.emaSlow),bars[i].close),s),emaAligned:flag(s===1?x.bullTrend:x.bearTrend),thresholdCross:flag(s===1?x.crossUpFromOS:x.crossDnFromOB)};
  });
 }
 {
  const a=classifySpeedCandleV3(bars,{minTick:priceStep});
  consume('speed',a.filter(x=>x.color).map(x=>ev(x.time,x.color.startsWith('bull')?'long':'short',x.color)),(i,s)=>({volumePercent:a[i].volumePercent,speedPercent:a[i].speedPercent,directionAligned:flag(s*(bars[i].close-bars[i].open)>0),midVolume:flag(a[i].volumePercent>=150),highVolume:flag(a[i].volumePercent>=200)}));
 }
 {
  const a=calculateCjCipherWaveTrend(bars);
  consume('cipher',a.filter(x=>sideOk(x.signal)).map(x=>ev(x.time,x.signal,'cj_cipher_wt')),(i,s)=>({wt1:a[i].wt1,wt2:a[i].wt2,waveGap:signed(a[i].waveDifference,s),waveGapSlope:signed(diff(a[i].waveDifference,a[i-1]?.waveDifference),s),wt1Slope:signed(diff(a[i].wt1,a[i-1]?.wt1),s),cross:flag(s===1?a[i].crossUp:a[i].crossDown),extremeZone:flag(s===1?a[i].wt1<=-53:a[i].wt1>=53)}));
 }
 {
  const original=calculateFrankTestV22(bars),t=traceFrank(bars);
  const {trace,...a}=t;insist(same(a,original),'FRANK_TRACE_PARITY');
  const feature=(i,s)=>({rsi:trace.rsi[i],stoch:trace.st[i],k:a.k[i],d:a.d[i],momentum:trace.mom[i],oscillator:a.oscillator[i],oscSlope:signed(diff(a.oscillator[i],a.oscillator[i-1]),s),histogram:signed(a.histogram[i],s),emaGapPct:signed(ratio(diff(trace.ef[i],trace.es[i]),bars[i].close),s),emaAligned:flag(s*(trace.ef[i]-trace.es[i])>0)});
  consume('frank_cross',[...a.buy,...a.sell].map(x=>ev(x.confirmedAt,x.side,'frank_cross_webapp')),feature);
  consume('frank_divergence',a.divergences.map(x=>ev(x.confirmationTime,x.type.endsWith('+')?'long':'short',x.type)),feature);
 }
 return out;
}
