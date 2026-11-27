import test from 'node:test';import assert from 'node:assert/strict';
import {extensionWindows,EXTENSION_END,LAUNCH,runOlderHistoryBatch} from './older-history-worker.mjs';
import {VERIFIED_INTERVALS} from '../research-batch.mjs';
test('exact verified listing-adjusted target; no overlap with frozen baseline',()=>{
 const rows=extensionWindows();assert.equal(rows.reduce((n,x)=>n+x.bars,0),123517);assert.equal(new Set(rows.map(x=>x.id)).size,rows.length);
 assert.ok(rows.every(x=>x.symbol!=='HYPEUSDT'&&x.endMs<=EXTENSION_END&&x.bars>=4&&x.bars<=480));
 const pairs=new Set(rows.map(x=>x.symbol+'|'+x.timeframe));assert.equal(pairs.size,20);
 for(const k of pairs){const a=rows.filter(x=>x.symbol+'|'+x.timeframe===k);const step=VERIFIED_INTERVALS[a[0].timeframe];assert.equal(a[0].startMs,Math.ceil(LAUNCH[a[0].symbol]/step)*step+3*step);assert.equal(a.at(-1).endMs,EXTENSION_END);for(let i=1;i<a.length;i++)assert.equal(a[i].startMs,a[i-1].endMs);}
});
test('capacity pause before schema or write',async()=>{let n=0;const db={query:async()=>{n++;return {rows:[{bytes:'10000000000'}]}}};assert.equal((await runOlderHistoryBatch(db)).status,'PAUSED_STORAGE');assert.equal(n,1);});
