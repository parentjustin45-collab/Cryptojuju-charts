import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {expectedHistoricalBars,TWO_YEAR_RANGE,loadHistoricalPeriod}
  from './render/historical-period.mjs';
import {studyContinuousHistoricalPeriod}
  from './render/historical-multiyear-replay.mjs';
import {calculateFrankTestV22} from './frank-test-v22-research.mjs';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const bars=Array.from({length:730},(_,i)=>{
  const time=TWO_YEAR_RANGE.startMs+i*86400000;
  const price=100+Math.sin(i/13)*9+i*.037+Math.cos(i/27)*4;
  const open=price-0.4,close=price+0.45*Math.sin(i*1.3);
  return {time,open,high:Math.max(open,close)+1.5,
    low:Math.min(open,close)-1.7,close,volume:40+i%17};
});
const source={
  source:'CJ_HISTORICAL_POSTGRES_TWO_READ_VERIFIED_V1',
  status:'CONTIGUOUS_SHA256_VERIFIED_UTC',
  market:{symbol:'BTCUSDT',timeframe:'1d',priceType:'LAST_PRICE',exchange:'Bitunix'},
  historyWindow:{startTime:TWO_YEAR_RANGE.startMs,endTime:TWO_YEAR_RANGE.endMs,
    intervalMs:86400000},
  sequenceSha256:'a'.repeat(64),
  candles:bars
};
test('two-year 5×5 library has exact timeframe-specific expected bars',()=>{
  assert.equal(expectedHistoricalBars({timeframe:'15m',...TWO_YEAR_RANGE}),70080);
  assert.equal(expectedHistoricalBars({timeframe:'30m',...TWO_YEAR_RANGE}),35040);
  assert.equal(expectedHistoricalBars({timeframe:'1h',...TWO_YEAR_RANGE}),17520);
  assert.equal(expectedHistoricalBars({timeframe:'4h',...TWO_YEAR_RANGE}),4380);
  assert.equal(expectedHistoricalBars({timeframe:'1d',...TWO_YEAR_RANGE}),730);
});
test('Frank 2.2 webapp research port confirms pivots only after two right bars',()=>{
  const f=calculateFrankTestV22(bars);
  assert.equal(f.protocol,'CJ_FRANK_TEST_V22_WEBAPP_RESEARCH_PORT_V1');
  assert.equal(f.oscillator.length,730);
  assert(f.divergences.length>=1);
  assert(f.divergences.every(d=>
    d.confirmationIndex===d.pivotIndex+2&&
    d.confirmationTime===bars[d.confirmationIndex].time&&
    d.firstExecutableOpen===bars[d.confirmationIndex+1]?.time));
  for(const cut of [120,350,500]){
    const first=calculateFrankTestV22(bars.slice(0,cut));
    const full=f.divergences.filter(x=>x.confirmationIndex<cut)
      .map(x=>[x.type,x.pivotIndex,x.confirmationIndex]);
    assert.deepEqual(first.divergences.map(x=>[x.type,x.pivotIndex,x.confirmationIndex]),full);
  }
});
test('full 730-day contiguous five-indicator research with causality, separated holdout',()=>{
  const r=studyContinuousHistoricalPeriod(source,{priceStep:.01});
  assert.equal(r.status,'TWO_YEAR_CAUSAL_RESEARCH_COMPLETE_NOT_PERFORMANCE_CERTIFIED');
  assert.equal(r.closedCandles,730);
  assert.equal(r.causalPrefixChecks,4);
  assert.equal(r.noLookaheadTestsPassed,true);
  assert.equal(r.marketOrdersPlaced,0);
  assert.equal(r.trainingOptimizationPerformed,false);
  assert.deepEqual(Object.keys(r.indicators),[
    'vector','momentum','speed','cipher','frank_cross','frank_divergence'
  ]);
  assert.equal(r.holdoutStartTime,bars[510].time);
  for(const x of Object.values(r.indicators)){
    assert.equal(x.signalCount,x.signals.length);
    for(const phase of Object.values(x.trainHoldout))
      for(const [h,stat] of Object.entries(phase.horizons)){
        assert([1,4,12].includes(Number(h)));
        assert(stat.samples>=0);
      }
  }
});
test('two-year engine refuses falsely labeled partial history',()=>{
  assert.throws(()=>studyContinuousHistoricalPeriod({...source,
    candles:bars.slice(0,480)},{priceStep:.01}),/COMPLETE_TWO_YEAR/);
  assert.throws(()=>studyContinuousHistoricalPeriod({...source,
    historyWindow:{...source.historyWindow,endTime:source.historyWindow.endTime-86400000}
  },{priceStep:.01}),/COMPLETE_TWO_YEAR/);
});
test('paginated historical library detects every gap and OHLC hash revision',async()=>{
  const rows=bars.map(c=>({
    open_ms:String(c.time),open_price:c.open,high_price:c.high,
    low_price:c.low,close_price:c.close,volume:c.volume,
    fingerprint:hash(['BTCUSDT','1d',c.time,c.open,c.high,c.low,c.close,c.volume])
  }));
  const queries=[];
  const db={query:async(sql,params)=>{
    queries.push(params);const from=Number(params[2]),to=Number(params[3]),limit=params[4];
    return {rows:rows.filter(x=>Number(x.open_ms)>=from&&Number(x.open_ms)<to).slice(0,limit)};
  }};
  const p=await loadHistoricalPeriod(db,{symbol:'BTCUSDT',timeframe:'1d',pageSize:200});
  assert.equal(p.barCount,730);
  assert.equal(p.pages,4);
  assert.match(p.sequenceSha256,/^[a-f0-9]{64}$/);
  assert.equal(p.candles.length,730);
  assert.equal(queries.length,4);
  const old=rows.splice(250,1);
  await assert.rejects(loadHistoricalPeriod(db,{symbol:'BTCUSDT',timeframe:'1d',pageSize:200}),
    /MISSING_BARS|INVALID_ROW/);
  rows.splice(250,0,...old);
  rows[400].close_price+=1;
  await assert.rejects(loadHistoricalPeriod(db,{symbol:'BTCUSDT',timeframe:'1d',pageSize:200}),
    /SHA256_CONFLICT/);
});
