import test from 'node:test';
import assert from 'node:assert/strict';
import {extendedBitunixAudit,EXTENDED_LOCK}
 from './momentum-fusion-extended-bitunix.mjs';
const H=3600000,NOW=Date.UTC(2026,9,27,9);
test('Extended data lock is longer than 672 and preserves minimum 135 / 2 blocked markets',()=>{
 assert.equal(EXTENDED_LOCK.barsRequested,2016);
 assert.equal(EXTENDED_LOCK.minContinuous,135);
 assert.deepEqual(EXTENDED_LOCK.symbols.map(x=>x.symbol+'/'+x.tf),
  ['ETHUSDT/1h','SOLUSDT/30m']);
});
test('Two continuous Bitunix cases work with exact closed times and zero missing',async()=>{
 const provider=async({interval,startTime,endTime})=>{
  const step=interval==='1h'?H:H/2;
  return Array.from({length:(endTime-startTime)/step},(_,i)=>{
   const t=startTime+i*step,x=100+3*Math.sin(i*.09);
   return {time:t,open:x-.2,close:x,high:x+.6,low:x-.6,volume:100};
  });
 };
 const a=await extendedBitunixAudit({nowMs:NOW,fetchPage:provider});
 assert.equal(a.status,'BOTH_ANALYZED');
 for(const x of a.results){
  assert.equal(x.data.expected,2016);
  assert.equal(x.data.eligibleSegments,1);
  assert.equal(x.data.latestContinuous,2016);
  assert.equal(x.data.invalid,0);
  assert.equal(x.latestValidTime,x.to-(x.tf==='1h'?H:H/2));
  assert.ok(x.data.actualComputed>1000);
 }
});
test('Invalid OHLC prevents stitching and can block a symbol if every clean run <135',async()=>{
 const provider=async({startTime,endTime,interval})=>{
  const step=interval==='1h'?H:H/2;
  return Array.from({length:(endTime-startTime)/step},(_,i)=>{
   const t=startTime+i*step,x=100+Math.sin(i*.19);
   const b={time:t,open:x,high:x+.4,low:x-.4,close:x,volume:1};
   // Same anchored absolute timestamp pattern across pages.
   if((Math.floor(t/step)%100)===0)b.high=x-.1;
   return b;
  });
 };
 const a=await extendedBitunixAudit({nowMs:NOW,fetchPage:provider});
 assert.equal(a.status,'PARTIAL_QUARANTINED');
 assert.ok(a.results.every(x=>x.status==='BLOCKED'));
 assert.ok(a.results.every(x=>x.data.longestContinuous<135));
 assert.ok(a.results.every(x=>x.latestValidComposite===null));
});
