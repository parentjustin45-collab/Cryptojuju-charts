import test from 'node:test';
import assert from 'node:assert/strict';
import {closedWindow,normalizeCandles,compareCandleSets,parityCsvRow,PARITY_CSV_HEADER} from './ohlc-parity-core.mjs';
const H=3600000,T=Date.UTC(2026,10,17,16);
const window={startTime:T-4*H,endTime:T,intervalMs:H,expected:4};
const clean=(shift=0)=>Array.from({length:4},(_,i)=>({
 time:T-(4-i)*H,open:64000+shift,high:64060+shift,low:63980+shift,close:64010+shift,volume:1
}));
test('closed windows use aligned UTC OPEN times and skip current/recent bars',()=>{
 const x=closedWindow(T+1234,'1h',4,1);
 assert.equal(x.endTime,T-H);assert.equal(x.startTime,T-5*H);
 assert.equal(x.expected,4);
 assert.throws(()=>closedWindow(T,'1min',4));
});
test('exact OHLC parity matches all expected CLOSED candles',()=>{
 const a=normalizeCandles(clean(),window,'direct');
 const b=normalizeCandles(clean().map(r=>({...r,time:r.time/1000})),window,'frontend');
 const comp=compareCandleSets(a,b,window);
 assert.equal(comp.status,'MATCH');assert.equal(comp.matched,4);
 assert.equal(comp.priceMismatches,0);
 assert.equal(a.quality,'CLEAN');
 assert.equal(parityCsvRow(T-H,a,b).split(',').length,16);
 assert.ok(PARITY_CSV_HEADER.includes('deltaHigh'));
});
test('mismatched high price is reported with timestamp, value, delta',()=>{
 const d=clean();d[1].high+=1.2;
 const a=normalizeCandles(clean(),window,'direct');
 const b=normalizeCandles(d,window,'frontend');
 const comp=compareCandleSets(a,b,window);
 assert.equal(comp.status,'PRICE_MISMATCH');
 assert.equal(comp.priceMismatches,1);
 assert.equal(comp.samples[0].differences[0].field,'high');
 assert.equal(comp.samples[0].differences[0].delta,1.2);
});
test('bad high/low is blocked, not corrected even when both sources match',()=>{
 const r=clean();r[0].low=r[0].open+0.1;
 const a=normalizeCandles(r,window,'direct');
 const b=normalizeCandles(r,window,'frontend');
 const result=compareCandleSets(a,b,window);
 assert.equal(result.status,'BLOCKED_DATA_QUALITY');
 assert.equal(a.bars.get(T-4*H).low,r[0].low);
 assert.equal(a.invalid[0].reasons[0],'LOW_ABOVE_OPEN_OR_CLOSE');
});
test('missing bar and duplicated timestamp block strict parity',()=>{
 const raw=clean();raw.splice(1,1);raw.push({...raw[0]});
 const a=normalizeCandles(raw,window,'direct');
 const b=normalizeCandles(clean(),window,'frontend');
 assert.equal(a.missing.length,1);assert.equal(a.duplicates.length,1);
 assert.equal(compareCandleSets(a,b,window).status,'BLOCKED_DATA_QUALITY');
});
test('do not accidentally match different candle opening timestamps',()=>{
 const raw=clean();raw[1].time+=1;
 const a=normalizeCandles(raw,window,'direct');
 assert.equal(a.missing.length,1);
 assert.equal(a.outOfRange.length,1);
 assert.equal(a.quality,'BLOCKED');
});
test('0.01 USDT tolerance accepts sub-tick differences, rejects 0.1 USDT',()=>{
 const a=normalizeCandles(clean(),window,'a');
 const soft=clean();soft[2].close+=0.009;
 assert.equal(compareCandleSets(a,normalizeCandles(soft,window,'b'),window).status,'MATCH');
 soft[2].close+=0.1;
 assert.equal(compareCandleSets(a,normalizeCandles(soft,window,'b'),window).status,'PRICE_MISMATCH');
});
