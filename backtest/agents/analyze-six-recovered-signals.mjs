/*
 * Diagnose the EXACT six Vector daily-opposed signals recovered by run
 * 44626524231. Consumes the archived GitHub Action artifact, NOT a new REST
 * window, so dates and market candles cannot silently drift.
 *
 * Counterfactual method: start from STRICT one-position portfolio and
 * restore exactly ONE candidate at its prior confirmation, all other
 * commands unchanged. Compare whole-phase return with the same strict
 * portfolio, under both friction assumptions. Deltas are NOT additive.
 */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {indexCompletedDaily,lastKnownDaily} from './vector-daily-intraday-alignment.mjs';
import {vectorRegimeFeatures} from '../vector-v13-regime.mjs';
import {runIntegratedVectorRiskStudy,INTEGRATED_RECOVERY_LOCK}
 from './vector-integrated-risk.mjs';

const from=resolve(process.argv[2]??'');
const to=resolve(process.argv[3]??'recovered-signal-audit');
if(!process.argv[2])throw Error('Archived GitHub artifact path is required');
await mkdir(to,{recursive:true});
const load=async(path)=>JSON.parse(await readFile(join(from,path),'utf8'));
const save=async(name,v)=>writeFile(join(to,name),JSON.stringify(v,null,2)+'\n');
const sha=a=>createHash('sha256').update(JSON.stringify(a)).digest('hex');
const iso=n=>new Date(n).toISOString();
const mt=n=>new Intl.DateTimeFormat('fr-CA',{
 timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit',
 hour:'2-digit',minute:'2-digit',hour12:false
}).format(new Date(n));
const round=n=>Number.isFinite(n)?Math.round(n*1e6)/1e6:null;
const isEq=(a,b)=>Math.abs(a-b)<1e-6;
const sourceReport=await load('integrated-portfolio-summary.json');
if(sourceReport.protocol!=='CJ_VECTOR_1H_THREE_MARKET_INTEGRATED_RISK_V1'||
   sourceReport.status!=='THREE_MARKETS_INTEGRATED_PAPER_READY'||
   sourceReport.verified!==3||sourceReport.blocked!==0)
 throw Error('Original integrated paper report is not the successful archived source');

