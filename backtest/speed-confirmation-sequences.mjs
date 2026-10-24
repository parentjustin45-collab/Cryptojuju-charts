/* Closed-candle MID -> HIGH confirmations; entry only AFTER HIGH closes.
   Same clean window, no future selection, no overlapping entries in a sequence.
   Fixed horizon close-to-close directional outcome is research, not PnL. */
import {classifySpeedCandleV3} from './speed-candle-v3.mjs';
export function studySpeedConfirmations(candles,{maxConfirmBars=5,horizons=[3,5,10],warmup=20}={}){
 if(!Array.isArray(candles)||!Number.isSafeInteger(maxConfirmBars)||maxConfirmBars<1||!Number.isSafeInteger(warmup)||warmup<20||!Array.isArray(horizons)||horizons.some(h=>!Number.isSafeInteger(h)||h<1))throw Error('Invalid confirmation study settings');
 const colors=classifySpeedCandleV3(candles);
 const output={bull:{mid:0,confirmed:0,unconfirmed:0,byHorizon:{}},bear:{mid:0,confirmed:0,unconfirmed:0,byHorizon:{}}};
 for(const dir of ['bull','bear'])for(const h of horizons)output[dir].byHorizon[h]={pairs:0,wins:0,sumSignedPct:0};
 const events=[];
 for(let i=warmup-1;i<candles.length;i++){
  const type=colors[i].color;
  const dir=type==='bullMid'?'bull':type==='bearMid'?'bear':null;
  if(!dir)continue;
  const out=output[dir];out.mid++;
  const high=dir==='bull'?'bullHigh':'bearHigh';
  let confirmation=-1;
  for(let j=i+1;j<=Math.min(i+maxConfirmBars,candles.length-1);j++){
   if(colors[j].color===high){confirmation=j;break;}
  }
  if(confirmation<0){out.unconfirmed++;continue;}
  out.confirmed++;
  const time=Number(candles[confirmation].time);
  events.push({direction:dir,midTime:Number(candles[i].time),confirmationTime:time,delayBars:confirmation-i,entryRule:'next-bar-open'});
  for(const h of horizons){
   // Entry on the next bar OPEN, exit at close h bars after confirmation.
   if(confirmation+1>=candles.length||confirmation+h>=candles.length)continue;
   const entry=Number(candles[confirmation+1].open),exit=Number(candles[confirmation+h].close);
   const signed=(exit/entry-1)*(dir==='bull'?1:-1)*100;
   const metric=out.byHorizon[h];metric.pairs++;if(signed>0)metric.wins++;metric.sumSignedPct+=signed;
  }
 }
 for(const v of Object.values(output)){
  v.confirmationRatePct=v.mid?100*v.confirmed/v.mid:null;
  for(const m of Object.values(v.byHorizon)){
   m.winRatePct=m.pairs?100*m.wins/m.pairs:null;
   m.meanSignedPct=m.pairs?m.sumSignedPct/m.pairs:null;
  }
 }
 return {byDirection:output,events,warning:'Descriptive only: MID then same-direction HIGH within 5 closed bars. Outcome starts at next bar open, excludes fees/slippage; repeated/overlapping sequences are not independent. No claim of predictive edge.'};
}
