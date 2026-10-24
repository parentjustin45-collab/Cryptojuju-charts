import test from 'node:test';
import assert from 'node:assert/strict';
import {validateIndicator} from './indicator-validation.mjs';
const step=900000,historyWindow={startTime:0,endTime:9*step,intervalMs:step};
const candle=i=>({time:i*step,open:100+i,high:105+i,low:95+i,close:102+i,volume:10});
test('signals are executed only within clean independent windows',()=>{
 const rows=Array.from({length:9},(_,i)=>candle(i));
 rows[4]={...rows[4],high:rows[4].open-1};
 const signals=[{time:2*step,side:'long'},{time:3*step,side:'long'},{time:5*step,side:'short'},{time:7*step,side:'flat'}];
 const r=validateIndicator({id:'fixture',rows,historyWindow,signals,options:{feeRate:0}});
 assert.equal(r.status,'PARTIAL_DATA');
 assert.equal(r.quality.invalid,1);
 assert.equal(r.segments.length,2);
 assert.equal(r.segments[0].report.trades[0].entryTime,3*step);
 assert.equal(r.segments[1].report.trades[0].entryTime,6*step);
 assert.equal(r.segments[1].report.initialCapital,100);
 assert.equal(r.excludedBars,1);
});
test('missing candle prevents cross-gap positions',()=>{
 const rows=Array.from({length:9},(_,i)=>candle(i)).filter(c=>c.time!==4*step);
 const r=validateIndicator({id:'fixture',rows,historyWindow,signals:[{time:3*step,side:'long'}]});
 assert.equal(r.segments.length,2);
 assert.equal(r.summary.tradeCount,0);
});
test('reject duplicate indicator signals',()=>{
 assert.throws(()=>validateIndicator({id:'fixture',rows:[candle(0)],historyWindow:{startTime:0,endTime:step,intervalMs:step},signals:[{time:0,side:'long'},{time:0,side:'short'}]}),/duplicate/);
});
test('no history means blocked, not a false success',()=>{
 const r=validateIndicator({id:'fixture',rows:[],historyWindow,signals:[]});
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.summary.winRatePct,null);
});
