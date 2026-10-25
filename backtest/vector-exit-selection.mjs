/* Predeclared Vector AIT exit candidates, trained before chronological cutoff.
   Each clean window is independent; next-bar-open entries, conservative intrabar fills. */
import {vectorAIT} from './vector-ait-v1.mjs';
export function studyVectorExits(windows,{cutoffTime,feeRate=0.0006,minTrainTrades=30,minTestTrades=30}={}){
 if(!Number.isFinite(cutoffTime))throw Error('cutoffTime required');
 const configs=[{id:'fixed_1_2_12',stop:1,take:2,maxBars:12},{id:'fixed_1_5_3_12',stop:1.5,take:3,maxBars:12},{id:'fixed_2_4_24',stop:2,take:4,maxBars:24},{id:'opposite_vector',stop:null,take:null,maxBars:null}];
 const result={};
 for(const side of ['long','short']){
  const candidates={};
  for(const cfg of configs)candidates[cfg.id]={train:{trades:0,wins:0,sumNetPct:0},test:{trades:0,wins:0,sumNetPct:0}};
  result[side]={candidates};
 }
 let windowsUsed=0;
 for(const w of windows){
  const bars=w.candles??w;if(bars.length<22)continue;windowsUsed++;
  const vector=vectorAIT(bars);
  for(const side of ['long','short']){
   const direction=side==='long'?1:-1;
   const indices=vector.flatMap((v,i)=>v.signal===side&&i<bars.length-1?[i]:[]);
   for(const cfg of configs){
    let occupied=-1;
    for(const i of indices){
     const start=i+1;if(start<=occupied)continue;
     const train=Number(bars[start].time)<cutoffTime,period=train?'train':'test';
     const entry=Number(bars[start].open),stop=cfg.stop===null?null:entry*(1-direction*cfg.stop/100),take=cfg.take===null?null:entry*(1+direction*cfg.take/100);
     let end=Math.min(bars.length-1,cfg.maxBars===null?bars.length-1:start+cfg.maxBars-1);
     if(train)while(end>=start&&Number(bars[end].time)>=cutoffTime)end--;
     if(end<start)continue;
     let exit=Number(bars[end].close),last=end;
     for(let j=start;j<=end;j++){
      const b=bars[j],o=Number(b.open),h=Number(b.high),l=Number(b.low);
      // Opposite Vector is known only after its candle closes; execute at next open.
      if(j>start&&vector[j-1].signal===(direction===1?'short':'long')){exit=o;last=j;break;}
      if(stop!==null){
       if(direction===1){
        if(o<=stop){exit=o;last=j;break;}if(o>=take){exit=o;last=j;break;}
        if(l<=stop){exit=stop;last=j;break;}if(h>=take){exit=take;last=j;break;}
       }else{
        if(o>=stop){exit=o;last=j;break;}if(o<=take){exit=o;last=j;break;}
        if(h>=stop){exit=stop;last=j;break;}if(l<=take){exit=take;last=j;break;}
       }
      }
     }
     const net=100*(direction*(exit-entry)/entry-feeRate*(1+exit/entry));
     const bucket=result[side].candidates[cfg.id][period];
     bucket.trades++;bucket.wins+=Number(net>0);bucket.sumNetPct+=net;occupied=last;
    }
   }
  }
 }
 for(const side of ['long','short']){
  const item=result[side];
  for(const c of Object.values(item.candidates))for(const b of Object.values(c)){
   b.meanNetPct=b.trades?b.sumNetPct/b.trades:null;b.winRatePct=b.trades?100*b.wins/b.trades:null;
  }
  const eligible=configs.filter(cfg=>item.candidates[cfg.id].train.trades>=minTrainTrades);
  eligible.sort((a,b)=>item.candidates[b.id].train.meanNetPct-item.candidates[a.id].train.meanNetPct);
  item.selectedOnTrain=eligible[0]?.id??null;
  item.validation=item.selectedOnTrain?{...item.candidates[item.selectedOnTrain].test,status:item.candidates[item.selectedOnTrain].test.trades>=minTestTrades?'sample_threshold_met':'insufficient_test_trades'}:{status:'insufficient_train_trades'};
 }
 return {bySide:result,diagnostics:{windows:windows.length,windowsUsed,minTrainTrades,minTestTrades},configs,assumptions:{cutoffTime,feeRate,execution:'next-bar-open',oppositeExit:'next open after confirmed opposite vector',tie:'stop first',selection:'highest train mean net per trade among predefined candidates',capital:'non-compounded percentage per trade',warning:'Research only; selecting on training does not guarantee generalization. Trades truncated at clean-window and split boundaries; no slippage.'}};
}
