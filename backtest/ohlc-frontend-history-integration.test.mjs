/* Tests extract REAL frontend functions from index.html. No parallel reimplementation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const grab=(start,end)=>{
 const i=html.indexOf(start),j=html.indexOf(end,i+start.length);
 assert.ok(i>=0&&j>i,'frontend source missing: '+start);
 return html.slice(i,j);
};
const source=[
 grab('function normalizeHistoryBuckets(rows,f){','/* DEV V1.26.0 — validate Bitunix REST OHLC before using chart/indicators.'),
 grab('function cjPrepareBitunixHistoricalEnvelope(rows,tf,nowMs=Date.now()){','/* DEV-ONLY opt-in trace')
].join('\n');
const steps={'15m':900,'1h':3600,'4h':14400};
const {cjPrepareBitunixHistoricalEnvelope,cjValidateBitunixLiveEnvelope}=runInNewContext(
 source+'\n;({cjPrepareBitunixHistoricalEnvelope,cjValidateBitunixLiveEnvelope})',{
  Math,Number,Date,Map,JSON,
  bucketTime:(t,tf)=>Math.floor(Number(t)/steps[tf])*steps[tf],
  intervalSeconds:tf=>steps[tf]
 });
const t0=Date.UTC(2026,10,12)/1000;
const clean=(tf,n=500)=>{
 const step=steps[tf];
 return Array.from({length:n},(_,i)=>({time:t0+i*step,open:100,high:105,low:95,
  close:100,volume:1+i}));
};
for(const tf of ['15m','1h','4h']){
 test(tf+' actual chart loads 500 closed candles unchanged if OHLC coherent',()=>{
  const raw=clean(tf),out=cjPrepareBitunixHistoricalEnvelope(raw,tf,(raw.at(-1).time+2*steps[tf])*1000);
  assert.equal(out.status,'CLEAN_RAW');assert.equal(out.issues.length,0);
  assert.equal(out.data.length,500);assert.equal(out.checkedClosed,500);
  assert.deepEqual(JSON.parse(JSON.stringify(out.data)),raw);
 });
 test(tf+' derives only opening envelope, raw 500-candle history untouched',()=>{
  const raw=clean(tf),rawCopy=JSON.stringify(raw);
  raw[123]={...raw[123],high:99.9,close:97};
  raw[124]={...raw[124],open:97,high:103,low:96,close:100};
  const snapshot=JSON.stringify(raw);
  const out=cjPrepareBitunixHistoricalEnvelope(raw,tf,(raw.at(-1).time+2*steps[tf])*1000);
  assert.equal(out.status,'DERIVED_WITH_RAW_PROVENANCE');
  assert.equal(out.corrected.length,1);
  assert.equal(out.corrected[0].raw.high,99.9);
  assert.equal(out.data[123].high,100);
  assert.equal(out.raw[123].high,99.9);
  assert.equal(JSON.stringify(raw),snapshot);
  assert.notEqual(snapshot,rawCopy);
 });
 test(tf+' unknown bad OHLC blocks signals rather than invent prices',()=>{
  const raw=clean(tf);raw[123]={...raw[123],high:99.9,close:101};
  const out=cjPrepareBitunixHistoricalEnvelope(raw,tf,(raw.at(-1).time+2*steps[tf])*1000);
  assert.equal(out.status,'BLOCKED');assert.equal(out.corrected.length,0);
  assert.equal(out.issues.length,1);
  assert.equal(out.data[123].high,99.9);
 });
 test(tf+' missing candle in chart history is rejected',()=>{
  const raw=clean(tf);raw.splice(55,1);
  const out=cjPrepareBitunixHistoricalEnvelope(raw,tf,(raw.at(-1).time+2*steps[tf])*1000);
  assert.equal(out.status,'BLOCKED');
  assert.ok(out.issues.some(x=>x.reason==='MISSING_OR_REPEATED_BUCKET'));
 });
 test(tf+' live Kline OHLC envelope must be proven by previous close',()=>{
  const last={...clean(tf,2)[1],time:t0};
  const time=last.time+steps[tf],o={interval:tf,data:[last]};
  const candidate={time,open:100,high:99.9,low:95,close:97,volume:3};
  const good=cjValidateBitunixLiveEnvelope(o,candidate,time);
  assert.equal(good.ok,true);assert.equal(good.derived,true);
  assert.equal(good.bar.high,100);assert.equal(candidate.high,99.9);
  assert.equal(cjValidateBitunixLiveEnvelope(o,{...candidate,open:101},time).ok,false);
  assert.equal(cjValidateBitunixLiveEnvelope(o,{...candidate,close:101},time).ok,false);
 });
}
test('Chart passes exactly the validated series to indicators and data renderer',()=>{
 assert.match(html,/o\.cjHistoryRaw=prep\.raw;o\.cjHistoryQuality=prep/);
 assert.match(html,/if\(prep\.status==="BLOCKED"\)throw Error/);
 assert.match(html,/o\.data=prep\.data/);
 assert.match(html,/o\.cs\.setData\(o\.data\)/);
 assert.match(html,/renderIndicators\(o\);o\.ch\.timeScale\(\)\.fitContent\(\)/);
});
