/* Archived fixed-source pilot, or manual collection of the preregistered future
 * window AFTER its end. No moving-window substitution or auto parameter tuning.
 * node .../run-cj-cipher-confirm1.mjs SOURCE_FOLDER OUTPUT_FOLDER
 * node .../run-cj-cipher-confirm1.mjs --prospective OUTPUT_FOLDER
 */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
import {compareBitunixReadbacks} from './bitunix-readback-consistency.mjs';
import {normalizeBitunixOpenEnvelope} from '../ohlc-bitunix-open-envelope.mjs';
import {fetchBitunixDataPilot} from './bitunix-data-pilot.mjs';
import {calculateCjCipherWaveTrend,cjCipherConfirmedCommands} from './cj-cipher-wavetrend-v1.mjs';
import {CIPHER_CONFIRM1_LOCK as lock,runCipherConfirmOneStudy,
 evaluateCipherConfirmationForward} from './cj-cipher-confirm1.mjs';

const forward=process.argv[2]==='--prospective';
if(!process.argv[2]||!process.argv[3])throw Error('Pass source folder (or --prospective) and output folder');
const now=Date.now(),futureEnd=Date.parse(lock.prospective.endExclusiveUtc);
if(forward&&now<futureEnd+120000)
 throw Error('PROSPECTIVE_WINDOW_NOT_COMPLETE; earliest collection '+new Date(futureEnd+120000).toISOString());
const to=resolve(process.argv[3]),from=resolve(process.argv[2]);
await mkdir(to,{recursive:true});
const load=async name=>JSON.parse(await readFile(join(from,name),'utf8'));
const save=async(name,obj)=>writeFile(join(to,name),JSON.stringify(obj,null,2)+'\n');
const hash=x=>createHash('sha256').update(x).digest('hex');
const digest=x=>hash(JSON.stringify(x));
assert.equal(hash(await readFile(new URL('./cj-cipher-wavetrend-v1.mjs',import.meta.url))),lock.referenceJsSha256);
assert.equal(hash(await readFile(new URL('./cj-cipher-wavetrend-v1-source.pine',import.meta.url))),lock.referencePineSha256);
if(!forward){
 assert.equal(hash(await readFile(resolve(lock.archive.path))),lock.archive.sha256);
 // Bind every input file to the hash-pinned ZIP, not merely to metadata in
 // another editable directory. The runner cannot silently substitute history.
 execFileSync('python3',['-c',
  'import sys,zipfile,pathlib; z=zipfile.ZipFile(sys.argv[1]); root=pathlib.Path(sys.argv[2]); '+
  'assert all((root/n).read_bytes()==z.read(n) for n in z.namelist()), "ARCHIVED_INPUT_BYTES_CHANGED"',
  resolve(lock.archive.path),from],{encoding:'utf8'});
 const source=await load('cj-cipher-pilot-summary.json');
 assert.equal(source.status,'CIPHER_3_MARKETS_FIRST_PILOT_COMPLETE');
 assert.deepEqual(source.symbols,lock.symbols);
}
const out={protocol:lock.protocol,generatedAtUtc:new Date(now).toISOString(),
 mode:forward?'REGISTERED_FUTURE_WINDOW':'EXACT_ARCHIVED_KNOWN_HISTORY',
 status:'PARTIAL',sourceRunId:forward?null:lock.archive.runId,
 prospective:lock.prospective,referenceOriginalsUnchanged:true,
 cases:[],optimizedParameters:false,promotedStrategy:null,ordersPlaced:false};
for(const symbol of lock.symbols){
 let first,second;
 if(forward){
  const input={symbol,timeframe:'1h',closedBars:960,anchorBars:3,nowMs:futureEnd+120000};
  first=await fetchBitunixDataPilot(input);second=await fetchBitunixDataPilot(input);
  for(const [name,snapshot] of [['first',first],['second',second]]){
   // Data pilot's nowMs selects the fixed historical end, not actual HTTP time.
   snapshot.fixedWindowAnchorUtc=new Date(input.nowMs).toISOString();
   snapshot.actualCollectedAtUtc=new Date().toISOString();
   await save(symbol+'-source-'+name+'.json',snapshot);
  }
 }else [first,second]=await Promise.all([load(symbol+'-source-first.json'),load(symbol+'-source-second.json')]);
 const readback=compareBitunixReadbacks(first,second);
 assert.equal(readback.status,'STABLE_TWO_READS');assert.equal(readback.checkedDerived,960);
 assert.equal(first.market.symbol,symbol);assert.equal(first.market.timeframe,'1h');
 for(const s of [first,second]){
  assert.equal(digest(s.rawRows),s.provenance.rawSha256);
  assert.equal(digest(s.acceptedCandles),s.provenance.derivedSha256);
  assert.equal(s.provenance.formingBarExcluded,true);
  const normalized=normalizeBitunixOpenEnvelope(s.rawRows,{intervalMs:3600000});
  assert.notEqual(normalized.status,'BLOCKED');
  assert.deepEqual(normalized.candles.filter(c=>c.time>=s.historyWindow.startTime&&
   c.time<s.historyWindow.endTime),s.acceptedCandles);
 }
 if(forward){
  assert.equal(first.historyWindow.endTime,futureEnd);
  assert.equal(first.acceptedCandles[672].time,Date.parse(lock.prospective.startUtc));
 }else{
  const source=await load(symbol+'-summary.json');
  assert.equal(first.provenance.rawSha256,source.sourceSha256.raw);
  assert.equal(first.provenance.derivedSha256,source.sourceSha256.derived);
  const commands=await load(symbol+'-cipher-and-vector-commands.json');
  assert.deepEqual(cjCipherConfirmedCommands(calculateCjCipherWaveTrend(first.acceptedCandles)),
   commands.signals.cj_cipher_wt_v1);
 }
 const result=runCipherConfirmOneStudy({bars:first.acceptedCandles,
  market:first.market,historyWindow:first.historyWindow});
 if(forward)result.status='REGISTERED_PROSPECTIVE_WINDOW_SIMULATION';
 await save(symbol+'-cipher-confirm1-full.json',result);
 const comparisons=structuredClone(result.comparisons);
 for(const cost of ['base','stress'])for(const phase of ['training','holdout'])
  delete comparisons[cost][phase].opportunity.details;
 const item={symbol,sourceRawSha256:first.provenance.rawSha256,
  sourceDerivedSha256:first.provenance.derivedSha256,
  historyWindow:first.historyWindow,comparisons};
 out.cases.push(item);
 console.log('CIPHER_CONFIRM1_CASE '+JSON.stringify({symbol,...comparisons.base.holdout}));
}
out.status=forward?'REGISTERED_FUTURE_WINDOW_COMPLETE':'THREE_MARKETS_ARCHIVED_ATR_COMPARISON_COMPLETE';
out.forwardDecision=forward?evaluateCipherConfirmationForward(out.cases):
 {status:'NOT_EVALUATED_FUTURE_WINDOW_PENDING',eligibleForBroaderResearch:false};
