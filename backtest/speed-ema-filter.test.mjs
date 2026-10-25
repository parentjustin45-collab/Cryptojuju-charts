import test from 'node:test';import assert from 'node:assert/strict';
import {emaSeries,compareSpeedEmaFilter} from './speed-ema-filter.mjs';
test('EMA 200 cannot use fewer than 200 candles',()=>{const a=Array.from({length:199},(_,i)=>({close:100+i}));assert.equal(emaSeries(a,200).every(x=>x===null),true);});
test('EMA seed and subsequent update use past closes only',()=>{const a=[1,2,3,4].map(close=>({close}));assert.deepEqual(emaSeries(a,3),[null,null,2,3]);});
test('EMA filter never admits signals before full warmup',()=>{const candles=Array.from({length:80},(_,i)=>({time:i*900000,open:100,high:102,low:99,close:i%2?101:100.5,volume:i%4===0?1000:100}));const r=compareSpeedEmaFilter(candles);assert.equal(r.counts.eligible200,0);assert.equal(r.counts.eligibleStack,0);});
test('future changes do not change earlier EMA values',()=>{const a=Array.from({length:220},(_,i)=>({close:100+i/10}));const b=a.map(x=>({...x}));b[219].close=9999;assert.deepEqual(emaSeries(a,200).slice(0,219),emaSeries(b,200).slice(0,219));});
