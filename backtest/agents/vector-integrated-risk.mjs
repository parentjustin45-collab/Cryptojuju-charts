/*
 * CryptoJuju Vector research-only INTEGRATED risk-managed paper portfolio.
 * One position per market, next-bar-open signal execution, ATR stop / target,
 * pessimistic stop-first on OHLC ambiguity, capped notional and max holding,
 * identical split/fees across original, strict, soft and recovery variants.
 * Crucial: recovered entry only when the CONFIRMATION bar already shows an
 * intraday EMA21/34/50 stack in the same direction. No future-bar features.
 * No orders, no real fills, no tuning, no automatic promotion.
 */
import {classifyHistory,requireCleanHistory} from '../quality-gate.mjs';
import {VETO_TRADE_POLICY} from './daily-veto-risk-paper.mjs';

export const INTEGRATED_RECOVERY_LOCK=Object.freeze({
  symbols:['BTCUSDT','HYPEUSDT','1000PEPEUSDT'],timeframe:'1h',
  strategyIds:['v11_original','v11_daily_strict','v11_daily_soft','v13_ema_confirmed_recovery'],
  recoveredOnlyWhen:'DAILY_OPPOSED_AND_CONFIRMED_1H_EMA_STACK',
  policy:'ATR14_1.5_STOP_2R_TARGET_12_BAR_TIMEOUT_NO_LEVERAGE',
  phaseSplitFraction:0.7
});
// A second FIXED protocol reuses the identical one-position ATR simulator.
// Explicitly allowlisted to prevent arbitrary strategies or retroactive modes.
export const INTEGRATED_MOMENTUM_IDS=Object.freeze([
  'vector_v11','momentum_fusion_v1','vector_v11_momentum_confirmed'
]);
export const INTEGRATED_CIPHER_CONFIRM1_IDS=Object.freeze([
  'cj_cipher_v10_atr','cj_cipher_v11_confirm1_atr'
]);
const verifiedIds=ids=>Array.isArray(ids)&&(
 JSON.stringify(ids)===JSON.stringify(INTEGRATED_RECOVERY_LOCK.strategyIds)||
 JSON.stringify(ids)===JSON.stringify(INTEGRATED_MOMENTUM_IDS)||
 JSON.stringify(ids)===JSON.stringify(INTEGRATED_CIPHER_CONFIRM1_IDS)
);
const r=x=>Math.round(x*1e6)/1e6;
function requireSignals(signals,bars){
 if(!Array.isArray(signals))throw Error('Missing Vector commands');
 const positions=new Map(bars.map((b,i)=>[b.time,i]));
 const out=new Map();
 let last=-Infinity;
 for(const x of signals){
  const i=positions.get(x?.time);
  if(!Number.isSafeInteger(x?.time)||i===undefined||i===bars.length-1||
     x.time<=last||!['long','short','flat'].includes(x?.side))
    throw Error('Non-causal, duplicate, unordered or non-executable Vector command');
  out.set(x.time,x.side);last=x.time;
 }
 return out;
}
function validatePolicy(policy){
 if(!policy||!Number.isSafeInteger(policy.atrPeriod)||
    policy.atrPeriod<2||policy.atrPeriod>100||
    !Number.isFinite(policy.stopAtrMultiple)||policy.stopAtrMultiple<=0||
    !Number.isFinite(policy.targetRMultiple)||policy.targetRMultiple<=0||
    !Number.isSafeInteger(policy.maxHoldBars)||policy.maxHoldBars<1||
    policy.maxHoldBars>48||
    !Number.isFinite(policy.initialCapital)||policy.initialCapital<=0||
    !Number.isFinite(policy.riskFraction)||policy.riskFraction<=0||
    policy.riskFraction>0.05||
    !Number.isFinite(policy.maxNotionalFraction)||
    policy.maxNotionalFraction<=0||policy.maxNotionalFraction>1||
    policy.splitFraction!==0.7)
   throw Error('Unsafe integrated portfolio policy');
 const fees=policy.costCases;
 if(!fees||!['base','stress'].every(x=>
   Number.isFinite(fees[x]?.feeRate)&&fees[x].feeRate>=0&&fees[x].feeRate<.1&&
   Number.isFinite(fees[x]?.slippageRate)&&fees[x].slippageRate>=0&&fees[x].slippageRate<.1))
    throw Error('Invalid integrated portfolio friction assumptions');
}
export function buildEmaConfirmedDailyRecovery({
 strictSignals,observations,features,bars,intervalMs
}={}){
 if(!Array.isArray(strictSignals)||!Array.isArray(observations)||
    !Array.isArray(features)||features.length!==bars?.length||
    !Number.isSafeInteger(intervalMs)||intervalMs<=0)
   throw Error('Mismatched causal recovery inputs');
 const command=requireSignals(strictSignals,bars);
 const output=new Map(command),recovered=[],blocked=[];
 let prev=-Infinity;
 const times=new Map(bars.map((b,i)=>[b.time,i]));
 for(const obs of observations){
  const i=times.get(obs.confirmedBarOpenMs);
  if(i===undefined||i>=bars.length-1||
     obs.confirmedBarOpenMs<=prev||
     obs.signalConfirmedAtMs!==bars[i].time+intervalMs||
     obs.entryAllowedAtMs!==bars[i+1].time||
     !['long','short'].includes(obs.vectorSide)||
     !Number.isSafeInteger(obs.dailyClosedAtMs)||
     obs.dailyClosedAtMs+120000>obs.signalConfirmedAtMs||
     !['aligned','daily_opposed','daily_mixed_or_warmup'].includes(obs.reason)||
     obs.neutralPolicy!=='block'||
     obs.accepted!==(obs.reason==='aligned')||
     features[i]?.time!==bars[i].time)
   throw Error('Recovery cannot consume unverified or future Daily/EMA observations');
  prev=obs.confirmedBarOpenMs;
  if(obs.reason!=='daily_opposed')continue;
  const aligned1h=(obs.vectorSide==='long'?'bull_stack':'bear_stack')===features[i].regime;
  if(!aligned1h){blocked.push(obs.confirmedBarOpenMs);continue;}
  // This time may contain a FLAT produced by the strict Daily veto.
  // Replace it with ONE direction command; never create two commands.
  if(output.has(obs.confirmedBarOpenMs)&&
     output.get(obs.confirmedBarOpenMs)!=='flat')
   throw Error('Cannot replace non-FLAT Daily-vetoed signal');
  output.set(obs.confirmedBarOpenMs,obs.vectorSide);
  recovered.push({time:obs.confirmedBarOpenMs,side:obs.vectorSide,
    dailyClosedAtMs:obs.dailyClosedAtMs,
    confirmationFeature:features[i].regime});
 }
 const signals=[...output.entries()].sort((a,b)=>a[0]-b[0])
   .map(([time,side])=>({time,side}));
 requireSignals(signals,bars);
 return {signals,recovered,blocked,
  stats:{strictCommands:strictSignals.length,
   recoveryCandidates:recovered.length+blocked.length,
   recovered:recovered.length,rejectedByClosedEma:blocked.length,
   newCommands:signals.length,
   futureDailyUsed:false},
  warnings:[
   'Experimentally restores only DAILY_OPPOSED signals when 1h EMA21/34/50 stack on the same CONFIRMED candle agrees with the Vector side.',
   'No intraday EMA from later candles; no rewards or future price data used to build commands.',
   'Recovered signals can replace a FLAT command; only the separate integrated risk engine measures portfolio effects.'
  ]};
}
function wilderAtr(bars,n){
 const out=Array(bars.length).fill(null);
 let sum=0;
 for(let i=0;i<bars.length;i++){
  const b=bars[i],prev=i?bars[i-1].close:b.close;
  const tr=Math.max(b.high-b.low,Math.abs(b.high-prev),Math.abs(b.low-prev));
  if(i<n){sum+=tr;if(i===n-1)out[i]=sum/n;}
  else out[i]=(out[i-1]*(n-1)+tr)/n;
 }
 return out;
}
function phasePortfolio({bars,atr,command,from,to,policy,friction}){
 const initial=policy.initialCapital;
 let equity=initial,peak=initial,maxDD=0,pos=null;
 const trades=[],stats={
  acceptedCommands:0,reversals:0,flatExits:0,sameSideIgnored:0,
  noAtrOrUnsafeStop:0,closedByStop:0,closedByTarget:0,
  timeouts:0,phaseEnd:0,stopTargetCollision:0,
  entryCount:0,markedBars:0
 };
 const close=(base,index,reason,collision=false)=>{
  const p=pos,direction=p.side;
  const exit=base*(1-direction*friction.slippageRate);
  const feeExit=p.qty*exit*friction.feeRate;
  const pnl=direction*p.qty*(exit-p.entry)-p.entryFee-feeExit;
  equity+=pnl;
  const trade={side:direction===1?'long':'short',
   entryTime:bars[p.entryIndex].time,exitTime:bars[index].time,
   entryPrice:r(p.entry),exitPrice:r(exit),qty:r(p.qty),
   initialStop:r(p.stop),target:r(p.target),
   entryFee:r(p.entryFee),exitFee:r(feeExit),netPnl:r(pnl),
   exitReason:reason,stopTargetCollision:collision,
   exitAtPhaseClose:reason==='phase_end_close'};
  trades.push(trade);pos=null;
  if(reason==='stop')stats.closedByStop++;
  if(reason==='target')stats.closedByTarget++;
  if(reason==='timeout_next_open')stats.timeouts++;
  if(reason==='phase_end_close')stats.phaseEnd++;
  if(collision)stats.stopTargetCollision++;
  return trade;
 };
 for(let i=from;i<to;i++){
  const b=bars[i];
  const commandSide=i>from?command.get(bars[i-1].time):undefined;
  // Timeout closes first at next bar open. Then this bar may accept a
  // fresh independently-confirmed signal from the previous candle.
  if(pos&&i-pos.entryIndex>=policy.maxHoldBars)
    close(b.open,i,'timeout_next_open');
  if(commandSide!==undefined){
   stats.acceptedCommands++;
   const side=commandSide==='long'?1:commandSide==='short'?-1:0;
   if(pos&&pos.side!==side){
    if(side===0)stats.flatExits++;
    else stats.reversals++;
    close(b.open,i,'vector_signal');
   }else if(pos&&pos.side===side)stats.sameSideIgnored++;
   if(side!==0&&!pos&&equity>0){
    const a=atr[i-1],entry=b.open*(1+side*friction.slippageRate);
    const dist=policy.stopAtrMultiple*a;
    const stop=entry-side*dist,target=entry+
      side*policy.targetRMultiple*dist;
    if(!Number.isFinite(a)||a<=0||stop<=0||target<=0){
     stats.noAtrOrUnsafeStop++;
    }else{
     // Risk budget includes estimated round-trip friction at stop,
     // but adverse price gaps can STILL exceed this nominal amount.
     const maxRiskLoss=dist+entry*friction.feeRate+
       Math.max(stop,0)*(friction.feeRate+friction.slippageRate);
     const qty=Math.min(equity*policy.riskFraction/maxRiskLoss,
       equity*policy.maxNotionalFraction/(entry*(1+friction.feeRate)));
     if(qty>0&&Number.isFinite(qty)){
      pos={side,entry,stop,target,qty,entryFee:qty*entry*friction.feeRate,
       entryIndex:i};
      stats.entryCount++;
     }
    }
   }
  }
  if(pos){
   const side=pos.side;
   const beyondStop=side===1?b.open<=pos.stop:b.open>=pos.stop;
   const beyondTarget=side===1?b.open>=pos.target:b.open<=pos.target;
   const hitStop=side===1?b.low<=pos.stop:b.high>=pos.stop;
   const hitTarget=side===1?b.high>=pos.target:b.low<=pos.target;
   if(beyondStop)close(b.open,i,'stop');
   else if(beyondTarget)close(pos.target,i,'target');
   else if(hitStop&&hitTarget)close(pos.stop,i,'stop',true);
   else if(hitStop)close(pos.stop,i,'stop');
   else if(hitTarget)close(pos.target,i,'target');
  }
  if(i===to-1&&pos)close(b.close,i,'phase_end_close');
  // Conservative close-based, after hypothetical exit fees, marked equity.
  // Not an intrabar/worst-tick DD or a proof of liquidation safety.
  const mark=pos?equity+pos.side*pos.qty*(b.close-pos.entry)-
    pos.entryFee-pos.qty*b.close*friction.feeRate:equity;
  peak=Math.max(peak,mark);
  if(peak>0)maxDD=Math.max(maxDD,(peak-mark)/peak);
  stats.markedBars++;
 }
 const wins=trades.filter(t=>t.netPnl>0).length;
 return {tradeCount:trades.length,winRatePct:trades.length?r(wins/trades.length*100):null,
  initialCapital:initial,finalCapital:r(equity),
  netProfit:r(equity-initial),returnPct:r((equity/initial-1)*100),
  closeMarkedMaxDrawdownPct:r(maxDD*100),
  stats,firstBarUtc:new Date(bars[from].time).toISOString(),
  endExclusiveUtc:new Date(bars[to-1].time+ (bars[1].time-bars[0].time)).toISOString(),
  riskModelOnly:true,trades};
}
export function runIntegratedVectorRiskStudy({
 bars,market,historyWindow,commandsByVariant,policy=VETO_TRADE_POLICY,
 strategyIds=INTEGRATED_RECOVERY_LOCK.strategyIds
}={}){
 validatePolicy(policy);
 const isCipher=JSON.stringify(strategyIds)===JSON.stringify(INTEGRATED_CIPHER_CONFIRM1_IDS);
 const intervals=isCipher?{'15m':900000,'1h':3600000,'4h':14400000}:{'1h':3600000};
 const intervalMs=Object.hasOwn(intervals,market?.timeframe)?intervals[market.timeframe]:null;
 if(market?.exchange!=='Bitunix'||market?.priceType!=='LAST_PRICE'||
    !intervalMs||!INTEGRATED_RECOVERY_LOCK.symbols.includes(market?.symbol)||
    !historyWindow||!Array.isArray(bars)||bars.length!==960)
  throw Error('Only verified 960-closed-bar BTC/HYPE/PEPE pilot at a supported interval allowed');
 const clean=requireCleanHistory(classifyHistory(bars,historyWindow));
 if(clean.length!==960||historyWindow.intervalMs!==intervalMs||
    !verifiedIds(strategyIds)||!commandsByVariant||
    Object.keys(commandsByVariant).length!==strategyIds.length||
    !strategyIds.every(id=>Object.hasOwn(commandsByVariant,id)))
  throw Error('Unverified history or invalid fixed integrated strategy variants');
 const atr=wilderAtr(clean,policy.atrPeriod);
 const commands=Object.fromEntries(strategyIds.map(id=>
  [id,requireSignals(commandsByVariant[id],clean)]));
 const split=Math.floor(clean.length*policy.splitFraction);
 if(split<policy.atrPeriod+policy.maxHoldBars+2||
    clean.length-split<policy.maxHoldBars+2)
  throw Error('Insufficient independent split bars');
 const scenarios={};
 for(const [costName,friction] of Object.entries(policy.costCases)){
  scenarios[costName]={};
  for(const id of strategyIds){
   const command=commands[id];
   scenarios[costName][id]={
    training:phasePortfolio({bars:clean,atr,command,from:0,to:split,policy,friction}),
    holdout:phasePortfolio({bars:clean,atr,command,from:split,to:clean.length,policy,friction})
   };
  }
 }
 return {
  protocol:strategyIds===INTEGRATED_RECOVERY_LOCK.strategyIds||
   JSON.stringify(strategyIds)===JSON.stringify(INTEGRATED_RECOVERY_LOCK.strategyIds)?
   'CJ_INTEGRATED_RISK_VECTOR_DAILY_RECOVERY_V1':
   JSON.stringify(strategyIds)===JSON.stringify(INTEGRATED_CIPHER_CONFIRM1_IDS)?
   'CJ_INTEGRATED_RISK_CIPHER_CONFIRM1_V1':'CJ_INTEGRATED_RISK_MOMENTUM_VECTOR_V1',
  strategies:[...strategyIds],
  status:'SIMULATED_ONE_POSITION_PORTFOLIO_ONLY',
  market,historyWindow,
  splitAtUtc:new Date(clean[split].time).toISOString(),
  entryTiming:'NEXT_CANDLE_OPEN_AFTER_CONFIRMED_SIGNAL',
  stopTargetResolution:'GAP_OPEN_FIRST_THEN_STOP_FIRST_ON_COLLISION',
  policy:{atrPeriod:policy.atrPeriod,stopAtrMultiple:policy.stopAtrMultiple,
   targetRMultiple:policy.targetRMultiple,maxHoldBars:policy.maxHoldBars,
   riskFraction:policy.riskFraction,maxNotionalFraction:policy.maxNotionalFraction,
   initialCapital:policy.initialCapital,costCases:policy.costCases},
  scenarios,ordersPlaced:false,indicatorCodeChanged:false,
  promotedStrategy:null,usesFutureForDecisions:false,
  warning:[
   'One integrated position per market, no leverage: all variants have identical ATR stop/target, risk sizing and phase boundaries.',
   'Returns are model-dependent and hypothetical: no spread, funding, minimum lot, market impact, mark-price stop or actual fill verification.',
   'The historical holdout is already inspected by CryptoJuju. A positive simulation cannot validate future profitability.',
   'Drawdown is marked on candle CLOSE and includes assumed liquidation fees; intrabar adverse risk and gap losses can be larger.',
   'Every variant uses confirmed-bar signals only. Daily recovery uses closed 1H EMA; Momentum experiment uses its own closed-bar oscillator/EMA readings.',
   'No real orders, no automatic strategy promotion, no TradingView parity or public-site changes.'
  ]
 };
}
