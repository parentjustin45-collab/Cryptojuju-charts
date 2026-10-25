import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeVectorMtfForward,VECTOR_MTF_FORWARD_LOCK} from './vector-mtf-forward-summary.mjs';

const H=3600000,START=Date.parse('2026-10-26T00:00:00Z');
const trade=(n=1,h4='bear',d1='bear',netPct=0.25)=>({
 sourceTime:START+n*H,signalTime:START+(n+1)*H,
 entryTime:START+(n+2)*H,exitTime:START+(n+3)*H,
 netPct,context:{h4,d1}
});
const original=(trades=[],asOfTime=START+100*H)=>({
 locked:{protocol:'vector-v12-btc1h-short-2026-10-26',symbol:'BTCUSDT',
  side:'short',interval:'1h',candidate:'break_extreme_2',startTime:START},
 asOfTime,status:'INSUFFICIENT_TRADES',commit:'test-commit',
 results:{
  baseline:{baseline:{trades},stress:{trades}},
  candidate:{baseline:{trades},stress:{trades}}
 }
});
test('locked 4H hypothesis is independent of historical optimization',()=>{
 assert.equal(VECTOR_MTF_FORWARD_LOCK.startTime,START);
 assert.equal(VECTOR_MTF_FORWARD_LOCK.candidate,'break_extreme_2');
 assert.equal(VECTOR_MTF_FORWARD_LOCK.primaryQuestion.includes('4H'),true);
 assert.equal(VECTOR_MTF_FORWARD_LOCK.minCompletedTrades,30);
});
test('4H bearish cohort uses same original trades; does not invent entries or use current unclosed 4H',()=>{
 const all=[trade(1,'bear','bear',.45),trade(7,'bull','bear',-.5),
  trade(13,null,'bear',-.2),trade(19,'bear','neutral',.05)];
 const v=summarizeVectorMtfForward(original(all));
 const c=v.cohorts.candidate.stress;
 assert.equal(v.status,'INSUFFICIENT_TRADES');
 assert.equal(c.all.trades,4);
 assert.equal(c.h4_bear.trades,2);
 assert.equal(c.h4_bear.wins,2);
 assert.equal(c.d1_bear.trades,3);
 assert.equal(c.h4_and_d1_bear.trades,1);
 assert.equal(c.h4_not_bear.trades,1);
 assert.equal(c.context_unknown.trades,1);
 assert.equal(c.h4_bear.meanNetPct,.25);
 assert.equal(c.h4_bear.sufficientSample,false);
 assert.equal(v.comparisons.h4_bear.meanNetDeltaPp,0);
});
test('original and candidate scenarios remain independent, never overwrite frozen results',()=>{
 const b=original([trade(1,'bear','bear',.25)]);
 b.results.baseline.stress.trades=[trade(1,'bear','bear',-.1)];
 const snapshot=JSON.stringify(b);
 const r=summarizeVectorMtfForward(b);
 assert.equal(r.cohorts.reference.stress.h4_bear.meanNetPct,-.1);
 assert.equal(r.cohorts.candidate.stress.h4_bear.meanNetPct,.25);
 assert.equal(r.comparisons.h4_bear.meanNetDeltaPp,.35);
 assert.equal(JSON.stringify(b),snapshot);
});
test('source before prospective start remains NOT_STARTED and has no cohorts',()=>{
 const b=original([],START);
 b.status='NOT_STARTED';b.results=null;
 const r=summarizeVectorMtfForward(b);
 assert.equal(r.status,'NOT_STARTED');
 assert.equal(r.cohorts,null);
});
test('reject prior-sample, future and malformed observations',()=>{
 for(const wrong of [
  {...trade(1),sourceTime:START-H},
  {...trade(1),exitTime:START+200*H},
  {...trade(1),context:{h4:'bear',d1:'forming'}},
  {...trade(1),entryTime:START+2*H}
 ]){
  assert.throws(()=>summarizeVectorMtfForward(original([wrong])),/Invalid or pre-start/);
 }
});
test('source lock cannot silently change ticker, candidate or start',()=>{
 const p=original([]);
 p.locked.candidate='follow_close_1';
 assert.throws(()=>summarizeVectorMtfForward(p),/Not the expected/);
});
test('minimum 30 closed trades does not imply a profitable strategy',()=>{
 const trades=Array.from({length:30},(_,i)=>trade(1+i*3,'bear','neutral',-0.2));
 const p=original(trades,START+100*H);
 const r=summarizeVectorMtfForward(p);
 assert.equal(r.status,'MINIMUM_COHORT_SAMPLE_MET');
 assert.equal(r.cohorts.candidate.stress.h4_bear.trades,30);
 assert.equal(r.cohorts.candidate.stress.h4_bear.meanNetPct,-.2);
});
