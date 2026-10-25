import test from 'node:test';
import assert from 'node:assert/strict';
import {vectorAIT} from './vector-ait-v1.mjs';
const bars=Array.from({length:50},(_,i)=>({time:i*900000,open:100,high:101,low:99,close:100,volume:100}));
test('AIT remains flat without directional candles',()=>{const r=vectorAIT(bars);assert.equal(r.length,50);assert.ok(r.every(x=>x.direction===0&&x.signal===null));});
test('AIT flips only when opposite vector confirms',()=>{
 const b=bars.map(x=>({...x}));b[30]={...b[30],open:100,high:110,low:99,close:109,volume:10000};
 b[40]={...b[40],open:109,high:110,low:98,close:99,volume:10000};
 const r=vectorAIT(b);assert.equal(r[30].signal,'long');assert.equal(r[39].direction,1);assert.equal(r[40].signal,'short');assert.equal(r[40].exit,'long');
});
