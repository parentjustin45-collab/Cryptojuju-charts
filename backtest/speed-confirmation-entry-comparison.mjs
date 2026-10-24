/* Compare MID entry vs waiting for its HIGH confirmation on identical
   confirmed sequences and identical exit timestamps. Also report all MID
   signals separately to expose confirmation selection bias.
   Next-bar OPEN entry; fixed exit at CLOSE; 0.06% each side, slippage optional.
   Independent hypothetical trades, NOT portfolio equity or compounded PnL. */
import {classifySpeedCandleV3} from './speed-candle-v3.mjs';
export function compareSpeedConfirmationEntries(candles,{maxConfirmBars=5,horizons=[3,5,10],warmup=20,feeRate=0.0006,slippageRate=0}={}){
 if(!Array.isArray(candles)||!Number.isSafeInteger(maxConfirmBars)||maxConfirmBars<1||!Number.isSafeInteger(warmup)||warmup<20||!Array.isArray(horizons)||!horizons.length||horizons.some(h=>!Number.isSafeInteger(h)||h<1)||![feeRate,slippageRate].every(x=>Number.isFinite(x)&&x>=0&&x<1))throw Error('Invalid confirmation comparison');
 const colors=classifySpeedCandleV3(candles),result={bull:{midSignals:0,confirmed:0,unconfirmed:0,byHorizon:{}},bear:{midSignals:0,confirmed:0,unconfirmed:0,byHorizon:{}}};
 for(const dir of ['bull','bear'])for(const h of horizons)result[dir].byHorizon[h]={matched:0,midWins:0,confirmedWins:0,midSumPct:0,confirmedSumPct:0,allMidCount:0,allMidWins:0,allMidSumPct:0};
 const net=(entryIndex,exitIndex,dir)=>{
  const side=dir==='bull'?1:-1;
  const entry=Number(candles[entryIndex].open)*(1+side*slippageRate);
  const exit=Number(candles[exitIndex].close)*(1-side*slippageRate);
  // Unit notional at entry; include entry and exit commissions.
  return 100*(side*(exit-entry)/entry-feeRate*(1+exit/entry));
 };
 for(let i=warmup-1;i<candles.length;i++){
  const dir=colors[i].color==='bullMid'?'bull':colors[i].color==='bearMid'?'bear':null;
  if(!dir)continue;
  const out=result[dir];out.midSignals++;
  const high=dir==='bull'?'bullHigh':'bearHigh';
  let confirm=-1;
  for(let j=i+1;j<=Math.min(i+maxConfirmBars,candles.length-1);j++)if(colors[j].color===high){confirm=j;break;}
  if(confirm<0)out.unconfirmed++;else out.confirmed++;
  for(const h of horizons){
   const m=out.byHorizon[h];
   if(i+h<candles.length){
    const value=net(i+1,i+h,dir);m.allMidCount++;m.allMidSumPct+=value;if(value>0)m.allMidWins++;
   }
   if(confirm<0||confirm+h>=candles.length)continue;
   // Same exit at confirm+h: isolates entry delay; both use same historical sequence.
   const mid=net(i+1,confirm+h,dir),wait=net(confirm+1,confirm+h,dir);
   m.matched++;m.midSumPct+=mid;m.confirmedSumPct+=wait;
   if(mid>0)m.midWins++;if(wait>0)m.confirmedWins++;
  }
 }
 for(const out of Object.values(result))for(const m of Object.values(out.byHorizon)){
  m.midWinRatePct=m.matched?100*m.midWins/m.matched:null;
  m.confirmedWinRatePct=m.matched?100*m.confirmedWins/m.matched:null;
  m.midMeanNetPct=m.matched?m.midSumPct/m.matched:null;
  m.confirmedMeanNetPct=m.matched?m.confirmedSumPct/m.matched:null;
  m.waitMinusMidPp=m.matched?(m.confirmedSumPct-m.midSumPct)/m.matched:null;
  m.allMidWinRatePct=m.allMidCount?100*m.allMidWins/m.allMidCount:null;
  m.allMidMeanNetPct=m.allMidCount?m.allMidSumPct/m.allMidCount:null;
 }
 return {byDirection:result,assumptions:{entry:'next-bar-open',exit:'close at confirmation + horizon',feeRate,slippageRate,capital:'independent unit-notional trades'},warning:'Research only. Confirmed-subset comparisons condition on a future confirmation; all-MID cohort is separately reported. Overlapping sequences are correlated; no portfolio simulation or statistical significance implied.'};
}
