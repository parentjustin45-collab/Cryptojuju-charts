/* One preregistered hypothesis. No parameter search, production edit or orders. */
import {readFileSync} from 'node:fs';
import {calculateCjCipherWaveTrend,cjCipherConfirmedCommands}
 from './cj-cipher-wavetrend-v1.mjs';
import {runIntegratedVectorRiskStudy,INTEGRATED_CIPHER_CONFIRM1_IDS}
 from './vector-integrated-risk.mjs';

const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x)}return x};
export const CIPHER_CONFIRM1_LOCK=freeze(JSON.parse(readFileSync(
 new URL('./cj-cipher-v11-lock.json',import.meta.url),'utf8')));
const H=3600000,round=x=>Math.round(x*1e6)/1e6;

// Input rows are snapshots at CLOSE. Extra-bar confirmation is dated at its
// actual close, never backdated onto the original cross. Cross exits stay prompt.
export function buildCipherConfirmOne(rows){
 if(!Array.isArray(rows)||!rows.length)throw Error('Closed WaveTrend rows required');
 for(let i=0;i<rows.length;i++){
  const x=rows[i];
  if(!Number.isSafeInteger(x?.time)||(i&&x.time-rows[i-1].time!==H)||
     ![null,'long','short'].includes(x.signal)||
     ![x.wt1,x.wt2].every(v=>v===null||Number.isFinite(v))||
     (x.signal!==null&&(!Number.isFinite(x.wt1)||!Number.isFinite(x.wt2)||
       (x.signal==='long'?x.wt1<=x.wt2:x.wt1>=x.wt2))))
   throw Error('Invalid confirmed WaveTrend chronology or direction');
 }
 const baseline=cjCipherConfirmedCommands(rows),commands=[],events=[];
 const split=CIPHER_CONFIRM1_LOCK.trainingBars;
 for(const [from,to] of [[0,Math.min(split,rows.length)],[split,rows.length]]){
  let pending=null,authorizedSide=null;
  for(let i=from;i<to;i++){
   const x=rows[i],executable=i+1<to;
   if(pending){
    const persists=Number.isFinite(x.wt1)&&Number.isFinite(x.wt2)&&
      (pending.side==='long'?x.wt1>x.wt2:x.wt1<x.wt2);
    pending.confirmationTime=x.time;
    if(!executable)pending.disposition='phase_boundary';
    else if(x.signal!==null)pending.disposition='rejected_opposite_cross';
    else if(!persists)pending.disposition='rejected_nonpersistent';
    else{
     pending.disposition='accepted';pending.entryTime=x.time+H;
     commands.push({time:x.time,side:pending.side});
     authorizedSide=pending.side;
    }
    pending=null;
   }
   if(x.signal!==null){
    const event={originTime:x.time,originIndex:i,side:x.signal,
     phase:from===0?'training':'holdout',
     baselineExecutable:executable,confirmationTime:null,entryTime:null,
     disposition:executable?'pending':'phase_boundary'};
    events.push(event);
    if(executable){
     // Repeated same-direction crosses after an equality do not constitute
     // an opposite exit. Stops/targets are managed by the common ATR kernel.
     if(authorizedSide!==x.signal){
      commands.push({time:x.time,side:'flat'});authorizedSide=null;
     }
     pending=event;
    }
   }
  }
 }
 return {commandsByVariant:{cj_cipher_v10_atr:baseline,
   cj_cipher_v11_confirm1_atr:commands},events,
   usesFutureForDecisions:false,optimizedParameters:false};
}

