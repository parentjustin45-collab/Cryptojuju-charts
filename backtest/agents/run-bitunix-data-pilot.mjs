/*
 * Configurable closed-candle Bitunix REST checks: default BTC ETH SOL x 15m 1h 4h; optional 5x5 cohort.
 * GitHub Actions only; no orders, no API keys, no background daemon.
 * Saves raw/derived OHLC and provenance as a transient CI artifact.
 */
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {makeBitunixFetchPage} from '../bitunix-adapter.mjs';
import {PILOT_SYMBOLS,PILOT_TIMEFRAMES} from './bitunix-data-pilot.mjs';
import {FIVE_CRYPTO_SYMBOLS,FIVE_TIMEFRAMES,isFiveByFive} from './render/five-by-five.mjs';
import {renderBitunixDataCenterHtml} from './bitunix-data-center-view.mjs';
import {fetchHourlyVerifiedWindow,summarizeHourlyFailure} from './hourly-bitunix-recovery.mjs';

const destination=resolve(process.argv[2]??'bitunix-data-pilot-report');
const closedBars=Number(process.env.CJ_DATA_PILOT_BARS??96);
const expanded=isFiveByFive();
const symbols=expanded?FIVE_CRYPTO_SYMBOLS:PILOT_SYMBOLS;
const timeframes=expanded?FIVE_TIMEFRAMES:PILOT_TIMEFRAMES;
if(!Number.isInteger(closedBars)||closedBars<4||closedBars>960)
  throw Error('CJ_DATA_PILOT_BARS must be 4..960');
const anchorTime=Date.now();
const fetchPage=makeBitunixFetchPage({
  fetchImpl:(url,opts)=>fetch(url,{
    ...opts,signal:AbortSignal.timeout(18000),cache:'no-store',credentials:'omit'
  })
});
await mkdir(destination,{recursive:true});
const summary={
  protocol:'CRYPTOJUJU_REAL_BITUNIX_DATA_INGEST_V1',
  startedAtUtc:new Date(anchorTime).toISOString(),
  dataSource:'Official Bitunix public Futures REST LAST_PRICE',
  independentTradingViewParity:false,
  continuousService:false,
  realIndicatorSignals:false,
  tradingEnabled:false,
  branch:'dev/ai-agents-phase1',
  cohort:expanded?'FIVE_BY_FIVE':'LEGACY_3X3',
  expectedCases:symbols.length*timeframes.length,
  checks:[]
};
for(const symbol of symbols){
  for(const timeframe of timeframes){
    const {first:out,second,readback,anchorBars,attempts,recovered}=await fetchHourlyVerifiedWindow({
      symbol,timeframe,closedBars,nowMs:anchorTime,fetchPage
    });
    const name=symbol+'-'+timeframe;
    await writeFile(resolve(destination,name+'.json'),JSON.stringify(out,null,2)+'\n');
    await writeFile(resolve(destination,name+'-repeatability.json'),JSON.stringify(readback,null,2)+'\n');
    if(attempts.length)
      await writeFile(resolve(destination,name+'-anchor-recovery.json'),JSON.stringify({attempts,second,anchorBars,recovered},null,2)+'\n');
    if(second&&readback.status!=='STABLE_TWO_READS')
      await writeFile(resolve(destination,name+'-second-read-when-blocked.json'),JSON.stringify(second,null,2)+'\n');
    const stable=readback.status==='STABLE_TWO_READS';
    const s={symbol,timeframe,status:stable?'DATA_READY_FOR_RESEARCH_ONLY':'BLOCKED',
      requestedBars:closedBars,
      acceptedBars:out.acceptedCandles.length,
      rawCount:out.provenance?.rawCount??0,
      corrections:out.quality?.corrected??0,
      unresolved:out.quality?.unresolved??0,
      quality:out.quality??null,
      sha256:out.provenance?.rawSha256??null,
      consistencyStatus:readback.status,
      repeatCheckedBars:readback.checkedDerived??0,
      differenceCount:readback.differenceCount??0,
      anchorBars,recoveryAttempts:attempts.length,recovered,
      failureDetails:stable?null:summarizeHourlyFailure(out,readback),
      reason:stable?null:(out.reason??readback.reason)};
    summary.checks.push(s);
    console.log('BITUNIX_DATA '+JSON.stringify(s));
  }
}
summary.finishedAtUtc=new Date().toISOString();
summary.passed=summary.checks.filter(x=>x.status==='DATA_READY_FOR_RESEARCH_ONLY').length;
summary.blocked=summary.checks.length-summary.passed;
summary.status=summary.blocked?'BLOCKED_OR_PARTIAL':'PASS_PUBLIC_BITUNIX_DATA_WINDOWS';
summary.warning=`Repeatability compares a second HTTP pull of the full ${closedBars} CLOSED bars per configuration (identical start/end and anchor), not only 24 bars. No continuous uptime, independent TradingView parity or indicator-performance proof.`;
await writeFile(resolve(destination,'summary.json'),JSON.stringify(summary,null,2)+'\n');
const md=[
  '# CryptoJuju — Données Bitunix réelles, premier pilote',
  '',
  `Statut : **${summary.status}** · ${summary.passed}/${summary.checks.length} fenêtres acceptées`,
  '',
  '| Marché | UT | Chandelles acceptées | Anomalies dérivées | Statut |',
  '|---|---|---:|---:|---|',
  ...summary.checks.map(x=>`| ${x.symbol} | ${x.timeframe} | ${x.acceptedBars}/${x.requestedBars} | ${x.corrections} | ${x.status} |`),
  '',
  '> Source : Bitunix public REST LAST_PRICE. Aucune parité indépendante TradingView.',
  `> Relecture immédiate : la même fenêtre de ${closedBars} chandelles fermées comparée entièrement aux valeurs initiales.`,
  '> Aucun signal réel, transaction ou backtest lancé depuis ce workflow.'
];
await writeFile(resolve(destination,'summary.md'),md.join('\n')+'\n');
await writeFile(resolve(destination,'data-center.html'),renderBitunixDataCenterHtml(summary));
console.log('SUMMARY '+JSON.stringify({status:summary.status,passed:summary.passed,blocked:summary.blocked}));
if(summary.blocked)process.exitCode=2;
