import test from 'node:test';
import assert from 'node:assert/strict';
import {VECTOR_PROSPECTIVE_LOCK,buildCompletedVectorContext,contextAtEntry,
 evaluateProspectiveVector,runVectorProspective} from './vector-prospective-v12.mjs';
const H=3600000,D=24*H;
function bars(n=95){
 const b=Array.from({length:n},(_,i)=>({time:i*H,open:100,high:101,low:99,close:100,volume:100}));
 b[31]={...b[31],open:103,high:104,low:99,close:100,volume:1000000};
 b[32]={...b[32],open:100,high:101,low:97.5,close:98,volume:100};
 return b;
}
function report(b,asOfTime=b.at(-1).time+H){
 return evaluateProspectiveVector({hourWindows:[{candles:b}],startTime:30*H,asOfTime});
}
test('Frozen protocol never changes the V1.1 baseline or candidate',()=>{
 assert.equal(VECTOR_PROSPECTIVE_LOCK.symbol,'BTCUSDT');
 assert.equal(VECTOR_PROSPECTIVE_LOCK.side,'short');
 assert.equal(VECTOR_PROSPECTIVE_LOCK.interval,'1h');
 assert.equal(VECTOR_PROSPECTIVE_LOCK.candidate,'break_extreme_2');
 assert.equal(VECTOR_PROSPECTIVE_LOCK.minimumConfirmations,4);
 assert.equal(VECTOR_PROSPECTIVE_LOCK.exit,'fixed_1_5_3_12');
 assert.equal(new Date(VECTOR_PROSPECTIVE_LOCK.startTime).toISOString(),'2026-10-26T00:00:00.000Z');
});
test('Vector confirmation waits until bar closes and fills at next opening',()=>{
 const r=report(bars());
 assert.ok(r.baseline.baseline.completedTrades>=1);
 assert.ok(r.candidate.baseline.completedTrades>=1);
 const a=r.baseline.baseline.trades[0],b=r.candidate.baseline.trades[0];
 assert.equal(a.signalTime,31*H);
 assert.equal(a.entryTime,32*H);
 assert.equal(b.sourceTime,31*H);
 assert.equal(b.signalTime,32*H);
 assert.equal(b.entryTime,33*H);
 assert.equal(b.context.d1,null);
 assert.equal(b.context.h4,null);
});
test('Unclosed or future candles cannot affect earlier reported results',()=>{
 const base=bars(),asOfTime=75*H;
 const a=report(base,asOfTime);
 const changed=base.map(x=>({...x}));
 for(let i=75;i<changed.length;i++)changed[i]={...changed[i],open:105,high:110,low:95,close:96,volume:1000000};
 assert.deepEqual(report(changed,asOfTime),a);
 assert.ok(a.baseline.baseline.trades.every(t=>t.exitTime<asOfTime));
});
test('Reports do not consume research period trades before start time',()=>{
 const r=evaluateProspectiveVector({hourWindows:[{candles:bars()}],startTime:50*H,asOfTime:95*H});
 assert.equal(r.baseline.baseline.completedTrades,0);
 assert.equal(r.candidate.baseline.completedTrades,0);
 assert.equal(r.status,'INSUFFICIENT_TRADES');
});
test('No positions cross a missing-candle window boundary',()=>{
 const full=bars(95),left=full.slice(0,38),right=full.slice(42);
 const r=evaluateProspectiveVector({hourWindows:[{candles:left},{candles:right}],startTime:30*H,asOfTime:95*H});
 assert.equal(r.baseline.baseline.completedTrades,0);
 assert.equal(r.candidate.baseline.completedTrades,0);
 assert.ok(r.baseline.baseline.censoredPositions>=1);
});
test('1D and 4H context is visible only after the higher candle closes',()=>{
 const context=buildCompletedVectorContext([Array.from({length:25},(_,i)=>({
  time:i*D,open:100,high:101,low:99,close:100,volume:100}))],D);
 assert.equal(contextAtEntry(context,25*D-1),'neutral'); // last closed day was day 23
 assert.equal(contextAtEntry(context,25*D),'neutral');
 // If the immediately preceding day is missing, a stale direction is NOT reused.
 context.byClose.delete(25*D);
 assert.equal(contextAtEntry(context,25*D),null);
 assert.equal(contextAtEntry(null,25*D),null);
});
test('Before Oct 26 the runner performs no external network request',async()=>{
 const out=await runVectorProspective({now:VECTOR_PROSPECTIVE_LOCK.startTime-1000,
  fetchPage:async()=>{throw Error('MUST NOT FETCH FUTURE')} });
 assert.equal(out.status,'NOT_STARTED');
 assert.equal(out.results,null);
});
