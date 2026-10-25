/* Vector AIT V1.1 exits: fixed-risk PURE, Vector opposite ONLY, and HYBRID.
   Closed-bar signal, next-bar-open fill; strict quarantine-window boundaries.
   All choices selected using chronological training data only.
   Slippage stress re-evaluates the SAME selected candidate, never re-optimizes it. */
import {vectorAIT} from './vector-ait-v1.mjs';

export const VECTOR_EXIT_CONFIGS=Object.freeze([
 {id:'fixed_1_2_12',family:'fixed',stopPct:1,takePct:2,maxBars:12},
 {id:'fixed_1_5_3_12',family:'fixed',stopPct:1.5,takePct:3,maxBars:12},
 {id:'fixed_2_4_24',family:'fixed',stopPct:2,takePct:4,maxBars:24},
 {id:'opposite_vector',family:'opposite',stopPct:null,takePct:null,maxBars:null},
 {id:'hybrid_1_2_12',family:'hybrid',stopPct:1,takePct:2,maxBars:12},
 {id:'hybrid_1_5_3_12',family:'hybrid',stopPct:1.5,takePct:3,maxBars:12},
 {id:'hybrid_2_4_24',family:'hybrid',stopPct:2,takePct:4,maxBars:24},
]);

const blank=()=>({trades:0,wins:0,sumNetPct:0,censored:0,censoredSplit:0,censoredWindow:0,
 reasons:{stop:0,take:0,opposite:0,timeout:0}});
function closeTrade({entry,rawExit,dir,feeRate,slippageRate,reason,exitIndex}){
 const exit=rawExit*(1-dir*slippageRate);
 return {status:'closed',reason,exitIndex,entry,exit,
  netPct:100*(dir*(exit-entry)/entry-feeRate*(1+exit/entry))};
}

/** One isolated signal's trade. A censored position NEVER becomes a realized P&L. */
export function simulateVectorExitTrade(bars,vector,signalIndex,side,config,{
 cutoffTime,feeRate=0.0006,slippageRate=0
}={}){
 if(!Number.isFinite(cutoffTime)||!['long','short'].includes(side))throw Error('Invalid trade parameters');
 if(!['fixed','opposite','hybrid'].includes(config?.family))throw Error('Invalid exit family');
 const dir=side==='long'?1:-1,start=signalIndex+1;
 if(start>=bars.length)return {status:'censored',censorReason:'no_next_open'};
 const partition=Number(bars[start].time)<cutoffTime?'train':'test';
 const entry=Number(bars[start].open)*(1+dir*slippageRate);
 const useFixed=config.family!=='opposite',useOpposite=config.family!=='fixed';
 const stop=useFixed?entry*(1-dir*config.stopPct/100):null;
 const take=useFixed?entry*(1+dir*config.takePct/100):null;
 const horizon=useFixed?start+config.maxBars-1:Infinity;
 const last=Math.min(bars.length-1,horizon);
 const opposite=side==='long'?'short':'long';
 for(let j=start;j<=last;j++){
  if(partition==='train'&&Number(bars[j].time)>=cutoffTime){
   return {status:'censored',partition,censorReason:'split_boundary'};
  }
  const b=bars[j],o=Number(b.open),h=Number(b.high),l=Number(b.low);
  // Gap orders are resolved at the opening price before any intrabar event.
  if(useFixed){
   if(dir===1&&o<=stop||dir===-1&&o>=stop)
    return {...closeTrade({entry,rawExit:o,dir,feeRate,slippageRate,reason:'stop',exitIndex:j}),partition};
   if(dir===1&&o>=take||dir===-1&&o<=take)
    return {...closeTrade({entry,rawExit:o,dir,feeRate,slippageRate,reason:'take',exitIndex:j}),partition};
  }
  // Opposite Vector is known only after the previous bar closes.
  if(useOpposite&&j>start&&vector[j-1]?.signal===opposite)
   return {...closeTrade({entry,rawExit:o,dir,feeRate,slippageRate,reason:'opposite',exitIndex:j}),partition};
  if(useFixed){
   // If both intrabar levels are reached, assume the stop was filled first.
   if(dir===1&&l<=stop||dir===-1&&h>=stop)
    return {...closeTrade({entry,rawExit:stop,dir,feeRate,slippageRate,reason:'stop',exitIndex:j}),partition};
   if(dir===1&&h>=take||dir===-1&&l<=take)
    return {...closeTrade({entry,rawExit:take,dir,feeRate,slippageRate,reason:'take',exitIndex:j}),partition};
  }
 }
 // Time exits are legitimate only when the COMPLETE requested horizon exists.
 if(useFixed&&horizon<bars.length&&!(partition==='train'&&Number(bars[horizon].time)>=cutoffTime))
  return {...closeTrade({entry,rawExit:Number(bars[horizon].close),dir,feeRate,slippageRate,reason:'timeout',exitIndex:horizon}),partition};
 const hasTestBar=partition==='train'&&Number(bars.at(-1).time)>=cutoffTime;
 return {status:'censored',partition,censorReason:hasTestBar?'split_boundary':'window_end'};
}

