/* Retrospective pivot study. Labels are research targets, never trade signals.
 * V1 fixed hypotheses: strict local extreme +/-3, two-sided 2 ATR(14)
 * prominence within 12 bars, match +/-3 bars. Same settings for every pair.
 * Separate training/holdout; do not match across boundary. No P&L claims.
 */
export const SPEC=Object.freeze({version:'CJ_PIVOT_DIAGNOSTICS_V1',radius:3,prominenceBars:12,atrPeriod:14,prominenceAtr:2,matchBars:3,forwardBars:12,warmup:14});
export const CHANNELS=['vector','momentum','speed','cipher','frank_cross','frank_divergence'];
const insist=(ok,msg)=>{if(!ok)throw Error(msg)};
export function atr14(bars){
 const out=[];let avg=0;
 for(let i=0;i<bars.length;i++){
  const b=bars[i],prev=bars[i-1]?.close??b.close;
  const tr=Math.max(b.high-b.low,Math.abs(b.high-prev),Math.abs(b.low-prev));
  avg=i<14?(avg*i+tr)/(i+1):(avg*13+tr)/14;
  out.push(i>=13?avg:null);
 }
 return out;
}
export function findPivots(bars,atr,start,end){
 const result=[];
 // Require all context and matching candidates to lie in phase.
 for(let i=Math.max(start+15,14);i<end-15;i++){
  const b=bars[i],a=atr[i];if(!(a>0))continue;
  let hi=true,lo=true,beforeLo=Infinity,afterLo=Infinity,beforeHi=-Infinity,afterHi=-Infinity;
  for(let k=i-12;k<=i+12;k++){
   if(k===i)continue;
   const x=bars[k];
   if(Math.abs(k-i)<=3){if(x.high>=b.high)hi=false;if(x.low<=b.low)lo=false;}
   if(k<i){beforeLo=Math.min(beforeLo,x.low);beforeHi=Math.max(beforeHi,x.high);}
   else{afterLo=Math.min(afterLo,x.low);afterHi=Math.max(afterHi,x.high);}
  }
  if(hi&&Math.min(b.high-beforeLo,b.high-afterLo)>=2*a)result.push({index:i,side:'short'});
  if(lo&&Math.min(beforeHi-b.low,afterHi-b.low)>=2*a)result.push({index:i,side:'long'});
 }
 return result;
}
const blank=()=>({events:0,edgeExcluded:0,eligible:0,early:0,onPivot:0,late:0,redundant:0,outsidePivot:0,pivots:0,missed:0,forwardSamples:0,favorable2Atr:0,adverse2Atr:0,positiveClose:0,sumCloseAtr:0});
export function studySignals(bars,indicators,split,observe=()=>{}){
 insist(Number.isInteger(split)&&split>=30&&bars.length-split>=30,'INVALID_PHASES');
 const atr=atr14(bars),index=new Map(bars.map((b,i)=>[b.time,i]));
 const phases={training:[0,split],holdout:[split,bars.length]};
 const result={};
 for(const [phase,[start,end]] of Object.entries(phases)){
  const pivots=findPivots(bars,atr,start,end);
  const bySide={long:new Map(),short:new Map()};
  for(const p of pivots)bySide[p.side].set(p.index,p);
  const stats={};
  for(const channel of CHANNELS){
   const events=indicators[channel]?.signals;insist(Array.isArray(events),'MISSING_CHANNEL_'+channel);
   const s=blank();s.pivots=pivots.length;const candidates=[],eligible=[],near=new Set(),matchedEvents=new Set(),matchedPivots=new Set();
   for(let e=0;e<events.length;e++){
    const evt=events[e],i=index.get(evt.time);
    insist(Number.isInteger(i)&&['long','short'].includes(evt.side),'INVALID_EVENT');
    if(i<start||i>=end)continue;s.events++;
    // Boundary exclusion provides complete pivot matching and outcome context.
    if(i<Math.max(start+12,14)||i>=end-12||!(atr[i]>0)){s.edgeExcluded++;continue;}
    s.eligible++;eligible.push(e);
    for(let d=-3;d<=3;d++){
     const p=bySide[evt.side].get(i+d);if(!p)continue;
     candidates.push({e,p:p.side+'|'+p.index,delta:i-p.index});near.add(e);
    }
    const entry=bars[i+1].open,side=evt.side==='long'?1:-1;
    let hi=-Infinity,lo=Infinity;
    for(let j=i+1;j<=i+12;j++){hi=Math.max(hi,bars[j].high);lo=Math.min(lo,bars[j].low);}
    const close=side*(bars[i+12].close-entry)/atr[i];
    const favorable=(side===1?hi-entry:entry-lo)/atr[i];
    const adverse=(side===1?entry-lo:hi-entry)/atr[i];
    s.forwardSamples++;s.favorable2Atr+=Number(favorable>=2);s.adverse2Atr+=Number(adverse>=2);s.positiveClose+=Number(close>0);s.sumCloseAtr+=close;
   }
   // Deterministic closest match; one event and one pivot per channel.
   candidates.sort((a,b)=>Math.abs(a.delta)-Math.abs(b.delta)||a.e-b.e||a.p.localeCompare(b.p));
   for(const c of candidates){
    if(matchedEvents.has(c.e)||matchedPivots.has(c.p))continue;
    matchedEvents.add(c.e);matchedPivots.add(c.p);
    const category=c.delta<0?'early':c.delta>0?'late':'onPivot';
    s[category]++;
    observe({phase,channel,category,event:events[c.e],index:index.get(events[c.e].time),pivotIndex:index.get(events[c.e].time)-c.delta,side:events[c.e].side});
   }
   for(const e of eligible)if(!matchedEvents.has(e)){const category=near.has(e)?'redundant':'outsidePivot';s[category]++;observe({phase,channel,category,event:events[e],index:index.get(events[e].time),side:events[e].side});}
   for(const p of pivots)if(!matchedPivots.has(p.side+'|'+p.index))observe({phase,channel,category:'missed',index:p.index,pivotIndex:p.index,side:p.side});
   s.missed=s.pivots-matchedPivots.size;
   insist(s.events===s.edgeExcluded+s.eligible&&s.eligible===s.early+s.onPivot+s.late+s.redundant+s.outsidePivot&&s.pivots===s.missed+s.early+s.onPivot+s.late,'COUNT_RECONCILIATION_FAILED');
   stats[channel]=s;
  }
  result[phase]={pivots:pivots.length,shortPivots:pivots.filter(p=>p.side==='short').length,longPivots:pivots.filter(p=>p.side==='long').length,channels:stats};
 }
 return result;
}
