/* CryptoJuju Vector AIT V1.2 research, NOT a production indicator.
   Change exactly one Pine input: minimumConfirmations 3/4/5.
   Preserve baseline Vector V1.1 at 4; shared fixed exits 1.5%/3%/12 bars.
   Closed-bar signal -> next-open entry. Isolated clean windows; no gap crossing.
   Select on train ONLY, audit the untouched test and slippage sensitivity. */
import {vectorAIT} from './vector-ait-v1.mjs';
import {simulateVectorExitTrade,VECTOR_EXIT_CONFIGS} from './vector-exit-selection.mjs';
export const VECTOR_CONFIRMATIONS=Object.freeze([3,4,5]);
const FIXED_EXIT=VECTOR_EXIT_CONFIGS.find(x=>x.id==='fixed_1_5_3_12');
const empty=()=>({trades:0,wins:0,sumNetPct:0,censored:0,censoredSplit:0,censoredWindow:0,
  signals:0,rapidReversals:0,reverseIntervals:0,sumReverseBars:0});
const validWindow=bars=>{
 if(!Array.isArray(bars)||bars.length<22)return false;
 const step=Number(bars[1].time)-Number(bars[0].time);
 return Number.isSafeInteger(step)&&step>0&&bars.every((b,i)=>i===0||Number(b.time)-Number(bars[i-1].time)===step);
};
function finalize(b){
 b.meanNetPct=b.trades?b.sumNetPct/b.trades:null;
 b.winRatePct=b.trades?100*b.wins/b.trades:null;
 b.rapidReversalPct=b.reverseIntervals?100*b.rapidReversals/b.reverseIntervals:null;
 b.meanReverseBars=b.reverseIntervals?b.sumReverseBars/b.reverseIntervals:null;
 return b;
}
function collect(bars,vector,side,cutoffTime,feeRate,slip,flipLookaheadBars){
 const out={train:empty(),test:empty()};
 const events=[];
 for(let i=19;i<bars.length-1;i++)if(vector[i].signal===side)events.push(i);
 // Whipsaw metric: count opposite transitions <= N bars apart.
 // Purely descriptive, never used to change a signal retrospectively.
 const flips=vector.flatMap((v,i)=>i>=19&&i<bars.length-1&&v.signal?[i]:[]);
 for(let k=1;k<flips.length;k++){
  const prev=flips[k-1],curr=flips[k],a=Number(bars[prev+1].time)<cutoffTime?'train':'test',
    b=Number(bars[curr+1].time)<cutoffTime?'train':'test';
  if(a!==b)continue;
  // Opposite directional flips only (Vector AIT always alternates after first).
  if(vector[prev].signal===vector[curr].signal)continue;
  const target=out[b];target.reverseIntervals++;target.sumReverseBars+=curr-prev;
  if(curr-prev<=flipLookaheadBars)target.rapidReversals++;
 }
 let occupied=-1;
 for(const i of events){
  if(i+1<=occupied)continue;
  const period=Number(bars[i+1].time)<cutoffTime?'train':'test';
  const bucket=out[period];bucket.signals++;
  const trade=simulateVectorExitTrade(bars,vector,i,side,FIXED_EXIT,{cutoffTime,feeRate,slippageRate:slip});
  if(trade.status==='closed'){
   bucket.trades++;bucket.wins+=Number(trade.netPct>0);bucket.sumNetPct+=trade.netPct;occupied=trade.exitIndex;
  }else{
   bucket.censored++;
   if(trade.censorReason==='split_boundary')bucket.censoredSplit++;else bucket.censoredWindow++;
   occupied=bars.length-1;
   if(period==='train'){
    const splitAt=bars.findIndex(b=>Number(b.time)>=cutoffTime);
    if(splitAt>=0)occupied=splitAt-1;
   }
  }
 }
 return out;
}
export function studyVectorConfirmations(windows,{
 cutoffTime,feeRate=0.0006,slippageRate=0,stressSlippageRate=0.0005,
 minTrainTrades=30,minTestTrades=30,flipLookaheadBars=3
}={}){
 if(!Number.isFinite(cutoffTime))throw Error('cutoffTime required');
 if(!Array.isArray(windows)||![feeRate,slippageRate,stressSlippageRate].every(x=>Number.isFinite(x)&&x>=0&&x<1)
   ||!Number.isInteger(minTrainTrades)||minTrainTrades<1||!Number.isInteger(minTestTrades)||minTestTrades<1
   ||!Number.isInteger(flipLookaheadBars)||flipLookaheadBars<1)throw Error('Invalid research configuration');
 const bySide={long:{candidates:{}},short:{candidates:{}}};
 for(const side of ['long','short'])for(const n of VECTOR_CONFIRMATIONS)
  bySide[side].candidates[String(n)]={train:empty(),test:empty(),stress:{train:empty(),test:empty()}};
 const diagnostics={windows:windows.length,usableWindows:0,excludedShort:0,rejectedGaps:0,minTrainTrades,minTestTrades};
 for(const w of windows){
  const bars=w.candles??w;
  if(!Array.isArray(bars)||bars.length<22){diagnostics.excludedShort++;continue;}
  if(!validWindow(bars)){diagnostics.rejectedGaps++;continue;}
  diagnostics.usableWindows++;
  for(const n of VECTOR_CONFIRMATIONS){
   const vector=vectorAIT(bars,{minimumConfirmations:n});
   for(const side of ['long','short']){
    const dest=bySide[side].candidates[String(n)];
    const baseline=collect(bars,vector,side,cutoffTime,feeRate,slippageRate,flipLookaheadBars);
    const stress=collect(bars,vector,side,cutoffTime,feeRate,stressSlippageRate,flipLookaheadBars);
    for(const split of ['train','test']){
     for(const key of Object.keys(dest[split]))dest[split][key]+=baseline[split][key];
     for(const key of Object.keys(dest.stress[split]))dest.stress[split][key]+=stress[split][key];
    }
   }
  }
 }
 for(const side of ['long','short']){
  const item=bySide[side];
  for(const candidate of Object.values(item.candidates)){
   finalize(candidate.train);finalize(candidate.test);finalize(candidate.stress.train);finalize(candidate.stress.test);
  }
  const eligible=VECTOR_CONFIRMATIONS.filter(n=>item.candidates[String(n)].train.trades>=minTrainTrades);
  // Prefer baseline 4 on equal train scores, avoiding arbitrary promotion.
  eligible.sort((a,b)=>item.candidates[String(b)].train.meanNetPct-item.candidates[String(a)].train.meanNetPct
   ||Math.abs(a-4)-Math.abs(b-4));
  item.selectedOnTrain=eligible[0]??null;
  const chosen=item.selectedOnTrain===null?null:item.candidates[String(item.selectedOnTrain)];
  const original=item.candidates['4'];
  const sufficient=Boolean(chosen&&chosen.test.trades>=minTestTrades&&original.test.trades>=minTestTrades);
  item.holdout={
   status:!chosen?'insufficient_train_trades':!sufficient?'insufficient_test_trades':
    item.selectedOnTrain===4?'baseline_selected':'review_candidate',
   selected:item.selectedOnTrain,selectedTrades:chosen?.test.trades??0,baselineTrades:original.test.trades,
   selectedMeanNetPct:chosen?.test.meanNetPct??null,baselineMeanNetPct:original.test.meanNetPct,
   deltaMeanNetPp:sufficient?chosen.test.meanNetPct-original.test.meanNetPct:null,
   stressSelectedMeanNetPct:sufficient?chosen.stress.test.meanNetPct:null,
   researchPass:Boolean(sufficient&&item.selectedOnTrain!==4&&chosen.test.meanNetPct>original.test.meanNetPct
    &&chosen.test.meanNetPct>0&&chosen.stress.test.meanNetPct>0),
  };
 }
 return {bySide,diagnostics,configurations:VECTOR_CONFIRMATIONS,
  assumptions:{cutoffTime,feeRate,slippageRate,stressSlippageRate,entry:'confirmed vector inversion; next candle open',
   exit:FIXED_EXIT.id,exitDescription:'fixed stop 1.5%, take 3%, maximum 12 bars; same for every candidate',
   sweptParameter:'minimumConfirmations only; 4 is original Vector AIT V1.1',firstEligibleIndex:19,
   split:'absolute chronological cutoff applied to trade entry; positions crossing split are censored',
   data:'continuous clean windows only; no gap crossings and censored trades excluded from completed-trade returns',
   selection:'train-only highest completed net mean, with baseline-tie preference',
   whipsawMetric:'confirmed opposite transitions occurring within '+flipLookaheadBars+' bars; descriptive only',
   promotion:'researchPass is an exploratory flag, NEVER automatic production promotion; check sample correlation, missing data, and TradingView parity',
   warning:'Small-sample, selection, censoring and correlated-asset biases remain. No live trading.'}};
}
