/* Level 6.4 shared specialist evidence, deterministic research only.
 * No vote from an unclosed bar, no forward confirmation, no signal edits.
 * Frank crossings and divergences are ONE specialist, not two votes. */
import {createHash} from 'node:crypto';
import {generate} from './autonomous-rule-candidates.mjs';
import {atr14,findPivots,CHANNELS} from './state-pivot-observer.mjs';
import {scoreFold} from './historical-single-change-experiments.mjs';
export const VERSION='CJ_L6_CONFLUENCE_V1';
export const FAMILIES=Object.freeze(['vector','momentum','speed','cipher','frank']);
export const POLICY=Object.freeze({lookbackBars:3,quorums:[2,3],opposingVotesAllowed:0,signalTiming:'confirmed close; hypothetical next open',rearm:'only after consensus drops below quorum or changes side'});
const need=(v,m)=>{if(!v)throw Error(m)},sha=x=>createHash('sha256').update(x).digest('hex');
const family=ch=>ch.startsWith('frank_')?'frank':ch;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function buildConfluences(bars,channels){
 need(Array.isArray(bars)&&bars.length>0&&bars.length<=14000,'CONFLUENCE_BARS');
 need(Object.keys(channels).sort().join('|')===[...CHANNELS].sort().join('|'),'CONFLUENCE_CHANNELS');
 const pos=new Map(bars.map((b,i)=>[b.time,i]));
 need(pos.size===bars.length&&bars.every((b,i)=>Number.isSafeInteger(b.time)&&(i===0||b.time>bars[i-1].time)),'CONFLUENCE_TIMES');
 const at=Array.from({length:bars.length},()=>new Map());
 for(const ch of CHANNELS)for(const e of channels[ch]){
  const i=pos.get(e.time);need(Number.isInteger(i)&&['long','short'].includes(e.side),'CONFLUENCE_EVENT');
  const f=family(ch),list=at[i].get(f)??[];
  list.push({channel:ch,time:e.time,side:e.side,tag:e.tag});at[i].set(f,list);
 }
 const latest=new Map(),state={2:null,3:null},result={union:[],quorum2:[],quorum3:[],conflictBars:0};
 for(let i=0;i<bars.length;i++){
  for(const [f,events] of at[i]){
   const sides=new Set(events.map(e=>e.side));
   latest.set(f,{index:i,side:sides.size===1?events[0].side:null,events});
  }
  const current=[...at[i].entries()].map(([f,events])=>({family:f,events,side:new Set(events.map(e=>e.side)).size===1?events[0].side:null}));
  const currentSides=new Set(current.map(x=>x.side));
  if(current.length&&currentSides.size===1&&!currentSides.has(null))result.union.push({time:bars[i].time,side:current[0].side,tag:'union_same_close'});
  const votes=FAMILIES.flatMap(f=>{const x=latest.get(f);return x&&i-x.index<POLICY.lookbackBars?[{family:f,ageBars:i-x.index,side:x.side,events:x.events}]:[];});
  const long=votes.filter(v=>v.side==='long'),short=votes.filter(v=>v.side==='short'),ambiguous=votes.some(v=>v.side===null);
  const conflict=ambiguous||(long.length>0&&short.length>0);
  if(conflict)result.conflictBars++;
  const side=conflict?null:long.length?'long':short.length?'short':null,support=side==='long'?long:side==='short'?short:[];
  for(const quorum of POLICY.quorums){
   const next=side&&support.length>=quorum?side:null;
   if(next&&state[quorum]!==next&&support.some(v=>v.ageBars===0))result['quorum'+quorum].push({time:bars[i].time,side:next,tag:'confluence_'+quorum,support});
   state[quorum]=next;
  }
 }
 return result;
}
function summarize(rows){
 const out={events:0,eligible:0,matched:0,pivots:0,missed:0,samples:0,sumGrossBps:0,positive20:0,early:0,on:0,late:0};
 for(const row of rows)for(const side of Object.values(row)){for(const k of Object.keys(out))if(k!=='matched')out[k]+=side[k];out.matched+=side.early+side.on+side.late;}
 return {...out,precision:out.eligible?out.matched/out.eligible:null,pivotCoverage:out.pivots?out.matched/out.pivots:null,meanNet20Bps:out.samples?out.sumGrossBps/out.samples-20:null,positiveNet20:out.samples?out.positive20/out.samples:null};
}
export function studyConfluence(bars,archive){
 need(bars.length>=150&&bars.length<=14000&&Number.isFinite(archive.priceStep)&&archive.priceStep>0,'CONFLUENCE_SCOPE');
 const channels=Object.fromEntries(CHANNELS.map(ch=>{
  const original=generate(ch,bars,archive.priceStep,false).signals;
  need(same(original,archive.indicators[ch].signals.filter(x=>x.time<=bars.at(-1).time)),'CONFLUENCE_ARCHIVE_PARITY_'+ch);
  return [ch,original];
 }));
 const result=buildConfluences(bars,channels),n=bars.length,cuts=[0,Math.floor(n/3),Math.floor(n*2/3),n];
 // Independently recalculate the six streams and quorum events on both prefixes.
 for(const cut of cuts.slice(1,3)){
  const prefix=bars.slice(0,cut),events=Object.fromEntries(CHANNELS.map(ch=>[ch,generate(ch,prefix,archive.priceStep,false).signals]));
  for(const ch of CHANNELS)need(same(events[ch],channels[ch].filter(e=>e.time<=prefix.at(-1).time)),'CONFLUENCE_CHANNEL_PREFIX_'+ch);
  const z=buildConfluences(prefix,events);
  for(const k of ['union','quorum2','quorum3'])need(same(z[k],result[k].filter(e=>e.time<=prefix.at(-1).time)),'CONFLUENCE_PREFIX_'+k);
 }
 const atr=atr14(bars),positions=new Map(bars.map((x,i)=>[x.time,i]));
 // Frank standalone is one deduplicated stream; conflicting same-bar votes cancel.
 const frank=buildConfluences(bars,Object.fromEntries(CHANNELS.map(ch=>[ch,ch.startsWith('frank_')?channels[ch]:[]]))).union;
 const systems={vector:channels.vector,momentum:channels.momentum,speed:channels.speed,cipher:channels.cipher,frank,union:result.union,quorum2:result.quorum2,quorum3:result.quorum3};
 const folds=[];
 for(let i=0;i<3;i++){const start=cuts[i],end=cuts[i+1],pivots=findPivots(bars,atr,start,end);folds.push({fold:i+1,startTime:bars[start].time,endTime:bars[end-1].time,systems:Object.fromEntries(Object.entries(systems).map(([k,signals])=>[k,scoreFold(bars,atr,positions,pivots,{signals},start,end)]))});}
 const pooled=Object.fromEntries(Object.keys(systems).map(k=>[k,summarize(folds.map(f=>f.systems[k]))]));
 const votes=Object.fromEntries(['quorum2','quorum3'].map(k=>[k,{events:result[k],sha256:sha(JSON.stringify(result[k]))}]));
 return {policy:POLICY,channelCounts:Object.fromEntries(CHANNELS.map(ch=>[ch,channels[ch].length])),conflictBars:result.conflictBars,folds,pooled,votes,prefixChecks:2,holdoutUsed:false,noSignalChanges:true,noPromotion:true,noTrading:true,paidCalls:0,exploratoryOnly:true};
}
