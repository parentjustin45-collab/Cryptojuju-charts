import test from 'node:test';
import assert from 'node:assert/strict';
import {auditMomentumVectorProspective as audit,MOM_VECTOR_PROSPECTIVE_LOCK as L}
 from './momentum-vector-prospective-gate.mjs';
const H=L.intervalMs,C=L.cutoffMs,sha='a'.repeat(64);
const start=C-500*H,end=start+960*H;
const bars=Array.from({length:960},(_,i)=>({
 time:start+i*H,open:100,high:101,low:99,close:100,volume:1
}));
const source={status:'DATA_READY_FOR_RESEARCH_ONLY',
 market:{exchange:'Bitunix',priceType:'LAST_PRICE',symbol:'BTCUSDT',timeframe:'1h'},
 historyWindow:{startTime:start,endTime:end,intervalMs:H},
 provenance:{formingBarExcluded:true,rawSha256:sha,derivedSha256:sha},
 acceptedCandles:bars};
const repeatability={status:'STABLE_TWO_READS',differenceCount:0,
 checkedDerived:960,market:{exchange:'Bitunix',symbol:'BTCUSDT',timeframe:'1h'},
 historyWindow:{...source.historyWindow},firstRawSha256:sha,
 secondRawSha256:sha,overlapRawSha256First:sha,overlapRawSha256Second:sha};
const args={source,repeatability,symbol:'BTCUSDT',strategy:'vector_v11',
 asOfMs:end,signals:[],trades:[]};
const run=over=>audit({...args,...over});
test('cutoff is EXCLUSIVE: 00:00Z close is warmup, 01:00Z is first admissible',()=>{
 const signals=[{time:C-H,side:'long'},{time:C,side:'short'},
  {time:C+H,side:'flat'}];
 const r=run({signals});
 assert.equal(r.status,'INSUFFICIENT_PROSPECTIVE_EVIDENCE');
 assert.deepEqual(r.eligibleSignals.map(x=>x.time),[C,C+H]);
 assert.equal(r.excludedWarmupSignals,1);
 assert.equal(r.eligibleSignals[0].confirmedAtCloseMs,C+H);
 assert.equal(r.eligibleSignals[0].earliestExecutionAtMs,C+H);
});
test('warmup trades, exact-cutoff entry, and incomplete positions are not credited',()=>{
 const trades=[
  {confirmationTime:C-2*H,entryTime:C-H,exitTime:C+2*H},
  {confirmationTime:C-H,entryTime:C,exitTime:C+2*H},
  {confirmationTime:C,entryTime:C+H,exitTime:C+2*H}
 ];
 const r=run({trades,signals:[
  {time:C-2*H,side:'long'},{time:C-H,side:'short'},
  {time:C,side:'long'}
 ]});
 assert.equal(r.eligibleClosedTradeCount,1);
 assert.equal(r.excludedWarmupOrBoundaryTrades,2);
 assert.equal(r.eligibleTrades[0].exitClosedAtMs,C+3*H);
});
test('future exit is BLOCKED even when trade starts after cutoff',()=>{
 const r=run({asOfMs:C+2*H,trades:[{
  confirmationTime:C,entryTime:C+H,exitTime:C+2*H
 }]});
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.reason,'GAPPED_FORMING_OR_INVALID_CLOSED_OHLC');
});
test('30 days and 30 trades per arm per market are mandatory',()=>{
 const signals=[{time:C,side:'long'}];
 const r=run({signals});
 assert.equal(r.status,'INSUFFICIENT_PROSPECTIVE_EVIDENCE');
 assert.equal(r.eligibleClosedTradeCount,0);
 assert.equal(r.promoted,false);
 assert.equal(r.ordersPlaced,false);
});
test('stable readback is not optional; wrong window and source hash fail closed',()=>{
 assert.equal(run({repeatability:{...repeatability,status:'BLOCKED'}}).reason,
  'DOUBLE_READ_NOT_VERIFIED');
 assert.equal(run({repeatability:{...repeatability,firstRawSha256:'b'.repeat(64)}}).reason,
  'DOUBLE_READ_NOT_VERIFIED');
 assert.equal(run({source:{...source,acceptedCandles:bars.slice(1)}}).reason,
  'INVALID_960_CLOSED_BITUNIX_SOURCE');
});
test('gaps and malformed OHLC block even if readback claims success',()=>{
 const changed=bars.map(x=>({...x}));
 changed[40].time+=H;
 assert.equal(run({source:{...source,acceptedCandles:changed}}).reason,
  'GAPPED_FORMING_OR_INVALID_CLOSED_OHLC');
});
test('unregistered variants and impossible timestamps are blocked',()=>{
 assert.equal(run({strategy:'momentum_optimized_after_holdout'}).reason,
  'UNREGISTERED_MARKET_OR_STRATEGY');
 assert.equal(run({asOfMs:C}).reason,'PROSPECTIVE_PERIOD_NOT_STARTED');
 assert.equal(run({signals:[{time:C,side:'long'},{time:C,side:'short'}]}).reason,
  'INVALID_OR_DUPLICATE_SIGNAL');
});

test('an invented trade without a corresponding directional confirmation is blocked',()=>{
 const trade={confirmationTime:C,entryTime:C+H,exitTime:C+2*H,side:'long'};
 assert.equal(run({trades:[trade]}).reason,'TRADE_WITHOUT_MATCHING_CONFIRMED_SIGNAL');
 assert.equal(run({signals:[{time:C,side:'flat'}],trades:[trade]}).reason,
  'TRADE_WITHOUT_MATCHING_CONFIRMED_SIGNAL');
 assert.equal(run({signals:[{time:C,side:'short'}],trades:[trade]}).reason,
  'TRADE_WITHOUT_MATCHING_CONFIRMED_SIGNAL');
 const valid=run({signals:[{time:C,side:'long'}],trades:[trade]});
 assert.equal(valid.eligibleClosedTradeCount,1);
});
