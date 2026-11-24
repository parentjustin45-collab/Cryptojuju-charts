import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {FIVE_CASES,FIVE_CRYPTO_SYMBOLS,FIVE_TIMEFRAMES,checkFiveByFiveComplete}
  from './render/five-by-five.mjs';
import {VERIFIED_INTERVALS} from './research-batch.mjs';
import {assessBitunixData} from './render/plan.mjs';
import {fetchBitunixDataPilot} from './bitunix-data-pilot.mjs';
import {researchSpecialist} from './run-render-indicator-pilot.mjs';
import {researchCipherFiveByFive} from './run-cj-cipher-five-by-five.mjs';
const end=Date.UTC(2026,10,24);
const sha='a'.repeat(64);
function fixture(symbol,timeframe){
  const step=VERIFIED_INTERVALS[timeframe],start=end-480*step;
  const candles=Array.from({length:480},(_,i)=>{
    const open=100+Math.sin(i/6)*7+i*.01;
    const close=open+Math.sin(i/3)*1.3;
    return {time:start+i*step,open,close,high:Math.max(open,close)+1,
      low:Math.min(open,close)-1,volume:1000+i};
  });
  const source={status:'DATA_READY_FOR_RESEARCH_ONLY',
    market:{exchange:'Bitunix',priceType:'LAST_PRICE',symbol,timeframe},
    provenance:{source:'Bitunix public Futures REST',formingBarExcluded:true,
      priceType:'LAST_PRICE',rawSha256:sha,derivedSha256:'b'.repeat(64)},
    historyWindow:{startTime:start,endTime:end,intervalMs:step},acceptedCandles:candles};
  const repeat={status:'STABLE_TWO_READS',checkedDerived:480,differenceCount:0,
    market:source.market,historyWindow:source.historyWindow,firstRawSha256:sha,
    overlapRawSha256First:'c'.repeat(64),overlapRawSha256Second:'c'.repeat(64)};
  return {source,repeat};
}
test('cohort has exact 25 unique pairs and verified 30m/1d intervals',()=>{
  assert.equal(FIVE_CRYPTO_SYMBOLS.length,5);
  assert.deepEqual(FIVE_TIMEFRAMES,['15m','30m','1h','4h','1d']);
  assert.equal(FIVE_CASES.length,25);
  assert.equal(new Set(FIVE_CASES.map(x=>x.symbol+'|'+x.timeframe)).size,25);
  assert.equal(VERIFIED_INTERVALS['30m'],1800000);
  assert.equal(VERIFIED_INTERVALS['1d'],86400000);
  assert.equal(checkFiveByFiveComplete(FIVE_CASES),true);
  assert.equal(checkFiveByFiveComplete(FIVE_CASES.slice(1)),false);
});
test('25-case upstream data gate accepts only a complete, positive, double-read cohort',()=>{
  const checks=FIVE_CASES.map(c=>({...c,status:'DATA_READY_FOR_RESEARCH_ONLY',
    consistencyStatus:'STABLE_TWO_READS',acceptedBars:480,requestedBars:480,sha256:sha}));
  const summary={cohort:'FIVE_BY_FIVE',expectedCases:25,
    status:'PASS_PUBLIC_BITUNIX_DATA_WINDOWS',passed:25,blocked:0,checks};
  assert.equal(assessBitunixData(summary).status,'DATA_READY_FOR_RESEARCH_ONLY');
  assert.equal(assessBitunixData({...summary,checks:checks.slice(1),passed:24}).status,'BLOCKED');
  assert.equal(assessBitunixData({...summary,checks:[checks[0],...checks.slice(0,24)]}).status,'BLOCKED');
  assert.equal(assessBitunixData({...summary,checks:[{...checks[0],acceptedBars:479},...checks.slice(1)]}).status,'BLOCKED');
});
test('Bitunix data intake understands crypto 30m and Daily closed boundaries',async()=>{
  for(const timeframe of ['30m','1d']){
    const step=VERIFIED_INTERVALS[timeframe];
    for(const symbol of FIVE_CRYPTO_SYMBOLS){
      const now=end+15000,first=end-9*step;
      const rows=Array.from({length:9},(_,i)=>({
        time:first+i*step,open:100,high:102,low:98,close:101,volume:100+i
      }));
      const result=await fetchBitunixDataPilot({
        symbol,timeframe,closedBars:6,anchorBars:3,nowMs:now,
        fetchPage:async({startTime,endTime})=>rows.filter(x=>x.time>=startTime&&x.time<endTime)
      });
      assert.equal(result.status,'DATA_READY_FOR_RESEARCH_ONLY',symbol+timeframe);
      assert.equal(result.acceptedCandles.length,6);
      assert.equal(result.historyWindow.endTime,end);
    }
  }
});
test('Momentum and SPEED both save 25 complete 480-bar case timelines',async()=>{
  const fixtures=new Map(FIVE_CASES.map(x=>[x.symbol+'-'+x.timeframe,fixture(x.symbol,x.timeframe)]));
  const read=async name=>{
    const b=String(name).split('/').at(-1),id=b.replace(/-repeatability\.json$|\.json$/,'');
    const v=fixtures.get(id);if(!v)throw Error('Unknown '+b);
    return JSON.stringify(b.endsWith('-repeatability.json')?v.repeat:v.source);
  };
  for(const kind of ['momentum','speed']){
    const details=new Map();
    const summary=await researchSpecialist(kind,'/no-real-files',{read,cases:FIVE_CASES,
      writeDetails:async(path,body)=>details.set(path,JSON.parse(body))});
    assert.equal(summary.passed,25,kind);
    assert.equal(summary.blocked,0,kind);
    assert.match(summary.status,/_25_DOUBLE_READ_CASES_READY$/);
    assert.equal(details.size,25);
    assert.equal([...details.values()].every(x=>x.bars.length===480&&x.causalOnly),true);
  }
});
test('Cipher compares same 25 verified sources and restores original 3x960 cohort separately',async()=>{
  const output=await mkdtemp(join(tmpdir(),'cj-five-by-five-cipher-'));
  const fixtures=new Map(FIVE_CASES.map(x=>[x.symbol+'-'+x.timeframe,fixture(x.symbol,x.timeframe)]));
  const contract=FIVE_CRYPTO_SYMBOLS.map(symbol=>({
    symbol,source:'BITUNIX_PUBLIC_TRADING_PAIRS',
    stepStatus:'RESEARCH_PRICE_PRECISION_NOT_TV_MINTICK',quotePrecision:2,priceStep:0.01
  }));
  const read=async name=>{
    const b=String(name).split('/').at(-1),id=b.replace(/-repeatability\.json$|\.json$/,'');
    const v=fixtures.get(id);if(!v)throw Error('Unknown '+b);
    return JSON.stringify(b.endsWith('-repeatability.json')?v.repeat:v.source);
  };
  try{
    const report=await researchCipherFiveByFive('/synthetic-input',output,{read,contracts:contract});
    assert.equal(report.status,'CIPHER_25_MARKETS_MTF_PILOT_COMPLETE',JSON.stringify(report.cases.filter(x=>x.status==='BLOCKED')));
    assert.equal(report.validated,25);
    const sample=JSON.parse(await readFile(join(output,'1000PEPEUSDT-1d-cipher-mtf-detail.json'),'utf8'));
    assert.equal(sample.confirmedBars,480);
    assert.equal(sample.comparison.signals.cj_cipher_wt_v1 instanceof Array,true);
    assert.ok(sample.portfolios.base&&sample.portfolios.stress);
  }finally{await rm(output,{recursive:true,force:true});}
});
