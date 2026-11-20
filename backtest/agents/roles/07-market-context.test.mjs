import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeMarketContext,fingerprintMarketCandles} from './07-market-context.mjs';

const hour=3_600_000;
function series(symbol,scale){
  const candles=Array.from({length:25},(_,i)=>{
    const close=100+scale*(i+Math.sin(i/2));
    return {time:i*hour,open:close-0.2,high:close+1,low:close-1,close,volume:10+i};
  });
  return {market:{exchange:'SYNTHETIC',priceType:'LAST_PRICE',symbol,timeframe:'1h'},
    historyWindow:{startTime:0,endTime:25*hour,intervalMs:hour},acceptedCandles:candles,
    provenance:{acceptanceStatus:'FIXTURE_ONLY',source:'SYNTHETIC_FIXTURE',priceType:'LAST_PRICE',
      paginationComplete:true,repeatedFetchMatches:true,formingBarExcluded:true,ohlcAlignedToSource:true,
      candleFingerprint:fingerprintMarketCandles(candles)}};
}
function fixture(){
  return {fixtureKind:'SYNTHETIC_CI_ONLY_NOT_BITUNIX',asOfTime:25*hour,lookbackBars:24,
    series:[series('SYNTH_BTC',1),series('SYNTH_ETH',-0.6)]};
}

test('summarizes aligned markets with breadth, range context and correlations, no signals',()=>{
  const report=analyzeMarketContext(fixture());
  assert.equal(report.status,'PASS_SYNTHETIC_ONLY');
  assert.equal(report.details.regime,'mixed');
  assert.equal(report.details.breadth.up,1);
  assert.equal(report.details.breadth.down,1);
  assert.equal(report.details.noTradeSignals,true);
  assert.equal(report.details.markets.length,2);
  assert.equal(report.details.markets[0].range.lookbackBars,24);
  assert.equal(report.details.correlations.length,1);
  assert.match(report.details.dataLimit,/not independently authenticated/);
});

test('blocks mismatched windows and non-contiguous candle timestamps',()=>{
  const mismatched=fixture();
  mismatched.series[1].historyWindow.endTime+=hour;
  assert.equal(analyzeMarketContext(mismatched).status,'BLOCKED');
  const gap=fixture();
  gap.series[1].acceptedCandles[5].time+=hour;
  gap.series[1].provenance.candleFingerprint=fingerprintMarketCandles(gap.series[1].acceptedCandles);
  assert.equal(analyzeMarketContext(gap).status,'BLOCKED');
});

test('blocks stale hashes, invalid OHLC and unclosed future bars',()=>{
  const tampered=fixture();
  tampered.series[0].acceptedCandles[2].close+=2;
  assert.match(analyzeMarketContext(tampered).details.reason,/fingerprint/);
  const badOHLC=fixture();
  badOHLC.series[0].acceptedCandles[2].high=badOHLC.series[0].acceptedCandles[2].low-1;
  badOHLC.series[0].provenance.candleFingerprint=fingerprintMarketCandles(badOHLC.series[0].acceptedCandles);
  assert.match(analyzeMarketContext(badOHLC).details.reason,/OHLCV/);
  const future=fixture();
  future.asOfTime=24*hour;
  assert.match(analyzeMarketContext(future).details.reason,/asOfTime|not closed/);
});

test('accepts Bitunix only when all declared upstream provenance gates pass',()=>{
  const input=fixture();
  delete input.fixtureKind;
  for(const item of input.series){
    item.market.exchange='Bitunix';
    item.provenance={...item.provenance,acceptanceStatus:'PASS',source:'Bitunix'};
  }
  const accepted=analyzeMarketContext(input);
  assert.equal(accepted.status,'PASS_RESEARCH_ONLY');
  input.series[0].provenance.repeatedFetchMatches=false;
  assert.equal(analyzeMarketContext(input).status,'BLOCKED');
});
