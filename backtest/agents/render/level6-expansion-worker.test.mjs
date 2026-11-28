import test from 'node:test';
import assert from 'node:assert/strict';
import {CANDIDATES,RANGE,planCandidate} from './level6-expansion-plan.mjs';
import {expansionWindows,runExpansionBatch} from './level6-expansion-worker.mjs';
import {FIVE_CASES} from './five-by-five.mjs';
import {fetchBitunixDataPilot} from '../bitunix-data-pilot.mjs';
import {validateHistoricalSource} from './historical-library.mjs';
const plan={admissionReady:true,closedLoop:true,projection:{withinGuard:true},expectedNewBars:638750,candidates:CANDIDATES.map(symbol=>planCandidate({symbol,status:'METADATA_VALID',launchMs:Date.UTC(2024,5,26,12),quotePrecision:4,priceStep:.0001}))};
test('separate queue exactly covers 25 new pairs, daily first, no duplicates or baseline symbols',()=>{
 const jobs=expansionWindows(plan);
 assert.equal(jobs.reduce((n,j)=>n+j.bars,0),638750);
 assert.equal(new Set(jobs.map(j=>j.id)).size,jobs.length);
 assert.equal(jobs.filter(j=>j.timeframe==='1d').length,10);
 assert.ok(jobs.slice(0,10).every(j=>j.timeframe==='1d'));
 for(const c of plan.candidates)for(const t of c.targets){
  const a=jobs.filter(j=>j.symbol===c.symbol&&j.timeframe===t.timeframe);
  assert.equal(a[0].startMs,t.startMs);assert.equal(a.at(-1).endMs,t.endMs);
  assert.ok(a.every((j,i)=>j.bars>=4&&j.bars<=480&&(!i||a[i-1].endMs===j.startMs)));
 }
 assert.equal(FIVE_CASES.length,25);assert.ok(jobs.every(j=>!FIVE_CASES.some(x=>x.symbol===j.symbol)));
 assert.deepEqual(expansionWindows(plan),jobs);
});
test('admission and target mismatches fail before collecting',async()=>{
 assert.throws(()=>expansionWindows({...plan,closedLoop:false}),/ADMISSION_NOT_READY/);
 const bad=structuredClone(plan);bad.candidates[0].targets[0].startMs-=86400000;
 assert.throws(()=>expansionWindows(bad),/INVALID_TARGET/);
 const r=await runExpansionBatch({},{preflight:async()=>({admissionReady:false,status:'WAITING'})});
 assert.equal(r.status,'ADMISSION_PAUSED');
});
test('new symbol fetch remains opt-in and bounded to approved range',async()=>{
 const opts={symbol:'BNBUSDT',timeframe:'1d',closedBars:4,historicalEndExclusiveMs:RANGE.startMs+4*86400000,fetchPage:async()=>{throw Error('fixture');},retries:0};
 await assert.rejects(()=>fetchBitunixDataPilot(opts),/Pilot restricted/);
 await assert.rejects(()=>fetchBitunixDataPilot({...opts,expansionOnly:true,historicalEndExclusiveMs:RANGE.startMs}),/Pilot restricted/);
 const r=await fetchBitunixDataPilot({...opts,expansionOnly:true});assert.equal(r.status,'BLOCKED');assert.equal(r.market.symbol,'BNBUSDT');
 assert.throws(()=>validateHistoricalSource({market:{symbol:'BNBUSDT',timeframe:'1d'}},{}),/UNVERIFIED_SOURCE/);
});
