import test from 'node:test';
import assert from 'node:assert/strict';
import {compareVectorV12Candidates} from './vector-v12-real-comparison.mjs';
import {diagnoseVectorV12Timing,renderVectorTimingDiagnosticsMarkdown}
  from './vector-v12-timing-diagnostics.mjs';

const step=900000,start=Date.UTC(2026,10,1);
const bars=Array.from({length:200},(_,i)=>({
  time:start+i*step,open:100,high:101,low:99,close:100,volume:100
}));
bars[30]={...bars[30],open:100,high:110,low:99,close:109,volume:10000};
bars[31]={...bars[31],open:109,high:111,low:108,close:110,volume:200};
bars[45]={...bars[45],open:109,high:110,low:98,close:99,volume:10000};
const w={startTime:start,endTime:start+bars.length*step,intervalMs:step};
const source={
  status:'DATA_READY_FOR_RESEARCH_ONLY',
  market:{symbol:'BTCUSDT',timeframe:'15m',exchange:'Bitunix',priceType:'LAST_PRICE'},
  historyWindow:w,acceptedCandles:bars,
  provenance:{rawSha256:'raw-fixture',derivedSha256:'derived-fixture',priceType:'LAST_PRICE',formingBarExcluded:true}
};
const repeatability={
  status:'STABLE_TWO_READS',checkedDerived:bars.length,
  market:{symbol:'BTCUSDT',timeframe:'15m',exchange:'Bitunix'},
  historyWindow:{...w},firstRawSha256:'raw-fixture',
  overlapRawSha256First:'stable',overlapRawSha256Second:'stable',differenceCount:0
};
const contract={symbol:'BTCUSDT',quotePrecision:1,priceStep:0.1,
  source:'BITUNIX_PUBLIC_TRADING_PAIRS',
  stepStatus:'RESEARCH_PRICE_PRECISION_NOT_TV_MINTICK'};
const comparison=compareVectorV12Candidates({source,repeatability,contract});
const run=o=>diagnoseVectorV12Timing({source,comparison,contract,...o});
test('native timing diagnostics include all three variants and isolated train/holdout',()=>{
 const result=run();
 assert.equal(result.status,'RESEARCH_DIAGNOSTIC_ONLY');
 assert.deepEqual(Object.keys(result.modes),['baseline_v11','follow_close_1','break_extreme_2']);
 assert.equal(result.modes.baseline_v11.phases.training.meanConfirmationDelayBars,0);
 assert.equal(result.modes.baseline_v11.phases.training.meanNextOpenPriceDisadvantagePct,0);
 assert.ok(result.modes.follow_close_1.phases.training.delayedSignals>=1);
 assert.equal(result.risks.length,5);
});
test('rapid reversal is only a descriptive proxy; the markdown refuses winner promotion',()=>{
 const d=run(),items=['BTCUSDT','ETHUSDT','SOLUSDT'].flatMap(symbol=>
   ['15m','1h','4h'].map(timeframe=>({...d,market:{...d.market,symbol,timeframe}})));
 const md=renderVectorTimingDiagnosticsMarkdown(items);
 assert.match(md,/pas la preuve d’un faux signal/);
 assert.match(md,/aucun test TradingView/);
 assert.match(md,/baseline_v11/);
 assert.match(md,/holdout/);
});
test('unproven, unrelated or incomplete inputs block the diagnostic',()=>{
 assert.throws(()=>run({source:{...source,status:'BLOCKED'}}),/Blocked/);
 assert.throws(()=>run({comparison:{...comparison,sourceRawSha256:'other'}}),/Blocked/);
 assert.throws(()=>run({comparison:{...comparison,promotedVariant:'follow_close_1'}}),/Blocked/);
 assert.throws(()=>run({flipBars:0}),/Invalid/);
});
test('signal statistics remain independent of future candle changes',()=>{
 const one=run(),mutable=bars.map(x=>({...x}));
 // Alter only the far future, but keep same synthetic acceptance stub to
 // verify the diagnostic on a new independent fixture.
 const orig=one.modes.baseline_v11.phases.training;
 for(let i=150;i<mutable.length;i++)mutable[i].volume*=2;
 const src={...source,acceptedCandles:mutable};
 const candidate=compareVectorV12Candidates({source:src,repeatability,contract});
 const another=diagnoseVectorV12Timing({source:src,comparison:candidate,contract});
 assert.deepEqual(orig,another.modes.baseline_v11.phases.training);
});
