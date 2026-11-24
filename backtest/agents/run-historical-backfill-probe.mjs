/* One-off bounded Bitunix historical availability probes for future 2y backfill.
 * NEVER writes to production Postgres or changes Render agents. Stores source
 * snapshots in a short-lived GitHub Actions artifact for human inspection.
 */
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeBitunixFetchPage} from '../bitunix-adapter.mjs';
import {fetchBitunixDataPilot} from './bitunix-data-pilot.mjs';
import {compareBitunixReadbacks} from './bitunix-readback-consistency.mjs';
import {HISTORICAL_TARGET,planMissingWindows} from './historical-backfill-plan.mjs';
import {VERIFIED_INTERVALS} from './research-batch.mjs';

const PROBES=Object.freeze([
  {symbol:'BTCUSDT',timeframe:'15m'},
  {symbol:'BTCUSDT',timeframe:'30m'},
  {symbol:'BTCUSDT',timeframe:'1d'},
  {symbol:'HYPEUSDT',timeframe:'1h'},
  {symbol:'1000PEPEUSDT',timeframe:'1h'}
]);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
export async function runProbes({
  destination,
  fetchPage=makeBitunixFetchPage({
    fetchImpl:(url,opts)=>fetch(url,{...opts,signal:AbortSignal.timeout(18000),
      cache:'no-store',credentials:'omit'})
  }),
  now=()=>Date.now(),pause=delay,fetchProbe=fetchBitunixDataPilot
}={}){
  if(!destination)throw Error('Output folder is required');
  await mkdir(destination,{recursive:true});
  const summary={
    protocol:'CJ_HISTORICAL_2Y_OLDEST_WINDOW_BOUNDED_PROBE_V1',
    disclaimer:'Probing the oldest 480-bar windows is not a complete 2-year historical backfill.',
    source:'Bitunix public Futures REST LAST_PRICE',
    startedAtUtc:new Date(now()).toISOString(),
    targetStartTime:HISTORICAL_TARGET.startTime,
    targetEndTime:HISTORICAL_TARGET.endTime,
    noTrading:true,noDatabaseWrites:true,noMainChanges:true,
    cases:[]
  };
  for(const {symbol,timeframe} of PROBES){
    const step=VERIFIED_INTERVALS[timeframe];
    const p=planMissingWindows({symbol,timeframe,chunkBars:480});
    const oldest=p.windows[0];
    if(oldest.startTime!==HISTORICAL_TARGET.startTime||oldest.closedBars!==480)
      throw Error('Unexpected oldest probe boundaries');
    const selector={symbol,timeframe,closedBars:480,anchorBars:3,
      nowMs:now(),historicalEndExclusiveMs:oldest.endTime,fetchPage};
    let first,readback={status:'BLOCKED',reason:'FIRST_READ_NOT_VALID'};
    const evidence={symbol,timeframe,window:{
      startTime:oldest.startTime,endTime:oldest.endTime,intervalMs:step},
      testedAtUtc:new Date(selector.nowMs).toISOString()};
    try{
      first=await fetchProbe(selector);
      await writeFile(join(destination,symbol+'-'+timeframe+'-first.json'),
        JSON.stringify(first)+'\n');
      if(first.status==='DATA_READY_FOR_RESEARCH_ONLY'){
        const second=await fetchProbe({...selector,nowMs:now()});
        readback=compareBitunixReadbacks(first,second);
        if(readback.status!=='STABLE_TWO_READS')
          await writeFile(join(destination,symbol+'-'+timeframe+'-second-diagnostic.json'),
            JSON.stringify(second)+'\n');
      }
      Object.assign(evidence,{
        status:readback.status==='STABLE_TWO_READS'?'VERIFIED_OLDEST_WINDOW':'OLDER_WINDOW_NOT_YET_AVAILABLE_OR_UNVERIFIED',
        firstStatus:first.status,firstReason:first.reason??null,
        provenanceFetchedAtUtc:first.provenance?.fetchedAtUtc,
        acceptedBars:first.acceptedCandles?.length??0,
        readbackStatus:readback.status,readbackReason:readback.reason??null,
        sha256:first.provenance?.rawSha256??null
      });
    }catch(err){
      Object.assign(evidence,{status:'PROBE_EXCEPTION',
        error:String(err?.message??err).slice(0,160),acceptedBars:0});
    }
    await writeFile(join(destination,symbol+'-'+timeframe+'-readback.json'),
      JSON.stringify(readback)+'\n');
    summary.cases.push(evidence);
    console.log('CJ_HISTORICAL_PROBE '+JSON.stringify(evidence));
    await pause(350);
  }
  summary.validated=summary.cases.filter(c=>c.status==='VERIFIED_OLDEST_WINDOW').length;
  summary.blocked=summary.cases.length-summary.validated;
  summary.finishedAtUtc=new Date(now()).toISOString();
  summary.status=summary.blocked?'HISTORICAL_AVAILABILITY_PARTIAL_OR_BLOCKED':'ALL_PROBED_WINDOWS_VERIFIED';
  await writeFile(join(destination,'historical-probe-summary.json'),JSON.stringify(summary,null,2)+'\n');
  await writeFile(join(destination,'historical-probe-summary.md'),
    ['# CryptoJuju — Contrôle historique ponctuel (lecture seule)','',
      'Période visée : 24 novembre 2024 — 24 novembre 2026 UTC.',
      'Ce test vérifie **le bloc le plus ancien de 480 chandelles** pour cinq couples représentatifs.',
      'Il ne remplace **pas** le rattrapage historique complet ni la vérification des autres combinaisons.',
      '',
      '| Marché | UT | Plus ancien bloc | Double lecture |',
      '|---|---|---|---|',
      ...summary.cases.map(x=>'| '+x.symbol+' | '+x.timeframe+' | '+x.status+' | '+(x.readbackStatus??'—')+' |'),
      '', 'Aucun ordre réel. Aucune modification à PostgreSQL ni à la branche main.', ''
    ].join('\n'));
  return summary;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
  const dir=process.argv[2];if(!dir)throw Error('Output directory argument required');
  const outcome=await runProbes({destination:resolve(dir)});
  console.log('CJ_HISTORICAL_PROBE_SUMMARY '+JSON.stringify({
    status:outcome.status,passed:outcome.validated,blocked:outcome.blocked}));
  if(outcome.validated===0)process.exitCode=2;
}
