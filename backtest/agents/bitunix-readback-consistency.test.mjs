import test from 'node:test';
import assert from 'node:assert/strict';
import {compareBitunixReadbacks} from './bitunix-readback-consistency.mjs';
import {fetchBitunixDataPilot} from './bitunix-data-pilot.mjs';

const intervalMs=900000;
const boundary=Date.UTC(2026,10,19,9,0);
const nowMs=boundary+120000;
const rows=Array.from({length:33},(_,i)=>({
  time:boundary-(33-i)*intervalMs,open:101,high:102,low:100,close:101,volume:50+i
}));
async function sample(closedBars,source=rows,opts={}){
 return fetchBitunixDataPilot({
  symbol:'BTCUSDT',timeframe:'15m',nowMs,closedBars,anchorBars:3,
  fetchPage:async({startTime,endTime})=>
    source.filter(r=>r.time>=startTime&&r.time<endTime),
  ...opts
 });
}
test('double read of identical closed OHLC with exact anchor overlap is stable',async()=>{
 const first=await sample(30),second=await sample(24);
 const result=compareBitunixReadbacks(first,second);
 assert.equal(result.status,'STABLE_TWO_READS');
 assert.equal(result.checkedRaw,27);
 assert.equal(result.checkedDerived,24);
 assert.equal(result.differenceCount,0);
 assert.equal(result.overlapRawSha256First,result.overlapRawSha256Second);
});
test('an upstream raw CLOSE revision blocks even with valid candle geometry',async()=>{
 const first=await sample(30),changed=rows.map(x=>({...x}));
 changed.at(-1).close=101.25;
 const second=await sample(24,changed);
 const result=compareBitunixReadbacks(first,second);
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.reason,'CLOSED_CANDLE_REVISION_OR_MISMATCH');
 assert.ok(result.differences.some(x=>x.field==='close'&&x.kind==='raw'));
});
test('raw volume-only revision is recorded, not hidden',async()=>{
 const first=await sample(30),changed=rows.map(x=>({...x}));
 changed.at(-1).volume+=1;
 const result=compareBitunixReadbacks(first,await sample(24,changed));
 assert.equal(result.status,'BLOCKED');
 assert.ok(result.differences.some(x=>x.field==='volume'));
});
test('read at a different candle boundary cannot be called repeatability',async()=>{
 const first=await sample(30),second=await sample(24,rows,{nowMs:nowMs+intervalMs});
 assert.equal(second.status,'BLOCKED'); // no newly closed candle in original fixture
 assert.equal(compareBitunixReadbacks(first,second).status,'BLOCKED');
});
test('missing second response, wrong market and malformed data all block',async()=>{
 const first=await sample(30),second=await sample(24);
 assert.equal(compareBitunixReadbacks(first,{...second,status:'BLOCKED'}).status,'BLOCKED');
 assert.equal(compareBitunixReadbacks(first,{...second,market:{...second.market,symbol:'ETHUSDT'}}).status,'BLOCKED');
 const wrong={...second,acceptedCandles:second.acceptedCandles.slice(1)};
 assert.equal(compareBitunixReadbacks(first,wrong).status,'BLOCKED');
});
