/* Contract parity with ACTUAL CryptoJuju index.html V1.1 frontend implementation.
 * The source is extracted from the deployed-develop HTML without importing any DOM code.
 * This is NOT proof of parity with the original external TradingView Pine Script.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import {vectorAIT} from './vector-ait-v1.mjs';

const SOURCE=new URL('../index.html',import.meta.url),html=readFileSync(SOURCE,'utf8');
function sourceOfFunction(source,name){
 const re=new RegExp('function\\s+'+name+'\\s*\\(');
 const matches=[...source.matchAll(new RegExp(re.source,'g'))];
 assert.equal(matches.length,1,'Expected exactly one '+name+'() in index.html');
 const start=matches[0].index,open=source.indexOf('{',start);
 assert.ok(open>start);
 let depth=0,inside=null,escape=false;
 for(let i=open;i<source.length;i++){
  const c=source[i];
  if(inside){if(escape){escape=false;continue;}if(c==='\\'){escape=true;continue;}
   if(c===inside)inside=null;continue;
  }
  if(c==='"'||c==="'"||c==='\`'){inside=c;continue;}
  if(c==='{')depth++;
  if(c==='}'&&--depth===0)return source.slice(start,i+1);
 }
 throw Error('Unbalanced frontend function: '+name);
}
const nativeCode=['rmaValues','smaValues','intervalSeconds','vectorAIT']
 .map(name=>sourceOfFunction(html,name)).join('\n');
const SECOND=1000;
function fixtures({count=280,step=3600000,scale=100}={}){
 let v=0x91fed,price=scale;
 const rand=()=>{v=(Math.imul(v,1664525)+1013904223)>>>0;return v/0x100000000;};
 return Array.from({length:count},(_,i)=>{
  let change=(rand()-.5)*.017*scale;
  if(i%17===0)change*=2.4;
  const open=price,close=Math.max(scale*.03,open+change);
  const high=Math.max(open,close)+scale*(.0002+rand()*.0013);
  const low=Math.max(scale*.001,Math.min(open,close)-scale*(.0002+rand()*.0013));
  const volume=100+rand()*150+(i%19===0?2500:0);
  price=close;
  return {time:Date.parse('2024-01-01T00:00:00Z')+i*step,open,high,low,close,volume};
 });
}
function compareWithFrontEnd(ms,tf){
 const data=ms.map(c=>({...c,time:c.time/SECOND}));
 const frozenNow=ms.at(-1).time+3*86400000;
 const out=runInNewContext(nativeCode+'\nvectorAIT(data,tf)',{
  data,tf,Date:class extends Date {static now(){return frozenNow;}},
  Number,Math,Map
 });
 // Normalize realm, markers and V1.1 vectors (all raw strong candles).
 const markers=JSON.parse(JSON.stringify(out.markers)).map(m=>({time:m.time*SECOND,side:m.text==='SHORT'?'short':'long'}));
 const rawVectors=[...out.vectors.entries()].map(([t,v])=>({time:t*SECOND,side:v===1?'long':'short'}));
 return {markers,rawVectors};
}
function compareResearch(ms,config){
 const v=vectorAIT(ms,config);
 return {
  markers:v.filter(x=>x.signal).map(x=>({time:x.time,side:x.signal})),
  rawVectors:v.flatMap(x=>x.bullishVector?[{time:x.time,side:'long'}]:
   x.bearishVector?[{time:x.time,side:'short'}]:[])
 };
}
test('Frontend and V1.1 research produce same raw vectors and LONG/SHORT markers on 1h BTC-like candles',()=>{
 const bars=fixtures({count:1500,scale:70000,step:3600000});
 const expected=compareWithFrontEnd(bars,'1h');
 const actual=compareResearch(bars);
 assert.ok(expected.markers.length>=3);
 assert.deepEqual(actual,expected);
});
test('Historical parity in 15m, 30m, 1h, 4h and 1d (different timestamps and independent patterns)',()=>{
 for(const [tf,step] of Object.entries({'15m':900000,'30m':1800000,'1h':3600000,'4h':14400000,'1d':86400000})){
  const bars=fixtures({count:600,step,scale:150});
  assert.deepEqual(compareResearch(bars),compareWithFrontEnd(bars,tf),tf);
 }
});
test('Tiny sub-cent tick prices remain consistent with frontend Number.EPSILON range floor',()=>{
 const bars=fixtures({count:500,step:3600000,scale:0.0000000004});
 // Check research engine default on genuine tiny candles, not an arbitrary hand-selected sample.
 assert.deepEqual(compareResearch(bars),compareWithFrontEnd(bars,'1h'));
});
test('Historical not-yet-closed frontend candle cannot count as a backtest signal',()=>{
 const bars=fixtures({count:240,step:3600000});
 const all=compareWithFrontEnd(bars,'1h');
 const latest=bars.at(-1).time;
 // Synthetic evaluation of an active bar by advancing Date to its midpoint only.
 const data=bars.map(c=>({...c,time:c.time/SECOND}));
 const frozenNow=latest+1800000;
 const active=runInNewContext(nativeCode+'\nvectorAIT(data,tf)',{
  data,tf:'1h',Date:class extends Date {static now(){return frozenNow;}},Number,Math,Map
 });
 assert.equal(active.vectors.has(latest/SECOND),false);
 assert.equal(active.markers.some(m=>m.time===latest/SECOND),false);
 assert.deepEqual(all.markers.filter(x=>x.time<latest),
  JSON.parse(JSON.stringify(active.markers)).map(m=>({time:m.time*SECOND,side:m.text==='SHORT'?'short':'long'})));
});
test('Raw frontend code and closed-candle vectors are prefix-stable',()=>{
 const bars=fixtures({count:450,scale:100});
 const older=bars.slice(0,300);
 assert.deepEqual(compareResearch(older),{
  markers:compareResearch(bars).markers.filter(x=>x.time<bars[300].time),
  rawVectors:compareResearch(bars).rawVectors.filter(x=>x.time<bars[300].time)
 });
});
