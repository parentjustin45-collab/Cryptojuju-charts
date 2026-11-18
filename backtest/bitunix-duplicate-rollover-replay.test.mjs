/* Dev regression tests: replay the exact previous-period OHLC reported at
 * the live 2026-11-17 09:00 (Quebec) boundary, through the production-source
 * stream functions. All trade examples below are constructed TEST FIXTURES;
 * they are not claimed to be raw trades from that specific morning.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const grab=(begin,end)=>{
 const a=html.indexOf(begin),b=html.indexOf(end,a+begin.length);
 assert.ok(a>=0&&b>a,'extract real frontend source '+begin);
 return html.slice(a,b);
};
const normalizeSrc=html.match(/function normalizeWsKline\(msg\)\{[^\n]+\}/)?.[0];
assert.ok(normalizeSrc);
const mergeSrc=grab('function mergeLive(o,k){','function stopLive(o){');
const envelopeSrc=grab('function cjValidateBitunixLiveEnvelope(o,k,bt){','/* DEV-ONLY opt-in trace');
const ctx={
 Math,Number,Array,Date,JSON,Map,
 bucketTime:(t,tf)=>Math.floor(Number(t)/(tf==='1h'?3600:900))*(tf==='1h'?3600:900),
 intervalSeconds:tf=>tf==='1h'?3600:900,
 cjFeedTrace:()=>{},cjTraceNextFrame:()=>{},updateLastUI:()=>{},
 clearTimeout:()=>{},setTimeout:()=>0,renderIndicators:()=>{}
};
const {normalizeWsKline,mergeLive,normalizeWsTrades,mergeTrades}=vm.runInNewContext(
 normalizeSrc+'\n'+envelopeSrc+'\n'+mergeSrc+'\n;({normalizeWsKline,mergeLive,normalizeWsTrades,mergeTrades})',ctx);
const H=3600, M=900,base=Date.UTC(2026,10,17,14)/1000; // 09:00 EST
const previous={
 '1h':{time:base-H,open:65035,high:65146.6,low:64846.4,close:65124.7,volume:100},
 '15m':{time:base-M,open:64944.8,high:65132.6,low:64846.4,close:65124.7,volume:100}
};
const event=(tf,values,seconds=2)=>({ch:tf==='1h'?'market_kline_60min':'market_kline_15min',
 symbol:'BTCUSDT',ts:(base+seconds)*1000,
 data:Object.fromEntries(Object.entries(values).map(([k,v])=>[k,String(v)]))});
const wsTrade=(seconds,prices)=>({ch:'trade',symbol:'BTCUSDT',ts:(base+seconds)*1000,
 data:prices.map((p,i)=>({t:new Date((base+seconds+i)*1000).toISOString(),
  p:String(p),v:'0.5',s:i?'sell':'buy'}))});
function make(tf){
 const updates=[],old={...previous[tf]};
 const o={interval:tf,data:[old],cs:{update:x=>updates.push({...x}),setData:()=>{}},indTimer:null};
 return {o,updates,old};
}
for(const tf of ['1h','15m']){
 test(tf+' full previous OHLC arriving at new boundary is quarantined',()=>{
  const {o,updates,old}=make(tf);
  const k=normalizeWsKline(event(tf,{o:old.open,h:old.high,l:old.low,c:old.close,b:100}))[0];
  assert.equal(mergeLive(o,k),false,'stale Kline rejected');
  assert.equal(o.data.length,1,'old candlestick remains, no bogus new candle');
  assert.equal(updates.length,0);
 });
 test(tf+' partial previous O/H/L and new close is quarantined',()=>{
  const {o,old}=make(tf);
  const k=normalizeWsKline(event(tf,{o:old.open,h:old.high,l:old.low,c:65118.5,b:101}))[0];
  assert.equal(mergeLive(o,k),false);
  assert.equal(o.data.length,1);
 });
 test(tf+' first verified trades build a fresh provisional candle without old O/H/L',()=>{
  const {o,updates,old}=make(tf);
  const trades=normalizeWsTrades(wsTrade(1,[65118.5,65120.1,65115.2]));
  assert.equal(trades.length,3);
  assert.equal(mergeTrades(o,trades),true);
  assert.equal(o.data.length,2);
  const last=o.data.at(-1);
  assert.equal(last.time,base);
  assert.equal(last.open,65118.5);
  assert.equal(last.high,65120.1);
  assert.equal(last.low,65115.2);
  assert.equal(last.close,65115.2);
  assert.equal(last.volume,1.5);
  assert.notEqual(last.open,old.open);
  assert.equal(o.cjBarSource,'trade');
  assert.equal(updates.at(-1).time,base);
  // Still reject stale Kline *after* trades initialized the new period.
  const stale=normalizeWsKline(event(tf,{o:old.open,h:old.high,l:old.low,c:65117,b:101}))[0];
  assert.equal(mergeLive(o,stale),false);
  assert.equal(o.data.at(-1).high,65120.1);
  assert.equal(o.data.at(-1).low,65115.2);
  // Fresh Kline eventually takes precedence over the provisional trade candle.
  const fresh=normalizeWsKline(event(tf,{o:65118.5,h:65122,l:65110,c:65121,b:4},12))[0];
  assert.equal(mergeLive(o,fresh),true);
  assert.equal(o.cjBarSource,'kline');
  assert.equal(o.data.at(-1).open,65118.5);
  assert.equal(o.data.at(-1).high,65122);
  assert.equal(o.data.at(-1).low,65110);
  assert.equal(o.data.at(-1).close,65121);
  assert.equal(o.data.length,2);
 });
 test(tf+' late trades cannot overwrite newer live candle',()=>{
  const {o}=make(tf);
  mergeTrades(o,normalizeWsTrades(wsTrade(1,[65118.5])));
  const oldBt=base-(tf==='1h'?H:M);
  const late=normalizeWsTrades({ts:(base+3)*1000,data:[{
   t:new Date((oldBt+60)*1000).toISOString(),p:'1000',v:'1'
  }]});
  assert.equal(mergeTrades(o,late),false);
  assert.equal(o.data.at(-1).close,65118.5);
 });
}
test('explicit old candle opening time does not leak into the new bucket',()=>{
 const k=normalizeWsKline({ts:(base+2)*1000,data:{
  o:'65035',h:'65146.6',l:'64846.4',c:'65124.7',time:(base-H)*1000
 }})[0];
 assert.equal(k.time,base-H);
});
test('Bitunix trade events use their own ISO timestamp not the gateway timestamp',()=>{
 const msg={ts:(base+3000)*1000,data:[{
  t:new Date((base+1)*1000).toISOString(),p:'65118.5',v:'0.25'
 }]};
 const rows=normalizeWsTrades(msg);
 assert.equal(rows[0].time,base+1);
 assert.equal(rows[0].price,65118.5);
});
