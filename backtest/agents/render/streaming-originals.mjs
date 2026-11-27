/* Streaming original-indicator research, closed bars only.
 * Exact arithmetic/order from pinned original JS ports; no candidate promotion.
 * State is bounded across arbitrary input pages. Events are confirmation-time.
 */
import {createHash} from 'node:crypto';
export const VERSION='CJ_STREAM_ORIGINALS_V1_20261127';
export const CHANNELS=['vector','momentum','speed','cipher','frank_cross','frank_divergence'];
const valid=x=>typeof x==='number'&&Number.isFinite(x);
const need=(x,m)=>{if(!x)throw Error(m)};
const push=(a,x,n)=>{a.push(x);if(a.length>n)a.shift();return a;};
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const ema=(s,k,x,n)=>{if(!valid(x))return null;const a=2/(n+1);return s[k]=valid(s[k])?a*x+(1-a)*s[k]:x;};
function rsi(s,close,prev,i,n,flat){
 if(!i)return null;
 const d=close-prev,g=Math.max(0,d),l=Math.max(0,-d);
 if(i<=n){s.g+=g;s.l+=l;if(i<n)return null;s.g/=n;s.l/=n;}
 else{s.g=(s.g*(n-1)+g)/n;s.l=(s.l*(n-1)+l)/n;}
 return s.l===0?(flat&&s.g===0?50:100):flat&&s.g===0?0:100-100/(1+s.g/s.l);
}
function sma(s,x,n,skip){
 if(!skip||valid(x)){s.q.push(x);if(valid(x))s.sum+=x;if(s.q.length>n){let y=s.q.shift();if(valid(y))s.sum-=y;}}
 return s.q.length===n&&s.q.every(valid)?s.sum/n:null;
}
const sm=()=>({q:[],sum:0});
function stoch(a,flat){if(!a.every(valid))return null;const lo=Math.min(...a),hi=Math.max(...a);return hi===lo?flat?50:null:100*(a.at(-1)-lo)/(hi-lo);}
const evt=(time,side,tag)=>({time,side,tag});
export function createStreamingReplay({priceStep,intervalMs}){
 need(valid(priceStep)&&priceStep>0&&Number.isSafeInteger(intervalMs)&&intervalMs>0,'BAD_CONFIG');
 let i=0,prev=null;
 const v={tr:[],vol:[],spread:[],atr:null,dir:0,entry:null};
 const m={r:{g:0,l:0},rsi:[],mom:[],st:sm(),prior:null};
 const c={sma:sm(),prev1:null,prev2:null};
 const f={r:{g:0,l:0},rsi:[],k:sm(),d:sm(),prior:null,priorK:null,piv:[],lows:[],highs:[]};
 const history=[];
 const counts=Object.fromEntries(CHANNELS.map(k=>[k,0]));
 const hashes=Object.fromEntries(CHANNELS.map(k=>[k,createHash('sha256')]));
 let sealed=false;
 function consume(b){
  need(!sealed,'REPLAY_ALREADY_FINISHED');
  const {time,open:o,high:h,low:l,close:cl,volume:vol}=b;
  need(Number.isSafeInteger(time)&&time>0&&time%intervalMs===0&&(!prev||time===prev.time+intervalMs)&&[o,h,l,cl,vol].every(valid)&&Math.min(o,l,cl)>0&&h>=Math.max(o,cl)&&l<=Math.min(o,cl)&&vol>=0,'BAD_OR_NONCONTIGUOUS_BAR');
  const events=Object.fromEntries(CHANNELS.map(k=>[k,[]]));
  const emit=(k,side,tag)=>events[k].push(evt(time,side,tag));
  // Vector: exact rolling sum order, Wilder ATR, alternating position state.
  const range=Math.max(h-l,priceStep),pc=prev?.close??cl,tr=Math.max(h-l,Math.abs(h-pc),Math.abs(l-pc));
  push(v.tr,tr,14);push(v.vol,vol,20);push(v.spread,vol*range,20);
  if(i===13)v.atr=mean(v.tr);else if(i>=14)v.atr=(v.atr*13+tr)/14;
  const av=i>=19?mean(v.vol):null,as=i>=19?mean(v.spread):null;
  const common=Number(av>0&&vol/av>=1.5)+Number(as>0&&vol*range/as>=1.5)+Number(Math.abs(cl-o)/range>=.6)+Number(v.atr!==null&&range>=v.atr*.8);
  const bull=cl>o&&common+Number((cl-l)/range>=.7)>=4,bear=cl<o&&common+Number((h-cl)/range>=.7)>=4;
  let vs=null,exit=null,closedTradeReturnPct=null;
  if(bull&&v.dir!==1){if(v.dir===-1){exit='short';closedTradeReturnPct=100*(v.entry-cl)/v.entry;}v.dir=1;v.entry=cl;vs='long';}
  else if(bear&&v.dir!==-1){if(v.dir===1){exit='long';closedTradeReturnPct=100*(cl-v.entry)/v.entry;}v.dir=-1;v.entry=cl;vs='short';}
  if(vs)emit('vector',vs,'vector_v11');
  // SPEED uses last twenty candles, exact original floor of one volume unit.
  push(history,b,20);
  const avgVol=i>=19?history.reduce((s,x)=>s+x.volume,0)/20:vol;
  const avgRange=i>=19?history.reduce((s,x)=>s+(x.high-x.low),0)/20:range;
  const volumePercent=vol/Math.max(avgVol,1)*100,speedPercent=range/Math.max(avgRange,priceStep)*100;
  const level=volumePercent>=200?'High':volumePercent>=150?'Mid':null,side=cl>o?'bull':cl<o?'bear':null,color=level&&side?side+level:null;
  if(color)emit('speed',side==='bull'?'long':'short',color);
  // Momentum original signal channel; divergence display is NOT a baseline event.
  const mr=rsi(m.r,cl,pc,i,14,true);push(m.rsi,mr,14);
  const ms=sma(m.st,m.rsi.length===14?stoch(m.rsi,false):null,3,true);
  const mm=i>=10?cl-history[history.length-11].close:null;push(m.mom,mm,100);
  const rank=m.mom.length===100&&m.mom.every(valid)?100*m.mom.reduce((n,x)=>n+Number(x<=mm),0)/100:null;
  const raw=[mr,ms,rank].every(valid)?(mr+ms+rank)/3:null;
  const comp=ema(m,'comp',raw,3),mf=ema(m,'ef',cl,21),ml=ema(m,'es',cl,55);
  const mup=valid(comp)&&valid(m.prior)&&m.prior<=30&&comp>30,mdn=valid(comp)&&valid(m.prior)&&m.prior>=70&&comp<70;
  if(mup&&mf>ml)emit('momentum','long','momentum_fusion');
  if(mdn&&mf<ml)emit('momentum','short','momentum_fusion');
  m.prior=comp;
  // Cipher: exact recursive EMA and rolling SMA state.
  const ap=(h+l+cl)/3,esa=ema(c,'esa',ap,10),dev=ema(c,'dev',Math.abs(ap-esa),10),ci=dev!==0?(ap-esa)/(.015*dev):0;
  const wt1=ema(c,'wt1',ci,21),wt2=sma(c.sma,wt1,4,true);
  const ready=[wt1,wt2,c.prev1,c.prev2].every(valid),cu=ready&&wt1>wt2&&c.prev1<=c.prev2,cd=ready&&wt1<wt2&&c.prev1>=c.prev2;
  if(cu||cd)emit('cipher',cu?'long':'short','cj_cipher_wt');
  c.prev1=wt1;c.prev2=wt2;
  // Frank: distinct RSI flat convention, SMA of consecutive valid values.
  const fr=rsi(f.r,cl,pc,i,10,false);push(f.rsi,fr,10);
  const fs=f.rsi.length===10?stoch(f.rsi,true):null,k=sma(f.k,fs,2,false),d=sma(f.d,k,2,false);
  const fm=i>=6?100*(cl-history[history.length-7].close)/history[history.length-7].close:null;
  const fraw=[fr,k,d,fm].every(valid)?(fr+k+d)/3+fm:null,trend=ema(f,'trend',fraw,2),slow=ema(f,'slow',trend,12),ef=ema(f,'ef',cl,8),es=ema(f,'es',cl,21);
  if(valid(trend)&&valid(f.prior)){
   const buy=(trend>22&&f.prior<=22)||(trend<18&&trend>f.prior&&valid(k)&&valid(f.priorK)&&k>f.priorK);
   const sell=(trend<76&&f.prior>=76)||(trend>82&&trend<f.prior&&valid(k)&&valid(f.priorK)&&k<f.priorK);
   if(buy&&ef>es)emit('frank_cross','long','frank_cross_webapp');
   if(sell&&ef<es)emit('frank_cross','short','frank_cross_webapp');
  }
  f.prior=trend;f.priorK=k;push(f.piv,{time,low:l,high:h,osc:trend},5);
  if(f.piv.length===5){const cur=f.piv[2];
   for(const [field,side,arr] of [['low','long',f.lows],['high','short',f.highs]]){
    const low=field==='low';if(!f.piv.every((x,j)=>j===2||(low?x[field]>cur[field]:x[field]<cur[field])))continue;
    for(const p of arr.slice(-2)){
     if(!valid(cur.osc)||!valid(p.osc))continue;
     const reg=low?cur.low<p.price&&cur.osc>p.osc:cur.high>p.price&&cur.osc<p.osc;
     const hid=low?cur.low>p.price&&cur.osc<p.osc:cur.high<p.price&&cur.osc>p.osc;
     if(reg||hid){emit('frank_divergence',side,(reg?'R':'H')+(low?'+':'-'));break;}
    }
    push(arr,{price:cur[field],osc:cur.osc},10);
   }
  }
  prev={time,close:cl};i++;
  for(const ch of CHANNELS)for(const e of events[ch]){counts[ch]++;hashes[ch].update(JSON.stringify(e)+'\n');}
  return {events,vector:{time,bullishVector:bull,bearishVector:bear,signal:vs,exit,direction:v.dir,closedTradeReturnPct},speed:{time,color,volumePercent,speedPercent,closed:true},momentum:{rsi:mr,stochRsi:ms,momentumRank:rank,composite:comp,emaFast:mf,emaSlow:ml},cipher:{hlc3:ap,esa,deviation:dev,ci,wt1,wt2},frank:{oscillator:trend,slow,k,d}};
 }
 return {consume,consumePage(bars,onRow){need(Array.isArray(bars),'BAD_PAGE');for(const b of bars){const out=consume(b);onRow?.(out,b);}},finish(){need(!sealed&&i>0,'EMPTY_OR_FINISHED');sealed=true;return {version:VERSION,bars:i,lastTime:prev.time,counts:{...counts},eventSha256:Object.fromEntries(CHANNELS.map(k=>[k,hashes[k].digest('hex')])),stateWindowSizes:{price:history.length,vector:v.vol.length,momentum:m.mom.length,frankPivots:f.lows.length+f.highs.length},noTrading:true};}};
}
