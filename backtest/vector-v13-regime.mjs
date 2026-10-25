/* Vector AIT V1.3: auditable research-only trend-regime gates.
 * Raw V1.1 observations and V1.2 break_extreme_2 confirmations are UNCHANGED.
 * Only completed bars, symmetric LONG/SHORT tests, no Pine/prod write.
 */
import {vectorAIT} from './vector-ait-v1.mjs';
import {applyVectorConfirmation} from './vector-antiwhipsaw-v12.mjs';
import {lastCompletedContext} from './vector-lower-tf-diagnostic.mjs';

export const VECTOR_V13_MODES=Object.freeze([
 'baseline_v11','break_extreme_2','v13_ema50_slope',
 'v13_ema_stack','v13_ema_stack_4h'
]);
export const VECTOR_V13_EMA=Object.freeze({fast:21,medium:34,slow:50,slopeBars:3});
const isGood=n=>typeof n==='number'&&Number.isFinite(n);
export function calculateEmaSeries(candles,length){
 if(!Number.isSafeInteger(length)||length<2||!Array.isArray(candles))throw Error('Invalid EMA inputs');
 const arr=Array(candles.length).fill(null),k=2/(length+1);
 let total=0,ema=null;
 for(let i=0;i<candles.length;i++){
  const price=Number(candles[i]?.close);
  if(!isGood(price)||price<=0)throw Error('Invalid close in EMA');
  if(i<length){total+=price;if(i===length-1)ema=total/length;}
  else ema=k*price+(1-k)*ema;
  if(i>=length-1)arr[i]=ema;
 }
 return arr;
}
export function vectorRegimeFeatures(candles){
 const f=calculateEmaSeries(candles,21),m=calculateEmaSeries(candles,34),
  s=calculateEmaSeries(candles,50);
 return candles.map((bar,i)=>{
  const price=Number(bar.close),slope=i>=3&&s[i]!==null&&s[i-3]!==null?
   100*(s[i]/s[i-3]-1):null;
  return {time:Number(bar.time),close:price,ema21:f[i],ema34:m[i],ema50:s[i],
   ema50SlopePct:slope,
   regime:slope===null?'unknown':price<f[i]&&f[i]<m[i]&&m[i]<s[i]&&slope<0?
    'bear_stack':price>f[i]&&f[i]>m[i]&&m[i]>s[i]&&slope>0?'bull_stack':'mixed'};
 });
}
function gate(features,side,mode,ctx4h,entryTime){
 const dir=side==='short'?-1:1;
 const e=features,valid=e&&[e.ema21,e.ema34,e.ema50,e.ema50SlopePct].every(isGood);
 if(!valid)return {accept:false,reason:'ema_warmup'};
 const slopeOk=dir*e.ema50SlopePct>0;
 const levelOk=dir*(e.close-e.ema50)>0;
 const fastOk=dir*(e.ema21-e.ema50)>0;
 if(!slopeOk||!levelOk||!fastOk)return {accept:false,reason:'ema50_slope_or_price'};
 if(mode==='v13_ema50_slope')return {accept:true,reason:'accepted'};
 const stack=dir*(e.ema21-e.ema34)>0&&dir*(e.ema34-e.ema50)>0;
 const closeFast=dir*(e.close-e.ema21)>0;
 if(!stack||!closeFast)return {accept:false,reason:'ema_stack_not_aligned'};
 if(mode==='v13_ema_stack')return {accept:true,reason:'accepted'};
 const expected=side==='short'?'bear':'bull';
 const observed=lastCompletedContext(ctx4h,entryTime);
 return observed===expected?{accept:true,reason:'accepted'}:
  {accept:false,reason:observed===null?'4h_context_missing':'4h_not_aligned'};
}
export function applyVectorV13(candles,{mode='v13_ema50_slope',context4h=null,rawVector=null}={}){
 if(!VECTOR_V13_MODES.includes(mode)||!Array.isArray(candles))throw Error('Unknown Vector research mode');
 const raw=rawVector??vectorAIT(candles);
 if(raw.length!==candles.length)throw Error('Unaligned Vector data');
 const original=applyVectorConfirmation(candles,raw,
  mode==='baseline_v11'?'baseline_v11':'break_extreme_2');
 const events=original.events.map(e=>({...e}));
 const features=vectorRegimeFeatures(candles);
 const audit={mode,candidates:0,accepted:0,rejected:0,byReason:{},bySide:{
  long:{candidates:0,accepted:0,rejected:0},short:{candidates:0,accepted:0,rejected:0}
 }};
 for(let i=0;i<events.length;i++){
  const event=events[i];if(!event.signal)continue;
  const side=event.signal;
  audit.candidates++;audit.bySide[side].candidates++;
  let result={accept:true,reason:'accepted'};
  if(mode.startsWith('v13_')){
   if(i+1>=candles.length)result={accept:false,reason:'no_next_open'};
   else result=gate(features[i],side,mode,context4h,Number(candles[i+1].time));
  }
  audit.byReason[result.reason]=(audit.byReason[result.reason]??0)+1;
  if(result.accept){audit.accepted++;audit.bySide[side].accepted++;}
  else {event.signal=null;audit.rejected++;audit.bySide[side].rejected++;}
 }
 return {mode,events,features,audit,confirmationDiagnostics:original.diagnostics,
  warning:'Trend regime and 4H tests are candidate gates, NOT probabilities. V1.1 and V1.2 detection source unchanged.'};
}