function tradeMetrics(result,bars,from,to){
 const occupied=new Set(),byTime=new Map(bars.map((b,i)=>[b.time,i]));
 let longestEmpty=0,emptyRun=0;
 for(const t of result.trades){
  const a=byTime.get(t.entryTime),b=byTime.get(t.exitTime);
  // Open-time exits do not occupy the exit bar unless another trade enters.
  const end=b+Number(['stop','target','phase_end_close'].includes(t.exitReason));
  for(let k=a;k<end;k++)occupied.add(k);
 }
 for(let i=from;i<to;i++){
  emptyRun=occupied.has(i)?0:emptyRun+1;longestEmpty=Math.max(longestEmpty,emptyRun);
 }
 const rapid=n=>result.trades.filter(t=>t.exitReason==='vector_signal'&&
   (t.exitTime-t.entryTime)/H<=n).length;
 return {tradeCount:result.tradeCount,returnPct:result.returnPct,
  closeMarkedMaxDrawdownPct:result.closeMarkedMaxDrawdownPct,
  winRatePct:result.winRatePct,
  longTrades:result.trades.filter(t=>t.side==='long').length,
  shortTrades:result.trades.filter(t=>t.side==='short').length,
  rapidOppositeExit3:rapid(3),rapidOppositeExit6:rapid(6),
  rapidOppositeExit6Fraction:result.tradeCount?round(rapid(6)/result.tradeCount):null,
  wholeBarsWithoutPosition:to-from-occupied.size,
  longestWholeBarsWithoutPosition:longestEmpty};
}

// Ex-post attribution only. Labels are never fed back into signal construction.
export function auditCipherOpportunityCost({baseline,variant,events,bars,phase}){
 const byOrigin=new Map(events.filter(e=>e.phase===phase).map(e=>[e.originTime,e]));
 const byEntry=new Map(variant.trades.map(t=>[t.entryTime,t]));
 const index=new Map(bars.map((b,i)=>[b.time,i]));
 const details=baseline.trades.map(t=>{
  const originTime=t.entryTime-H,e=byOrigin.get(originTime);
  if(!e||e.side!==t.side)throw Error('Baseline ATR trade lacks a confirmed source cross');
  const delayed=e.entryTime===null?null:byEntry.get(e.entryTime);
  if(delayed&&delayed.side!==t.side)throw Error('Delayed trade direction mismatch');
  const retained=Boolean(delayed&&delayed.netPnl>0);
  const k=index.get(t.entryTime),direction=t.side==='long'?1:-1;
  return {originTime,side:t.side,baselineNetPnl:t.netPnl,
   disposition:e.disposition,delayedTradeExecuted:Boolean(delayed),
   delayedNetPnl:delayed?.netPnl??null,baselineWinnerRetained:t.netPnl>0&&retained,
   entryDelayBars:e.disposition==='accepted'?1:null,
   adverseRawEntryDelayPct:e.disposition==='accepted'?
    round(100*direction*(bars[k+1].open/bars[k].open-1)):null};
 });
 const winners=details.filter(x=>x.baselineNetPnl>0);
 const rejected=x=>x.disposition.startsWith('rejected_');
 return {baselineTrades:details.length,baselineWinners:winners.length,
  rejectedWinningBaselineTrades:winners.filter(rejected).length,
  rejectedLosingBaselineTrades:details.filter(x=>x.baselineNetPnl<0&&rejected(x)).length,
  baselineWinnersLostAtPhaseBoundary:winners.filter(x=>x.disposition==='phase_boundary').length,
  delayedBaselineWinnersNowNonpositive:winners.filter(x=>x.delayedTradeExecuted&&x.delayedNetPnl<=0).length,
  baselineWinnersWithoutDelayedTrade:winners.filter(x=>!x.delayedTradeExecuted).length,
  baselineWinnersRetained:winners.filter(x=>x.baselineWinnerRetained).length,
  baselineWinnersRetainedFraction:winners.length?
    round(winners.filter(x=>x.baselineWinnerRetained).length/winners.length):null,
  details};
}

