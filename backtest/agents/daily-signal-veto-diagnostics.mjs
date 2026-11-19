/*
 * CRYPTOJUJU: Daily-veto signal opportunity diagnostics.
 * RESEARCH / DESCRIPTIVE ONLY — neither trades nor executable P&L.
 *
 * A rejected Vector reversal is NOT automatically a losing trade.
 * For each accepted/rejected signal, examine the actual closed-bar price
 * evolution after the NEXT bar opens. The observed horizon's forward
 * price data is used for OUTCOME measurement only, NEVER in the signal
 * decision, daily gate, mode selection, or parameter tuning.
 *
 * Observed fixed-horizon signed close movement, MFE and MAE are mutually
 * different measurements; overlapping signals are NOT independent trades.
 */
export const FORWARD_SIGNAL_HORIZONS=Object.freeze([3,6,12]);
const reasonGroup=Object.freeze({
 aligned:'accepted_aligned',
 mixed_allowed:'accepted_mixed',
 daily_opposed:'rejected_opposed',
 daily_mixed_or_warmup:'rejected_neutral',
 daily_not_yet_available:'rejected_unavailable'
});
const num=(n)=>typeof n==='number'&&Number.isFinite(n);
const round=(n)=>Math.round(n*1e6)/1e6;
function ensureBars(bars,intervalMs){
 if(!Array.isArray(bars)||bars.length<2||
   !Number.isSafeInteger(intervalMs)||intervalMs<=0)
   throw Error('Missing verified closed lower-timeframe bars');
 for(let i=0;i<bars.length;i++){
   const b=bars[i];
   if(!Number.isSafeInteger(b?.time)||
      ![b.open,b.high,b.low,b.close].every(num)||
      b.open<=0||b.close<=0||b.low<=0||b.high<b.low||
      b.low>Math.min(b.open,b.close)||b.high<Math.max(b.open,b.close)||
      (i>0&&b.time!==bars[i-1].time+intervalMs))
     throw Error('Malformed or non-contiguous OHLC series');
 }
}
function blankGroup(){
 return {observedSignals:0,eligible:0,censored:0,
  positiveDirectionalCloseMoves:0,negativeDirectionalCloseMoves:0,
  zeroDirectionalCloseMoves:0,sumDirectionalClosePct:0,
  sumFavorableExcursionPct:0,sumAdverseExcursionPct:0};
}
function finalize(b){
 const n=b.eligible;
 return {
  observedSignals:b.observedSignals,
  eligibleOutcomeBars:n,censoredNearEnd:b.censored,
  positiveDirectionalCloseMoves:b.positiveDirectionalCloseMoves,
  negativeDirectionalCloseMoves:b.negativeDirectionalCloseMoves,
  zeroDirectionalCloseMoves:b.zeroDirectionalCloseMoves,
  directionalClosePositivePct:n?round(b.positiveDirectionalCloseMoves/n*100):null,
  meanDirectionalCloseChangePct:n?round(b.sumDirectionalClosePct/n):null,
  meanMaxFavorableExcursionPct:n?round(b.sumFavorableExcursionPct/n):null,
  meanMaxAdverseExcursionPct:n?round(b.sumAdverseExcursionPct/n):null,
  sampleGate:n>=20?'DESCRIPTIVE_ONLY':'INSUFFICIENT_SAMPLE',
  noWinRateOrPnLInference:true
 };
}
export function diagnoseDailyVetoedSignals({
 bars,observations,intervalMs,
 horizons=FORWARD_SIGNAL_HORIZONS,
 dailySafetyDelayMs=120000
}={}){
 ensureBars(bars,intervalMs);
 if(!Array.isArray(observations)||!Array.isArray(horizons)||
    !horizons.length||horizons.some((n,i)=>
      !Number.isSafeInteger(n)||n<1||n>48||(i>0&&n<=horizons[i-1]))||
    !Number.isSafeInteger(dailySafetyDelayMs)||
    dailySafetyDelayMs<0||dailySafetyDelayMs>3600000)
   throw Error('Invalid signal outcomes protocol');
 const byTime=new Map(bars.map((b,i)=>[b.time,i]));
 const observed=new Set(),all={};
 for(const h of horizons){
   all[h]={};
   for(const group of Object.values(reasonGroup))all[h][group]=blankGroup();
 }
 let earliestDecision=null,latestDecision=null;
 for(const obs of observations){
   const i=byTime.get(obs?.confirmedBarOpenMs);
   if(i===undefined||i+1>=bars.length||
      !['long','short'].includes(obs?.vectorSide)||
      !Object.hasOwn(reasonGroup,obs?.reason)||
      !Number.isSafeInteger(obs.signalConfirmedAtMs)||
      !Number.isSafeInteger(obs.entryAllowedAtMs)||
      obs.signalConfirmedAtMs!==bars[i].time+intervalMs||
      obs.entryAllowedAtMs!==bars[i+1].time||
      !['block','allow_mixed'].includes(obs.neutralPolicy)||
      obs.accepted!==(obs.reason==='aligned'||obs.reason==='mixed_allowed')||
      (obs.reason==='mixed_allowed'&&obs.neutralPolicy!=='allow_mixed')||
      observed.has(obs.confirmedBarOpenMs)||
      (obs.dailyClosedAtMs!==null&&
       (!Number.isSafeInteger(obs.dailyClosedAtMs)||
        obs.dailyClosedAtMs+dailySafetyDelayMs>obs.signalConfirmedAtMs)))
     throw Error('Unsafe, future-looking or duplicate Daily signal observation');
   observed.add(obs.confirmedBarOpenMs);
   earliestDecision=earliestDecision===null?obs.signalConfirmedAtMs:
     Math.min(earliestDecision,obs.signalConfirmedAtMs);
   latestDecision=latestDecision===null?obs.signalConfirmedAtMs:
     Math.max(latestDecision,obs.signalConfirmedAtMs);
   const side=obs.vectorSide==='long'?1:-1;
   const entryIndex=i+1,entry=bars[entryIndex].open;
   for(const h of horizons){
     const b=all[h][reasonGroup[obs.reason]];
     b.observedSignals++;
     const last=entryIndex+h-1;
     if(last>=bars.length){b.censored++;continue}
     let high=-Infinity,low=Infinity;
     for(let k=entryIndex;k<=last;k++){
       high=Math.max(high,bars[k].high);
       low=Math.min(low,bars[k].low);
     }
     const close=bars[last].close;
     const directionalChangePct=side*(close-entry)/entry*100;
     const favorablePct=(side===1?(high-entry):(entry-low))/entry*100;
     const adversePct=(side===1?(entry-low):(high-entry))/entry*100;
     b.eligible++;
     b.sumDirectionalClosePct+=directionalChangePct;
     b.sumFavorableExcursionPct+=favorablePct;
     b.sumAdverseExcursionPct+=adversePct;
     if(directionalChangePct>0)b.positiveDirectionalCloseMoves++;
     else if(directionalChangePct<0)b.negativeDirectionalCloseMoves++;
     else b.zeroDirectionalCloseMoves++;
   }
 }
 const out={};
 for(const h of horizons){
   out[h]={};
   for(const [key,value] of Object.entries(all[h]))
     out[h][key]=finalize(value);
 }
 return {
   protocol:'CJ_DAILY_SIGNAL_VETO_FORWARD_DIAGNOSTIC_V1',
   status:'DESCRIPTIVE_SIGNAL_OUTCOMES_ONLY',
   inspectedClosedBars:bars.length,
   observedSignalCount:observed.size,
   intervalMs,
   fixedHorizonsClosedBars:[...horizons],
   firstDecisionMs:earliestDecision,
   lastDecisionMs:latestDecision,
   groupsByHorizon:out,
   executionModel:'NEXT_BAR_OPEN_REFERENCE_PRICE_ONLY_NO_TRADING',
   simulationPnl:false,feesApplied:false,overlappingSignalsIndependent:false,
   futureUsedForDecisions:false,
   warnings:[
     'Forward outcomes use future CLOSED candle data only for retrospective measurements; no lookahead in entry decisions.',
     'A rejected opposite signal can trigger FLAT in the strategy. Its hypothetical directional move is NOT an actual missed trade.',
     'Fixed horizons can overlap between signals; averages are descriptive and NOT independent trade win rates.',
     'Positive directional move ignores spread, fees, funding, liquidity, timing of exits and capacity.',
     'No automatic indicator tuning, promotion, live-trading signals or orders.'
   ]
 };
}
