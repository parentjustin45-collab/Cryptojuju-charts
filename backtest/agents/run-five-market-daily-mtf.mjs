/*
 * Five diversified Bitunix derivative contracts x 15m/1h/4h with causal
 * last-CLOSED-Daily Vector gates. Each accepted series independently read
 * twice; no quiet exchange fallbacks, orders, keys or deployment.
 */
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {DAILY_INTRADAY_RESEARCH_SYMBOLS,fetchBitunixDataPilot}
 from './bitunix-data-pilot.mjs';
import {auditDailyVectorMarket} from './daily-vector-research.mjs';
import {compareBitunixReadbacks} from './bitunix-readback-consistency.mjs';
import {compareDailyAlignedVector,DAILY_ALIGNMENT_LOCK}
 from './vector-daily-intraday-alignment.mjs';
import {measureCausalDailyTrendPersistence}
 from './daily-trend-persistence.mjs';
import {readCryptoJujuWatchlist,fetchOpenContractMetadata}
 from './market-universe-50.mjs';

const folder=resolve(process.argv[2]??'five-market-daily-mtf-research');
await mkdir(folder,{recursive:true});
const nowMs=Date.now();
const TF=['15m','1h','4h'],SIZE=960;
const store=(name,obj)=>writeFile(join(folder,name),JSON.stringify(obj,null,2)+'\n');
const report={
 protocol:'CJ_FIVE_MARKET_DAILY_15M_1H_4H_RESEARCH_V1',
 source:'Bitunix public Futures LAST_PRICE',
 runStartedUtc:new Date(nowMs).toISOString(),
 symbols:[...DAILY_INTRADAY_RESEARCH_SYMBOLS],
 timeframes:TF,
 expectedCases:DAILY_INTRADAY_RESEARCH_SYMBOLS.length*TF.length,
 cases:[],validated:0,blocked:0,status:'BLOCKED_OR_PARTIAL',
 productionChanged:false,tradesPlaced:false,autoPromoted:false,
 assumptions:[
  '365 or explicit-fallback 180 closed Daily bars, plus 960 closed lower-TF bars.',
  'Only the last CONFIRMED Daily trend with unmeasured 120s availability buffer.',
  'Strict Daily directional gate vs mixed-neutral soft gate; V1.1 raw Vector unchanged.',
  'Vetoed reversal causes flat exit next open instead of keeping old exposure.',
  'Inspected historical 70/30 holdout, insufficient cases and fixed simulated fees/slippage.',
  'An observed 88-90% Daily trend retention does not mean 90% winning trades or hourly up candles.',
  'No Forex feed, Pine parity gate, real orders, paid Render, production deploy or automatic winner.'
 ]
};
const add=async(c)=>{
 report.cases.push(c);
 await store(c.symbol+'-'+c.timeframe+'-summary.json',c);
 console.log('FIVE_DAILY_MTF '+JSON.stringify({
  symbol:c.symbol,tf:c.timeframe,status:c.status,
  reason:c.reason??null,dailyBars:c.dailyBars??0,lowerBars:c.lowerBars??0,
  seen:c.filters?.v11_daily_aligned?.seen??null,
  strict:c.filters?.v11_daily_aligned?.accepted??null,
  soft:c.filters?.v11_daily_soft?.accepted??null,
  persistence:c.persistence??null,
  holdout:c.results.map(r=>({mode:r.mode,trades:r.holdoutTrades,returnPct:r.holdoutReturnPct}))
 }));
};
try{
 const html=await readFile(resolve('index.html'),'utf8');
 const wl=readCryptoJujuWatchlist(html);
 const active=await fetchOpenContractMetadata();
 const site=new Set(wl.symbols);
 report.watchlistEntries=wl.total;
 report.contractsOnBitunix=active.length;
 for(const symbol of DAILY_INTRADAY_RESEARCH_SYMBOLS){
   let daily,contract,failed=null;
   try{
     const matches=active.filter(c=>c?.symbol===symbol&&c?.symbolStatus==='OPEN');
     if(!site.has(symbol)||matches.length!==1||
        !Number.isInteger(Number(matches[0].quotePrecision))||
        Number(matches[0].quotePrecision)<0||Number(matches[0].quotePrecision)>12)
       throw Error('Active Bitunix contract or CryptoJuju watchlist entry missing');
     const quotePrecision=Number(matches[0].quotePrecision);
     contract={
       symbol,quotePrecision,priceStep:10**(-quotePrecision),
       source:'BITUNIX_PUBLIC_TRADING_PAIRS',
       stepStatus:'RESEARCH_PRICE_PRECISION_NOT_TV_MINTICK'
     };
     daily=await auditDailyVectorMarket({symbol,contract,nowMs});
     await store(symbol+'-1d-source-and-replay.json',daily);
     if(daily.status!=='DAILY_RESEARCH_COMPLETE')
       throw Error('Daily source failed: '+daily.reason);
   }catch(e){failed=String(e?.message??e);}
   for(const timeframe of TF){
     const result={symbol,timeframe,status:'BLOCKED',reason:failed,
       dailyBars:daily?.depth??0,lowerBars:0,
       filters:null,results:[],persistence:null,
       versionPromoted:null,simulationOnly:true};
     if(failed){await add(result);continue}
     try{
       const opts={symbol,timeframe,closedBars:SIZE,anchorBars:3,nowMs};
       const first=await fetchBitunixDataPilot(opts);
       await store(symbol+'-'+timeframe+'-first.json',first);
       if(first.status!=='DATA_READY_FOR_RESEARCH_ONLY')
         throw Error('First OHLC read blocked: '+first.reason);
       const second=await fetchBitunixDataPilot(opts);
       await store(symbol+'-'+timeframe+'-second.json',second);
       const readback=compareBitunixReadbacks(first,second);
       await store(symbol+'-'+timeframe+'-readback.json',readback);
       if(second.status!=='DATA_READY_FOR_RESEARCH_ONLY'||
          readback.status!=='STABLE_TWO_READS'||readback.checkedDerived!==SIZE)
         throw Error('Second OHLC read mismatched or incomplete');
       const study=compareDailyAlignedVector({
         intraday:first,intradayReadback:readback,
         daily:daily.source,dailyReadback:daily.readback,contract
       });
       await store(symbol+'-'+timeframe+'-daily-filter-research.json',study);
       result.status=study.status;
       result.reason=null;
       result.dailyBars=daily.depth;
       result.lowerBars=first.acceptedCandles.length;
       result.filters=study.filters;
       // The full JSON study retains the individual stop/target fills.
       // Keep only summary metrics in the compact multi-market matrix.
       const paper=study.standaloneVetoRiskPaper;
       const strip=x=>{const {trades,...summary}=x;return summary;};
       result.standaloneRiskPaper={
         protocol:paper.protocol,status:paper.status,
         scenarios:Object.fromEntries(Object.entries(paper.scenarios).map(([cost,groups])=>
           [cost,Object.fromEntries(Object.entries(groups).map(([group,phases])=>
             [group,{training:strip(phases.training),holdout:strip(phases.holdout)}]))]
         )),
         caveat:'Standalone simulated risk-limited trades, NOT Vector integrated portfolio PnL'
       };
       // Non-trade opportunity diagnostics: direction from the NEXT bar
       // open, fixed-horizon close and max excursions after each signal.
       result.opportunity={
         v11_daily_aligned:study.signalOpportunity.v11_daily_aligned,
         v11_daily_soft:study.signalOpportunity.v11_daily_soft
       };
       result.results=Object.entries(study.holdout).map(([mode,r])=>({
         mode,holdoutTrades:r.tradeCount,trainTrades:study.training[mode].tradeCount,
         holdoutReturnPct:r.returnPct,holdoutMaxDrawdownPct:r.maxDrawdownPct,
         sampleAdequacy:r.tradeCount>=20?'DESCRIPTIVE_ONLY':'INSUFFICIENT_TRADES',
         promoted:false
       }));
       if(timeframe==='1h'){
         const p=measureCausalDailyTrendPersistence({
           dailySource:daily.source,hourlySource:first,comparison:study
         });
         result.persistence={
           dailyRetainedNextDayPct:p.dailyDirectionRetainedNextDayPct,
           directionalDayTransitions:p.dailyTrendDayTransitions,
           dailyRetainedNextDayCount:p.dailyDirectionRetainedNextDay,
           holdout:p.phases.holdout,
           training:p.phases.training
         };
         await store(symbol+'-1h-daily-trend-persistence.json',p);
       }
     }catch(e){result.status='BLOCKED';result.reason=String(e?.message??e);}
     await add(result);
   }
 }
}catch(e){report.error=String(e?.message??e);}
report.validated=report.cases.filter(x=>x.status==='RESEARCH_COMPARISON_ONLY').length;
report.blocked=report.expectedCases-report.validated;
report.status=report.blocked===0?'ALL_15_MARKET_TIMEFRAMES_RESEARCH_READY':'PARTIAL_OR_BLOCKED_RESEARCH';
await store('five-market-daily-mtf-summary.json',report);
const f=n=>Number.isFinite(n)?Number(n).toFixed(2)+' %':'—';
const rows=[
 '# CryptoJuju — Daily 1D → Vector 15M / 1H / 4H sur 5 marchés',
 '',
 '**'+report.status+'** — '+report.validated+' / '+report.expectedCases+' configurations',
 '',
 'Données Bitunix publiques avec double lecture complète de chaque fenêtre et contrôle causal.',
 'Filtre strict : seuls les signaux alignés avec une direction Daily confirmée entrent.',
 'Filtre souple : jours MIXED admis; jours UNKNOWN et manquants toujours bloqués.',
 '',
 '| Marché | TF | 1D fermées | Signaux V1.1 vus | Strict admis | Souple admis |',
 '|---|---|---:|---:|---:|---:|',
 ...report.cases.map(x=>'| '+x.symbol+' | '+x.timeframe+' | '+x.dailyBars+
  ' | '+(x.filters?.v11_daily_aligned?.seen??'—')+
  ' | '+(x.filters?.v11_daily_aligned?.accepted??'—')+
  ' | '+(x.filters?.v11_daily_soft?.accepted??'—')+' |'),
 '',
 '## Signaux rejetés par le Daily : évolution à 6 bougies (DESCRIPTIF)',
 'Le mouvement directionnel vers la clôture six bougies plus tard ne représente pas un profit, car les signaux peuvent se chevaucher et être refusés alors qu’une position est déjà ouverte.',
 '| Marché | UT | Politique | Rejets opposés observés | Rejets utilisables | Mouvement moyen directionnel 6 bougies | Excursion favorable moyenne | Échantillon |',
 '|---|---|---|---:|---:|---:|---:|---|',
 ...report.cases.flatMap(x=>['v11_daily_aligned','v11_daily_soft'].map(mode=>{
   const q=x.opportunity?.[mode]?.groupsByHorizon?.[6]?.rejected_opposed;
   return '| '+x.symbol+' | '+x.timeframe+' | '+mode+' | '+
     (q?.observedSignals??'—')+' | '+(q?.eligibleOutcomeBars??'—')+
     ' | '+f(q?.meanDirectionalCloseChangePct)+
     ' | '+f(q?.meanMaxFavorableExcursionPct)+
     ' | '+(q?.sampleGate??'BLOQUÉ')+' |';
 })),
 '',
 '## Rendement historique simulé (holdout inspecté; ne prouve pas une stratégie supérieure)',
 '| Marché | TF | Mode | Trades | Rendement net | Drawdown | Échantillon |',
 '|---|---|---|---:|---:|---:|---|',
 ...report.cases.flatMap(x=>x.results.length?x.results.map(r=>
  '| '+x.symbol+' | '+x.timeframe+' | '+r.mode+' | '+r.holdoutTrades+
  ' | '+f(r.holdoutReturnPct)+' | '+f(r.holdoutMaxDrawdownPct)+
  ' | '+r.sampleAdequacy+' |'):
  ['| '+x.symbol+' | '+x.timeframe+' | **BLOQUÉ** | — | — | — | '+x.reason+' |']),
 '',
 '## Paper trades isolés sur signaux rejetés vs alignés : stop, objectif, frais et risque',
 'Règle figée : ATR Wilder(14), stop = 1,5 ATR, take-profit = 2R, durée max 12 bougies; exposition limitée au capital, budget risque nominal 1 % et aucun levier. Base : 0,06 % frais + 0,05 % glissement par côté. Stress : 0,10 % + 0,20 %. Hypothèses, pas coûts réellement mesurés.',
 '| Marché | UT | Hypothèse frais | Cohorte | Trades holdout | Retour net fictif | Drawdown réalisé |',
 '|---|---|---|---|---:|---:|---:|',
 ...report.cases.flatMap(x=>['base','stress'].flatMap(cost=>
   ['daily_opposed','aligned'].map(group=>{
     const r=x.standaloneRiskPaper?.scenarios?.[cost]?.[group]?.holdout;
     return '| '+x.symbol+' | '+x.timeframe+' | '+cost+' | '+group+
       ' | '+(r?.tradeCount??'—')+' | '+f(r?.returnPct)+
       ' | '+f(r?.realizedMaxDrawdownPct)+' |';
   }))),
 '',
 'Ces transactions autonomes ne simulent PAS les positions préexistantes du vrai portefeuille Vector. Ne pas additionner les rendements.',
 '',
 '## Persistance Daily vs mouvements 1H (hypothèse « 90 % »)',
 '| Marché | Continuité Daily | Jours éligibles | 1H EMA alignées (holdout) | Bougies 1H sens Daily (holdout) |',
 '|---|---:|---:|---:|---:|',
 ...report.cases.filter(x=>x.timeframe==='1h').map(x=>'| '+x.symbol+
  ' | '+f(x.persistence?.dailyRetainedNextDayPct)+
  ' | '+(x.persistence?.directionalDayTransitions??'—')+
  ' | '+f(x.persistence?.holdout?.directionalHourlyAlignmentPct)+
  ' | '+f(x.persistence?.holdout?.hourlyPriceDirectionAgreementPct)+' |'),
 '',
 ...report.assumptions.map(x=>'- '+x),
 '',
 'Aucun ordre, promotion ou déploiement; la prochaine étape exige plus de données et de trades.'
];
await writeFile(join(folder,'five-market-daily-mtf-summary.md'),rows.join('\n')+'\n');
console.log('FIVE_DAILY_MTF_SUMMARY '+JSON.stringify({
 status:report.status,validated:report.validated,blocked:report.blocked,
 error:report.error??null
}));
if(report.blocked)process.exitCode=2;
