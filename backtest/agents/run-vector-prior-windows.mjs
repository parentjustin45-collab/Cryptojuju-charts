/*
 * Bitunix closed-history stress test on two disjoint older 40-day windows.
 * No TrainingView, order APIs, trading keys, automated parameter selection,
 * production changes or paid infrastructure. Historical backtest only.
 */
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {readCryptoJujuWatchlist,fetchOpenContractMetadata}
 from './market-universe-50.mjs';
import {auditDailyVectorMarket} from './daily-vector-research.mjs';
import {fetchBitunixDataPilot} from './bitunix-data-pilot.mjs';
import {compareBitunixReadbacks} from './bitunix-readback-consistency.mjs';
import {compareDailyAlignedVector} from './vector-daily-intraday-alignment.mjs';
import {HISTORICAL_SYMBOLS,planPriorHourlyWindows,
 auditPriorResultShape} from './vector-daily-historical-windows.mjs';

const folder=resolve(process.argv[2]??'prior-1h-vector-historical-research');
await mkdir(folder,{recursive:true});
const save=(name,obj)=>writeFile(join(folder,name),JSON.stringify(obj,null,2)+'\n');
const windows=planPriorHourlyWindows();
const summary={
 protocol:'CJ_VECTOR_DAILY_PRIOR_WINDOWS_RESEARCH_V1',
 status:'PARTIAL_OR_BLOCKED',
 anchoredRecentReferenceUtc:'2026-11-19T00:00:00.000Z',
 runFetchedAtUtc:new Date().toISOString(),
 researchDataSource:'Bitunix public futures LAST_PRICE',
 windows,markets:[...HISTORICAL_SYMBOLS],cases:[],
 expected:HISTORICAL_SYMBOLS.length*windows.length,
 passed:0,blocked:0,
 ordersPlaced:false,promotedVersion:null,productionTouched:false,
 dataPolicy:'Historical 960-closed-candle blocks, 365/180 closed Daily, two full HTTP reads per window',
 warnings:[
  'Both earlier 40-day windows were chosen BEFORE checking their signal results.',
  'They do not overlap the already-inspected latest 40-day 1h window.',
  'These windows remain historical and are NOT a prospective independent blind holdout.',
  'Candle source timestamps reflect requested historical as-of; runFetchedAtUtc tracks actual request date.',
  'A directional Daily does NOT guarantee each 1h candle moves in that direction.',
  'Fixed fee/slippage is an unverified approximation across futures contracts and memo tokens.',
  'No auto-promotion, tuning, production updates, trading or Render fees.'
 ]
};
try{
 const wl=readCryptoJujuWatchlist(await readFile(resolve('index.html'),'utf8'));
 const listed=new Set(wl.symbols);
 const market=await fetchOpenContractMetadata();
 summary.siteWatchlistCount=wl.total;
 summary.activeBitunixContractCount=market.filter(c=>c?.symbolStatus==='OPEN').length;
 for(const symbol of HISTORICAL_SYMBOLS){
   for(const window of windows){
     const cell={symbol,windowId:window.id,
       interval:'1h',asOfUtc:new Date(window.asOfMs).toISOString(),
       hourlyStartTime:window.startTime,hourlyEndTime:window.endTime,
       status:'BLOCKED',reason:null,dailyBars:0,hourlyBars:0,
       baselineTrades:0,holdoutModes:[],feeModel:'RESEARCH_FIXED_0.0006_AND_0.0005',
       dataFetchedAtUtc:new Date().toISOString(),promotedVersion:null
     };
     try{
       const exact=market.filter(m=>m?.symbol===symbol&&m?.symbolStatus==='OPEN');
       if(!listed.has(symbol)||exact.length!==1||
          !Number.isInteger(Number(exact[0].quotePrecision))||
          Number(exact[0].quotePrecision)<0||
          Number(exact[0].quotePrecision)>12)
         throw Error('No exact public OPEN contract and listed CryptoJuju symbol');
       const q=Number(exact[0].quotePrecision);
       const contract={symbol,quotePrecision:q,priceStep:10**(-q),
         source:'BITUNIX_PUBLIC_TRADING_PAIRS',
         stepStatus:'RESEARCH_PRICE_PRECISION_NOT_TV_MINTICK'};
       const daily=await auditDailyVectorMarket({
         symbol,contract,nowMs:window.asOfMs
       });
       await save(symbol+'-'+window.id+'-daily-evidence.json',daily);
       if(daily.status!=='DAILY_RESEARCH_COMPLETE')
         throw Error('Historical Daily unavailable: '+daily.reason);
       if(daily.source.historyWindow.endTime!==window.endTime)
         throw Error('Historical 1D date boundary moved unexpectedly');
       const query={symbol,timeframe:'1h',closedBars:window.requestedBars,
         anchorBars:3,nowMs:window.asOfMs};
       const first=await fetchBitunixDataPilot(query);
       await save(symbol+'-'+window.id+'-first-1h.json',first);
       if(first.status!=='DATA_READY_FOR_RESEARCH_ONLY')
         throw Error('Historical 1H failed quality gate: '+first.reason);
       const second=await fetchBitunixDataPilot(query);
       await save(symbol+'-'+window.id+'-second-1h.json',second);
       const repeat=compareBitunixReadbacks(first,second);
       await save(symbol+'-'+window.id+'-1h-readback.json',repeat);
       if(second.status!=='DATA_READY_FOR_RESEARCH_ONLY'||
          repeat.status!=='STABLE_TWO_READS'||
          repeat.checkedDerived!==window.requestedBars||
          first.historyWindow.startTime!==window.startTime||
          first.historyWindow.endTime!==window.endTime)
         throw Error('Historical 1H time window or repeated OHLC verification failed');
       const study=compareDailyAlignedVector({
         intraday:first,intradayReadback:repeat,
         daily:daily.source,dailyReadback:daily.readback,contract
       });
       await save(symbol+'-'+window.id+'-six-vector-modes.json',study);
       cell.status=study.status;
       cell.dailyBars=daily.depth;
       cell.hourlyBars=first.acceptedCandles.length;
       cell.dailyRawSha256=daily.source.provenance.rawSha256;
       cell.hourlyRawSha256=first.provenance.rawSha256;
       cell.dailyStrictAccepted=study.filters.v11_daily_aligned.accepted;
       cell.dailySoftAccepted=study.filters.v11_daily_soft.accepted;
       cell.dailyStrictRejected=study.filters.v11_daily_aligned.rejectedOpposed+
         study.filters.v11_daily_aligned.rejectedNeutral;
       cell.holdoutModes=Object.entries(study.holdout).map(([mode,r])=>({
         mode,holdoutTrades:r.tradeCount,trainingTrades:study.training[mode].tradeCount,
         holdoutNetReturnPct:r.returnPct,holdoutDrawdownPct:r.maxDrawdownPct,
         sampleSufficient:r.tradeCount>=20,
         promoted:false
       }));
       cell.baselineTrades=study.holdout.baseline_v11.tradeCount;
     }catch(e){cell.reason=String(e?.message??e)}
     summary.cases.push(cell);
     console.log('OLDER_VECTOR '+JSON.stringify({
       symbol,window:window.id,status:cell.status,reason:cell.reason,
       dailyBars:cell.dailyBars,hourlyBars:cell.hourlyBars,
       baselineHoldoutTrades:cell.baselineTrades,
       holdout:cell.holdoutModes.map(v=>({mode:v.mode,trades:v.holdoutTrades,
         netPct:Math.round(v.holdoutNetReturnPct*100)/100}))
     }));
     await save(symbol+'-'+window.id+'-report.json',cell);
   }
 }
}catch(e){summary.fatalError=String(e?.message??e);}
summary.passed=summary.cases.filter(c=>c.status==='RESEARCH_COMPARISON_ONLY').length;
summary.blocked=summary.expected-summary.passed;
summary.status=summary.blocked===0?'ALL_SIX_OLDER_WINDOWS_RESEARCH_COMPLETE':'PARTIAL_OR_BLOCKED';
if(summary.cases.length===summary.expected)
 auditPriorResultShape(summary,windows);
