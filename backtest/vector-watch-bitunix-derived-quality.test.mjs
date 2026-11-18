import test from 'node:test';
import assert from 'node:assert/strict';
import {assessBitunixPage,captureRealBitunix} from './vector-watch-bitunix-readonly.mjs';
const H=3600000,start=Date.parse('2026-11-14T00:00:00Z');
const page=()=>Array.from({length:80},(_,i)=>({time:start+i*H,
 open:100+i*0.1,high:101+i*0.1,low:99+i*0.1,close:100+i*0.1,volume:200+i}));
function defect(rows){
 const out=rows.map(x=>({...x})),i=70,open=out[i-1].close;
 out[i]={...out[i],open,high:open-0.1,low:open-0.5,close:open-0.2};
 return out;
}
const now=start+81*H;
test('Raw strict WATCH blocks, provenance-derived research WATCH accepts previous-close envelope',()=>{
 const raw=defect(page()),unchanged=JSON.stringify(raw);
 assert.throws(()=>assessBitunixPage(raw,now),/last continuous/);
 const r=assessBitunixPage(raw,now,{symbol:'BTCUSDT',allowDerivedEnvelope:true});
 assert.equal(r.envelope.policy,'bitunix-open-envelope-v1');
 assert.equal(r.envelope.corrections,1);
 assert.equal(r.envelope.rawPreserved,true);
 assert.equal(r.continuousClosed,80);
 assert.equal(r.excludedInvalidCount,0);
 assert.equal(JSON.stringify(raw),unchanged);
 assert.ok(['possible','confirmed_idle','neutral'].includes(r.WATCH.status));
 assert.equal(r.WATCH.tradingSignal,false);
});
test('Research WATCH fails closed for unconfirmed maximum below the CLOSE',()=>{
 const raw=defect(page());raw[70].close=raw[70].open+0.2;
 assert.throws(()=>assessBitunixPage(raw,now,{allowDerivedEnvelope:true}),/unverified/);
});
test('Research WATCH cannot bridge a missing hour by derivation',()=>{
 const raw=page();raw.splice(25,1);
 assert.throws(()=>assessBitunixPage(raw,now,{allowDerivedEnvelope:true}),/unverified/);
});
test('Real-capture opt-in is only source quality processing, never an order',async()=>{
 const rows=defect(page());
 const snapshot=await captureRealBitunix({
  nowMs:now,
  fetchPage:async()=>rows,
  directFetch:async()=>{throw Error('Must not need fallback')}
 });
 assert.equal(snapshot.status,'BITUNIX_FRESH_SNAPSHOT_VERIFIED');
 assert.equal(snapshot.symbols.length,3);
 assert.ok(snapshot.symbols.every(x=>x.envelope.corrections===1&&x.WATCH.tradingSignal===false));
});
