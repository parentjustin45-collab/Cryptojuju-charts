/* Momentum Fusion Pine v6 close-bar-only RESEARCH PORT.
 * Source supplied by user 2026-10-26. Never places orders or changes Vector.
 * Model must be validated against actual TradingView exports before parity claim.
 * Divergences are emitted at CONFIRMATION bar (pivotRight later), not backdated.
 */
export const MOMFUSION_DEFAULTS=Object.freeze({
 rsiLen:14,stochLen:14,stochSmooth:3,momLen:10,momNormLen:100,
 smoothLen:3,wRsi:1,wStoch:1,wMom:1,obLevel:70,osLevel:30,
 extremeHigh:90,extremeLow:10,useEmaFilter:true,emaFastLen:21,
 emaSlowLen:55,showDivergences:true,pivotLeft:5,pivotRight:5,
 maxPivotLookback:60,alertsOn:true
});
const valid=x=>typeof x==='number'&&Number.isFinite(x);
function checkParams(p){
 for(const k of ['rsiLen','stochLen','stochSmooth','momLen','momNormLen','smoothLen',
  'emaFastLen','emaSlowLen','pivotLeft','pivotRight','maxPivotLookback']){
  if(!Number.isSafeInteger(p[k])||p[k]<1)throw Error('Invalid length: '+k);
 }
 if(p.momNormLen<10||p.maxPivotLookback<5)throw Error('Invalid minimum length');
 for(const k of ['wRsi','wStoch','wMom']){
  if(!valid(p[k])||p[k]<0)throw Error('Invalid nonnegative weight '+k);
 }
 if(!Number.isFinite(p.obLevel)||!Number.isFinite(p.osLevel)||
    !Number.isFinite(p.extremeHigh)||!Number.isFinite(p.extremeLow))
    throw Error('Invalid oscillator zones');
 if(!(p.osLevel<=p.obLevel&&p.extremeLow<=p.osLevel&&
  p.obLevel<=p.extremeHigh))throw Error('Non-ordered zone thresholds');
}
function emaArray(src,n){
 const out=new Array(src.length).fill(null),alpha=2/(n+1);
 let last=null;
 for(let i=0;i<src.length;i++){
  if(!valid(src[i]))continue;
  last=last===null?src[i]:alpha*src[i]+(1-alpha)*last;
  out[i]=last;
 }
 return out;
}
function smaArray(src,n){
 // Pine ta.sma(source,length) counts the most recent LENGTH NON-na
 // observations. In Stoch RSI, zero-range bars can yield na values;
 // never let one unavailable stochastic reading discard later valid SMA.
 const out=new Array(src.length).fill(null),window=[];
 let sum=0;
 for(let i=0;i<src.length;i++){
  if(valid(src[i])){
   window.push(src[i]);sum+=src[i];
   if(window.length>n)sum-=window.shift();
  }
  if(window.length===n)out[i]=sum/n;
 }
 return out;
}
function rsiArray(close,n){
 const out=new Array(close.length).fill(null);
 if(close.length<=n)return out;
 let up=0,down=0;
 for(let j=1;j<=n;j++){
  const delta=close[j]-close[j-1];
  up+=Math.max(0,delta);down+=Math.max(0,-delta);
 }
 up/=n;down/=n;
 const calc=()=>down===0?(up===0?50:100):up===0?0:100-100/(1+up/down);
 out[n]=calc();
 for(let i=n+1;i<close.length;i++){
  const delta=close[i]-close[i-1];
  up=(up*(n-1)+Math.max(delta,0))/n;
  down=(down*(n-1)+Math.max(-delta,0))/n;
  out[i]=calc();
 }
 return out;
}
function stochArray(src,n){
 const out=new Array(src.length).fill(null);
 for(let i=n-1;i<src.length;i++){
  let min=Infinity,max=-Infinity,ok=true;
  for(let j=i-n+1;j<=i;j++){
   if(!valid(src[j])){ok=false;break;}
   min=Math.min(min,src[j]);max=Math.max(max,src[j]);
  }
  // Zero-range ta.stoch is na, then ta.sma waits for valid values.
  if(ok&&max>min)out[i]=100*(src[i]-min)/(max-min);
 }
 return out;
}
function percentRankArray(src,n){
 const out=new Array(src.length).fill(null);
 for(let i=n-1;i<src.length;i++){
  if(!valid(src[i]))continue;
  let count=0,ok=true;
  for(let j=i-n+1;j<=i;j++){
   if(!valid(src[j])){ok=false;break;}
   count+=Number(src[j]<=src[i]); // TradingView ta.percentrank includes ties.
  }
  if(ok)out[i]=100*count/n;
 }
 return out;
}
/* Candidate lies pivotRight bars BEFORE evaluation index.
 * Prefer rightmost equal extrema: newer equal extrema prevent older pivot.
 * This is an explicit tie policy requiring crosscheck with TV examples.
 */
