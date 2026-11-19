/*
 * CryptoJuju | Causal PAPER-TRADE laboratory for Daily-vetoed Vector signals.
 *
 * An isolated, sequential risk-limited simulation per signal cohort; NOT the
 * PnL of an integrated always-in-trade portfolio. Candidate signals are
 * selected exclusively from previously confirmed Vector + completed Daily
 * decisions. No indicator parameters are optimized, and no orders are sent.
 *
 * Fills: following bar OPEN (with adverse slippage); stop/target during OHLC
 * bar (if BOTH touch, pessimistic STOP). Stop gaps fill at worse OPEN.
 * Hard timeout closes at following bar OPEN; at phase boundary closes at
 * final available CLOSED bar close. Risk/target levels fixed at entry from
 * Wilder ATR(14) computed through confirmation bar only.
 */
import {classifyHistory,requireCleanHistory} from '../quality-gate.mjs';
export const VETO_TRADE_POLICY=Object.freeze({
  atrPeriod:14,stopAtrMultiple:1.5,targetRMultiple:2,
  maxHoldBars:12,riskFraction:0.01,maxNotionalFraction:1,
  initialCapital:1000,splitFraction:0.7,
  groups:['daily_opposed','aligned'],
  costCases:{
    base:{feeRate:0.0006,slippageRate:0.0005},
    stress:{feeRate:0.001,slippageRate:0.002}
  }
});
const round=x=>Math.round(x*1e6)/1e6;
function requirePolicy(p){
  if(!Number.isInteger(p?.atrPeriod)||p.atrPeriod<2||p.atrPeriod>200||
     !Number.isFinite(p?.stopAtrMultiple)||p.stopAtrMultiple<=0||
     !Number.isFinite(p?.targetRMultiple)||p.targetRMultiple<=0||
     !Number.isInteger(p?.maxHoldBars)||p.maxHoldBars<1||p.maxHoldBars>100||
     !Number.isFinite(p?.riskFraction)||p.riskFraction<=0||p.riskFraction>0.05||
     !Number.isFinite(p?.maxNotionalFraction)||p.maxNotionalFraction<=0||p.maxNotionalFraction>1||
     !Number.isFinite(p?.initialCapital)||p.initialCapital<=0||
     !Number.isFinite(p?.splitFraction)||p.splitFraction<0.5||p.splitFraction>0.9||
     !Array.isArray(p.groups)||p.groups.length!==2||
     p.groups[0]!=='daily_opposed'||p.groups[1]!=='aligned'||
     !p.costCases||Object.keys(p.costCases).length!==2)
    throw Error('Unsafe risk/recovery research policy');
  for(const x of Object.values(p.costCases)){
    if(!Number.isFinite(x?.feeRate)||x.feeRate<0||x.feeRate>=0.1||
       !Number.isFinite(x?.slippageRate)||x.slippageRate<0||x.slippageRate>=0.1)
       throw Error('Invalid fixed simulated friction');
  }
}
function makeAtr(bars,period){
 const out=new Array(bars.length).fill(null);
 let rolling=0;
 for(let i=0;i<bars.length;i++){
   const c=bars[i],prev=i?bars[i-1].close:c.close;
   const tr=Math.max(c.high-c.low,Math.abs(c.high-prev),Math.abs(c.low-prev));
   if(i<period){rolling+=tr;if(i===period-1)out[i]=rolling/period;}
   else out[i]=(out[i-1]*(period-1)+tr)/period;
 }
 return out;
}
function verifyObservations(observations,bars,intervalMs){
 if(!Array.isArray(observations))throw Error('Missing confirmed Daily observations');
 const seen=new Set();
 for(const x of observations){
   if(!Number.isSafeInteger(x?.confirmedBarOpenMs)||
      !Number.isSafeInteger(x?.signalConfirmedAtMs)||
      !Number.isSafeInteger(x?.entryAllowedAtMs)||
      !['long','short'].includes(x?.vectorSide)||
      !['aligned','daily_opposed','daily_mixed_or_warmup',
         'mixed_allowed','daily_not_yet_available'].includes(x?.reason)||
      typeof x?.accepted!=='boolean'||
      x.accepted!==(x.reason==='aligned'||x.reason==='mixed_allowed')||
      !['block','allow_mixed'].includes(x.neutralPolicy)||
      seen.has(x.confirmedBarOpenMs))
     throw Error('Invalid or duplicate confirmed signal observation');
   seen.add(x.confirmedBarOpenMs);
   const i=(x.confirmedBarOpenMs-bars[0].time)/intervalMs;
   if(!Number.isInteger(i)||i<0||i>=bars.length-1||
      x.signalConfirmedAtMs!==bars[i].time+intervalMs||
      x.entryAllowedAtMs!==bars[i+1].time||
      (x.dailyClosedAtMs!==null&&
       (!Number.isSafeInteger(x.dailyClosedAtMs)||
        x.dailyClosedAtMs+120000>x.signalConfirmedAtMs)))
      throw Error('Lookahead, out-of-window or bad execution timestamp');
 }
}
function summarize(p,tradeCount,wins,exitReasons,stats){
 return {
   tradeCount,winRatePct:tradeCount?round(wins/tradeCount*100):null,
   finalCapital:round(p.equity),netProfit:round(p.equity-p.initialCapital),
   returnPct:round((p.equity/p.initialCapital-1)*100),
   realizedMaxDrawdownPct:round(p.maxDrawdown*100),
   skippedOverlap:stats.overlap,skippedNoAtr:stats.noAtr,
   excludedPhaseBoundary:stats.boundary,
   candidateSignals:stats.candidates,
   filledEntries:tradeCount,
   exitReasons,
   scenarioIsNotIntegratedPortfolio:true,
   pnlIsSimulated:true
 };
}
function phaseSim({
 bars,atr,observations,intervalMs,group,from,to,policy,friction
}){
 const stats={candidates:0,overlap:0,noAtr:0,boundary:0};
 const equityState={equity:policy.initialCapital,initialCapital:policy.initialCapital,
   peak:policy.initialCapital,maxDrawdown:0};
 let wins=0,lockedUntil=-1;
 const exitReasons={stop:0,target:0,timeout_next_open:0,phase_end_close:0};
 const executions=[];
 const mark=()=>{
   equityState.peak=Math.max(equityState.peak,equityState.equity);
   equityState.maxDrawdown=Math.max(equityState.maxDrawdown,
     (equityState.peak-equityState.equity)/equityState.peak);
 };
 for(const obs of observations){
   if(obs.reason!==group)continue;
   const confirmIndex=(obs.confirmedBarOpenMs-bars[0].time)/intervalMs;
   if(confirmIndex<from||confirmIndex>=to)continue;
   stats.candidates++;
   const entryIndex=confirmIndex+1;
   if(entryIndex>=to){stats.boundary++;continue;}
   if(entryIndex<=lockedUntil){stats.overlap++;continue;}
   const atrAtSignal=atr[confirmIndex];
   if(!Number.isFinite(atrAtSignal)||atrAtSignal<=0){stats.noAtr++;continue;}
   if(equityState.equity<=0)break;
   const direction=obs.vectorSide==='long'?1:-1;
   const entryBase=bars[entryIndex].open;
   const entry=entryBase*(1+direction*friction.slippageRate);
   const distance=policy.stopAtrMultiple*atrAtSignal;
   // All parameters are determined from closed candles BEFORE entry.
   const stop=entry-direction*distance,target=entry+
     direction*policy.targetRMultiple*distance;
   if(stop<=0||target<=0) {stats.noAtr++;continue;}
   const riskBudget=equityState.equity*policy.riskFraction;
   const qty=Math.min(riskBudget/distance,
     equityState.equity*policy.maxNotionalFraction/entry);
   if(!Number.isFinite(qty)||qty<=0){stats.noAtr++;continue;}
   const entryFee=qty*entry*friction.feeRate;
   const limit=Math.min(to-1,entryIndex+policy.maxHoldBars-1);
   let exitBase=null,exitIndex=null,reason=null,collision=false;
   for(let k=entryIndex;k<=limit;k++){
     const b=bars[k];
     const openedBeyondStop=direction===1?b.open<=stop:b.open>=stop;
     const openedBeyondTarget=direction===1?b.open>=target:b.open<=target;
     const touchedStop=direction===1?b.low<=stop:b.high>=stop;
     const touchedTarget=direction===1?b.high>=target:b.low<=target;
     // A gap at OPEN is resolved first. Bad gaps fill worse than stop;
     // favorable gaps are capped at target, not improved arbitrarily.
     if(openedBeyondStop){exitBase=b.open;reason='stop'}
     else if(openedBeyondTarget){exitBase=target;reason='target'}
     else if(touchedStop&&touchedTarget){
       exitBase=stop;reason='stop';collision=true;
     }else if(touchedStop){exitBase=stop;reason='stop'}
     else if(touchedTarget){exitBase=target;reason='target'}
     if(reason!==null){exitIndex=k;break}
   }
   if(exitIndex===null){
     const next=entryIndex+policy.maxHoldBars;
     if(next<to){exitIndex=next;exitBase=bars[next].open;reason='timeout_next_open';}
     else{exitIndex=to-1;exitBase=bars[exitIndex].close;reason='phase_end_close';}
   }
   const exit=exitBase*(1-direction*friction.slippageRate);
   const exitFee=qty*exit*friction.feeRate;
   const netPnl=direction*qty*(exit-entry)-entryFee-exitFee;
   equityState.equity+=netPnl;
   mark();
   if(netPnl>0)wins++;
   exitReasons[reason]++;
   lockedUntil=exitIndex;
   executions.push({
     confirmationOpenMs:obs.confirmedBarOpenMs,
     entryMs:bars[entryIndex].time,exitMs:bars[exitIndex].time,
     side:obs.vectorSide,group,reason,simulatedFillPrice:round(entry),
     exitFillPrice:round(exit),atrAtConfirmation:round(atrAtSignal),
     stop:round(stop),target:round(target),qty:round(qty),
     riskBudget:round(riskBudget),netPnl:round(netPnl),
     exitFee:round(exitFee),entryFee:round(entryFee),
     stopAndTargetSameBarStopWins:collision
   });
 }
 return {...summarize(equityState,executions.length,wins,exitReasons,stats),
   trades:executions,phaseStartMs:bars[from].time,
   phaseEndExclusiveMs:bars[to-1].time+intervalMs};
}
export function runDailyVetoRiskPaperExperiment({
 market,historyWindow,bars,observations,policy=VETO_TRADE_POLICY
}={}){
 requirePolicy(policy);
 if(!market||market.exchange!=='Bitunix'||market.priceType!=='LAST_PRICE'||
    !['15m','1h','4h'].includes(market.timeframe)||
    !historyWindow||!Array.isArray(bars)||
    bars.length<4*policy.atrPeriod)
   throw Error('A verified Bitunix closed-bar research window is required');
 // Always enforce strict OHLC continuity before attributing performance.
 const clean=requireCleanHistory(classifyHistory(bars,historyWindow));
 verifyObservations(observations,clean,historyWindow.intervalMs);
 const atr=makeAtr(clean,policy.atrPeriod);
 const split=Math.floor(clean.length*policy.splitFraction);
 if(split<=policy.atrPeriod+policy.maxHoldBars||
    clean.length-split<=policy.maxHoldBars+1)
   throw Error('Insufficient split bars for risk-managed research');
 const scenarios={};
 for(const [name,friction] of Object.entries(policy.costCases)){
   scenarios[name]={};
   for(const group of policy.groups){
     scenarios[name][group]={
       training:phaseSim({
         bars:clean,atr,observations,intervalMs:historyWindow.intervalMs,
         group,from:0,to:split,policy,friction
       }),
       holdout:phaseSim({
         bars:clean,atr,observations,intervalMs:historyWindow.intervalMs,
         group,from:split,to:clean.length,policy,friction
       })
     };
   }
 }
 return {
  protocol:'CJ_DAILY_VETO_STANDALONE_RISK_PAPER_V1',
  status:'SIMULATED_RISK_TRADE_COHORTS_ONLY',
  market,historyWindow,
  splitAtUtc:new Date(clean[split].time).toISOString(),
  riskPolicy:{atrMethod:'Wilder RMA true range from CLOSED bars only',atrPeriod:policy.atrPeriod,
    stopAtrMultiple:policy.stopAtrMultiple,targetRMultiple:policy.targetRMultiple,
    riskFraction:policy.riskFraction,maxNotionalFraction:policy.maxNotionalFraction,
    maxHoldBars:policy.maxHoldBars,initialCapital:policy.initialCapital,
    intrabarAmbiguity:'STOP_FIRST',gapStopFill:'WORSE_OPEN',
    lastPhaseBarExit:'CLOSED_BAR_CLOSE_WITH_ADVERSE_SLIPPAGE'},
  frictionScenarios:policy.costCases,
  scenarios,
  decisionsUseFutureCandles:false,ordersPlaced:false,autoPromotion:false,
  warnings:[
    'Standalone isolated cohorts of directional signals: NOT realized opportunity cost or the portfolio PnL of Vector/FLAT.',
    'At most one trade at a time per cohort/phase. Multiple events during a trade are intentionally skipped.',
    'Stop and target are simulated using candle high/low; if both touch in one bar, the stop fills first (conservative).',
    'Historical bar highs/lows cannot prove the true intrabar path, liquidity, mark-price stops or executable fills.',
    'Stop gaps fill at worse open; 12-bar expiry exits at next bar open when available.',
    'Realized-trade drawdown excludes open-position adverse excursions; it is NOT a full equity risk bound.',
    'Costs are illustrative; actual spread, funding and varying derivatives liquidity are NOT measured.',
    'Split and parameters were already designed after seeing markets: historical holdout is NOT blind/prospective.',
    'No orders, real money, strategy deployment, automatic variant selection or TradingView parity.'
  ]
 };
}
