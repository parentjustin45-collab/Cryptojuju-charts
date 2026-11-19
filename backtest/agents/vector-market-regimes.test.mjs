import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compareVectorV12Candidates} from './vector-v12-real-comparison.mjs';
import {describeClosedBarRegimes,diagnoseVectorMarketRegimes,
 formatVectorRegimesMarkdown} from './vector-market-regimes.mjs';

const step=900000,start=Date.UTC(2026,10,1),count=240;
const bars=Array.from({length:count},(_,i)=>{
 const close=i<60?100+i*.4:i<120?124-(i-60)*.45:
   i<180?97+Math.sin(i)*.7:97+(i-180)*.5;
 return {time:start+i*step,open:close,high:close+1,
   low:close-1,close,volume:100};
});
const window={startTime:start,endTime:start+count*step,intervalMs:step};
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const source={status:'DATA_READY_FOR_RESEARCH_ONLY',
 market:{exchange:'Bitunix',priceType:'LAST_PRICE',symbol:'BTCUSDT',timeframe:'15m'},
 historyWindow:window,acceptedCandles:bars,
 provenance:{rawSha256:'fixture-raw',derivedSha256:sha(bars),
   formingBarExcluded:true,priceType:'LAST_PRICE'}};
const repeatability={status:'STABLE_TWO_READS',checkedDerived:count,
 market:{exchange:'Bitunix',symbol:'BTCUSDT',timeframe:'15m'},
 historyWindow:window,firstRawSha256:'fixture-raw',
 overlapRawSha256First:'equal',overlapRawSha256Second:'equal',differenceCount:0};
const contract={symbol:'BTCUSDT',quotePrecision:1,priceStep:0.1,
 source:'BITUNIX_PUBLIC_TRADING_PAIRS',
 stepStatus:'RESEARCH_PRICE_PRECISION_NOT_TV_MINTICK'};
const comparison=compareVectorV12Candidates({source,repeatability,contract});
const run=x=>diagnoseVectorMarketRegimes({
 source,comparison,contract,blockBars:60,...x
});
test('causal labels distinguish directional trends and a low-efficiency range candidate',()=>{
 const labels=describeClosedBarRegimes(bars);
 assert.equal(labels[30].regime,'warmup');
 assert.ok(labels.slice(52,90).some(x=>x.regime==='uptrend'));
 assert.ok(labels.slice(120,160).some(x=>x.regime==='downtrend'));
 assert.ok(labels.slice(160,180).some(x=>x.regime==='range_candidate'));
 assert.ok(labels.every(x=>['warmup','uptrend','downtrend','range_candidate','mixed'].includes(x.regime)));
});
test('future edits never alter regimes already computed from closed history',()=>{
 const original=describeClosedBarRegimes(bars);
 const changed=bars.map(x=>({...x}));
 for(let i=205;i<changed.length;i++)
   changed[i].close*=1.15;
 const derived=describeClosedBarRegimes(changed);
 assert.deepEqual(derived.slice(0,205),original.slice(0,205));
 assert.deepEqual(describeClosedBarRegimes(bars.slice(0,160)),original.slice(0,160));
});
test('four disjoint 60-bar periods and three modes never elect a winner',()=>{
 const out=run();
 assert.equal(out.status,'DESCRIPTIVE_ONLY_NO_WINNER');
 assert.equal(out.promotedVariant,null);
 assert.equal(out.blocks.length,4);
 assert.equal(out.blocks.reduce((n,x)=>n+x.candleCount,0),count);
 assert.deepEqual(Object.keys(out.modes),['baseline_v11','follow_close_1','break_extreme_2']);
 for(const mode of Object.values(out.modes)){
   assert.equal(mode.byBlock.length,4);
   assert.equal(mode.overallByRegime.warmup.meanDelayBars===null||
     mode.overallByRegime.warmup.meanDelayBars>=0,true);
 }
});
test('blocked, mutated or mislabeled Bitunix histories cannot produce research regimes',()=>{
 assert.throws(()=>run({source:{...source,status:'BLOCKED'}}),/Blocked/);
 assert.throws(()=>run({comparison:{...comparison,promotedVariant:'follow_close_1'}}),/Blocked/);
 const altered=bars.map(x=>({...x}));altered[140].close+=.01;
 assert.throws(()=>run({source:{...source,acceptedCandles:altered}}),/Blocked/);
 assert.throws(()=>run({blockBars:10}),/Blocked/);
});
test('nine-case Markdown report distinguishes research from verified performance',()=>{
 const out=run();
 const list=['BTCUSDT','ETHUSDT','SOLUSDT'].flatMap(symbol=>
   ['15m','1h','4h'].map(timeframe=>({...out,
     market:{...out.market,symbol,timeframe}})));
 const md=formatVectorRegimesMarkdown(list);
 assert.match(md,/range_candidate/);
 assert.match(md,/aucune version promue/);
 assert.match(md,/blocs chronologiques/);
 assert.match(md,/aucune supériorité/);
});
