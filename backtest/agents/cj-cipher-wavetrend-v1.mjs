/*
 * CJ Cipher - WaveTrend Cross V1.0, faithful close-bar-only research port
 * of the user's Pine Script v6 supplied in conversation, 2026-11-19.
 *
 * NO divergences or trade signals outside WT1/WT2 CROSS events.
 * Pine: ap=hlc3; ESA=ema(ap,n1); D=ema(abs(ap-ESA),n1);
 * CI=D!=0?(ap-ESA)/(0.015*D):0; WT1=ema(CI,n2);
 * WT2=sma(WT1,smooth). Crossover is strictly previous <=, current >;
 * crossunder previous >=, current <. Timestamp = confirmed BAR OPEN.
 *
 * Input must contain only completed bars. A Pine confirmClose=false alert
 * may fire intrabar and retract; historical OHLC CANNOT reproduce it.
 * This port deliberately DOES NOT infer intrabar crossings.
 *
 * Source parity with Pine/TradingView is NOT independently established.
 * No trades, alert routing, production changes or fetches.
 */
export const CJ_CIPHER_WT_V1_DEFAULTS=Object.freeze({
  channelLength:10,averageLength:21,signalSmoothing:4,
  overbought1:60,overbought2:53,oversold1:-60,oversold2:-53,
  confirmClose:true,showDots:true,showDelta:true
});
const finite=x=>typeof x==='number'&&Number.isFinite(x);
function checkParams(p){
 for(const k of ['channelLength','averageLength','signalSmoothing'])
  if(!Number.isSafeInteger(p[k])||p[k]<1||p[k]>500)
   throw Error('Invalid CJ Cipher WaveTrend length '+k);
 for(const k of ['overbought1','overbought2','oversold1','oversold2'])
  if(!Number.isSafeInteger(p[k]))throw Error('Invalid CJ Cipher reference level '+k);
 for(const k of ['confirmClose','showDots','showDelta'])
  if(typeof p[k]!=='boolean')throw Error('Invalid CJ Cipher boolean input '+k);
}
function requireClosedCandles(candles){
 if(!Array.isArray(candles)||!candles.length)throw Error('Closed OHLC array required');
 let prev=-Infinity;
 for(const [i,c] of candles.entries()){
  if(!Number.isSafeInteger(c?.time)||c.time<=prev||
     ![c.open,c.high,c.low,c.close].every(finite)||
     c.open<=0||c.close<=0||c.low<=0||
     c.high<Math.max(c.open,c.close)||c.low>Math.min(c.open,c.close))
   throw Error('Invalid or unordered closed OHLC at '+i);
  prev=c.time;
 }
}
// Pine ta.ema() starts with the first non-na input, not an SMA seed.
function emaPine(source,n){
 const out=new Array(source.length).fill(null),alpha=2/(n+1);
 let prior=null;
 for(let i=0;i<source.length;i++){
  if(!finite(source[i]))continue;
  prior=prior===null?source[i]:alpha*source[i]+(1-alpha)*prior;
  out[i]=prior;
 }
 return out;
}
// Pine ta.sma() skips na values. Signal path is finite after first WT1.
function smaPine(source,n){
 const out=new Array(source.length).fill(null),buf=[];
 let sum=0;
 for(let i=0;i<source.length;i++){
  if(finite(source[i])){
   buf.push(source[i]);sum+=source[i];
   if(buf.length>n)sum-=buf.shift();
  }
  if(buf.length===n)out[i]=sum/n;
 }
 return out;
}
export function calculateCjCipherWaveTrend(candles,overrides={}){
 if(!overrides||typeof overrides!=='object'||Array.isArray(overrides))
  throw Error('Invalid CJ Cipher settings');
 const params={...CJ_CIPHER_WT_V1_DEFAULTS,...overrides};
 for(const key of Object.keys(overrides))
  if(!Object.hasOwn(CJ_CIPHER_WT_V1_DEFAULTS,key))
   throw Error('Unknown CJ Cipher input '+key);
 checkParams(params);
 requireClosedCandles(candles);
 const hlc3=candles.map(c=>(c.high+c.low+c.close)/3);
 const esa=emaPine(hlc3,params.channelLength);
 const deviation=emaPine(hlc3.map((ap,i)=>Math.abs(ap-esa[i])),
   params.channelLength);
 const ci=hlc3.map((ap,i)=>deviation[i]!==0?
   (ap-esa[i])/(0.015*deviation[i]):0);
 const wt1=emaPine(ci,params.averageLength);
 const wt2=smaPine(wt1,params.signalSmoothing);
 return candles.map((bar,i)=>{
  const previous=i>0?wt1[i-1]:null,prev2=i>0?wt2[i-1]:null;
  const ready=[wt1[i],wt2[i],previous,prev2].every(finite);
  const crossUp=ready&&wt1[i]>wt2[i]&&previous<=prev2;
  const crossDown=ready&&wt1[i]<wt2[i]&&previous>=prev2;
  // All supplied bars are fully closed. confirmClose=false is only
  // equivalent to historical Pine close snapshots, NOT intrabar alerts.
  const bullSignal=crossUp,bearSignal=crossDown;
  const difference=wt2[i]===null?null:wt1[i]-wt2[i];
  return {
   time:bar.time,barIndex:i,hlc3:hlc3[i],
   esa:esa[i],deviation:deviation[i],ci:ci[i],
   wt1:wt1[i],wt2:wt2[i],waveDifference:difference,
   displayWaveDifference:params.showDelta?difference:null,
   dotValue:params.showDots&&(bullSignal||bearSignal)?wt2[i]:null,
   dotColor:params.showDots&&(bullSignal||bearSignal)?
      (bullSignal?'lime':'red'):null,
   crossUp,crossDown,bullSignal,bearSignal,
   signal:bullSignal?'long':bearSignal?'short':null,
   confirmedAtClose:true,
   historicalIntrabarAlertsNotReconstructed:!params.confirmClose,
   levels:{
     ob1:params.overbought1,ob2:params.overbought2,
     os1:params.oversold1,os2:params.oversold2,zero:0
   }
  };
 });
}
export function cjCipherConfirmedCommands(rows){
 if(!Array.isArray(rows))throw Error('Missing CJ Cipher values');
 const out=[],seen=new Set();
 for(let i=0;i<rows.length-1;i++){
  const x=rows[i];
  if(!Number.isSafeInteger(x?.time)||seen.has(x.time))
   throw Error('Duplicate or invalid CJ Cipher output time');
  seen.add(x.time);
  if(x.signal==='long'||x.signal==='short')
   out.push({time:x.time,side:x.signal});
 }
 return out;
}
