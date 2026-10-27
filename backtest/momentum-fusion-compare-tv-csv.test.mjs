import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateMomentumFusion} from './momentum-fusion-v1.mjs';
import {compareTradingViewCsv,TV_PARITY_PROTOCOL}
 from './momentum-fusion-compare-tv-csv.mjs';
const H=3600000,BEGIN=Date.UTC(2026,7,5,0);
const labels=['time','open','high','low','close','MomFusion | Parity Probe:Composite original',
 'MomFusion | Parity Probe:CHECK RSI14',
 'MomFusion | Parity Probe:CHECK StochRSI14 SMA3',
 'MomFusion | Parity Probe:CHECK Momentum10',
 'MomFusion | Parity Probe:CHECK PercentRank100',
 'MomFusion | Parity Probe:CHECK EMA21',
 'MomFusion | Parity Probe:CHECK EMA55',
 'MomFusion | Parity Probe:CHECK BullSignal 1/0',
 'MomFusion | Parity Probe:CHECK BearSignal 1/0',
 'MomFusion | Parity Probe:CHECK PivotLow confirmed NOW',
 'MomFusion | Parity Probe:CHECK PivotHigh confirmed NOW'];
function fixture(n=320){
 const bars=Array.from({length:n},(_,i)=>{
  const v=120+5*Math.sin(i*.1)+2*Math.sin(i*.035)+.006*i,
   o=v-.13,c=v+.2*Math.sin(i*.67);
  return {time:BEGIN+i*H,open:o,high:Math.max(o,c)+.8,
   low:Math.min(o,c)-.9,close:c,volume:1000};
 });
 const calc=calculateMomentumFusion(bars);
 const val=v=>v===null?'':typeof v==='boolean'?Number(v):
  Number.isFinite(v)?v.toFixed(9):'';
 const rows=bars.map((b,i)=>{
  const r=calc[i];
  return [new Date(b.time).toISOString(),b.open,b.high,b.low,b.close,
   val(r.composite),val(r.rsi),val(r.stochRsi),
   i>=10?val(b.close-bars[i-10].close):'',
   val(r.momentumRank),val(r.emaFast),val(r.emaSlow),
   val(r.bullSignal),val(r.bearSignal),
   val(r.pivotLowConfirmed),val(r.pivotHighConfirmed)];
 });
 return {bars,rows,csv:[labels,...rows].map(row=>row.join(',')).join('\n')+'\n'};
}
test('A full source-identical synthetic TV CSV compares all 11 diagnostic outputs',()=>{
 const x=compareTradingViewCsv(fixture().csv);
 assert.equal(x.verdict,'MATCHED_CSV_WITHIN_TOLERANCE');
 assert.equal(x.bars,320);
 assert.ok(x.comparedValues>1000);
 assert.equal(x.mismatchedValues,0);
 assert.equal(Object.keys(x.byField).length,11);
});
test('CSV detects one altered composite, no false parity badge',()=>{
 const {rows}=fixture();
 rows[280][5]='20.000000000';
 const s=[labels,...rows].map(x=>x.join(',')).join('\n');
 const r=compareTradingViewCsv(s);
 assert.equal(r.verdict,'MISMATCH');
 assert.equal(r.byField.composite.mismatch,1);
 assert.equal(r.byField.composite.examples[0].utc,new Date(BEGIN+280*H).toISOString());
});
test('CSV detects reversal marker with wrong bar, even if composite unchanged',()=>{
 const {rows}=fixture();
 rows[275][12]=Number(rows[275][12])?0:1;
 const s=[labels,...rows].map(x=>x.join(',')).join('\n');
 const r=compareTradingViewCsv(s);
 assert.equal(r.verdict,'MISMATCH');
 assert.equal(r.byField.bullSignal.mismatch,1);
});
test('CSV rejects insufficient history, missing label, duplicate time and implicit timezone',()=>{
 const {rows}=fixture();
 const toText=rr=>[labels,...rr].map(x=>x.join(',')).join('\n');
 assert.throws(()=>compareTradingViewCsv(toText(rows.slice(-175))),/Insufficient/);
 const headers=[...labels];headers[6]='unknown RSI';
 assert.throws(()=>compareTradingViewCsv([headers,...rows].map(x=>x.join(',')).join('\n')),
  /Missing\/ambiguous/);
 const dupe=rows.map(r=>[...r]);dupe[260][0]=dupe[259][0];
 assert.throws(()=>compareTradingViewCsv(toText(dupe)),/increasing/);
 const unstamped=rows.map(r=>[...r]);unstamped[185][0]='2026-08-12 20:00:00';
 assert.throws(()=>compareTradingViewCsv(toText(unstamped)),/timezone/);
});
test('CSV refuses invented precision matching on missing reference values after warmup',()=>{
 const {rows}=fixture();
 rows[265][5]='';
 const r=compareTradingViewCsv([labels,...rows].map(x=>x.join(',')).join('\n'));
 assert.equal(r.verdict,'MISMATCH');
 assert.equal(r.byField.composite.mismatch,1);
});
test('CSV supports headers quoted with comma, extra indicator columns, Unix ms',()=>{
 const {rows}=fixture();
 const extraHeaders=[...labels,'Misc, notes'];
 const extended=[extraHeaders.map(x=>x.includes(',')?'"'+x+'"':x).join(','),
  ...rows.map(r=>[r[0].endsWith('Z')?String(Date.parse(r[0])):r[0],
   ...r.slice(1),'"misc, value"'].join(','))].join('\n');
 assert.equal(compareTradingViewCsv(extended).verdict,'MATCHED_CSV_WITHIN_TOLERANCE');
});
test('No raw Bitunix trades, no optimizations or speculative TV comparison claims',()=>{
 assert.match(TV_PARITY_PROTOCOL.id,/parity/);
 assert.equal(TV_PARITY_PROTOCOL.minCsvBars,200);
 assert.equal(TV_PARITY_PROTOCOL.warmupBars,150);
 assert.equal(TV_PARITY_PROTOCOL.timezonePolicy,'REQUIRE_OFFSET_OR_UNIX_EPOCH');
});
