/* Vector V1.5 RESEARCH candidate: structure-hold plus independently confirmed
   follow-through reversal. V1.4 reference and all prospective locks stay intact.
   Every signal is based on COMPLETED bars. Entries are available next open only.
*/
import {vectorAIT} from './vector-ait-v1.mjs';
import {vectorAtr,VECTOR_V14_LOCK} from './vector-v14-hysteresis.mjs';
export const V15_LOCK=Object.freeze({
 protocol:'vector-v15-two-closed-bar-recovery-exploratory-v1',
 lookbackStructure:4,lookbackImpulse:2,atrLength:14,
 structureBufferAtr:0.05,impulseBodyAtr:1.25,
 pendingBars:3,minBarsAfterFlip:3,
 followThroughMinAgeBars:2,followThroughMaxAgeBars:3,
 previousProgressAtr:0.15,followThroughProgressAtr:0.45,
 note:'One added causal two-closed-bar continuation path compared with V1.4. FROZEN BEFORE historical comparison; qualitative user screenshots are not holdout.'
});
const sideOf=v=>v?.bullishVector?'long':v?.bearishVector?'short':null;
const dir=side=>side==='long'?1:side==='short'?-1:0;
function levelBroken(bars,i,side,lookback,buffer){
 if(i<lookback)return false;
 const history=bars.slice(i-lookback,i);
 const high=Math.max(...history.map(x=>Number(x.high)));
 const low=Math.min(...history.map(x=>Number(x.low)));
 return side==='long'?Number(bars[i].close)>high+buffer:
  Number(bars[i].close)<low-buffer;
}
function acceptance(bars,atr,i,candidate,lastFlip,cfg){
 if(atr[i]===null||!Number.isFinite(atr[i]))return null;
 const side=candidate.side,s=dir(side),now=bars[i],age=i-candidate.index;
 const impulse=Math.abs(Number(now.close)-Number(now.open))>=cfg.impulseBodyAtr*atr[i]&&
  levelBroken(bars,i,side,cfg.lookbackImpulse,0);
 if(impulse)return 'impulse_reversal';
 if(levelBroken(bars,i,side,cfg.lookbackStructure,cfg.structureBufferAtr*atr[i])&&
    i-lastFlip>=cfg.minBarsAfterFlip)return 'structure_break';
 // Exactly one *new* optional idea compared to V1.4: sustained two-bar
 // directional close progress from the source Vector candle, with both
 // consecutive completed bars aligned. No future price, no repainting.
 if(age>=cfg.followThroughMinAgeBars&&age<=cfg.followThroughMaxAgeBars &&
    i>=2 && i-lastFlip>=cfg.minBarsAfterFlip){
  const base=Number(bars[candidate.index].close);
  const prev=Number(bars[i-1].close),close=Number(now.close);
  if(s*(prev-base)>=cfg.previousProgressAtr*atr[i] &&
     s*(close-base)>=cfg.followThroughProgressAtr*atr[i] &&
     s*(close-prev)>0 &&
     s*(prev-Number(bars[i-2].close))>0)
     return 'two_close_follow_through';
 }
 return null;
}
export function applyVectorV15(candles,{rawVector=null,config=V15_LOCK}={}){
 if(!Array.isArray(candles)||candles.length<2)throw Error('Need candles');
 const step=Number(candles[1].time)-Number(candles[0].time);
 if(!Number.isSafeInteger(step)||step<=0||candles.some((b,i)=>!Number.isSafeInteger(Number(b.time))||
   (i>0&&Number(b.time)-Number(candles[i-1].time)!==step)))
  throw Error('Discontinuous V1.5 candles');
 const raw=rawVector??vectorAIT(candles);
 if(raw.length!==candles.length)throw Error('Mismatched Vector output');
 const atr=vectorAtr(candles,config.atrLength);
 const audit={vectorCandidates:0,accepted:0,initial:0,
  impulse:0,structure:0,followThrough:0,expired:0,cancelled:0,
  acceptedEvents:[],pendingAtEnd:0};
 const events=[];let state=0,pending=null,lastFlip=-Infinity;
 for(let i=0;i<candles.length;i++){
  const vec=sideOf(raw[i]);let signal=null,sourceIndex=null,why=null;
  if(vec&&dir(vec)!==state){
   if(!pending){pending={side:vec,index:i};audit.vectorCandidates++;}
   else if(pending.side!==vec){audit.cancelled++;pending={side:vec,index:i};audit.vectorCandidates++;}
  }
  if(pending&&dir(pending.side)===state)pending=null;
  if(pending){
   const age=i-pending.index;
   if(age>config.pendingBars){pending=null;audit.expired++;}
   else{
    const accepted=state===0?'initial':acceptance(candles,atr,i,pending,lastFlip,config);
    if(accepted){
     const old=state;signal=pending.side;sourceIndex=pending.index;why=accepted;
     state=dir(signal);if(old!==0)lastFlip=i;
     audit.accepted++;audit[accepted==='initial'?'initial':
      accepted==='impulse_reversal'?'impulse':
      accepted==='structure_break'?'structure':'followThrough']++;
     audit.acceptedEvents.push({time:Number(candles[i].time),side:signal,
      sourceTime:Number(candles[sourceIndex].time),reason:why,delayBars:i-sourceIndex});
     pending=null;
    }
   }
  }
  events.push({time:Number(candles[i].time),signal,direction:state,sourceIndex,
   delayBars:sourceIndex===null?null:i-sourceIndex,why});
 }
 audit.pendingAtEnd=Number(Boolean(pending));
 return {mode:config.protocol,events,audit,
  warning:'Independent exploratory candidate: may still retain losing trends or miss valid reversals. No auto-deployment.'};
}
