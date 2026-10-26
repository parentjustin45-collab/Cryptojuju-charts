/* Vector AIT two-stage WATCH + CONFIRMED, research-only shadow overlay.
 * WATCH is NOT a LONG/SHORT trade call or order. CONFIRMED delegates byte-for-byte
 * to the immutable V1.4 state machine. All emissions happen at candle CLOSE.
 * Watch outcomes are retrospective diagnostics and must not drive the algorithm.
 */
import {vectorAIT} from './vector-ait-v1.mjs';
import {applyVectorV14,VECTOR_V14_LOCK,vectorAtr} from './vector-v14-hysteresis.mjs';
export const VECTOR_WATCH_LOCK=Object.freeze({
 id:'vector-shadow-watch-v1-20261026',
 confirmEngine:VECTOR_V14_LOCK.id,
 pendingBars:VECTOR_V14_LOCK.pendingBars,
 watchTrigger:'first closed Vector candle opposite current V1.4 confirmed direction',
 noOrder:true,noAutoFlip:true,
 note:'No new trade filter, no EMA restrictions, no look-ahead, and no alert if same-bar confirmation already exists.'
});
const sideOf=v=>v?.bullishVector?'long':v?.bearishVector?'short':null;
const dir=s=>s==='long'?1:s==='short'?-1:0;
export function applyVectorWatch(candles,{rawVector=null,v14=null}={}){
 if(!Array.isArray(candles)||candles.length<2)throw Error('Need contiguous closed candles');
 const step=Number(candles[1].time)-Number(candles[0].time);
 if(!Number.isSafeInteger(step)||step<=0||candles.some((b,i)=>
  !Number.isSafeInteger(Number(b.time))||(i&&Number(b.time)-Number(candles[i-1].time)!==step)))
  throw Error('Watch refuses missing or noncontiguous bars');
 const raw=rawVector??vectorAIT(candles);
 if(!Array.isArray(raw)||raw.length!==candles.length)throw Error('Raw Vector misaligned');
 const truth=v14??applyVectorV14(candles,{rawVector:raw});
 if(!Array.isArray(truth.events)||truth.events.length!==candles.length)
  throw Error('V1.4 reference misaligned');
 const atr=vectorAtr(candles,14),alerts=[],rows=[];
 let active=null;
 const resolve=(status,i)=>{
  if(!active)return;
  const alert=alerts[active.alertIndex];
  alert.resolution=status;
  alert.resolvedTime=i===null?null:Number(candles[i].time);
  alert.resolvedIndex=i;
  alert.leadBars=status==='confirmed'?i-alert.index:null;
  active=null;
 };
 for(let i=0;i<candles.length;i++){
  const v=truth.events[i],prior=i>0?truth.events[i-1].direction:0;
  const observed=sideOf(raw[i]);
  let watch=null,watchSource=null;
  if(active && v.signal){
   const candidate=alerts[active.alertIndex];
   // Confirm ONLY if V1.4 accepts the same source candle.
   if(v.signal===candidate.side && v.sourceIndex===candidate.index)resolve('confirmed',i);
   else resolve('superseded_by_other_confirmation',i);
  }
  if(active && observed && observed!==alerts[active.alertIndex].side){
   resolve('canceled_opposite_vector',i);
  }
  if(v.signal){
   // A genuine V1.4 signal NEVER becomes an "early" watch on the same bar.
  }else if(prior!==0&&observed&&dir(observed)!==prior&&!active){
   const b=candles[i],a=atr[i],c=Number(b.close),o=Number(b.open);
   const alert={index:i,time:Number(b.time),side:observed,
    heldDirection:prior===1?'long':'short',
    close:c,bodyAtr:a>0?Math.abs(c-o)/a:null,
    resolution:'pending',resolvedTime:null,resolvedIndex:null,
    leadBars:null};
   const idx=alerts.push(alert)-1;
   active={alertIndex:idx};watch=observed;watchSource=i;
  }
  if(active && i-alerts[active.alertIndex].index>=VECTOR_WATCH_LOCK.pendingBars){
   resolve('expired_unconfirmed',i);
  }
  rows.push({time:Number(candles[i].time),watch,watchSource,
   confirmed:v.signal??null,confirmedSource:v.sourceIndex??null,
   direction:v.direction});
 }
 if(active)resolve('censored_end',null);
 return {mode:VECTOR_WATCH_LOCK.id,rows,alerts,
  unchangedConfirmed:truth.events.every((e,i)=>e.signal===rows[i].confirmed&&e.direction===rows[i].direction),
  note:'WATCH is a non-tradable diagnostic. The underlying V1.4 direction and LONG/SHORT arrows remain untouched.'};
}
