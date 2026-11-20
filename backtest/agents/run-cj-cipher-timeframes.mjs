import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fetchBitunixDataPilot} from './bitunix-data-pilot.mjs';
import {compareBitunixReadbacks} from './bitunix-readback-consistency.mjs';
import {CIPHER_CONFIRM1_LOCK, runCipherConfirmOneStudy} from './cj-cipher-confirm1.mjs';

const output = process.argv[2];
if (!output) throw Error('Pass an output directory');
await mkdir(output, {recursive: true});

const endUtc = '2026-11-20T00:00:00Z';
const results = [];
for (const timeframe of ['15m', '1h', '4h']) {
 for (const symbol of CIPHER_CONFIRM1_LOCK.symbols) {
  const options = {symbol, timeframe, closedBars: 960, nowMs: Date.parse(endUtc)};
  const file = (suffix) => join(output, `${symbol}-${timeframe}-${suffix}.json`);
  try {
   const first = await fetchBitunixDataPilot(options);
   const second = await fetchBitunixDataPilot(options);
   const readback = compareBitunixReadbacks(first, second);
   await writeFile(file('sources'), JSON.stringify({first, second, readback}));
   if (readback.status !== 'STABLE_TWO_READS' || readback.checkedDerived !== 960) {
    throw Error([readback.reason, first.reason, first.fetchError, second.reason, second.fetchError].filter(Boolean).join(' / '));
   }
   const report = runCipherConfirmOneStudy({bars: first.acceptedCandles,
    market: first.market, historyWindow: first.historyWindow});
   await writeFile(file('replay'), JSON.stringify(report));
   const comparisons = structuredClone(report.comparisons);
   for (const phases of Object.values(comparisons)) {
    for (const phase of Object.values(phases)) delete phase.opportunity.details;
   }
   results.push({symbol, timeframe, status: 'COMPLETE', historyWindow: first.historyWindow,
    holdoutStartUtc: report.portfolio.splitAtUtc, provenance: {
     normalizationVersion: first.provenance.normalizationVersion,
     readback, derivedSha256: first.provenance.derivedSha256,
     corrected: first.quality.corrected
    }, comparisons});
  } catch (error) {
   results.push({symbol, timeframe, status: 'BLOCKED', reason: error.message});
  }
  console.log(JSON.stringify(results.at(-1), (key, value) => key === 'comparisons' ? undefined : value));
 }
}
await writeFile(join(output, 'summary.json'), JSON.stringify({
 status: 'HISTORICAL_PAIRED_TIMEFRAME_COMPARISON', endUtc,
 riskPolicy: CIPHER_CONFIRM1_LOCK.risk, results
}, null, 2) + '\n');
if (results.some(result => result.status === 'BLOCKED')) process.exitCode = 2;
