import test from 'node:test';
import assert from 'node:assert/strict';
import {classifySpeedEmaInteractions,emaInteractionSignals} from './speed-ema-interactions.mjs';
function bars(n=240){return Array.from({length:n},(_,i)=>({time:i*900000,open:100,high:101,low:99,close:100,volume:i===220?10000:100}));}
test('no event before an EMA is initialized using previous closed candle',()=>{
 const rows=bars(40);const events=classifySpeedEmaInteractions(rows,{periods:[200]});
 assert.deepEqual(events,[]);
});
test('SPEED bullish bounce at EMA and no forward-looking dependence',()=>{
 const rows=bars();rows[220]={...rows[220],open:99.5,high:102,low:99,close:101};
 const a=classifySpeedEmaInteractions(rows,{periods:[13]});
 assert.ok(a.some(e=>e.time===rows[220].time&&e.side==='long'&&e.type==='bounce'));
 const copy=rows.map(x=>({...x}));copy[230].close=200;copy[230].high=201;
 const b=classifySpeedEmaInteractions(copy,{periods:[13]});
 assert.deepEqual(a.filter(e=>e.time<=rows[220].time),b.filter(e=>e.time<=rows[220].time));
});
test('only selected EMA event generates a signal',()=>{
 const events=[{time:1,period:200,type:'bounce',side:'long',closed:true},{time:2,period:50,type:'bounce',side:'short',closed:true}];
 assert.deepEqual(emaInteractionSignals(events),[{time:1,side:'long'}]);
});
