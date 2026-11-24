import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateHistoricalSource,reconcileHourlyArchives}
  from './render/historical-library.mjs';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const step=900000,end=Date.UTC(2026,10,24,18);
export function makeValidatedFixture({symbol='BTCUSDT',timeframe='15m',
  count=480,closeDelta=0}={}){
  const span={ '15m':900000,'30m':1800000,'1h':3600000,
    '4h':14400000,'1d':86400000}[timeframe];
  const start=end-count*span;
  const bars=Array.from({length:count},(_,i)=>{
    const open=100+i*.01;
    return {time:start+i*span,open,high:open+1,
      low:open-1,close:open+.1+(i===5?closeDelta:0),volume:100+i};
  });
  const rawRows=[...bars.slice(0,3).map((c,i)=>({...c,time:start-(3-i)*span})),...bars];
  const rawSha=sha(rawRows),derivedSha=sha(bars),fingerprint='b'.repeat(64);
  const historyWindow={startTime:start,endTime:end,intervalMs:span};
  return {
    first:{
      status:'DATA_READY_FOR_RESEARCH_ONLY',
      market:{symbol,timeframe,exchange:'Bitunix',priceType:'LAST_PRICE'},
      provenance:{source:'Bitunix public Futures REST',priceType:'LAST_PRICE',
        formingBarExcluded:true,rawSha256:rawSha,derivedSha256:derivedSha},
      historyWindow,rawRows,acceptedCandles:bars,role1:{status:'PASS'},
      quality:{unresolved:0}
    },
    repeat:{status:'STABLE_TWO_READS',checkedDerived:count,differenceCount:0,
      firstRawSha256:rawSha,overlapRawSha256First:fingerprint,
      overlapRawSha256Second:fingerprint,
      market:{symbol,timeframe,exchange:'Bitunix'},historyWindow}
  };
}
test('historical bridge validates strict double-read source + full 480 canonical rows',()=>{
 const x=makeValidatedFixture();
 const v=validateHistoricalSource(x.first,x.repeat);
 assert.equal(v.rows.length,480);
 assert.equal(v.rows[0].open_ms,v.startMs);
 assert.equal(v.rows.at(-1).open_ms,v.endMs-900000);
 assert.match(v.rows[0].candle_sha256,/^[a-f0-9]{64}$/);
});
test('historical bridge requires genuine source hashes, repeatability and no gaps',()=>{
 const mk=()=>makeValidatedFixture();
 let f=mk();f.repeat.status='BLOCKED';
 assert.throws(()=>validateHistoricalSource(f.first,f.repeat),/DOUBLE_READ/);
 f=mk();f.first.acceptedCandles[10].time++;
 assert.throws(()=>validateHistoricalSource(f.first,f.repeat),/UNVERIFIED_SOURCE/);
 f=mk();f.first.rawRows[1].close++;
 assert.throws(()=>validateHistoricalSource(f.first,f.repeat),/UNVERIFIED_SOURCE/);
 f=mk();f.first.market.symbol='XAUUSDT';
 assert.throws(()=>validateHistoricalSource(f.first,f.repeat),/UNVERIFIED_SOURCE/);
 f=mk();f.first.acceptedCandles[6].close=999;
 f.first.provenance.derivedSha256=sha(f.first.acceptedCandles);
 assert.throws(()=>validateHistoricalSource(f.first,f.repeat),/INVALID_OR_NONCAUSAL_OHLC/);
});
test('legacy and current cohort allow 960 candles if independently verified',()=>{
 const x=makeValidatedFixture({symbol:'SOLUSDT',timeframe:'4h',count:960});
 const v=validateHistoricalSource(x.first,x.repeat);
 assert.equal(v.rows.length,960);
});
test('read-only reconciliation does not insert anything into database',async()=>{
 let sql='';
 const mock={query:async(query,params)=>{sql=query;assert.deepEqual(params,[2]);return {rows:[]}}};
 const r=await reconcileHourlyArchives(mock,{limit:2});
 assert.equal(r.dryRun,true);
 assert.equal(r.scanned,0);
 assert.match(sql,/cj_archive_manifest/);
 assert.match(sql,/cj_historical_source_receipts/);
 await assert.rejects(reconcileHourlyArchives(mock,{limit:99}),/INVALID_BRIDGE_BATCH/);
});
