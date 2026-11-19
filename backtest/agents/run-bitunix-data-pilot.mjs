/*
 * Nine read-only Bitunix REST checks: BTC ETH SOL x 15m 1h 4h.
 * GitHub Actions only; no orders, no API keys, no background daemon.
 * Saves raw/derived OHLC and provenance as a transient CI artifact.
 */
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {makeBitunixFetchPage} from '../bitunix-adapter.mjs';
import {PILOT_SYMBOLS,PILOT_TIMEFRAMES,fetchBitunixDataPilot} from './bitunix-data-pilot.mjs';

const destination=resolve(process.argv[2]??'bitunix-data-pilot-report');
const closedBars=Number(process.env.CJ_DATA_PILOT_BARS??96);
if(!Number.isInteger(closedBars)||closedBars<4||closedBars>480)
  throw Error('CJ_DATA_PILOT_BARS must be 4..480');
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
  checks:[]
};
for(const symbol of PILOT_SYMBOLS){
  for(const timeframe of PILOT_TIMEFRAMES){
    let out;
    try{
      out=await fetchBitunixDataPilot({
        symbol,timeframe,closedBars,nowMs:anchorTime,
        fetchPage
      });
    }catch(e){
      out={market:{symbol,timeframe},status:'BLOCKED',reason:'UNHANDLED_FETCH_OR_VALIDATION_ERROR',
        error:String(e?.message??e),acceptedCandles:[]};
    }
    await writeFile(resolve(destination,`${symbol}-${timeframe}.json`),
      JSON.stringify(out,null,2)+'\n');
    const s={symbol,timeframe,status:out.status,
      requestedBars:closedBars,
      acceptedBars:out.acceptedCandles.length,
      rawCount:out.provenance?.rawCount??0,
      corrections:out.quality?.corrected??0,
      unresolved:out.quality?.unresolved??0,
      quality:out.quality??null,
      sha256:out.provenance?.rawSha256??null,
      reason:out.reason??null};
    summary.checks.push(s);
    console.log('BITUNIX_DATA '+JSON.stringify(s));
  }
}
summary.finishedAtUtc=new Date().toISOString();
summary.passed=summary.checks.filter(x=>x.status==='DATA_READY_FOR_RESEARCH_ONLY').length;
summary.blocked=summary.checks.length-summary.passed;
summary.status=summary.blocked?'BLOCKED_OR_PARTIAL':'PASS_PUBLIC_BITUNIX_DATA_WINDOWS';
summary.warning='Source is Bitunix only; no separate TradingView price parity and no indicator or backtest validation.';
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
  '> Aucun signal réel, transaction ou backtest lancé depuis ce workflow.'
];
await writeFile(resolve(destination,'summary.md'),md.join('\n')+'\n');
console.log('SUMMARY '+JSON.stringify({status:summary.status,passed:summary.passed,blocked:summary.blocked}));
if(summary.blocked)process.exitCode=2;
