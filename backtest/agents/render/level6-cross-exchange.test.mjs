import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyBinanceRows,matchedReport,loadMatchedBinanceDaily} from './level6-cross-exchange.mjs';
import {historicalTargetFor} from './historical-period.mjs';
import {studyContinuousHistoricalPeriod,studyMatchedExchangePeriod} from './historical-multiyear-replay.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const symbol='BTCUSDT',timeframe='1d',target=historicalTargetFor(symbol,timeframe),step=86400000,scope={symbol,timeframe,startMs:target.startMs,endMs:target.endMs};
const rows=Array.from({length:730},(_,i)=>{
 const time=target.startMs+i*step,o=100+Math.sin(i/5)*10+i/100,h=o+2,l=o-2,c=o+Math.sin(i),v=1000+i;
 return {open_ms:time,open_price:o,high_price:h,low_price:l,close_price:c,volume:v,fingerprint:sha(JSON.stringify(['BINANCE_UM',symbol,timeframe,time,o,h,l,c,v]))};
});
test('Binance source identity and checksum verified; gaps and foreign fingerprints rejected',()=>{
 const b=verifyBinanceRows(rows,scope);assert.equal(b.barCount,730);assert.equal(b.market.exchange,'Binance');
 assert.throws(()=>verifyBinanceRows(rows.slice(1),scope),/COUNT/);
 const bad=structuredClone(rows);bad[1].open_ms+=step;assert.throws(()=>verifyBinanceRows(bad,scope),/GAP/);
 const foreign=structuredClone(rows);foreign[0].fingerprint=sha(JSON.stringify([symbol,timeframe,foreign[0].open_ms,...['open_price','high_price','low_price','close_price','volume'].map(k=>foreign[0][k])]));
 assert.throws(()=>verifyBinanceRows(foreign,scope),/SHA/);
});
test('same research engine on explicit distinct sources, baseline unchanged and no tuning',()=>{
 const b=verifyBinanceRows(rows,scope),bitunix={...b,source:'CJ_HISTORICAL_POSTGRES_TWO_READ_VERIFIED_V1',market:{...b.market,exchange:'Bitunix'},sequenceSha256:'a'.repeat(64)};
 const priceStep=.1,original=studyContinuousHistoricalPeriod(bitunix,{priceStep}),baselineSha=sha(JSON.stringify(original));
 const r=matchedReport(bitunix,b,{baselineSha,priceStep});
 assert.equal(r.bitunix.sourceSequenceSha256,bitunix.sequenceSha256);assert.equal(r.binance.sourceSequenceSha256,b.sequenceSha256);
 assert.equal(r.bitunix.holdoutStartTime,r.binance.holdoutStartTime);
 assert.deepEqual(r.bitunix.indicators,r.binance.indicators);
 assert.equal(r.noTuning,true);assert.equal(r.noPromotion,true);
 assert.throws(()=>matchedReport(bitunix,b,{baselineSha:'b'.repeat(64),priceStep}),/BASELINE_REPLAY_MISMATCH/);
 assert.throws(()=>studyContinuousHistoricalPeriod(b,{priceStep}),/REPLAY_REQUIRES/);
 assert.throws(()=>studyMatchedExchangePeriod({...b,source:bitunix.source},{priceStep,target}),/MATCHED_SOURCE_NOT_VERIFIED/);
});
test('incomplete archive scope cannot start a replay',async()=>{
 const db={query:async(sql)=>{assert.match(sql,/status='VERIFIED'/);return {rows:[]}}};
 const r=await loadMatchedBinanceDaily(db,{symbol,startMs:target.startMs,endMs:target.endMs});
 assert.equal(r.status,'AWAITING_BINANCE_ARCHIVES');assert.equal(r.verified,0);assert.ok(r.required>0);
});
