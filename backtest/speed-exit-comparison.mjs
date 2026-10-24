import {classifySpeedCandleV3} from './speed-candle-v3.mjs';

// Controlled comparison: same entry logic, risk, fees, and candle stream.
// Opposite HIGH exits at next open; intrabar stop wins ambiguous TP/SL touches.
export function compareSpeedExits(candles,{entry='mid',side='both',mode='hybrid',capital=100,allocation=0.5,fee=0.0006,slippage=0.0005,stopPercent=1.5,targetPercent=3,maxBars=120}={}){
 if(!Array.isArray(candles)||!['mid','high'].includes(entry)||!['long','short','both'].includes(side)||!['fixed','opposite','hybrid'].includes(mode)||![capital,allocation,fee,slippage,stopPercent,targetPercent].every(Number.isFinite)||capital<=0||allocation<=0||allocation>1||fee<0||fee>=1||slippage<0||slippage>=1||stopPercent<=0||targetPercent<=0||!Number.isSafeInteger(maxBars)||maxBars<1)throw Error('Invalid comparison parameters');
 const colors=classifySpeedCandleV3(candles),trades=[];let equity=capital,position=null,peak=capital,maxDrawdown=0;
 const hasTarget=mode!=='opposite',hasOpposite=mode!=='fixed';
 for(let i=0;i<candles.length;i++){
  const b=candles[i],o=Number(b.open),h=Number(b.high),l=Number(b.low),c=Number(b.close),prev=i?colors[i-1].color:null;
  const exit=(price,reason)=>{
   const p=position,fill=price*(1-p.side*slippage),pnl=p.qty*p.side*(fill-p.entry)-p.entryFee-p.qty*fill*fee;
   equity+=pnl;trades.push({side:p.side===1?'long':'short',entryTime:Number(candles[p.start].time),exitTime:Number(b.time),pnl,reason});position=null;
  };
  let exited=false;
  if(position&&hasOpposite&&(position.side===1?prev==='bearHigh':prev==='bullHigh')){exit(o,'opposite_high');exited=true;}
  if(!position&&!exited&&i>0&&equity>0){
   const s=prev===(entry==='mid'?'bullMid':'bullHigh')?1:prev===(entry==='mid'?'bearMid':'bearHigh')?-1:0;
   if(s&&(side==='both'||side===(s===1?'long':'short'))){const fill=o*(1+s*slippage),qty=equity*allocation/(fill*(1+fee));position={side:s,entry:fill,qty,entryFee:qty*fill*fee,start:i};}
  }
  if(position){
   const p=position,stop=p.entry*(1-p.side*stopPercent/100),target=p.entry*(1+p.side*targetPercent/100);
   const stopGap=p.side===1?o<=stop:o>=stop,targetGap=p.side===1?o>=target:o<=target;
   const stopHit=p.side===1?l<=stop:h>=stop,targetHit=p.side===1?h>=target:l<=target;
   if(stopGap)exit(o,'stop_gap');
   else if(hasTarget&&targetGap)exit(o,'target_gap');
   else if(stopHit)exit(stop,'stop');
   else if(hasTarget&&targetHit)exit(target,'target');
   else if(i-p.start+1>=maxBars)exit(c,'max_bars');
   else if(i===candles.length-1)exit(c,'end_of_data');
  }
  const marked=equity+(position?position.qty*position.side*(c-position.entry)-position.entryFee-position.qty*c*fee:0);
  peak=Math.max(peak,marked);if(peak>0)maxDrawdown=Math.max(maxDrawdown,(peak-marked)/peak);
 }
 return {entry,side,mode,returnPercent:100*(equity/capital-1),tradeCount:trades.length,winRatePercent:trades.length?100*trades.filter(t=>t.pnl>0).length/trades.length:null,maxDrawdownPercent:100*maxDrawdown,trades,assumptions:{capital,allocation,fee,slippage,stopPercent,targetPercent,maxBars,signalExecution:'next-open',stopFirst:true,noSameBarReversal:true},warning:'Research only: clean continuous windows, forced end exits, no funding or order-book model.'};
}