export function runCipherConfirmOneStudy({bars,market,historyWindow}){
 const wave=calculateCjCipherWaveTrend(bars),built=buildCipherConfirmOne(wave);
 const portfolio=runIntegratedVectorRiskStudy({bars,market,historyWindow,
  commandsByVariant:built.commandsByVariant,strategyIds:INTEGRATED_CIPHER_CONFIRM1_IDS,
  policy:CIPHER_CONFIRM1_LOCK.risk});
 const comparisons={};
 for(const cost of ['base','stress']){
  comparisons[cost]={};
  for(const phase of ['training','holdout']){
   const baseline=portfolio.scenarios[cost].cj_cipher_v10_atr[phase];
   const variant=portfolio.scenarios[cost].cj_cipher_v11_confirm1_atr[phase];
   const from=phase==='training'?0:672,to=phase==='training'?672:960;
   const events=built.events.filter(e=>e.phase===phase);
   comparisons[cost][phase]={
    baseline:tradeMetrics(baseline,bars,from,to),
    variant:tradeMetrics(variant,bars,from,to),
    candidates:{total:events.length,baselineExecutable:events.filter(e=>e.baselineExecutable).length,
     accepted:events.filter(e=>e.disposition==='accepted').length,
     rejectedOppositeCross:events.filter(e=>e.disposition==='rejected_opposite_cross').length,
     rejectedNonpersistent:events.filter(e=>e.disposition==='rejected_nonpersistent').length,
     phaseBoundary:events.filter(e=>e.disposition==='phase_boundary').length},
    opportunity:auditCipherOpportunityCost({baseline,variant,events:built.events,bars,phase})
   };
  }
 }
 return {protocol:CIPHER_CONFIRM1_LOCK.protocol,market,historyWindow,
  status:'HISTORICAL_PAIRED_ATR_DESCRIPTIVE_ONLY',
  commandsByVariant:built.commandsByVariant,events:built.events,comparisons,portfolio,
  prospectiveWindow:CIPHER_CONFIRM1_LOCK.prospective,
  optimizedParameters:false,productionIndicatorChanged:false,
  ordersPlaced:false,promotedStrategy:null};
}

export function evaluateCipherConfirmationForward(cases){
 const p=CIPHER_CONFIRM1_LOCK.prospective;
 if(!Array.isArray(cases)||cases.length!==3||
    new Set(cases.map(c=>c.symbol)).size!==3||
    !cases.every(c=>CIPHER_CONFIRM1_LOCK.symbols.includes(c.symbol)))
  return {status:'BLOCKED_MISSING_MARKETS',eligibleForBroaderResearch:false};
 const h=cases.flatMap(c=>['base','stress'].map(cost=>c.comparisons[cost].holdout));
 if(h.some(x=>x.baseline.tradeCount<p.minimumTradesPerArmPerMarket||
    x.variant.tradeCount<p.minimumTradesPerArmPerMarket||!x.opportunity.baselineWinners))
  return {status:'INSUFFICIENT_TRADES',eligibleForBroaderResearch:false};
 const a=cases.map(c=>c.comparisons.base.holdout);
 const sum=(side,key)=>a.reduce((n,x)=>n+x[side][key],0);
 const bRapid=sum('baseline','rapidOppositeExit6'),vRapid=sum('variant','rapidOppositeExit6');
 const checks={
  nonWorseEveryMarketBothCosts:h.every(x=>x.variant.returnPct>=x.baseline.returnPct&&
   x.variant.closeMarkedMaxDrawdownPct<=x.baseline.closeMarkedMaxDrawdownPct),
  winnersRetainedEveryMarketBothCosts:h.every(x=>x.opportunity.baselineWinnersRetained/
   x.opportunity.baselineWinners>=p.minimumBaselineWinnersRetainedFraction),
  improvedBaseMarkets:a.filter(x=>x.variant.returnPct>x.baseline.returnPct).length>=
   p.minimumMarketsWithStrictlyBetterBaseReturn,
  fewerRapidExitsAndLowerRate:vRapid<bRapid&&
   vRapid/sum('variant','tradeCount')<bRapid/sum('baseline','tradeCount')
 };
 const passed=Object.values(checks).every(Boolean);
 return {status:passed?'ELIGIBLE_FOR_BROADER_RESEARCH_ONLY':'LOCKED_CRITERIA_NOT_MET',
  eligibleForBroaderResearch:passed,checks,promotedStrategy:null};
}
