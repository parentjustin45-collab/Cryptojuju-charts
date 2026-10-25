/* Export per-symbol/timeframe Vector minimum-confirmation sweep.
   No performance claim or automatic publication is made. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
export function buildVectorConfirmationAudit(data){
 const rows=[],decisions=[];
 for(const report of data){
  const s=report.vectorConfirmationStudy;if(!s)continue;
  const meta={symbol:report.symbol,timeframe:report.interval,days:report.periodDays,
   coveragePct:report.coveragePct,excludedBars:report.excludedBars,
   cleanWindows:report.cleanWindows};
  for(const side of ['long','short']){
   const item=s.bySide[side];
   decisions.push({...meta,side,...item.holdout,
    usableWindows:s.diagnostics.usableWindows,rejectedGaps:s.diagnostics.rejectedGaps});
   for(const threshold of s.configurations){
    const candidate=item.candidates[String(threshold)];
    for(const scenario of ['baseline','stress'])for(const split of ['train','test']){
     const b=scenario==='baseline'?candidate[split]:candidate.stress[split];
     rows.push({...meta,side,threshold,baselineV11:threshold===4,scenario,split,
      selectedOnTrain:item.selectedOnTrain===threshold,
      slippageRate:scenario==='baseline'?s.assumptions.slippageRate:s.assumptions.stressSlippageRate,
      signals:b.signals,trades:b.trades,wins:b.wins,winRatePct:b.winRatePct,
      meanNetPct:b.meanNetPct,censored:b.censored,censoredSplit:b.censoredSplit,
      censoredWindow:b.censoredWindow,rapidReversals:b.rapidReversals,
      reversalPairs:b.reverseIntervals,rapidReversalPct:b.rapidReversalPct,
      meanReverseBars:b.meanReverseBars,
      eligible:b.trades>=(split==='train'?s.diagnostics.minTrainTrades:s.diagnostics.minTestTrades)});
    }
   }
  }
 }
 return {rows,decisions,interpretation:'Only minimumConfirmations changes across Vector V1.2 research candidates. Fixed 1.5% SL, 3% TP and 12-bar maximum are identical. Training selects; validation compares; data-gap and split-censored trades excluded. Baseline=unchanged Vector V1.1. No strategy promoted. These are independent net returns per completed trade, not compounded portfolio performance.'};
}
const esc=v=>{
 if(v==null)return '';
 const s=String(v);return /[,\n"]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
};
export function exportVectorConfirmationAudit(audit,{csvPath='vector-confirmation-study.csv',jsonPath='vector-confirmation-study.json'}={}){
 const fields=['symbol','timeframe','days','coveragePct','excludedBars','cleanWindows','side','threshold',
  'baselineV11','scenario','split','selectedOnTrain','slippageRate','signals','trades',
  'wins','winRatePct','meanNetPct','censored','censoredSplit','censoredWindow',
  'rapidReversals','reversalPairs','rapidReversalPct','meanReverseBars','eligible'];
 writeFileSync(csvPath,[fields.join(','),...audit.rows.map(r=>fields.map(k=>esc(r[k])).join(','))].join('\n')+'\n');
 writeFileSync(jsonPath,JSON.stringify({...audit,generatedAt:new Date().toISOString()},null,2)+'\n');
 return audit.rows.length;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 const log=readFileSync(process.argv[2]??'speed-bitunix-report.log','utf8');
 const line=log.split(/\r?\n/).findLast(x=>x.startsWith('SPEED_BITUNIX_REPORT='));
 if(!line)throw Error('Missing SPEED_BITUNIX_REPORT payload');
 const audit=buildVectorConfirmationAudit(JSON.parse(line.slice('SPEED_BITUNIX_REPORT='.length)));
 if(!audit.rows.length)throw Error('Missing Vector confirmation research data');
 console.log('Exported '+exportVectorConfirmationAudit(audit)+' Vector confirmation study rows');
}