const findings=[],groups=[],summary={
 protocol:'CJ_EXACT_SIX_VECTOR_EMA_RECOVERY_SIGNAL_REVIEW_V1',
 artifactFromRunId:44626524231,archivedAtUtc:sourceReport.generatedAtUtc,
 auditStartedUtc:new Date().toISOString(),
 originalSymbolSet:[...INTEGRATED_RECOVERY_LOCK.symbols],
 status:'RESEARCH_AUDIT_INCOMPLETE',
 expectedRecoveredSignals:6,
 exactSignals:[],perMarket:[],marketTotals:[],
 resultsAreHistorical:true,ordersPlaced:false,indicatorPromoted:false,
 disclaimers:[
  'Candidates come from the exact archived artifact, not a new Bitunix REST snapshot.',
  'A counterfactual restores ONE opposite-Daily signal into an otherwise strict portfolio, with all previously selected rules unchanged.',
  'Counterfactual phase return difference is NOT per-trade PnL and is NOT additive across signals: stops and later entry states interact.',
  'The daily source and hourly candle are only used after they are closed; newer bars are inspected solely for ex-post simulation.',
  'Training/holdout are pre-inspected historical data, not statistically independent prospective evidence.',
  'Risk-based paper fills omit funding, live spread, book liquidity and real slippage validation; no orders or promotion.'
 ]
};
const bySymbol=Object.fromEntries(sourceReport.cases.map(v=>[v.symbol,v]));
for(const symbol of INTEGRATED_RECOVERY_LOCK.symbols){
 const [log,day,hour,commands,paper]=await Promise.all([
   load(symbol+'-research-summary.json'),
   load(symbol+'-daily-two-reads.json'),
   load(symbol+'-hourly-read-one.json'),
   load(symbol+'-causal-confirmed-commands.json'),
   load(symbol+'-integrated-portfolio-trades.json')
 ]);
 if(log.status!=='SIMULATED_ONE_POSITION_PORTFOLIO_ONLY'||
    bySymbol[symbol]?.status!==log.status||
    paper.status!=='SIMULATED_ONE_POSITION_PORTFOLIO_ONLY'||
    hour.status!=='DATA_READY_FOR_RESEARCH_ONLY'||
    day.status!=='DAILY_RESEARCH_COMPLETE'||
    hour.market.symbol!==symbol||day.source.market.symbol!==symbol||
    paper.market.symbol!==symbol||
    hour.acceptedCandles.length!==960||
    sha(hour.rawRows)!==hour.provenance.rawSha256||
    sha(hour.acceptedCandles)!==hour.provenance.derivedSha256||
    sha(day.source.rawRows)!==day.source.provenance.rawSha256||
    sha(day.source.acceptedCandles)!==day.source.provenance.derivedSha256||
    log.sourceSha256?.hourly!==hour.provenance.rawSha256||
    log.sourceSha256?.daily!==day.source.provenance.rawSha256)
  throw Error('Archived source/provenance SHA or window mismatch '+symbol);

 const bars=hour.acceptedCandles;
 const idx=indexCompletedDaily(day.source);
 const emAs=vectorRegimeFeatures(bars);
 const strat=commands.strategies;
 if(!INTEGRATED_RECOVERY_LOCK.strategyIds.every(x=>Array.isArray(strat[x])))
  throw Error('Not all archived portfolio policies present '+symbol);
 const storedRecovery=strat.v13_ema_confirmed_recovery;
 const strict=strat.v11_daily_strict;
 const strictByTime=new Map(strict.map(x=>[x.time,x.side]));
 const recovered=storedRecovery.filter(x=>strictByTime.get(x.time)!==x.side);
 if(recovered.length!==log.recovered||
    recovered.length!==commands.stats?.recovery?.recovered)
  throw Error('Recovered count differs from archived report '+symbol);
 const allClose = new Map(bars.map((x,i)=>[x.time,i]));
 const rebuilt=runIntegratedVectorRiskStudy({
  bars,market:hour.market,historyWindow:hour.historyWindow,commandsByVariant:strat
 });
 for(const cost of ['base','stress'])
  for(const mode of INTEGRATED_RECOVERY_LOCK.strategyIds)
   for(const phase of ['training','holdout']){
    const a=rebuilt.scenarios[cost][mode][phase];
    const b=paper.scenarios[cost][mode][phase];
    if(a.tradeCount!==b.tradeCount||!isEq(a.returnPct,b.returnPct)||
       !isEq(a.finalCapital,b.finalCapital))
      throw Error('Integrated archive replay does not match '+[symbol,cost,mode,phase].join(' '));
   }
 const splitMs=Date.parse(paper.splitAtUtc);
 const per={symbol,reportedRecovered:log.recovered,
  confirmedRecoveryCount:recovered.length,trainingRecovered:0,holdoutRecovered:0,
  baseTrainingRecoveryDeltaPctPoints:round(
    paper.scenarios.base.v13_ema_confirmed_recovery.training.returnPct-
    paper.scenarios.base.v11_daily_strict.training.returnPct),
  baseHoldoutRecoveryDeltaPctPoints:round(
    paper.scenarios.base.v13_ema_confirmed_recovery.holdout.returnPct-
    paper.scenarios.base.v11_daily_strict.holdout.returnPct),
  stressTrainingRecoveryDeltaPctPoints:round(
    paper.scenarios.stress.v13_ema_confirmed_recovery.training.returnPct-
    paper.scenarios.stress.v11_daily_strict.training.returnPct),
  stressHoldoutRecoveryDeltaPctPoints:round(
    paper.scenarios.stress.v13_ema_confirmed_recovery.holdout.returnPct-
    paper.scenarios.stress.v11_daily_strict.holdout.returnPct)
 };
 for(const signal of recovered){
  const i=allClose.get(signal.time);
  if(i===undefined||i>=bars.length-1)throw Error('Candidate not on executable closed bar');
  const confirmAt=bars[i].time+3600000;
  const historicalDaily=lastKnownDaily(idx,confirmAt,{safetyDelayMs:120000});
  const e=emAs[i],direction=signal.side==='long'?1:-1;
  const expectedEma=direction>0?'bull_stack':'bear_stack';
  const strictOld=strictByTime.get(signal.time)??null;
  if(!historicalDaily||historicalDaily.closedAt+120000>confirmAt||
     !['long','short'].includes(signal.side)||historicalDaily.side===null||
     historicalDaily.side===signal.side||e.regime!==expectedEma||
     !(strictOld==='flat'||strictOld===null))
   throw Error('Recovered signal cannot be justified by completed Daily / EMA '+symbol);
  const phase=confirmAt<splitMs?'training':confirmAt>splitMs?'holdout':'boundary';
  if(phase==='boundary')throw Error('Recovered signal at split is ambiguous');
  if(phase==='training')per.trainingRecovered++;else per.holdoutRecovered++;
  // Single-candidate experiment: full historical context unchanged, only one
  // previously vetoed command restored.
  const soloSignals=[...strict.filter(c=>c.time!==signal.time),signal]
    .sort((a,b)=>a.time-b.time);
  const only={...strat,v13_ema_confirmed_recovery:soloSignals};
  const solo=runIntegratedVectorRiskStudy({
    bars,market:hour.market,historyWindow:hour.historyWindow,commandsByVariant:only
  });
  const byFriction={};
  for(const cost of ['base','stress']){
   const strictPhase=paper.scenarios[cost].v11_daily_strict[phase];
   const fullPhase=paper.scenarios[cost].v13_ema_confirmed_recovery[phase];
   const soloPhase=solo.scenarios[cost].v13_ema_confirmed_recovery[phase];
   const recEntry=fullPhase.trades.find(t=>t.entryTime===confirmAt);
   const strictEntry=strictPhase.trades.find(t=>t.entryTime===confirmAt);
   const soloEntry=soloPhase.trades.find(t=>t.entryTime===confirmAt);
   byFriction[cost]={
    phase,strictReturnPct:strictPhase.returnPct,
    allSixPortfolioReturnPct:fullPhase.returnPct,
    soloRecoveryReturnPct:soloPhase.returnPct,
    soloMinusStrictPctPoints:round(soloPhase.returnPct-strictPhase.returnPct),
    fullRecoveryMinusStrictPctPoints:round(fullPhase.returnPct-strictPhase.returnPct),
    strictTradeCount:strictPhase.tradeCount,
    soloTradeCount:soloPhase.tradeCount,
    fullRecoveryTradeCount:fullPhase.tradeCount,
    recoveredCommandCreatesSoloEntry:Boolean(soloEntry),
    recoveredCommandCreatesFullVariantEntry:Boolean(recEntry),
    strictWasEntryAtSameTime:Boolean(strictEntry),
    fullVariantEntryIfAny:recEntry??null,
    soloEntryIfAny:soloEntry??null
   };
  }
  const horizonOutcome={};
  for(const h of [3,6,12]){
   const last=i+h;
   if(last>=bars.length){horizonOutcome[h]=null;continue;}
   const open=bars[i+1].open,close=bars[last].close;
   horizonOutcome[h]={
    directionalCloseChangePct:round(direction*100*(close-open)/open),
    absoluteExitClose:close,
    eligibleForStudyOnly:true
   };
  }
  const o={
   id:symbol+'-'+iso(confirmAt),
   symbol,side:signal.side,
   confirmationCandleOpenedUtc:iso(signal.time),
   confirmedAndExecutableFromUtc:iso(confirmAt),
   confirmedAndExecutableFromQuebec:mt(confirmAt),
   phase,
   previousStrictCommand:strictOld,
   confirmedDaily:{regime:historicalDaily.regime,side:historicalDaily.side,
     latestClosedAtUtc:iso(historicalDaily.closedAt)},
   confirmedOneHour:{regime:e.regime,
     close:e.close,ema21:round(e.ema21),ema34:round(e.ema34),
     ema50:round(e.ema50),ema50SlopePct:round(e.ema50SlopePct)},
   nextOpenPrice:bars[i+1].open,
   fixedHorizonRawDirectionOnly:horizonOutcome,
   isolatedCounterfactual:byFriction,
   note:'Portfolio deltas measured over full chronological training/holdout segment, cannot be attributed to a hypothetical single isolated trade.'
  };
  findings.push(o);
  console.log('RECOVERED_SIGNAL_DETAIL '+JSON.stringify({
   id:o.id,side:o.side,phase:o.phase,
   daily:o.confirmedDaily,ema:o.confirmedOneHour,
   strictCommand:strictOld,
   soloBaseReturnDeltaPctPoints:byFriction.base.soloMinusStrictPctPoints,
   soloStressReturnDeltaPctPoints:byFriction.stress.soloMinusStrictPctPoints,
   actualFullRecoveryEntry:byFriction.base.recoveredCommandCreatesFullVariantEntry,
   nextOpen:o.nextOpenPrice,
   forward3h:o.fixedHorizonRawDirectionOnly[3]?.directionalCloseChangePct??null,
   forward6h:o.fixedHorizonRawDirectionOnly[6]?.directionalCloseChangePct??null,
   forward12h:o.fixedHorizonRawDirectionOnly[12]?.directionalCloseChangePct??null,
   soloBaseTrade:byFriction.base.soloEntryIfAny?{
     entryTimeUtc:iso(byFriction.base.soloEntryIfAny.entryTime),
     exitTimeUtc:iso(byFriction.base.soloEntryIfAny.exitTime),
     exitReason:byFriction.base.soloEntryIfAny.exitReason,
     netSimulatedPnl:byFriction.base.soloEntryIfAny.netPnl,
     entryPrice:byFriction.base.soloEntryIfAny.entryPrice,
     exitPrice:byFriction.base.soloEntryIfAny.exitPrice,
     hitStopAndTargetSameCandle:byFriction.base.soloEntryIfAny.stopTargetCollision
   }:null,
   fullBaseTrade:byFriction.base.fullVariantEntryIfAny?{
     exitTimeUtc:iso(byFriction.base.fullVariantEntryIfAny.exitTime),
     exitReason:byFriction.base.fullVariantEntryIfAny.exitReason,
     netSimulatedPnl:byFriction.base.fullVariantEntryIfAny.netPnl
   }:null,
   soloStressTrade:byFriction.stress.soloEntryIfAny?{
     exitReason:byFriction.stress.soloEntryIfAny.exitReason,
     netSimulatedPnl:byFriction.stress.soloEntryIfAny.netPnl
   }:null
  }));
 }
 groups.push(per);
 console.log('RECOVERED_MARKET_REPLAY '+JSON.stringify(per));
}
if(findings.length!==6||
   findings.filter(x=>x.symbol==='HYPEUSDT').length!==3||
   findings.filter(x=>x.symbol==='1000PEPEUSDT').length!==3||
   findings.some(x=>x.symbol==='BTCUSDT'))
 throw Error('The exact 0 BTC / 3 HYPE / 3 PEPE six-event universe did not replay');
