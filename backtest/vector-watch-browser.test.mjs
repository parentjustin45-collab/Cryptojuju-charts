import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {readVectorWatchState,WATCH_UI_LOCK} from './vector-watch-browser.mjs';
const H=3600;
function sample(n=75){
 const start=1_800_000_000,arr=[];
 for(let i=0;i<n;i++)arr.push({time:start+i*H,open:100,high:100.5,low:99.5,close:100,volume:100});
 return arr;
}
function withWatch(){
 const b=sample();
 // V1.4 accepted initial short and a very strong, but nonstructural
 // counter-vector later. WATCH should remain informational and not flip.
 b[30]={...b[30],open:100.4,high:100.45,low:99.55,close:99.6,volume:10000};
 b[74]={...b[74],open:99.5,high:100.35,low:99.45,close:100.3,volume:10000};
 return b;
}
test('WATCH UI is default-off, never an order or replacement for a trading signal',()=>{
 assert.equal(WATCH_UI_LOCK.visibleByDefault,false);
 assert.equal(WATCH_UI_LOCK.neverAnOrder,true);
 assert.equal(readVectorWatchState(sample(),'1h',1_800_000_000+75*H).tradingSignal,false);
});
test('Completed counter-vector candle triggers possible WATCH without changing holding direction',()=>{
 const b=withWatch(),now=b.at(-1).time+H;
 const r=readVectorWatchState(b,'1h',now);
 assert.equal(r.status,'possible');
 assert.equal(r.confirmedDirection,'SHORT');
 assert.equal(r.watchDirection,'LONG');
 assert.equal(r.ageBars,0);
 assert.equal(r.tradingSignal,false);
});
test('An open, changing last candle NEVER triggers WATCH until its close',()=>{
 const b=withWatch(),opening=b.at(-1).time;
 const r=readVectorWatchState(b,'1h',opening+5);
 assert.notEqual(r.status,'possible');
 assert.equal(r.watchDirection,null);
});
test('Later position cannot look back across missing bars or insufficient warmup',()=>{
 const b=withWatch();b[60].time-=H;
 const r=readVectorWatchState(b,'1h',b.at(-1).time+H);
 assert.equal(r.status,'insufficient');
});
test('A single invalid older Bitunix OHLC is quarantined; valid recent 55+ bars still show WATCH',()=>{
 const b=withWatch(),now=b.at(-1).time+H;
 // Observed Bitunix defect: high 82379.4 < open 82379.5.
 b[8]={...b[8],open:82379.5,high:82379.4,low:82089,close:82319.8};
 const state=readVectorWatchState(b,'1h',now);
 assert.equal(state.status,'possible');
 assert.equal(state.watchDirection,'LONG');
 assert.equal(state.confirmedDirection,'SHORT');
 assert.equal(state.tradingSignal,false);
});
test('Malformed Bitunix OHLC inside last 55 bars blocks WATCH (no interpolation)',()=>{
 const b=withWatch(),now=b.at(-1).time+H;
 b[40]={...b[40],open:100.5,high:100.4,low:99.5,close:100};
 const state=readVectorWatchState(b,'1h',now);
 assert.equal(state.status,'insufficient');
 assert.equal(state.watchDirection,null);
});
test('Corrupt latest fully closed candle cannot be bypassed by older valid candles',()=>{
 const b=withWatch(),now=b.at(-1).time+H;
 b[74]={...b[74],open:100.5,high:100.4,low:99.5,close:100};
 const state=readVectorWatchState(b,'1h',now);
 assert.equal(state.status,'insufficient');
 assert.equal(state.tradingSignal,false);
});
test('Stale data not presented as a live reversal alert',()=>{
 const b=withWatch(),now=b.at(-1).time+10*H;
 const r=readVectorWatchState(b,'1h',now);
 assert.equal(r.status,'stale');
 assert.equal(r.watchDirection,null);
});
test('No mutation to original Bitunix OHLC data; signal statuses are deterministic',()=>{
 const b=withWatch(),snap=JSON.stringify(b),now=b.at(-1).time+H;
 assert.deepEqual(readVectorWatchState(b,'1h',now),readVectorWatchState(b,'1h',now));
 assert.equal(JSON.stringify(b),snap);
});
test('Browser integration is syntactically valid and persisted per-card toggle is OFF by default',()=>{
 const s=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const match=s.match(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/i);
 assert.ok(match,'Expected one classic inline application script');
 assert.doesNotThrow(()=>new vm.Script(match[1]));
 assert.match(s,/<input type="checkbox" data-x="watchstate">/);
 assert.match(s,/class="cjWatchBadge"[^>]*hidden/);
 assert.match(s,/refreshExperimentalWatch\(o\)/);
 assert.match(s,/import\('\.\/backtest\/vector-watch-browser\.mjs'\)/);
 assert.match(s,/function renderSignalLayers\(o\)/);
 assert.match(s,/try\{o\.cs\.setMarkers\(vectorEnabled\?vr\.markers:\[\]\)\}/);
 assert.match(s,/if\(Object\.prototype\.hasOwnProperty\.call\(st,x\.dataset\.x\)\)x\.checked=!!st\[x\.dataset\.x\]/);
});
