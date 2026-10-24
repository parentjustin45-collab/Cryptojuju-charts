/* CryptoJuju Charts V1.26.0 — deterministic backtest core.
   Standalone ES module. No UI or network side effects.
   Signals: [{time,side:'long'|'short'|'flat'}] computed using closed candles only.
   Orders execute at NEXT candle open; no look-ahead.
*/
export function runBacktest(candles, signals, options = {}) {
  const initialCapital = options.initialCapital ?? 100;
  const feeRate = options.feeRate ?? 0.0006;
  const slippageRate = options.slippageRate ?? 0;
  const allocation = options.allocation ?? 1;
  for (const [key,value] of Object.entries({initialCapital,feeRate,slippageRate,allocation})) {
    if (!Number.isFinite(value) || value < 0) throw new Error('Invalid '+key);
  }
  if (initialCapital <= 0 || allocation > 1 || feeRate >= 1 || slippageRate >= 1) throw new Error('Invalid configuration');
  if (!Array.isArray(candles) || !Array.isArray(signals)) throw new Error('Candles and signals must be arrays');
  const bars = candles.map(c => ({...c,time:Number(c.time),open:Number(c.open),high:Number(c.high),low:Number(c.low),close:Number(c.close)}));
  for (let i=0;i<bars.length;i++) {
    const c=bars[i];
    if (![c.time,c.open,c.high,c.low,c.close].every(Number.isFinite) || c.open<=0 || c.low<=0 || c.low>Math.min(c.open,c.close) || c.high<Math.max(c.open,c.close) || (i && c.time<=bars[i-1].time)) throw new Error('Invalid or unordered candle at '+i);
  }
  const byTime=new Map();
  for (const s of signals) {
    if (!['long','short','flat'].includes(s.side) || !Number.isFinite(Number(s.time)) || byTime.has(Number(s.time))) throw new Error('Invalid or duplicate signal');
    byTime.set(Number(s.time),s.side);
  }
  let equity=initialCapital, position=null, peak=equity, maxDrawdown=0;
  const trades=[], equityCurve=[];
  const exit=(bar,reason)=>{
    const price=bar.open*(1-position.side*slippageRate);
    const gross=position.qty*position.side*(price-position.entry);
    const exitFee=position.qty*price*feeRate;
    const pnl=gross-position.entryFee-exitFee;
    equity+=pnl;
    trades.push({side:position.side===1?'long':'short',entryTime:position.time,exitTime:bar.time,entry:position.entry,exit:price,quantity:position.qty,pnl,reason});
    position=null;
  };
  for(let i=0;i<bars.length;i++){
    const bar=bars[i];
    // The signal on bar i-1 is actionable only at the open of bar i.
    const command=i>0?byTime.get(bars[i-1].time):undefined;
    const target=command==='long'?1:command==='short'?-1:command==='flat'?0:null;
    if(target!==null){
      if(position && position.side!==target) exit(bar,'signal');
      if(target!==0 && !position && equity>0){
        const entry=bar.open*(1+target*slippageRate);
        const budget=equity*allocation;
        const qty=budget/(entry*(1+feeRate));
        position={side:target,entry,qty,entryFee:qty*entry*feeRate,time:bar.time};
      }
    }
    const mark=position?position.qty*position.side*(bar.close-position.entry)-position.entryFee-position.qty*bar.close*feeRate:0;
    const markedEquity=equity+mark;
    peak=Math.max(peak,markedEquity);
    if(peak>0) maxDrawdown=Math.max(maxDrawdown,(peak-markedEquity)/peak);
    equityCurve.push({time:bar.time,equity:markedEquity});
  }
  // Close at final close for a fully realized report (no next-open assumption).
  if(position){
    const last=bars[bars.length-1];
    const final={...last,open:last.close};
    exit(final,'end_of_data');
    equityCurve[equityCurve.length-1].equity=equity;
  }
  const wins=trades.filter(t=>t.pnl>0);
  return {initialCapital,finalCapital:equity,netProfit:equity-initialCapital,returnPct:(equity/initialCapital-1)*100,tradeCount:trades.length,winRate:trades.length?wins.length/trades.length*100:0,maxDrawdownPct:maxDrawdown*100,trades,equityCurve,assumptions:{feeRate,slippageRate,allocation,execution:'next-bar-open',finalExit:'last-close'}};
}
