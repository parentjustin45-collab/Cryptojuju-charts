/* Dev read-only audit. Replays an explicitly HYPOTHETICAL stale Bitunix
 * OHLC snapshot across a candle boundary into the exact frontend functions.
 * Passing means the reproduction/mechanism is proven, NOT that Bitunix emitted
 * the stale OHLC in the user's actual 08:45 traffic. Live evidence is separate.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const grab=(begin,end)=>{const a=html.indexOf(begin),b=html.indexOf(end,a+begin.length);
 assert.ok(a>=0&&b>a, 'extract actual frontend implementation '+begin);
 return html.slice(a,b)};
const normalizeSrc=html.match(/function normalizeWsKline\(msg\)\{[^\n]+\}/)?.[0];
assert.ok(normalizeSrc);
const mergeSrc=grab('function mergeLive(o,k){','function stopLive(o){');
const ctx={
 Math,Number,Array,Date,JSON,Map,
 bucketTime:(t,tf)=>Math.floor(Number(t)/(tf==='1h'?3600:900))*(tf==='1h'?3600:900),
 cjFeedTrace:()=>{},cjTraceNextFrame:()=>{},updateLastUI:()=>{},
 clearTimeout:()=>{},setTimeout:()=>0,renderIndicators:()=>{}
};
const {normalizeWsKline,mergeLive}=vm.runInNewContext(normalizeSrc+'\n'+mergeSrc+'\n;({normalizeWsKline,mergeLive})',ctx);
const before={open:65025.9,high:65038,low:64850.8,close:64963.3,volume:100};
const start=Date.UTC(2026,10,17,13,45)/1000; // 08:45 America/Toronto
function scenario(tf,payload,eventTsMs){
 const step=tf==='1h'?3600:900;
 const initial={...before,time:start-step};
 const updated=[];
 const o={interval:tf,data:[initial],cs:{update:x=>updated.push({...x}),setData:()=>{}},indTimer:null};
 const ws={ch:tf==='1h'?'market_kline_60min':'market_kline_15min',
  symbol:'BTCUSDT',ts:eventTsMs,data:payload};
 const rows=normalizeWsKline(ws);
 assert.equal(rows.length,1);
 mergeLive(o,rows[0]);
 return {rows,o,updated,initial};
}
for(const tf of ['15m','1h']){
 test('hypothetical stale OHLC after boundary clones previous bar into new '+tf,()=>{
  const boundary=tf==='1h'?Math.floor(start/3600)*3600:start;
  const prev={...before,volume:100};
  const payload={o:String(prev.open),h:String(prev.high),l:String(prev.low),c:String(prev.close),b:'100'};
  const result=scenario(tf,payload,(boundary+2)*1000);
  assert.equal(result.o.data.length,2);
  assert.equal(result.o.data[1].time,boundary);
  for(const key of ['open','high','low','close'])
   assert.equal(result.o.data[1][key],result.initial[key]);
  assert.equal(result.updated.at(-1).time,boundary);
  console.log('POTENTIAL_STALE_COPY '+JSON.stringify({tf,eventBarTime:result.rows[0].time,
   newBucketTime:boundary,oldOHLC:prev,newOHLC:result.o.data[1]}));
 });
 test('stale high/low range survives if only close changes '+tf,()=>{
  const boundary=tf==='1h'?Math.floor(start/3600)*3600:start;
  const payload={o:String(before.open),h:String(before.high),l:String(before.low),
   c:'64980.4',b:'100'};
  const result=scenario(tf,payload,(boundary+2)*1000);
  assert.equal(result.o.data[1].time,boundary);
  assert.equal(result.o.data[1].high,before.high);
  assert.equal(result.o.data[1].low,before.low);
  assert.equal(result.o.data[1].close,64980.4);
 });
}
test('original candle timestamp prevents incorrect bucket when Bitunix includes it',()=>{
 const eventAfter=(start+2)*1000;
 const original=(start-900)*1000;
 const data={o:'65025.9',h:'65038',l:'64850.8',c:'64963.3',time:original};
 const x=normalizeWsKline({ts:eventAfter,data});
 assert.equal(x[0].time,start-900);
});
