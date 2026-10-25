/* Convert the existing Bitunix JSON-line research output into a compact, auditable comparison.
   No market data is fetched here; no cross-segment returns are compounded. */
import {readFileSync,writeFileSync} from 'node:fs';
const path=process.argv[2]??'speed-bitunix-report.log';
const lines=readFileSync(path,'utf8').split(/\r?\n/);
const reportLine=lines.findLast(line=>line.startsWith('SPEED_BITUNIX_REPORT='));
if(!reportLine)throw Error('Missing SPEED_BITUNIX_REPORT payload');
const data=JSON.parse(reportLine.slice('SPEED_BITUNIX_REPORT='.length));
const columns=['symbol','timeframe','days','status','coverage_pct','excluded_bars','clean_windows','entry','direction','exit','segments','trades','win_rate_pct','mean_segment_return_pct','worst_segment_drawdown_pct'];
const csv=[columns.join(',')];
const table=[];
for(const r of data){
 for(const [name,segments] of Object.entries(r.exitComparison??{})){
  const [entry,direction,exit]=name.split('_');
  const trades=segments.reduce((s,x)=>s+x.tradeCount,0);
  const weightedWins=segments.reduce((s,x)=>s+(x.tradeCount*x.winRatePercent/100),0);
  const avgReturn=segments.length?segments.reduce((s,x)=>s+x.returnPercent,0)/segments.length:null;
  const drawdown=segments.length?Math.max(...segments.map(x=>x.maxDrawdownPercent)):null;
  const row=[r.symbol,r.interval,r.periodDays,r.status,r.coveragePct,r.excludedBars,r.cleanWindows,entry,direction,exit,segments.length,trades,trades?+(weightedWins/trades*100).toFixed(2):null,avgReturn===null?null:+avgReturn.toFixed(4),drawdown===null?null:+drawdown.toFixed(4)];
  csv.push(row.map(x=>x??'').join(','));
  table.push({symbol:r.symbol,timeframe:r.interval,entry,direction,exit,trades,winRatePct:row[12],meanSegmentReturnPct:row[13],worstSegmentDrawdownPct:row[14],coveragePct:r.coveragePct,status:r.status});
 }
}
writeFileSync('speed-strategy-comparison.csv',csv.join('\n')+'\n');
writeFileSync('speed-strategy-comparison.json',JSON.stringify({generatedAt:new Date().toISOString(),source:'SPEED_BITUNIX_REPORT',interpretation:'Descriptive research only; segments reset capital and cannot be compounded. Compare only matched symbols, timeframes, and periods. Win rates are trade weighted; mean segment returns are not portfolio returns.',rows:table},null,2)+'\n');
console.log('Generated '+table.length+' comparable strategy rows');
