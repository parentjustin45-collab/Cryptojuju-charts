import test from 'node:test';
import assert from 'node:assert/strict';
import {planPriorHourlyWindows,auditPriorResultShape,
 HISTORICAL_SYMBOLS,HOUR_BARS} from './vector-daily-historical-windows.mjs';
test('two full 40-day periods are consecutive but disjoint and strictly earlier than the most recent one',()=>{
 const p=planPriorHourlyWindows();
 assert.equal(p.length,2);
 assert.equal(p[0].requestedBars,HOUR_BARS);
 assert.equal(p[0].endTime,p[1].endTime+40*86400000);
 assert.equal(p[0].startTime,p[1].endTime);
 assert.equal(p[0].utcEndExclusive,'2026-10-10T00:00:00.000Z');
 assert.equal(p[1].utcEndExclusive,'2026-08-31T00:00:00.000Z');
 assert.ok(p.every(x=>x.asOfMs<Date.parse(x.latestStudyEndExclusiveUtc)));
});
test('disallows unaligned/future/nonsensical history plans',()=>{
 assert.throws(()=>planPriorHourlyWindows({anchorUtc:'2026-11-19T04:00:00.000Z'}),/closed UTC/);
 assert.throws(()=>planPriorHourlyWindows({barCount:961}),/closed UTC/);
 assert.throws(()=>planPriorHourlyWindows({barCount:250}),/closed UTC/);
 assert.throws(()=>planPriorHourlyWindows({periods:0}),/closed UTC/);
});
test('blocked individual windows remain visible; no false complete success',()=>{
 const w=planPriorHourlyWindows();
 const data={protocol:'CJ_VECTOR_DAILY_PRIOR_WINDOWS_RESEARCH_V1',
  ordersPlaced:false,promotedVersion:null,cases:
   HISTORICAL_SYMBOLS.flatMap(symbol=>w.map(window=>({
     symbol,windowId:window.id,status:'BLOCKED',
     reason:'OHLC gap',holdoutModes:[]
   })))};
 assert.equal(auditPriorResultShape(data,w),true);
 assert.throws(()=>auditPriorResultShape({...data,cases:data.cases.slice(1)},w),/Incomplete/);
 const copied=structuredClone(data);
 copied.cases[1].windowId=copied.cases[0].windowId;
 assert.throws(()=>auditPriorResultShape(copied,w),/duplicate/);
});
