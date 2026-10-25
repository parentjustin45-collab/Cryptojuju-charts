// Vector Always In Trade V1.1: closed candle research port.
export function vectorAIT(candles,p={}){
 const cfg={volumeLength:20,spreadLength:20,atrLength:14,volumeMultiplier:1.5,spreadMultiplier:1.5,atrMultiplier:0.8,minimumBodyRatio:0.6,minimumCloseStrength:0.7,minimumConfirmations:4,minTick:1e-8,...p};
 let atr=null,dir=0,entry=null;const tr=[],vol=[],spread=[],out=[];
 for(let i=0;i<candles.length;i++){
  const c=candles[i],o=Number(c.open),h=Number(c.high),l=Number(c.low),close=Number(c.close),v=Number(c.volume??0);
  if(![o,h,l,close,v].every(Number.isFinite)||o<=0||l<=0||l>Math.min(o,close)||h<Math.max(o,close)||v<0)throw Error('Invalid OHLC');
  const range=Math.max(h-l,cfg.minTick),t=Math.max(h-l,Math.abs(h-(i?Number(candles[i-1].close):close)),Math.abs(l-(i?Number(candles[i-1].close):close)));
  tr.push(t);vol.push(v);spread.push(v*range);
  const mean=(a,n)=>i>=n-1?a.slice(i-n+1).reduce((s,x)=>s+x,0)/n:null;
  if(i===cfg.atrLength-1)atr=mean(tr,cfg.atrLength);
  else if(i>=cfg.atrLength)atr=(atr*(cfg.atrLength-1)+t)/cfg.atrLength;
  const av=mean(vol,cfg.volumeLength),as=mean(spread,cfg.spreadLength);
  const common=Number(av>0&&v/av>=cfg.volumeMultiplier)+Number(as>0&&v*range/as>=cfg.spreadMultiplier)+Number(Math.abs(close-o)/range>=cfg.minimumBodyRatio)+Number(atr!==null&&range>=atr*cfg.atrMultiplier);
  const bull=close>o&&common+Number((close-l)/range>=cfg.minimumCloseStrength)>=cfg.minimumConfirmations;
  const bear=close<o&&common+Number((h-close)/range>=cfg.minimumCloseStrength)>=cfg.minimumConfirmations;
  let signal=null,exit=null,closedTradeReturnPct=null;
  if(bull&&dir!==1){if(dir===-1){exit='short';closedTradeReturnPct=100*(entry-close)/entry;}dir=1;entry=close;signal='long';}
  else if(bear&&dir!==-1){if(dir===1){exit='long';closedTradeReturnPct=100*(close-entry)/entry;}dir=-1;entry=close;signal='short';}
  out.push({time:Number(c.time),bullishVector:bull,bearishVector:bear,signal,exit,direction:dir,closedTradeReturnPct});
 }
 return out;
}
