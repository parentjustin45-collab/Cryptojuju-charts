import test from 'node:test';
import assert from 'node:assert/strict';
import {compareVectorV12Candidates} from './vector-v12-real-comparison.mjs';

const step=900000,start=Date.UTC(2026,10,1),length=180;
const bars=Array.from({length},(_,i)=>({
 time:start+i*step,open:100,high:101,low:99,close:100,volume:100
}));
bars[30]={...bars[30],open:100,close:109,high:110,low:99,volume:10000};
bars[45]={...bars[45],open:109,close:99,high:110,low:98,volume:10000};
bars[31]={...bars[31],open:109,close:110,high:111,low:108,volume:200};
const w={startTime:start,endTime:start+length*step,intervalMs:step};
const source={
 status:'DATA_READY_FOR_RESEARCH_ONLY',
 market:{exchange:'Bitunix',priceType:'LAST_PRICE',symbol:'BTCUSDT',timeframe:'15m'},
 historyWindow:w,acceptedCandles:bars,
 provenance:{formingBarExcluded:true,priceType:'LAST_PRICE',
   rawSha256:'some-sha',derivedSha256:'derived-sha',normalizationVersion:'bitunix-open-envelope-v1'}
};
const repeatability={
 status:'STABLE_TWO_READS',checkedDerived:24,
 market:{exchange:'Bitunix',symbol:'BTCUSDT',timeframe:'15m'},
 historyWindow:{startTime:w.endTime-24*step,endTime:w.endTime,intervalMs:step},
 firstRawSha256:'some-sha',overlapRawSha256First:'matched',overlapRawSha256Second:'matched',
 differenceCount:0
};
const contract={symbol:'BTCUSDT',quotePrecision:1,priceStep:.1,
 source:'BITUNIX_PUBLIC_TRADING_PAIRS',
 stepStatus:'RESEARCH_PRICE_PRECISION_NOT_TV_MINTICK'};
const run=changes=>compareVectorV12Candidates({source,repeatability,contract,...changes});

test('compare 3 alternatives on identical source/costs without changing V1.1',()=>{
 const r=run();
 assert.equal(r.status,'CANDIDATES_EVALUATED_RESEARCH_ONLY');
 assert.equal(r.baselineReproduced,true);
 assert.equal(r.promotedVariant,null);
 assert.deepEqual(r.modes.map(x=>x.mode),[
   'baseline_v11','follow_close_1','break_extreme_2'
 ]);
 assert.ok(r.noLookaheadPrefixChecks>3);
 assert.equal(r.closedBars,length);
 for(const id of r.modes.map(x=>x.mode)){
   assert.equal(r.results.training[id].indicatorParity,'UNVERIFIED');
   assert.equal(r.results.holdout[id].indicatorParity,'UNVERIFIED');
   assert.ok(Number.isFinite(r.results.training[id].returnPct));
 }
 assert.equal(r.checks.noRealTrades,true);
});
test('V1.2 confirmation may not be marked at initial Vector bar',()=>{
 const r=run();
 const delayed=r.modes.find(x=>x.mode==='follow_close_1');
 assert.ok(delayed.preview.every(x=>x.confirmedAtCloseMs===x.hypotheticalEntryOpenMs));
 assert.ok(delayed.preview.every(x=>x.confirmedBarOpenMs>=x.detectedBarOpenMs));
 assert.ok(delayed.preview.every(x=>x.delayBars===1));
});
test('provenance mismatch or failed repeated source blocks entire comparison',()=>{
 assert.throws(()=>run({source:{...source,status:'BLOCKED'}}),/requires stable/);
 assert.throws(()=>run({repeatability:{...repeatability,status:'BLOCKED'}}),/requires stable/);
 assert.throws(()=>run({repeatability:{...repeatability,
   market:{...repeatability.market,symbol:'ETHUSDT'}}}),/does not belong/);
 assert.throws(()=>run({contract:{...contract,priceStep:.0001}}),/price-precision/);
});
test('invalid real OHLC stops candidate generation instead of inventing repaired prices',()=>{
 const changed=bars.map(x=>({...x}));
 changed[110].high=changed[110].open-10;
 assert.throws(()=>run({source:{...source,acceptedCandles:changed}}),/Backtest blocked/);
});
