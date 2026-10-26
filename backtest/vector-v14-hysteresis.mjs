/* Vector directional state V1.4 — RESEARCH ONLY.
   Does not alter V1.1/V1.2/V1.3, production, or the pre-registered forward studies.
   Raw Vector candles create reversal candidates; only causal structural/momentum
   evidence can change the accepted holding direction. All candles must be CLOSED.
 */
import {vectorAIT} from './vector-ait-v1.mjs';
export const VECTOR_V14_LOCK=Object.freeze({
 id:'v14_hysteresis_structure_momentum_v1',
 lookbackStructure:4,lookbackImpulse:2,atrLength:14,
 structureBufferAtr:0.05,impulseBodyAtr:1.25,
 pendingBars:3,minBarsAfterFlip:3,
 minBars:55,
 note:'Fixed research hypothesis before seeing 180d comparison. No intrabar signals, no Pine production implementation.'
});
const good=(x)=>typeof x==='number'&&Number.isFinite(x);
const sideOf=(v)=>v?.bullishVector?'long':v?.bearishVector?'short':null;
const direction=side=>side==='long'?1:side==='short'?-1:0;
export function vectorAtr(candles,len=VECTOR_V14_LOCK.atrLength){
 const arr=Array(candles.length).fill(null),tr=[];
 let atr=null;
 for(let i=0;i<candles.length;i++){
  const b=candles[i],prev=i>0?Number(candles[i-1].close):null;
  const value=Math.max(Number(b.high)-Number(b.low),
   prev===null?0:Math.abs(Number(b.high)-prev),
   prev===null?0:Math.abs(Number(b.low)-prev));
  if(!good(value)||value<0)throw Error('Invalid ATR candle');
  tr.push(value);
  if(i===len-1)atr=tr.slice(0,len).reduce((a,v)=>a+v,0)/len;
  else if(i>len-1)atr=(atr*(len-1)+value)/len;
  if(i>=len-1)arr[i]=atr;
 }
 return arr;
}
function breakout(bars,i,side,lookback,buffer){
 if(i<lookback)return false;
 const slice=bars.slice(i-lookback,i),close=Number(bars[i].close);
 const line=side==='long'?Math.max(...slice.map(x=>Number(x.high))):
  Math.min(...slice.map(x=>Number(x.low)));
 return side==='long'?close>line+buffer:close<line-buffer;
}
function rejectionCode(bars,atr,i,candidate,lastFlip,cfg){
 if(atr[i]===null||!good(atr[i]))return 'atr_warmup';
 const side=candidate.side,b=bars[i],body=Math.abs(Number(b.close)-Number(b.open));
 const early=body>=cfg.impulseBodyAtr*atr[i] &&
  breakout(bars,i,side,cfg.lookbackImpulse,0);
 const structure=breakout(bars,i,side,cfg.lookbackStructure,cfg.structureBufferAtr*atr[i]);
 if(early)return 'impulse_reversal';
 if(structure&&i-lastFlip>=cfg.minBarsAfterFlip)return 'structure_break';
 return 'structure_not_confirmed';
}
export function applyVectorV14(candles,{rawVector=null,config=VECTOR_V14_LOCK}={}){
 if(!Array.isArray(candles)||candles.length<2)throw Error('Need continuous closed candles');
 if(candles.some((b,i)=>!Number.isSafeInteger(Number(b.time))||
  (i>1&&Number(b.time)-Number(candles[i-1].time)!==
   Number(candles[1].time)-Number(candles[0].time))))
   throw Error('Vector V1.4 refuses discontinuous candles');
 const raw=rawVector??vectorAIT(candles);
 if(!Array.isArray(raw)||raw.length!==candles.length)throw Error('Raw vector must be aligned');
 const atr=vectorAtr(candles,config.atrLength);
 const events=[],audit={vectorCandidates:0,accepted:0,acceptedInitial:0,
  impulseReversals:0,structureReversals:0,expired:0,cancelledOpposite:0,
  stillPending:0,bySide:{long:0,short:0},acceptReasons:[],rejections:0};
 let state=0,pending=null,lastFlip=-Infinity;
 for(let i=0;i<candles.length;i++){
  const side=sideOf(raw[i]);let signal=null,sourceIndex=null,why=null;
  if(side&&direction(side)!==state){
   if(!pending){pending={side,index:i};audit.vectorCandidates++;}
   else if(pending.side!==side){
    audit.cancelledOpposite++;pending={side,index:i};audit.vectorCandidates++;
   }
  }
  if(pending&&direction(pending.side)===state)pending=null;
  if(pending){
   if(i-pending.index>config.pendingBars){
    audit.expired++;pending=null;
    // On the next raw vector candle a fresh pending state is allowed.
   }else{
    const decision=state===0?'initial':rejectionCode(candles,atr,i,pending,lastFlip,config);
    if(decision!=='structure_not_confirmed'&&decision!=='atr_warmup'){
     signal=pending.side;sourceIndex=pending.index;why=decision;
     const oldState=state;state=direction(signal);
     if(oldState!==0)lastFlip=i;
     audit.accepted++;audit.bySide[signal]++;
     if(decision==='initial')audit.acceptedInitial++;
     if(decision==='impulse_reversal')audit.impulseReversals++;
     if(decision==='structure_break')audit.structureReversals++;
     audit.acceptReasons.push({time:Number(candles[i].time),side:signal,
      reason:why,sourceIndex,confirmIndex:i});
     pending=null;
    }else audit.rejections++;
   }
  }
  events.push({time:Number(candles[i].time),signal,direction:state,
   sourceIndex,delayBars:sourceIndex===null?null:i-sourceIndex,why});
 }
 audit.stillPending=Number(Boolean(pending));
 return {mode:config.id,events,audit,atr,
  warning:'Preliminary structure/hysteresis candidate, not TradingView V1.1 parity or a verified reversal predictor.'};
}
