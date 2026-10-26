import test from 'node:test';
import assert from 'node:assert/strict';
import {assessBitunixPage,captureRealBitunix,LIVE_WATCH_LOCK} from './vector-watch-bitunix-readonly.mjs';
const H=3600000,epoch=Date.parse('2026-10-20T00:00:00Z');
function page(n=80){
 return Array.from({length:n},(_,i)=>({time:epoch+i*H,
  open:100+i*.1,high:101+i*.1,low:99+i*.1,close:100+i*.1,volume:1000+i}));
}
test('Read-only snapshot uses Bitunix only and accepts 55+ contiguous CLOSED bars',()=>{
 assert.equal(LIVE_WATCH_LOCK.allowOtherExchanges,false);
 assert.equal(LIVE_WATCH_LOCK.execution,false);
 const rows=page(),now=epoch+(rows.length+1)*H;
 const r=assessBitunixPage(rows,now,{symbol:'BTCUSDT'});
 assert.equal(r.source,'Bitunix');
 assert.equal(r.continuousClosed,rows.length);
 assert.equal(r.ohlc.at(-1).time,rows.at(-1).time/1000);
 assert.ok(['possible','confirmed_idle','neutral'].includes(r.WATCH.status));
 assert.equal(r.WATCH.tradingSignal,false);
});
test('Reject tampered OHLC, duplicate and disconnected last 55 bars',()=>{
 const source=page(),now=epoch+(source.length+1)*H;
 const duplicate=[...source,source[5]];
 assert.throws(()=>assessBitunixPage(duplicate,now),/duplicate/);
 const corrupted=page();corrupted[20].high=90;
 assert.throws(()=>assessBitunixPage(corrupted,now),/corrupt/);
 const gap=page();gap[35].time+=H; // duplicate 36, effectively a gap
 assert.throws(()=>assessBitunixPage(gap,now),/duplicate/);
 const remote=page();remote.splice(60,1); // one missing hour in the last segment
 assert.throws(()=>assessBitunixPage(remote,now),/last continuous/);
});
test('Reject stale or insufficient closed candles: no false live WATCH',()=>{
 const rows=page(),now=epoch+(rows.length+7)*H;
 assert.throws(()=>assessBitunixPage(rows,now),/stale/);
 assert.throws(()=>assessBitunixPage(page(54),epoch+55*H),/insufficient/);
});
test('An unfinished last candle cannot generate a WATCH trade',()=>{
 const rows=page(),now=rows.at(-1).time+10*60;
 const x=assessBitunixPage(rows,now);
 assert.equal(x.continuousClosed,rows.length-1);
 assert.equal(x.ohlc.at(-1).time,rows.at(-2).time/1000);
});
test('Snapshot download fallback remains Bitunix direct only, never other exchange',async()=>{
 const now=epoch+81*H;
 const fetchPage=async({symbol})=>{throw Error('proxy down '+symbol);};
 const directFetch=async()=>({ok:true,json:async()=>({code:'0',data:page()})});
 const snap=await captureRealBitunix({nowMs:now,fetchPage,directFetch});
 assert.equal(snap.status,'BITUNIX_FRESH_SNAPSHOT_VERIFIED');
 assert.equal(snap.symbols.length,3);
 for(const x of snap.symbols){
  assert.equal(x.source,'Bitunix direct');
  assert.equal(x.transportProblems.length,1);
  assert.equal(x.status,'BITUNIX_VERIFIED');
 }
});
