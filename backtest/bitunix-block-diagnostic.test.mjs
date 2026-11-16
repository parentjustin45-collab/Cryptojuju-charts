import test from 'node:test';
import assert from 'node:assert/strict';
import {auditBitunixBlocks} from './bitunix-block-diagnostic.mjs';
const H=3600000;
const candle=t=>({time:t,open:100,high:101,low:99,close:100,volume:1});
test('repairs a missing hour only from real refetch',async()=>{
 const calls=[];
 const fetchPage=async q=>{calls.push(q);return q.startTime===H&&q.endTime===2*H?[candle(H)]:[candle(0),candle(2*H)];};
 const r=await auditBitunixBlocks(fetchPage,{symbol:'BTCUSDT',startTime:0,endTime:3*H});
 assert.equal(r.initial.missing,1);assert.equal(r.final.validUnique,3);
 assert.equal(r.final.status,'READY');assert.equal(calls.length,2);
});
test('never invents a missing candle after failed retry',async()=>{
 const r=await auditBitunixBlocks(async q=>q.startTime===0?[candle(0)]:[],{symbol:'ETHUSDT',startTime:0,endTime:2*H,retries:1});
 assert.deepEqual(r.final.missing,[H]);assert.equal(r.final.validUnique,1);
});
test('quarantines contradictory duplicates',async()=>{
 const r=await auditBitunixBlocks(async()=>[candle(0),{...candle(0),close:101}],{symbol:'SOLUSDT',startTime:0,endTime:H,retries:0});
 assert.deepEqual(r.final.duplicateTimes,[0]);assert.equal(r.final.validUnique,0);
});
test('invalid OHLC is never silently corrected',async()=>{
 const r=await auditBitunixBlocks(async()=>[{...candle(0),high:90}],{symbol:'BTCUSDT',startTime:0,endTime:H,retries:0});
 assert.equal(r.final.validUnique,0);assert.equal(r.final.invalid.length,1);
});

test('conflicting refetched candle remains quarantined',async()=>{
 let n=0;
 const r=await auditBitunixBlocks(async q=>{
  n++;
  if(n===1)return [candle(0),{...candle(H),high:90}];
  return [candle(H)];
 },{symbol:'BTCUSDT',startTime:0,endTime:2*H,retries:1});
 assert.equal(r.final.validUnique,1);
 assert.deepEqual(r.final.duplicateTimes,[H]);
});
