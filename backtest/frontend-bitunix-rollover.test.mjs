import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Compile the exact development frontend guard, not a reimplemented copy.
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const code=source.match(/function shouldRecoverBitunixCandle\(o,now=Date\.now\(\)\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(code,'Bitunix frontend rollover guard must exist');
const detect=vm.runInNewContext(code+';shouldRecoverBitunixCandle',{Date,intervalSeconds:f=>f==='1h'?3600:60});
const H=3600000;
const open=Date.UTC(2026,10,16,20);
const old=Math.floor((open-H)/1000);
const state=()=>({interval:'1h',data:[{time:old,open:100,high:102,low:99,close:101}],wsConnectedAt:open-30*60000,lastMarketTickAt:open+11000,lastResyncAt:0});
test('does not create a fake candle at the hour transition',()=>{
 const o=state(),original=JSON.stringify(o.data);
 assert.equal(detect(o,open+8000),false);
 assert.equal(detect(o,open+12000),true);
 assert.equal(JSON.stringify(o.data),original,'guard may request reconnect but never manufacture OHLC');
});
test('recovers after 10s if previous-hour candle is still shown despite market messages',()=>{
 const o=state();assert.equal(detect(o,open+12000),true);
 o.lastResyncAt=open+12000;
 assert.equal(detect(o,open+20000),false,'30-second cooldown');
 assert.equal(detect(o,open+43000),true);
});
test('current candle requires no reconnect when updates arrive',()=>{
 const o=state();o.data=[{time:open/1000}];o.lastMarketTickAt=open+11000;
 assert.equal(detect(o,open+12000),false);
});
test('stalled market ticks trigger reconnect even if WS pings keep arriving',()=>{
 const o=state();o.data=[{time:open/1000}];o.lastMarketTickAt=open+1000;
 assert.equal(detect(o,open+22000),true);
});
test('freshly connected WS receives grace before stale-history recovery',()=>{
 const o=state();o.wsConnectedAt=open+6000;o.lastMarketTickAt=0;
 assert.equal(detect(o,open+12000),false);
 assert.equal(detect(o,open+17000),true);
});
