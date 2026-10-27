import test from 'node:test';
import assert from 'node:assert/strict';
import {auditMomentumFusion,MOMENTUM_AUDIT_LOCK}
 from './momentum-fusion-bitunix-audit.mjs';
const H=3600000;
const NOW=Date.UTC(2026,9,26,20);
test('Read-only audit locks baseline, 4 TFs and 3 cryptos without trading orders',()=>{
 assert.equal(MOMENTUM_AUDIT_LOCK.noTrades,true);
 assert.equal(MOMENTUM_AUDIT_LOCK.noThresholdOptimizations,true);
 assert.deepEqual(MOMENTUM_AUDIT_LOCK.timeframes,['15m','30m','1h','4h']);
 assert.deepEqual(MOMENTUM_AUDIT_LOCK.symbols,['BTCUSDT','ETHUSDT','SOLUSDT']);
});
test('Injectable deterministic closed OHLC feeds 12 markets with no historical pivot backdating',async()=>{
 const called=[],steps={'15m':H/4,'30m':H/2,'1h':H,'4h':4*H};
 const provider=async({symbol,interval,startTime,endTime,limit})=>{
  called.push({symbol,interval,limit});
  const step=steps[interval],rows=[];
  for(let t=startTime;t<endTime;t+=step){
   const i=t/step,close=100+Math.sin(i*.14)*4+Math.sin(i*.041)*2+i*.0001;
   rows.push({time:t,open:close-.15,close,high:close+.55,
    low:close-.8,volume:1000});
  }
  return rows;
 };
 const r=await auditMomentumFusion({fetchPage:provider,nowMs:NOW});
 assert.equal(r.state,'ALL_ANALYZED');
 assert.equal(r.results.length,12);
 assert.equal(called.length,48);
 for(const x of r.results){
  assert.equal(x.status,'ANALYZED');
  assert.equal(x.data.eligibleWindows,1);
  assert.equal(x.data.excludedBars,0);
  assert.equal(x.data.barsAnalyzed,672);
  assert.ok(x.counts.firstAvailable!==null);
  for(const e of x.events){
   assert.ok(e.availableAt<x.data.end);
   if(e.kind.startsWith('reg')||e.kind.startsWith('hidden')){
    assert.ok(e.availableAt>e.pivotTime);
    assert.equal((e.availableAt-e.pivotTime)/steps[x.market.tf],5);
   }
  }
 }
});
test('An invalid early candle is quarantined, never interpolated across a gap',async()=>{
 const provider=async({startTime,endTime,interval,symbol})=>{
  const step=interval==='1h'?H:H/4,rows=[];
  for(let t=startTime;t<endTime;t+=step){
   const i=t/step,close=100+3*Math.sin(.12*i);
   rows.push({time:t,open:close,close,high:close+1,low:close-1,volume:1});
  }
  if(symbol==='ETHUSDT'&&endTime-startTime===180*step)
   rows[2].high=rows[2].open-.001;
  return rows;
 };
 const r=await auditMomentumFusion({fetchPage:provider,nowMs:NOW,
  markets:['ETHUSDT'],timeframes:['1h']});
 assert.equal(r.results.length,1);
 assert.ok(r.results[0].data.excludedBars>=1);
 assert.ok(['ANALYZED','BLOCKED_DATA'].includes(r.results[0].status));
 assert.ok(r.results[0].events.every(x=>x.availableAt<=r.results[0].data.lastExpectedClosedOpen));
});
