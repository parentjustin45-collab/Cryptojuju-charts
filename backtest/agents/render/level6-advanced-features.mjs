/* Causal fixed research features for Level 6.3. No adjustable periods,
 * thresholds, source code, future prices, or signal modifications. */
import {atr14} from './state-pivot-observer.mjs';
import {calculateCjCipherWaveTrend} from '../cj-cipher-wavetrend-v1.mjs';
export const ADVANCED_FEATURES=Object.freeze(['RSI14','EMA8_21_SPREAD','ATR14_PCT','WAVETREND_DIFFERENCE','VOLUME_RATIO20']);
export const ADVANCED_VERSION='CJ_L6_RULE_CONTRACT_V2';
const valid=b=>b&&[b.open,b.high,b.low,b.close,b.volume].every(Number.isFinite)&&b.low>0&&b.open>0&&b.close>0&&b.low<=Math.min(b.open,b.close)&&b.high>=Math.max(b.open,b.close)&&b.volume>=0;
function ema(src,n){let p=null;const a=2/(n+1);return src.map(x=>(p=p===null?x:a*x+(1-a)*p));}
function rsi(closes){
 const out=Array(closes.length).fill(null);let up=0,down=0;
 for(let i=1;i<closes.length;i++){
  const d=closes[i]-closes[i-1],u=Math.max(d,0),v=Math.max(-d,0);
  if(i<=14){up+=u/14;down+=v/14;}else{up=(up*13+u)/14;down=(down*13+v)/14;}
  if(i>=14)out[i]=down===0?(up===0?50:100):up===0?0:100-100/(1+up/down);
 }
 return out;
}
export function advancedSeries(name,bars){
 if(!ADVANCED_FEATURES.includes(name)||!Array.isArray(bars)||bars.length>14000)throw Error('RULE_FEATURE_SCOPE');
 if(!bars.length)return [];
 if(!bars.every(valid))throw Error('RULE_FEATURE_INVALID_BAR');
 const closes=bars.map(b=>b.close);
 if(name==='RSI14')return rsi(closes);
 if(name==='EMA8_21_SPREAD'){const fast=ema(closes,8),slow=ema(closes,21);return closes.map((c,i)=>i>=20?100*(fast[i]-slow[i])/c:null);}
 if(name==='ATR14_PCT')return atr14(bars).map((x,i)=>x===null?null:100*x/closes[i]);
 if(name==='WAVETREND_DIFFERENCE')return calculateCjCipherWaveTrend(bars).map((x,i)=>i>=20?x.waveDifference:null);
 const out=Array(bars.length).fill(null);let sum=0;
 for(let i=0;i<bars.length;i++){
  if(i>=20){out[i]=sum>0?bars[i].volume/(sum/20):null;sum-=bars[i-20].volume;}
  sum+=bars[i].volume;
 }
 return out;
}
export function compileAdvancedRule(r){
 // The diagnostic passes immutable full training and prefix arrays. Cache
 // only within one compiled tag, and re-evaluate a different prefix array.
 const cache=new WeakMap();
 return (bars,i,side)=>{
  if(!Array.isArray(bars)||!Number.isInteger(i)||i<1||i>=bars.length||!['long','short'].includes(side))return 'unclassified';
  let v=cache.get(bars);if(!v){v=advancedSeries(r.feature,bars);cache.set(bars,v);}
  const a=v[i],b=v[i-1];
  if(!Number.isFinite(a)||!Number.isFinite(b))return 'unclassified';
  return (r.operator==='LT_PREVIOUS'?a<b:a>b)?'tagged':'untagged';
 };
}
