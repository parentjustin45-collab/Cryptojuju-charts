import test from 'node:test';
import assert from 'node:assert/strict';
import {compareSpeedEmaInteractions} from './speed-ema-strategy-comparison.mjs';
function bars(n=240){return Array.from({length:n},(_,i)=>({time:i*900000,open:100,high:101,low:99,close:100,volume:i===220?10000:100}));}
test('SPEED and EMA reaction comparisons share the same closed-candle sample',()=>{
 const rows=bars();rows[219].close=100.5;rows[220]={...rows[220],open:100.6,high:102,low:99,close:101};
 const r=compareSpeedEmaInteractions(rows);
 assert.ok(r.strategies.speed.signals>=1);
 assert.ok(r.strategies.ema13_bounce.signals>=1);
 assert.equal(r.assumptions.execution,'next-bar-open');
 assert.equal(r.assumptions.feeRate,0.0006);
});
test('future bars cannot create a historical EMA bounce signal',()=>{
 const rows=bars();rows[219].close=100.5;rows[220]={...rows[220],open:100.6,high:102,low:99,close:101};
 const original=compareSpeedEmaInteractions(rows).strategies.ema13_bounce.signals;
 rows[230]={...rows[230],open:110,high:111,low:109,close:110};
 assert.equal(compareSpeedEmaInteractions(rows).strategies.ema13_bounce.signals,original);
});
