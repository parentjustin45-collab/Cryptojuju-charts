/* Research-only scenario builder. Requires verified, closed-candle color events
   from the real SPEED V3 classifier; bullHigh=green, bullMid=blue, bearHigh=red, bearMid=pink. */
const meanings=Object.freeze({green:'long',red:'short',blue:'long',pink:'short'});
const levels=Object.freeze({bullHigh:'green',bullMid:'blue',bearHigh:'red',bearMid:'pink'});
export function speedClassificationsToColorEvents(rows){
 if(!Array.isArray(rows))throw Error('Classifications array required');
 return rows.filter(r=>r.color!=null).map(r=>{
  if(!Object.hasOwn(levels,r.color))throw Error('Unknown SPEED classification: '+r.color);
  if(r.closed!==true)throw Error('Unclosed SPEED candle');
  return {time:r.time,color:levels[r.color],closed:true,classification:r.color};
 });
}
export function speedColorScenarios(events,{reversalLookahead=5}={}){
 if(!Array.isArray(events)||!Number.isSafeInteger(reversalLookahead)||reversalLookahead<1)throw Error('Invalid inputs');
 const groups={directional:[],earlyReversal:[],combined:[],reversalAlerts:[]};
 const seen=new Set();
 for(const event of events){
  const time=Number(event?.time),color=event?.color;
  if(!Number.isSafeInteger(time)||!Object.hasOwn(meanings,color)||seen.has(time))throw Error('Invalid, unverified or duplicate SPEED color event');
  if(event.closed!==true)throw Error('Only confirmed closed-candle colors accepted');
  seen.add(time);
  const side=meanings[color];
  const signal={time,side,color,confirmed:color==='green'||color==='red'};
  groups.combined.push(signal);
  if(signal.confirmed)groups.directional.push(signal);
  else{
   groups.earlyReversal.push(signal);
   groups.reversalAlerts.push({time,color,expectedDirection:side,confirmed:false,lookaheadBars:reversalLookahead});
  }
 }
 for(const key of ['directional','earlyReversal','combined'])groups[key].sort((a,b)=>a.time-b.time);
 groups.reversalAlerts.sort((a,b)=>a.time-b.time);
 return {...groups,warning:'Hypotheses only. Blue/pink are unconfirmed reversals; no predictive reliability is implied.'};
}
