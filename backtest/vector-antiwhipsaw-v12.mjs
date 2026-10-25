/* Research-only V1.2 anti-whipsaw candidates. Never modifies Pine V1.1.
   Delayed entries use only closed candles; baseline mirrors Vector AIT V1.1.
   Evaluation: next-bar-open, fixed risk, training selection, untouched holdout. */
import {vectorAIT} from './vector-ait-v1.mjs';
import {simulateVectorExitTrade,VECTOR_EXIT_CONFIGS} from './vector-exit-selection.mjs';

export const VECTOR_CONFIRMATION_MODES=Object.freeze([
 {id:'baseline_v11',label:'Original V1.1',window:0},
 {id:'follow_close_1',label:'Next close exceeds Vector close',window:1},
 {id:'break_extreme_2',label:'Close breaks Vector high/low within 2 bars',window:2},
]);
const EXIT=VECTOR_EXIT_CONFIGS.find(x=>x.id==='fixed_1_5_3_12');
const newBucket=()=>({signals:0,trades:0,wins:0,sumNetPct:0,censored:0,
 censoredSplit:0,censoredWindow:0,delayedSignals:0,sumDelayBars:0,
 reversalPairs:0,rapidReversals:0,sumReversalBars:0,boundaryExcluded:0});
const directionOf=side=>side==='long'?1:side==='short'?-1:0;
const vectorSide=v=>v?.bullishVector?'long':v?.bearishVector?'short':null;
function contiguity(bars){
 if(!Array.isArray(bars)||bars.length<22)return false;
 const step=Number(bars[1].time)-Number(bars[0].time);
 if(!Number.isSafeInteger(step)||step<=0)return false;
 return bars.every((x,i)=>i===0||Number(x.time)-Number(bars[i-1].time)===step);
}
function confirmedBy(bar,pending,mode){
 const close=Number(bar.close);
 if(mode==='follow_close_1')return pending.side==='long'?close>pending.close:close<pending.close;
 if(mode==='break_extreme_2')return pending.side==='long'?close>pending.high:close<pending.low;
 throw Error('Unknown confirmation mode');
}
/** Causal state machine. Raw Vector flags refer only to the same finished candle.
    A pending candidate is discarded when an opposite Vector candle appears.
    A failed confirmation cannot be used retrospectively. */
export function applyVectorConfirmation(candles,rawVector,mode='baseline_v11'){
 if(!Array.isArray(candles)||!Array.isArray(rawVector)||candles.length!==rawVector.length)
  throw Error('Aligned candles and Vector observations required');
 const cfg=VECTOR_CONFIRMATION_MODES.find(x=>x.id===mode);
 if(!cfg)throw Error('Unknown Vector confirmation mode');
 const out=[],diagnostics={candidates:0,confirmed:0,expired:0,cancelledOpposite:0,pendingAtEnd:0};
 let state=0,pending=null;
 for(let i=0;i<candles.length;i++){
  const raw=rawVector[i],vSide=vectorSide(raw);
  let signal=null,sourceIndex=null,delayBars=null;
  if(mode==='baseline_v11'){
   signal=raw?.signal??null;state=raw?.direction??state;
   if(signal){sourceIndex=i;delayBars=0;diagnostics.candidates++;diagnostics.confirmed++;}
  }else{
   let processed=false;
   if(pending){
    const age=i-pending.index;
    if(vSide&&vSide!==pending.side){
     diagnostics.cancelledOpposite++;pending=null;
    }else if(age>=1&&age<=cfg.window&&confirmedBy(candles[i],pending,mode)){
     signal=pending.side;sourceIndex=pending.index;delayBars=age;
     state=directionOf(signal);pending=null;diagnostics.confirmed++;processed=true;
    }else if(age>=cfg.window){diagnostics.expired++;pending=null;}
   }
   if(!pending&&!processed&&vSide&&directionOf(vSide)!==state){
    const bar=candles[i];
    pending={side:vSide,index:i,close:Number(bar.close),high:Number(bar.high),low:Number(bar.low)};
    diagnostics.candidates++;
   }
  }
  out.push({time:Number(candles[i].time),signal,direction:state,sourceIndex,delayBars});
 }
 diagnostics.pendingAtEnd=pending?1:0;
 return {events:out,diagnostics,mode};
}

