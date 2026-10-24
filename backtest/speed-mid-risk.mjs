import {classifySpeedCandleV3} from './speed-candle-v3.mjs';

// Historical research simulator. Closed MID signals enter at next open.
// Conservative stop-first when both stop and target are touched.
export function simulateSpeedMidRisk(candles,opts={}){
 const {capital=100,fee=0.0006,slippage=0.0005,allocation=0.5,stopPercent=1.5,targetPercent=3,holdBars=20,reinforce=false}=opts;
 if(!Array.isArray(candles)||![capital,fee,slippage,allocation,stopPercent,targetPercent].every(Number.isFinite)||capital<=0||fee<0||fee>=1||slippage<0||slippage>=1||allocation<=0||allocation>1||stopPercent<=0||targetPercent<=0||!Number.isInteger(holdBars)||holdBars<1)throw Error('Invalid parameters');
 const colors=classifySpeedCandleV3(candles);
 let balance=capital,position=null,peak=capital,drawdown=0;
 const trades=[];
 for(let i=0;i<candles.length;i++){
  const b=candles[i],o=Number(b.open),h=Number(b.high),l=Number(b.low),c=Number(b.close);
  const prev=i?colors[i-1].color:null;
  if(!position&&i>0&&balance>0&&(prev==='bullMid'||prev==='bearMid')){
   const side=prev==='bullMid'?1:-1,entry=o*(1+side*slippage),qty=balance*allocation/(entry*(1+fee));
   position={side,entry,qty,entryFee:qty*entry*fee,start:i,added:false};
  }else if(position&&reinforce&&!position.added&&((position.side===1&&prev==='bullHigh')||(position.side===-1&&prev==='bearHigh'))){
   // Preserve the existing stop/target basis; add at next open.
   const entry=o*(1+position.side*slippage),extra=balance*0.25/(entry*(1+fee));
   const cost=position.entry*position.qty+entry*extra;
   position.entry=cost/(position.qty+extra);
   position.qty+=extra;
   position.entryFee+=extra*entry*fee;
   position.added=true;
  }
  if(position){
   const p=position,stop=p.entry*(1-p.side*stopPercent/100),target=p.entry*(1+p.side*targetPercent/100);
   const stopGap=p.side===1?o<=stop:o>=stop,goalGap=p.side===1?o>=target:o<=target;
   const stopHit=p.side===1?l<=stop:h>=stop,goalHit=p.side===1?h>=target:l<=target;
   let price=null,reason=null;
   if(stopGap){price=o;reason='stop_gap';}
   else if(goalGap){price=o;reason='target_gap';}
   else if(stopHit){price=stop;reason='stop';}
   else if(goalHit){price=target;reason='target';}
   else if(i-p.start+1>=holdBars){price=c;reason='time';}
   else if(i===candles.length-1){price=c;reason='end';}
   if(reason){
    const exit=price*(1-p.side*slippage);
    const pnl=p.qty*p.side*(exit-p.entry)-p.entryFee-p.qty*exit*fee;
    balance+=pnl;
    trades.push({entryTime:Number(candles[p.start].time),exitTime:Number(b.time),side:p.side===1?'long':'short',pnl,reason,added:p.added});
    position=null;
   }
  }
  const equity=balance+(position?position.qty*position.side*(c-position.entry)-position.entryFee-position.qty*c*fee:0);
  peak=Math.max(peak,equity);
  drawdown=Math.max(drawdown,peak>0?(peak-equity)/peak:0);
 }
 return {capital,finalCapital:balance,returnPercent:(balance/capital-1)*100,tradeCount:trades.length,winRatePercent:trades.length?100*trades.filter(t=>t.pnl>0).length/trades.length:null,maxDrawdownPercent:100*drawdown,trades,assumptions:{fee,slippage,allocation,stopPercent,targetPercent,holdBars,reinforce,entry:'next-open',stopTarget:'stop-first',singlePosition:true}};
}