summary.status='SIX_ARCHIVED_RECOVERED_SIGNALS_REPLAY_VERIFIED';
summary.exactSignals=findings;
summary.perMarket=groups;
summary.sampleCount=6;
summary.holdoutRecovered=findings.filter(x=>x.phase==='holdout').length;
summary.trainingRecovered=findings.filter(x=>x.phase==='training').length;
await save('six-recovered-signals-full-evidence.json',summary);
const pct=v=>Number.isFinite(v)?v.toFixed(3)+' pp':'—';
const rows=[
 '# CryptoJuju — Les 6 signaux récupérés, vérifiés à partir de l’artefact GitHub original',
 '',
 '**'+summary.status+'** : '+summary.sampleCount+' événements. Historique épinglé à l’exécution 44626524231.',
 '',
 'Cette analyse ne refait aucune requête Bitunix : elle rejoue les SIX commandes réellement sauvegardées, sur les chandelles et le portefeuille initial, en comparant un seul retour de signal contre Daily au portefeuille strict. AUCUN résultat futur ne sert à accepter un signal.',
 '',
 '| Marché | Date Québec (signal confirmé) | LONG/SHORT | Daily fermé | 1H confirmé | Phase | Impact solo base vs strict | Impact solo stress vs strict | Nouvelle entrée? |',
 '|---|---|---|---|---|---|---:|---:|---|',
 ...findings.map(x=>'| '+x.symbol+' | '+x.confirmedAndExecutableFromQuebec+
  ' | '+x.side+' | '+x.confirmedDaily.regime+
  ' | '+x.confirmedOneHour.regime+' | '+x.phase+
  ' | '+pct(x.isolatedCounterfactual.base.soloMinusStrictPctPoints)+
  ' | '+pct(x.isolatedCounterfactual.stress.soloMinusStrictPctPoints)+
  ' | '+(x.isolatedCounterfactual.base.recoveredCommandCreatesFullVariantEntry?'oui':'non')+' |'),
 '',
 '## Impact GLOBAL des commandes récupérées (ne pas additionner aux contre-factuels individuels)',
 '| Marché | Récupérés training | Récupérés holdout | Delta training base | Delta holdout base | Delta training stress | Delta holdout stress |',
 '|---|---:|---:|---:|---:|---:|---:|',
 ...groups.map(x=>'| '+x.symbol+' | '+x.trainingRecovered+
  ' | '+x.holdoutRecovered+' | '+pct(x.baseTrainingRecoveryDeltaPctPoints)+
  ' | '+pct(x.baseHoldoutRecoveryDeltaPctPoints)+
  ' | '+pct(x.stressTrainingRecoveryDeltaPctPoints)+
  ' | '+pct(x.stressHoldoutRecoveryDeltaPctPoints)+' |'),
 '',
 '## Limites',
 ...summary.disclaimers.map(x=>'- '+x),
 '',
 'Aucun modèle promu; les variations de portefeuille sont hypothétiques, préalablement inspectées et insuffisantes pour prouver un avantage.'
];
await writeFile(join(to,'six-recovered-signals-review.md'),rows.join('\n')+'\n');
console.log('SIX_RECOVERED_FINAL '+JSON.stringify({
 status:summary.status,samples:findings.length,
 training:summary.trainingRecovered,holdout:summary.holdoutRecovered,
 groups
}));
