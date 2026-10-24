import {classifySpeedCandleV3} from './speed-candle-v3.mjs';

// Single-position, closed-bar signal strategy; exits and entries at next open.
// The optional protective stop is evaluated intrabar; no take-profit or pyramiding.
export function backtestSpeedOppositeHigh(candles,{entry='high',stopPercent=1.5,maxBars=120,fee=0.0006,slippage=0.0005,capital=100,allocation=0.5}={}){
 if(!['high','mid'].includes(entry)||!Array.isArray(candles)||![stopPercent,maxBars,fee,slippage,capital,allocation].every(Number.isFinite)||stopPercent<=0||!Number.isSafeInteger(maxBars)||maxBars<1||fee<0||fee>=1||slippage<0||slippage>=1||capital<=0||allocation<=0||allocation>1)throw Error('Invalid strategy parameters');
 const colors=classifySpeedCandleV3(candles),trades=[];let equity=capital,position=null,peak=capital,maxDrawdown=0;
 for(let i=0;i<candles.length;i++){
  const b=candles[i],open=Number(b.open),low=Number(b.low),high=Number(b.high),close=Number(b.close);
  const prev=i>0?colors[i-1].color:null;
  const opposite=position&&(position.side===1?prev==='bearHigh':prev==='bullHigh');
  const exit=(price,reason)=>{
   const p=position,fill=price*(1-p.side*slippage),pnl=p.qty*p.side*(fill-p.entry)-p.entryFee-p.qty*fill*fee;
   equity+=pnl;trades.push({side:p.side===1?'long':'short',entryTime:Number(candles[p.start].time),exitTime:Number(b.time),entry:p.entry,exit:fill,pnl,reason});position=null;
  };
  // Exit on next open after opposite HIGH. Do not reverse on the same bar.
  let exited=false;
  if(opposite){exit(open,'opposite_high');exited=true;}
  if(!position&&!exited&&i>0&&equity>0){
   const side=entry==='high'?(prev==='bullHigh'?1:prev==='bearHigh'?-1:0):(prev==='bullMid'?1:prev==='bearMid'?-1:0);
   if(side){const fill=open*(1+side*slippage),qty=equity*allocation/(fill*(1+fee));position={side,entry:fill,qty,entryFee:qty*fill*fee,start:i};}
  }
  if(position){
   const p=position,stop=p.entry*(1-p.side*stopPercent/100);
   const gap=p.side===1?open<=stop:open>=stop,hit=p.side===1?low<=stop:high>=stop;
   if(gap){exit(open,'stop_gap');exited=true;}
   else if(hit){exit(stop,'stop');exited=true;}
   else if(i-p.start+1>=maxBars){exit(close,'max_bars');exited=true;}
   else if(i===candles.length-1){exit(close,'end_of_data');exited=true;}
  }
  const mark=position?position.qty*position.side*(close-position.entry)-position.entryFee-position.qty*close*fee:0;
  const marked=equity+mark;peak=Math.max(peak,marked);if(peak>0)maxDrawdown=Math.max(maxDrawdown,(peak-marked)/peak);
 }
 return {entry,initialCapital:capital,finalCapital:equity,returnPercent:100*(equity/capital-1),tradeCount:trades.length,winRatePercent:trades.length?100*trades.filter(t=>t.pnl>0).length/trades.length:null,maxDrawdownPercent:100*maxDrawdown,trades,assumptions:{fee,slippage,allocation,stopPercent,maxBars,signalExecution:'next-open',noSameBarReversal:true,onePosition:true,stopGapAtOpen:true},warning:'Research only; isolated clean historical windows, no intrabar sequencing or funding modeled.'};
}