function accumulate(bucket,trade){
 if(trade.status==='censored'){
  bucket.censored++;
  if(trade.censorReason==='split_boundary')bucket.censoredSplit++;
  else bucket.censoredWindow++;
  return;
 }
 bucket.trades++;
 bucket.wins+=Number(trade.netPct>0);
 bucket.sumNetPct+=trade.netPct;
 bucket.reasons[trade.reason]++;
}
function finalize(bucket){
 bucket.meanNetPct=bucket.trades?bucket.sumNetPct/bucket.trades:null;
 bucket.winRatePct=bucket.trades?100*bucket.wins/bucket.trades:null;
 return bucket;
}
function isContiguous(bars){
 if(bars.length<2)return false;
 const step=Number(bars[1].time)-Number(bars[0].time);
 if(!Number.isSafeInteger(step)||step<=0)return false;
 for(let i=2;i<bars.length;i++)if(Number(bars[i].time)-Number(bars[i-1].time)!==step)return false;
 return true;
}
export function studyVectorExits(windows,{
 cutoffTime,feeRate=0.0006,slippageRate=0,stressSlippageRate=0.0005,
 minTrainTrades=30,minTestTrades=30
}={}){
 if(!Number.isFinite(cutoffTime))throw Error('cutoffTime required');
 if(!Array.isArray(windows)||![feeRate,slippageRate,stressSlippageRate].every(v=>Number.isFinite(v)&&v>=0&&v<1)
    ||!Number.isSafeInteger(minTrainTrades)||minTrainTrades<1||!Number.isSafeInteger(minTestTrades)||minTestTrades<1)
  throw Error('Invalid comparison configuration');
 const result={};
 for(const side of ['long','short']){
  const candidates={};
  for(const cfg of VECTOR_EXIT_CONFIGS)candidates[cfg.id]={
   train:blank(),test:blank(),stress:{train:blank(),test:blank()}};
  result[side]={candidates};
 }
 let windowsUsed=0,shortWindows=0,rejectedGaps=0;
 for(const window of windows){
  const bars=window.candles??window;
  if(!Array.isArray(bars)||bars.length<22){shortWindows++;continue;}
  if(!isContiguous(bars)){rejectedGaps++;continue;}
  windowsUsed++;
  const vector=vectorAIT(bars);
  for(const side of ['long','short']){
   const signals=vector.flatMap((v,i)=>v.signal===side&&i<bars.length-1?[i]:[]);
   for(const cfg of VECTOR_EXIT_CONFIGS){
    // No overlapping positions per candidate and direction. Censored trades also
    // reserve their observed interval, until the train split or clean window ends.
    let occupied=-1;
    for(const i of signals){
     if(i+1<=occupied)continue;
     const trade=simulateVectorExitTrade(bars,vector,i,side,cfg,{cutoffTime,feeRate,slippageRate});
     const stress=simulateVectorExitTrade(bars,vector,i,side,cfg,{cutoffTime,feeRate,slippageRate:stressSlippageRate});
     const partition=trade.partition??(Number(bars[i+1].time)<cutoffTime?'train':'test');
     accumulate(result[side].candidates[cfg.id][partition],trade);
     accumulate(result[side].candidates[cfg.id].stress[partition],stress);
     if(trade.status==='closed')occupied=trade.exitIndex;
     else{
      occupied=bars.length-1;
      if(partition==='train'){
       const boundary=bars.findIndex(b=>Number(b.time)>=cutoffTime);
       if(boundary>=0)occupied=boundary-1;
      }
     }
    }
   }
  }
 }
 for(const side of ['long','short']){
  const item=result[side];
  for(const candidate of Object.values(item.candidates)){
   finalize(candidate.train);finalize(candidate.test);
   finalize(candidate.stress.train);finalize(candidate.stress.test);
  }
  const eligible=VECTOR_EXIT_CONFIGS.filter(cfg=>item.candidates[cfg.id].train.trades>=minTrainTrades);
  eligible.sort((a,b)=>item.candidates[b.id].train.meanNetPct-item.candidates[a.id].train.meanNetPct);
  item.selectedOnTrain=eligible[0]?.id??null;
  const winner=item.selectedOnTrain?item.candidates[item.selectedOnTrain]:null;
  item.validation=winner?{...winner.test,status:winner.test.trades>=minTestTrades?'sample_threshold_met':'insufficient_test_trades'}:{status:'insufficient_train_trades'};
  item.stressValidation=winner?{...winner.stress.test,status:winner.stress.test.trades>=minTestTrades?'sample_threshold_met':'insufficient_test_trades'}:{status:'insufficient_train_trades'};
 }
 return {bySide:result,diagnostics:{windows:windows.length,windowsUsed,shortWindows,rejectedGaps,minTrainTrades,minTestTrades},configs:VECTOR_EXIT_CONFIGS,
  assumptions:{cutoffTime,feeRate,slippageRate,stressSlippageRate,execution:'next-bar-open',entrySignals:'confirmed Vector direction changes only',fixed:'TP/SL and maximum holding bars, no Vector-based exit',
   opposite:'only the next-open after the confirmed opposite Vector, no stops or time limit',
   hybrid:'TP/SL, maximum holding bars, or confirmed opposite Vector (whichever occurs first)',
   sameBarStopTake:'stop-first',gapFill:'at actual next open if beyond stop or take',
   censoring:'incomplete trades at split/window ends are counted separately and EXCLUDED from P&L and trade totals',
   selection:'best net mean on train at baseline slippage only; identical winner checked on test and with stress slippage',
   capital:'independent net percent per completed trade; not compounded across gaps',
   warning:'Research only. TradingView signal parity not independently verified; no tick-level ordering. Excluding censored trades may bias estimates; inspect censor counts and sample sizes.'}};
}
