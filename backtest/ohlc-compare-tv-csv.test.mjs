import test from 'node:test';
import assert from 'node:assert/strict';
import {compareTVExport} from './ohlc-compare-tv-csv.mjs';
const base=Date.UTC(2026,10,17,12);
const refHeader='interval,utc,epochMs,leftSource,rightSource,leftOpen,leftHigh,leftLow,leftClose,rightOpen,rightHigh,rightLow,rightClose,deltaOpen,deltaHigh,deltaLow,deltaClose\n';
const bars=Array.from({length:12},(_,i)=>{
 const time=base+i*900000,ohlc=[65000+i,65030+i,64970+i,65010+i];
 return {time,ohlc};
});
const ref=refHeader+bars.map(x=>['15m',new Date(x.time).toISOString(),x.time,'frontend','direct',...x.ohlc,...x.ohlc,0,0,0,0].join(',')).join('\n')+'\n';
const tv='time,open,high,low,close\n'+bars.map(x=>[x.time/1000,...x.ohlc].join(',')).join('\n')+'\n';
test('TradingView CSV agrees on all 12 matching BTCUSDT 15m bars',()=>{
 const r=compareTVExport({tvCSV:tv,parityCSV:ref,tf:'15m',minimumOverlap:12});
 assert.equal(r.status,'MATCH');assert.equal(r.overlapping,12);
 assert.equal(r.comparator.priceMismatches,0);
 assert.ok(r.warning.includes('BITUNIX'));
});
test('TV high mismatch is detected and time aligned',()=>{
 const bad=tv.replace('65032,64972','65036,64972');
 const r=compareTVExport({tvCSV:bad,parityCSV:ref,tf:'15m',minimumOverlap:12});
 assert.equal(r.status,'PRICE_MISMATCH');
 assert.equal(r.comparator.samples[0].differences[0].field,'high');
});
test('reject timezone-naive TradingView export',()=>{
 const bad=tv.replace(String(base/1000),'2026-11-17 12:00:00');
 assert.throws(()=>compareTVExport({tvCSV:bad,parityCSV:ref}),/timezone|UTC|offset/i);
});
test('reject wrong timeframe rather than pretending parity',()=>{
 assert.throws(()=>compareTVExport({tvCSV:tv,parityCSV:ref,tf:'4h'}),/does not contain timeframe/);
});
test('missing overlap never earns a perfect score',()=>{
 const shifted=tv.replaceAll(String(base/1000),'1525870000');
 const bad=compareTVExport({tvCSV:shifted,parityCSV:ref,minimumOverlap:12});
 assert.equal(bad.status,'INSUFFICIENT_OVERLAP');
});
