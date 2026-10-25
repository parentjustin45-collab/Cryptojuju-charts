/* Export auditable Vector exit families, censored trades and slippage stress.
   Research results: percentages are net per COMPLETED independent trade, not compounded. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

export function buildVectorExitAudit(reports){
 const rows=[],diagnostics=[];
 for(const r of reports){
  const study=r.vectorExitSelection;
  if(!study)continue;
  const meta={symbol:r.symbol,timeframe:r.interval,days:r.periodDays,coveragePct:r.coveragePct,
   excludedBars:r.excludedBars,cleanWindows:r.cleanWindows};
  diagnostics.push({...meta,...study.diagnostics,selected:{
   long:study.bySide.long.selectedOnTrain,short:study.bySide.short.selectedOnTrain}});
  for(const side of ['long','short']){
   const selection=study.bySide[side];
   for(const cfg of study.configs){
    const pair=selection.candidates[cfg.id];
    for(const [caseName,data,slip] of [
     ['baseline',pair,study.assumptions.slippageRate],
     ['stress',pair.stress,study.assumptions.stressSlippageRate]]){
     for(const split of ['train','test']){
      const b=data[split];
      const threshold=split==='train'?study.diagnostics.minTrainTrades:study.diagnostics.minTestTrades;
      rows.push({...meta,side,exitId:cfg.id,family:cfg.family,split,caseName,
       slippageRate:slip,selectedOnTrain:selection.selectedOnTrain===cfg.id,
       trades:b.trades,censored:b.censored,censoredSplit:b.censoredSplit,censoredWindow:b.censoredWindow,
       wins:b.wins,winRatePct:b.winRatePct,meanNetPct:b.meanNetPct,
       stops:b.reasons.stop,takes:b.reasons.take,oppositeExits:b.reasons.opposite,timeouts:b.reasons.timeout,
       sampleStatus:b.trades>=threshold?'sample_threshold_met':'insufficient_trades'});
     }
    }
   }
  }
 }
 return {rows,diagnostics,description:{
  baseline:'Slippage-free execution with two-sided fees; candidate selection performed on baseline training only.',
  stress:'The SAME train-selected exit configuration re-executed with added slippage on each side; trades may differ because stop and take fills can differ.',
  censored:'Not counted as completed trades; window boundary and chronological split are recorded separately.',
  caution:'Excluding incomplete trades can create survivorship/censoring bias. These are exploratory results, not compounded portfolio returns; TradingView Pine parity still requires independent checks.'}};
}
function csvEscape(v){
 if(v===null||v===undefined)return '';
 const s=String(v);return /[,"\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
}
export function exportVectorExitAudit(audit,{csvPath='vector-exit-comparison.csv',jsonPath='vector-exit-comparison.json'}={}){
 const fields=['symbol','timeframe','days','coveragePct','excludedBars','cleanWindows','side','family',
  'exitId','split','caseName','slippageRate','selectedOnTrain','trades','censored',
  'censoredSplit','censoredWindow','wins','winRatePct','meanNetPct','stops','takes',
  'oppositeExits','timeouts','sampleStatus'];
 const lines=[fields.join(','),...audit.rows.map(r=>fields.map(k=>csvEscape(r[k])).join(','))];
 writeFileSync(csvPath,lines.join('\n')+'\n');
 writeFileSync(jsonPath,JSON.stringify({...audit,generatedAt:new Date().toISOString()},null,2)+'\n');
 return audit.rows.length;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 const log=readFileSync(process.argv[2]??'speed-bitunix-report.log','utf8');
 const line=log.split(/\r?\n/).findLast(x=>x.startsWith('SPEED_BITUNIX_REPORT='));
 if(!line)throw Error('Missing SPEED_BITUNIX_REPORT');
 const data=JSON.parse(line.slice('SPEED_BITUNIX_REPORT='.length));
 const audit=buildVectorExitAudit(data);
 if(!audit.rows.length)throw Error('Missing Vector exit selection results');
 console.log('Exported '+exportVectorExitAudit(audit)+' Vector exit audit rows');
}