function countReversals(bars,events,side,cutoff,flipBars,out){
 const flips=events.flatMap((x,i)=>i<bars.length-1&&x.signal?[i]:[]);
 for(let j=1;j<flips.length;j++){
  const a=flips[j-1],b=flips[j];
  if(events[b].signal!==side||events[a].signal===side)continue;
  const pa=Number(bars[a+1].time)<cutoff?'train':'test';
  const pb=Number(bars[b+1].time)<cutoff?'train':'test';
  if(pa!==pb)continue;
  const item=out[pb];item.reversalPairs++;item.sumReversalBars+=b-a;
  if(b-a<=flipBars)item.rapidReversals++;
 }
}
function evaluate(bars,events,side,cutoff,fee,slip,flipBars){
 const out={train:newBucket(),test:newBucket()};
 countReversals(bars,events,side,cutoff,flipBars,out);
 let occupied=-1;
 for(let i=0;i<bars.length-1;i++){
  const event=events[i];
  if(event.signal!==side)continue;
  const partition=Number(bars[i+1].time)<cutoff?'train':'test';
  const bucket=out[partition];
  // Avoid a confirmation initiated in training becoming a new test trade.
  if(partition==='test'&&event.sourceIndex!==null&&Number(bars[event.sourceIndex].time)<cutoff){
   bucket.boundaryExcluded++;continue;
  }
  if(i+1<=occupied)continue;
  bucket.signals++;
  if(event.delayBars>0){bucket.delayedSignals++;bucket.sumDelayBars+=event.delayBars;}
  const r=simulateVectorExitTrade(bars,events,i,side,EXIT,{cutoffTime:cutoff,feeRate:fee,slippageRate:slip});
  if(r.status==='closed'){
   bucket.trades++;bucket.wins+=Number(r.netPct>0);bucket.sumNetPct+=r.netPct;
   occupied=r.exitIndex;
  }else{
   bucket.censored++;
   if(r.censorReason==='split_boundary')bucket.censoredSplit++;
   else bucket.censoredWindow++;
   occupied=bars.length-1;
   if(partition==='train'){
    const split=bars.findIndex(b=>Number(b.time)>=cutoff);
    if(split>=0)occupied=split-1;
   }
  }
 }
 return out;
}
function combine(dst,src){
 for(const field of Object.keys(dst))dst[field]+=src[field];
}
function finalize(b){
 b.winRatePct=b.trades?100*b.wins/b.trades:null;
 b.meanNetPct=b.trades?b.sumNetPct/b.trades:null;
 b.rapidReversalPct=b.reversalPairs?100*b.rapidReversals/b.reversalPairs:null;
 b.meanReversalBars=b.reversalPairs?b.sumReversalBars/b.reversalPairs:null;
 b.meanDelayBars=b.delayedSignals?b.sumDelayBars/b.delayedSignals:null;
 return b;
}
export function studyVectorAntiWhipsaw(windows,{
 cutoffTime,feeRate=0.0006,slippageRate=0,stressSlippageRate=0.0005,
 minTrainTrades=30,minTestTrades=30,rapidReversalBars=3
}={}){
 if(!Number.isFinite(cutoffTime)||!Array.isArray(windows)
   ||![feeRate,slippageRate,stressSlippageRate].every(x=>Number.isFinite(x)&&x>=0&&x<1)
   ||![minTrainTrades,minTestTrades,rapidReversalBars].every(x=>Number.isSafeInteger(x)&&x>=1))
  throw Error('Invalid Vector research configuration');
 const bySide=Object.fromEntries(['long','short'].map(side=>[side,{candidates:Object.fromEntries(
  VECTOR_CONFIRMATION_MODES.map(mode=>[mode.id,{
   train:newBucket(),test:newBucket(),stress:{train:newBucket(),test:newBucket()},
   counts:{candidates:0,confirmed:0,expired:0,cancelledOpposite:0,pendingAtEnd:0},
  }]))}]));
 const diagnostics={windows:windows.length,usableWindows:0,excludedShort:0,rejectedGaps:0,minTrainTrades,minTestTrades};
 for(const w of windows){
  const bars=w.candles??w;
  if(!Array.isArray(bars)||bars.length<22){diagnostics.excludedShort++;continue;}
  if(!contiguity(bars)){diagnostics.rejectedGaps++;continue;}
  diagnostics.usableWindows++;
  const raw=vectorAIT(bars);
  for(const mode of VECTOR_CONFIRMATION_MODES){
   const variant=applyVectorConfirmation(bars,raw,mode.id);
   for(const side of ['long','short']){
    const candidate=bySide[side].candidates[mode.id];
    const base=evaluate(bars,variant.events,side,cutoffTime,feeRate,slippageRate,rapidReversalBars);
    const stress=evaluate(bars,variant.events,side,cutoffTime,feeRate,stressSlippageRate,rapidReversalBars);
    for(const split of ['train','test']){
     combine(candidate[split],base[split]);combine(candidate.stress[split],stress[split]);
    }
    // Variant counts describe all directions; share across side reports for context.
    combine(candidate.counts,variant.diagnostics);
   }
  }
 }
 for(const side of ['long','short']){
  const item=bySide[side];
  for(const c of Object.values(item.candidates)){
   finalize(c.train);finalize(c.test);finalize(c.stress.train);finalize(c.stress.test);
  }
  const eligible=VECTOR_CONFIRMATION_MODES.filter(x=>item.candidates[x.id].train.trades>=minTrainTrades);
  eligible.sort((a,b)=>item.candidates[b.id].train.meanNetPct-item.candidates[a.id].train.meanNetPct
   ||Number(b.id==='baseline_v11')-Number(a.id==='baseline_v11'));
  item.selectedOnTrain=eligible[0]?.id??null;
  const chosen=item.selectedOnTrain?item.candidates[item.selectedOnTrain]:null;
  const baseline=item.candidates.baseline_v11;
  const sufficient=Boolean(chosen&&chosen.test.trades>=minTestTrades&&baseline.test.trades>=minTestTrades);
  item.holdout={
   status:!chosen?'insufficient_train_trades':!sufficient?'insufficient_test_trades':
    item.selectedOnTrain==='baseline_v11'?'baseline_selected':'candidate_for_review',
   selected:item.selectedOnTrain,
   selectedTrades:chosen?.test.trades??0,baselineTrades:baseline.test.trades,
   selectedNetPct:chosen?.test.meanNetPct??null,baselineNetPct:baseline.test.meanNetPct,
   deltaNetPp:sufficient?chosen.test.meanNetPct-baseline.test.meanNetPct:null,
   stressSelectedNetPct:sufficient?chosen.stress.test.meanNetPct:null,
   preliminaryPass:Boolean(sufficient&&item.selectedOnTrain!=='baseline_v11'
    &&chosen.test.meanNetPct>baseline.test.meanNetPct
    &&chosen.test.meanNetPct>0&&chosen.stress.test.meanNetPct>0),
  };
 }
 return {bySide,diagnostics,modes:VECTOR_CONFIRMATION_MODES,
  assumptions:{cutoffTime,feeRate,slippageRate,stressSlippageRate,
   benchmark:'Vector AIT V1.1, four confirmations, unchanged signals',
   variation:'Signal acceptance after a completed subsequent candle; no change to raw Vector detection',
   entry:'next bar open after confirmation',exit:EXIT.id,
   stopTakeSameBar:'stop-first',minTrainTrades,minTestTrades,
   selection:'one candidate selected on chronological training only; compare identical choice on held-out test with slippage',
   incompleteTrades:'censored at missing-data and split boundaries, never treated as profit',
   whipsaw:'opposite emitted signals within '+rapidReversalBars+' bars; not proof of a false signal',
   warning:'Experimental only. Rejected/incomplete trades can bias averages. No intrabar ordering, correlated samples or TradingView Pine parity guarantee. No automatic release.'}};
}
