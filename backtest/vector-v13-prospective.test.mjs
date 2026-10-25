import test from 'node:test';
import assert from 'node:assert/strict';
import {VECTOR_V13_FORWARD_LOCK,runVectorV13Forward,evaluateVectorV13Forward}
 from './vector-v13-prospective.mjs';
const H=3600000,START=VECTOR_V13_FORWARD_LOCK.startTime;
function candles(n=125,{up=false}={}){
 const b=Array.from({length:n},(_,i)=>{
  const close=up?100+i*.4:150-i*.4;
  return {time:i*H,open:close+.08,high:close+.25,low:close-.25,close,volume:100};
 });
 const c=b[65];
 b[65]={...c,open:c.close+3,high:c.close+3.2,low:c.close-.3,volume:1e7};
 return b;
}
const evaluate=(b=candles(),until=b.at(-1).time+H)=>evaluateVectorV13Forward({
 hourWindows:[{candles:b}],startTime:60*H,asOfTime:until
});
test('Candidate locked AFTER historical inspection with independently later start',()=>{
 assert.equal(VECTOR_V13_FORWARD_LOCK.protocol,'vector-v13-btc-1h-short-ema50-forward-v1');
 assert.equal(new Date(START).toISOString(),'2026-10-27T00:00:00.000Z');
 assert.equal(VECTOR_V13_FORWARD_LOCK.symbol,'BTCUSDT');
 assert.deepEqual(VECTOR_V13_FORWARD_LOCK.modes,
  ['baseline_v11','break_extreme_2','v13_ema50_slope']);
 assert.equal(VECTOR_V13_FORWARD_LOCK.exit,'fixed_1_5_3_12');
 assert.equal(VECTOR_V13_FORWARD_LOCK.feeRate,.0006);
});
test('Reference V1.1 and V1.2 and EMA50 are independently observable after warmup',()=>{
 const r=evaluate();
 for(const key of VECTOR_V13_FORWARD_LOCK.modes){
  assert.ok(r.byMode[key].zero.trades>=1,key);
  assert.equal(r.byMode[key].zero.closedTrades.every(t=>t.sourceTime>=60*H),true);
 }
 assert.equal(r.byMode.baseline_v11.zero.closedTrades[0].signalTime,65*H);
 assert.equal(r.byMode.break_extreme_2.zero.closedTrades[0].signalTime,66*H);
 assert.equal(r.byMode.v13_ema50_slope.zero.closedTrades[0].entryTime,67*H);
 assert.equal(r.status,'INSUFFICIENT_TRADES');
});
test('Bearish EMA filter can reject short signal during bullish trend without changing V1.1/V1.2 signals',()=>{
 const r=evaluate(candles(125,{up:true}));
 assert.ok(r.byMode.baseline_v11.zero.trades>=1);
 assert.ok(r.byMode.break_extreme_2.zero.trades>=1);
 assert.equal(r.byMode.v13_ema50_slope.zero.trades,0);
});
test('Prospective simulation does not use future bars and never counts open positions as profit',()=>{
 const b=candles();
 const original=evaluate(b,90*H);
 const changed=b.map((x,i)=>i<90?{...x}:{...x,open:100,high:110,low:90,close:99,volume:1e8});
 assert.deepEqual(original,evaluate(changed,90*H));
 const atSignal=evaluate(b,68*H);
 assert.ok(atSignal.byMode.v13_ema50_slope.zero.censored>=1||
  atSignal.byMode.v13_ema50_slope.zero.trades>=1);
});
test('Higher simulated slippage is worse than zero slippage for same trade cohort',()=>{
 const r=evaluate(),v=r.byMode.v13_ema50_slope;
 assert.ok(v.stress.meanNetPct<v.zero.meanNetPct);
 assert.ok(v.harsh.meanNetPct<v.stress.meanNetPct);
});
test('A gap cannot silently connect two historical windows',()=>{
 const b=candles(),bad=b.map(x=>({...x}));
 bad[75].time+=H;
 assert.throws(()=>evaluate(bad),/Noncontiguous/);
});
test('Before prospective start no Bitunix fetch is allowed',async()=>{
 const r=await runVectorV13Forward({now:START-1,fetchPage:async()=>{
  throw Error('FORBIDDEN NETWORK BEFORE START');
 }});
 assert.equal(r.status,'NOT_STARTED');
 assert.equal(r.results,null);
});
test('Do not mutate synthetic source OHLC in pure forward evaluation',()=>{
 const b=candles(),snapshot=JSON.stringify(b);
 assert.deepEqual(evaluate(b),evaluate(b));
 assert.equal(JSON.stringify(b),snapshot);
});