function confirmedPivot(src,i,left,right,type){
 const p=i-right;
 if(p<left||!valid(src[p]))return false;
 for(let j=p-left;j<p;j++){
  if(!valid(src[j]))return false;
  if(type==='low'?src[j]<src[p]:src[j]>src[p])return false;
 }
 for(let j=p+1;j<=i;j++){
  if(!valid(src[j]))return false;
  if(type==='low'?src[j]<=src[p]:src[j]>=src[p])return false;
 }
 return true;
}
function candleCheck(candles){
 if(!Array.isArray(candles))throw Error('Expected closed OHLC array');
 let prev=null;
 for(const b of candles){
  const {time}=b,open=Number(b.open),high=Number(b.high),
   low=Number(b.low),close=Number(b.close),volume=Number(b.volume??0);
  if(!Number.isSafeInteger(time)||time<=0||![open,high,low,close,volume].every(valid)||
    open<=0||close<=0||low<=0||high<Math.max(open,close)||
    low>Math.min(open,close)||volume<0||prev!==null&&time<=prev)
   throw Error('Invalid or unordered Bitunix OHLC (quarantine first)');
  prev=time;
 }
}
export function calculateMomentumFusion(candles,overrides={}){
 const p={...MOMFUSION_DEFAULTS,...overrides};
 checkParams(p);candleCheck(candles);
 const closes=candles.map(x=>Number(x.close));
 const rsi=rsiArray(closes,p.rsiLen),
  stoch=smaArray(stochArray(rsi,p.stochLen),p.stochSmooth);
 const momentum=closes.map((c,i)=>i>=p.momLen?c-closes[i-p.momLen]:null);
 const rank=percentRankArray(momentum,p.momNormLen);
 const total=Math.max(p.wRsi+p.wStoch+p.wMom,0.001);
 const raw=closes.map((_,i)=>
  [rsi[i],stoch[i],rank[i]].every(valid)?
  (rsi[i]*p.wRsi+stoch[i]*p.wStoch+rank[i]*p.wMom)/total:null);
 const composite=emaArray(raw,p.smoothLen),
  emaFast=emaArray(closes,p.emaFastLen),
  emaSlow=emaArray(closes,p.emaSlowLen);
 let prevLow=null,prevHigh=null,lastDivText='None';
 const out=[];
 for(let i=0;i<candles.length;i++){
  const c=composite[i],prior=i?composite[i-1]:null;
  const bullTrend=emaFast[i]>emaSlow[i],bearTrend=emaFast[i]<emaSlow[i];
  const crossUp=valid(c)&&valid(prior)&&prior<=p.osLevel&&c>p.osLevel,
   crossDown=valid(c)&&valid(prior)&&prior>=p.obLevel&&c<p.obLevel;
  const bullSignal=crossUp&&(!p.useEmaFilter||bullTrend);
  const bearSignal=crossDown&&(!p.useEmaFilter||bearTrend);
  const zone=!valid(c)?'Unavailable':c>=p.extremeHigh?'Extreme Bull':
   c>=p.obLevel?'Overbought':c<=p.extremeLow?'Extreme Bear':
   c<=p.osLevel?'Oversold':'Neutral';
  const trendText=!p.useEmaFilter?'Off':bullTrend?'Bull':bearTrend?'Bear':'Flat';
  const divergences=[];
  if(confirmedPivot(composite,i,p.pivotLeft,p.pivotRight,'low')){
   const k=i-p.pivotRight,cur={index:k,time:candles[k].time,
    osc:composite[k],price:Number(candles[k].low)};
   if(prevLow&&k-prevLow.index<=p.maxPivotLookback){
    if(cur.price<prevLow.price&&cur.osc>prevLow.osc)
     divergences.push({type:'regBull',marker:'R+',pivotIndex:k,
      pivotTime:cur.time,confirmationIndex:i,confirmationTime:candles[i].time,
      previousPivotIndex:prevLow.index,previousPivotTime:prevLow.time});
    if(cur.price>prevLow.price&&cur.osc<prevLow.osc)
     divergences.push({type:'hiddenBull',marker:'H+',pivotIndex:k,
      pivotTime:cur.time,confirmationIndex:i,confirmationTime:candles[i].time,
      previousPivotIndex:prevLow.index,previousPivotTime:prevLow.time});
   }
   prevLow=cur;
  }
  if(confirmedPivot(composite,i,p.pivotLeft,p.pivotRight,'high')){
   const k=i-p.pivotRight,cur={index:k,time:candles[k].time,
    osc:composite[k],price:Number(candles[k].high)};
   if(prevHigh&&k-prevHigh.index<=p.maxPivotLookback){
    if(cur.price>prevHigh.price&&cur.osc<prevHigh.osc)
     divergences.push({type:'regBear',marker:'R-',pivotIndex:k,
      pivotTime:cur.time,confirmationIndex:i,confirmationTime:candles[i].time,
      previousPivotIndex:prevHigh.index,previousPivotTime:prevHigh.time});
    if(cur.price<prevHigh.price&&cur.osc>prevHigh.osc)
     divergences.push({type:'hiddenBear',marker:'H-',pivotIndex:k,
      pivotTime:cur.time,confirmationIndex:i,confirmationTime:candles[i].time,
      previousPivotIndex:prevHigh.index,previousPivotTime:prevHigh.time});
   }
   prevHigh=cur;
  }
  // Match Pine's independent ifs ordering: regular bull, regular bear,
  // hidden bull, hidden bear; the last active assignment wins.
  for(const type of ['regBull','regBear','hiddenBull','hiddenBear']){
   if(divergences.some(x=>x.type===type))
    lastDivText=({regBull:'Reg Bull',regBear:'Reg Bear',
     hiddenBull:'Hid Bull',hiddenBear:'Hid Bear'})[type];
  }
  out.push({time:candles[i].time,barIndex:i,rsi:rsi[i],stochRsi:stoch[i],
   momentumRank:rank[i],composite:c,emaFast:emaFast[i],
   emaSlow:emaSlow[i],zone,trend:trendText,bullTrend,bearTrend,
   crossUpFromOS:crossUp,crossDnFromOB:crossDown,bullSignal,bearSignal,
   divergences,lastDivText,
   // Alert conditions are independent of visualization toggles.
   alerts:p.alertsOn?{bullSignal,bearSignal,
    regBull:divergences.some(x=>x.type==='regBull'),
    regBear:divergences.some(x=>x.type==='regBear'),
    hiddenBull:divergences.some(x=>x.type==='hiddenBull'),
    hiddenBear:divergences.some(x=>x.type==='hiddenBear')}:null});
 }
 return out;
}
