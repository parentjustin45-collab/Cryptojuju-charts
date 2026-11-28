import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {CANDIDATES,RANGE,normalizeContracts,planCandidate,preflightExpansion,capacityProjection,inspectExpansionCapacity} from './level6-expansion-plan.mjs';
import {FIVE_CASES,FIVE_CRYPTO_SYMBOLS} from './five-by-five.mjs';
const metadata={code:0,data:CANDIDATES.map(symbol=>({symbol,symbolStatus:'OPEN',quotePrecision:4,launchTime:Date.UTC(2023,0,1)}))};
const response=p=>({ok:true,json:async()=>p});
const fetchImpl=async()=>response(metadata);
const hash=x=>createHash('sha256').update(x).digest('hex');
function db({loop=false,full=true,bytes=1000000}={}){
 const report=JSON.stringify({refinement:{round:1},noTrading:true,noPromotion:true,holdoutUsed:false});
 return {query:async(sql)=>{
  if(sql.includes('pg_database_size'))return {rows:[{bytes}]};
  if(sql.includes('GROUP BY symbol,timeframe'))return {rows:(full?FIVE_CASES:FIVE_CASES.slice(1)).map(x=>({...x,reports:1}))};
  if(sql.includes('to_regclass'))return {rows:[{t:'yes'}]};
  if(sql.includes('refinement'))return {rows:loop?[{report,sha:hash(report)}]:[],rowCount:loop?1:0};
  throw Error('Unexpected or write query '+sql);
 }};
}
test('original cohort unchanged; full two-year targets and chronological priority',()=>{
 assert.equal(FIVE_CASES.length,25);assert.equal(CANDIDATES.length,5);assert.ok(CANDIDATES.every(s=>!FIVE_CRYPTO_SYMBOLS.includes(s)));
 const plans=normalizeContracts(metadata).map(planCandidate);
 assert.deepEqual(plans[0].targets.map(x=>x.timeframe),['1d','4h','1h','30m','15m']);
 assert.equal(plans.flatMap(x=>x.targets).reduce((n,x)=>n+x.expectedBars,0),638750);
});
test('listing-adjusted history reserves three aligned anchors; no synthetic bars',()=>{
 const contract={symbol:CANDIDATES[0],status:'METADATA_VALID',launchMs:Date.UTC(2025,0,1,1),quotePrecision:4,priceStep:.0001};
 const daily=planCandidate(contract).targets[0];assert.equal(daily.startMs,Date.UTC(2025,0,5));assert.equal(daily.coverageKind,'LISTING_ADJUSTED_WITH_THREE_ANCHORS');
 assert.equal(planCandidate({...contract,launchMs:RANGE.endMs-86400000}).targets[0].status,'BLOCKED_INSUFFICIENT_HISTORY');
});
test('missing, duplicate, closed or invalid contracts are blocked',()=>{
 const bad={code:0,data:[...metadata.data.slice(1),{...metadata.data[1]},{...metadata.data[0],symbol:CANDIDATES[2],symbolStatus:'CLOSED'}]};
 const rows=normalizeContracts(bad);assert.equal(rows[0].status,'BLOCKED_MISSING_OR_DUPLICATE');assert.equal(rows[1].status,'BLOCKED_MISSING_OR_DUPLICATE');assert.equal(rows[2].status,'BLOCKED_MISSING_OR_DUPLICATE');
 assert.equal(normalizeContracts({code:0,data:[{...metadata.data[0],symbolStatus:'CLOSED'}]})[0].status,'BLOCKED_CONTRACT_METADATA');
});
test('read-only gate waits for level 5.5 and capacity; eligible does not mean admitted',async()=>{
 const x=await preflightExpansion({db:db(),fetchImpl});assert.equal(x.status,'WAITING_LEVEL55_REAL_CYCLE');assert.equal(x.noHistoryWrites,true);
 assert.equal((await preflightExpansion({db:db({loop:true}),fetchImpl})).status,'PREFLIGHT_READY_FOR_ADMISSION_REVIEW');
 assert.equal((await preflightExpansion({db:db({loop:true,full:false}),fetchImpl})).status,'BASELINE_NOT_COMPLETE');
 const huge=Number.MAX_SAFE_INTEGER;assert.equal((await preflightExpansion({db:db({loop:true,bytes:huge}),fetchImpl})).status,'PAUSED_STORAGE');
});
test('unstable official metadata is rejected before history planning',async()=>{
 let calls=0;await assert.rejects(()=>preflightExpansion({db:db(),fetchImpl:async()=>response(++calls===1?metadata:{...metadata,data:metadata.data.slice(1)})}),/METADATA_NOT_STABLE/);
});

test('capacity projection reserves pending Bitunix and Binance independently',async()=>{
 const cap={dbBytes:450000000,thresholdBytes:7000000000};
 const p=capacityProjection(cap,{expectedNewBars:638750,olderRemaining:48535,binanceRemaining:1271010});
 assert.equal(p.withinGuard,true);assert.ok(p.projectedBytes>1500000000);
 assert.equal(capacityProjection({...cap,thresholdBytes:700000000},{expectedNewBars:638750,olderRemaining:48535,binanceRemaining:1271010}).withinGuard,false);
 const db={query:async sql=>sql.includes('to_regclass')?{rows:[{older:'yes',binance:'yes'}]}:{rows:[{older_remaining:'48535',binance_remaining:'1271010'}]}};
 const actual=await inspectExpansionCapacity(db,{capacity:cap,expectedNewBars:638750});assert.equal(actual.projectedBytes,p.projectedBytes);
});