await save('cj-cipher-confirm1-summary.json',out);
const fmt=x=>Number.isFinite(x)?x.toFixed(2):'—';
const lines=['# CJ Cipher V1.0 / V1.1 — comparaison ATR identique','',
 '**'+out.status+'** — '+out.mode+'.',
 '',
 'V1.1 attend une bougie fermée supplémentaire avant entrée; sortie à plat au prochain OPEN dès le croisement original. Aucun paramètre retouché.',
 '',
 '| Marché | Frais | Phase | Trades V1.0 → V1.1 | Retour net V1.0 | Retour net V1.1 | DD clôtures V1.0 → V1.1 | Gagnants V1.0 conservés |',
 '|---|---|---|---:|---:|---:|---:|---:|',
 ...out.cases.flatMap(c=>['base','stress'].flatMap(cost=>['training','holdout'].map(phase=>{
  const x=c.comparisons[cost][phase],b=x.baseline,v=x.variant,o=x.opportunity;
  return `| ${c.symbol} | ${cost} | ${phase} | ${b.tradeCount} → ${v.tradeCount} | ${fmt(b.returnPct)} % | ${fmt(v.returnPct)} % | ${fmt(b.closeMarkedMaxDrawdownPct)} → ${fmt(v.closeMarkedMaxDrawdownPct)} % | ${o.baselineWinnersRetained}/${o.baselineWinners} |`;
 }))),
 '',
 '| Marché (base, 30 % historique) | Candidats rejetés | Sorties à signal opposé ≤6h V1.0 → V1.1 | Gagnants rejetés | Gagnants devenus ≤0 après délai | Longue période sans position V1.0 → V1.1 |',
 '|---|---:|---:|---:|---:|---:|',
 ...out.cases.map(c=>{const x=c.comparisons.base.holdout,o=x.opportunity;
  return `| ${c.symbol} | ${x.candidates.rejectedOppositeCross+x.candidates.rejectedNonpersistent} | ${x.baseline.rapidOppositeExit6} → ${x.variant.rapidOppositeExit6} | ${o.rejectedWinningBaselineTrades} | ${o.delayedBaselineWinnersNowNonpositive} | ${x.baseline.longestWholeBarsWithoutPosition} → ${x.variant.longestWholeBarsWithoutPosition}h |`;
 }),
 '',
 'Les gagnants sont définis rétrospectivement par le bras V1.0 ATR, et non connus au signal. Les données détaillées incluent candidats, sens LONG/SHORT, effets du délai et frontières de phase. Les sorties rapides ne sont pas automatiquement mauvaises.',
 '',
 'Même ATR14/stop 1,5 ATR/cible 2R/timeout 12h/risque nominal 1 %/notionnel ≤100 % pour les deux bras. Base par côté : frais 0,06 % + glissement 0,05 %; stress : 0,10 % + 0,20 %. Funding, spread réel et lots non mesurés. DD sur clôtures uniquement.',
 '',
 forward?'Fenêtre prospective préinscrite terminée. Décision : '+out.forwardDecision.status+'.':
  'Historique déjà consulté : exploration descriptive, pas une validation prospective. Ne pas comparer ces rendements ATR aux anciens rendements reversal-only. Fenêtre future fixée du 2026-11-20T04:00Z au 2026-12-02T04:00Z, pas encore évaluée ni planifiée automatiquement.',
 '',
 'Aucun ordre, aucune promotion automatique. Branche de recherche uniquement; originaux et site public inchangés.'
];
await writeFile(join(to,'cj-cipher-confirm1-summary.md'),lines.join('\n')+'\n');
console.log('CIPHER_CONFIRM1_SUMMARY '+JSON.stringify({status:out.status,forwardDecision:out.forwardDecision}));