await save('prior-1h-vector-summary.json',summary);
const f=n=>Number.isFinite(n)?n.toFixed(2)+' %':'—';
const lines=[
 '# CryptoJuju — Tests historiques 1H, deux blocs plus anciens sans chevauchement',
 '',
 'Statut : **'+summary.status+'** · '+summary.passed+' / '+summary.expected+' cas acceptés.',
 'Chaque bloc de 40 jours comporte 960 heures fermées. Le Daily est calculé à la date historique correspondante.',
 'Les dates des fenêtres ont été verrouillées avant toute lecture des résultats.',
 '',
 '| Symbole | Bloc | Daily | 1H | V1.1 trades holdout | Statut |',
 '|---|---|---:|---:|---:|---|',
 ...summary.cases.map(c=>'| '+c.symbol+' | '+c.windowId+' | '+
  c.dailyBars+' | '+c.hourlyBars+' | '+c.baselineTrades+
  ' | '+c.status+(c.reason?' ('+c.reason+')':'')+' |'),
 '',
 '| Marché | Bloc | Mode | Trades holdout | Rendement simulé | Drawdown simulé | Échantillon |',
 '|---|---|---|---:|---:|---:|---|',
 ...summary.cases.flatMap(c=>c.holdoutModes.map(r=>
  '| '+c.symbol+' | '+c.windowId+' | '+r.mode+' | '+r.holdoutTrades+
  ' | '+f(r.holdoutNetReturnPct)+' | '+f(r.holdoutDrawdownPct)+
  ' | '+(r.sampleSufficient?'Descriptif':'Insuffisant')+' |')),
 '',
 ...summary.warnings.map(x=>'- '+x),
 '','Aucune version promue, aucun ordre, aucune mise à jour du site public.'
];
await writeFile(join(folder,'prior-1h-vector-summary.md'),lines.join('\n')+'\n');
console.log('OLDER_VECTOR_SUMMARY '+JSON.stringify({
 status:summary.status,passed:summary.passed,blocked:summary.blocked,
 fatalError:summary.fatalError??null
}));
if(summary.blocked)process.exitCode=2;
