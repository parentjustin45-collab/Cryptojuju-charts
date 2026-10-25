/* Auditable V1.2 anti-whipsaw results. Never promote candidates automatically.
   Compare selected train rule against unchanged V1.1 on untouched holdout. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

export function buildVectorAntiWhipsawAudit(reports){
 const rows=[],decisions=[];
 for(const r of reports){
  const s=r.vectorAntiWhipsawStudy;if(!s)continue;
  const meta={symbol:r.symbol,timeframe:r.interval,days:r.periodDays,
   coveragePct:r.coveragePct,excludedBars:r.excludedBars,cleanWindows:r.cleanWindows};
  for(const side of ['long','short']){
   const item=s.bySide[side];
   decisions.push({...meta,side, ...item.holdout,
    usableWindows:s.diagnostics.usableWindows,rejectedGaps:s.diagnostics.rejectedGaps,
    excludedShort:s.diagnostics.excludedShort});
   for(const mode of s.modes){
    const candidate=item.candidates[mode.id];
    for(const scenario of ['baseline','stress'])for(const split of ['train','test']){
     const b=scenario==='baseline'?candidate[split]:candidate.stress[split];
     rows.push({...meta,side,mode:mode.id,modeLabel:mode.label,
      v11Reference:mode.id==='baseline_v11',scenario,split,
      selectedOnTrain:item.selectedOnTrain===mode.id,
      slippageRate:scenario==='baseline'?s.assumptions.slippageRate:s.assumptions.stressSlippageRate,
      signals:b.signals,trades:b.trades,wins:b.wins,winRatePct:b.winRatePct,
      meanNetPct:b.meanNetPct,censored:b.censored,censoredSplit:b.censoredSplit,
      censoredWindow:b.censoredWindow,boundaryExcluded:b.boundaryExcluded,
      delayedSignals:b.delayedSignals,meanDelayBars:b.meanDelayBars,
      reversalPairs:b.reversalPairs,rapidReversals:b.rapidReversals,
      rapidReversalPct:b.rapidReversalPct,meanReversalBars:b.meanReversalBars,
      candidatesObserved:candidate.counts.candidates,confirmedObserved:candidate.counts.confirmed,
      expiredObserved:candidate.counts.expired,cancelledOpposite:candidate.counts.cancelledOpposite,
      sampleStatus:b.trades>=(split==='train'?s.diagnostics.minTrainTrades:s.diagnostics.minTestTrades)
       ?'sample_threshold_met':'insufficient_trades'});
    }
   }
  }
 }
 return {rows,decisions,description:{
  baseline:'Vector AIT V1.1 without additional filters, minimumConfirmations=4.',
  candidates:'Follow-through next-close and closed-bar breakout of original Vector high/low within two bars.',
  execution:'Next candle open after signal; fixed SL 1.5%, TP 3%, time limit 12 bars, 0.06% fees each side.',
  selection:'Only training data chooses one mode, never the held-out test.',
  cautions:'Delay reduces signal count; rapid flips are descriptive only. Censored positions can bias estimates. No portfolio compounding or live-trading claim. Verify TradingView Pine parity separately.'}};
}
function csvValue(v){
 if(v==null)return '';
 const s=String(v);return /[,\n"]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
}
export function exportVectorAntiWhipsawAudit(audit,{csvPath='vector-antiwhipsaw-study.csv',jsonPath='vector-antiwhipsaw-study.json'}={}){
 const fields=['symbol','timeframe','days','coveragePct','excludedBars','cleanWindows','side','mode',
  'modeLabel','v11Reference','scenario','split','selectedOnTrain','slippageRate',
  'signals','trades','wins','winRatePct','meanNetPct','censored','censoredSplit','censoredWindow',
  'boundaryExcluded','delayedSignals','meanDelayBars','reversalPairs','rapidReversals',
  'rapidReversalPct','meanReversalBars','candidatesObserved','confirmedObserved','expiredObserved',
  'cancelledOpposite','sampleStatus'];
 writeFileSync(csvPath,[fields.join(','),...audit.rows.map(r=>fields.map(k=>csvValue(r[k])).join(','))].join('\n')+'\n');
 writeFileSync(jsonPath,JSON.stringify({...audit,generatedAt:new Date().toISOString()},null,2)+'\n');
 return audit.rows.length;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 const log=readFileSync(process.argv[2]??'speed-bitunix-report.log','utf8');
 const line=log.split(/\r?\n/).findLast(x=>x.startsWith('SPEED_BITUNIX_REPORT='));
 if(!line)throw Error('Missing SPEED_BITUNIX_REPORT');
 const audit=buildVectorAntiWhipsawAudit(JSON.parse(line.slice('SPEED_BITUNIX_REPORT='.length)));
 if(!audit.rows.length)throw Error('No Vector anti-whipsaw study found');
 console.log('Exported '+exportVectorAntiWhipsawAudit(audit)+' anti-whipsaw audit rows');
}
