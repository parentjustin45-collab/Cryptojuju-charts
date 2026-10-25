import test from 'node:test';
import assert from 'node:assert/strict';
import {vectorAIT} from './vector-ait-v1.mjs';
import {studyVectorConfirmations,VECTOR_CONFIRMATIONS} from './vector-confirmation-study.mjs';

const step=900000;
const rows=(n=60,offset=0)=>Array.from({length:n},(_,i)=>({
 time:offset+i*step,open:100,high:101,low:99,close:100,volume:100
}));
function active(n=600){
 const b=rows(n);
 for(let i=30,k=0;i<n-1;i+=12,k++){
  b[i]=k%2?{...b[i],open:103,close:100,high:104,low:99,volume:10000}
               :{...b[i],open:100,close:103,high:104,low:99,volume:10000};
 }
 return b;
}
test('threshold 3 detects a moderate Vector skipped by unchanged V1.1 threshold 4',()=>{
 const b=rows();b[30]={...b[30],open:99.5,high:101,low:99,close:100.8};
 b[35]={...b[35],open:100.5,high:101,low:99,close:99.2};
 const early=vectorAIT(b,{minimumConfirmations:3});
 const original=vectorAIT(b);
 assert.equal(early[30].signal,'long');assert.equal(early[35].signal,'short');
 assert.equal(original[30].signal,null);assert.equal(original[35].signal,null);
 assert.deepEqual(VECTOR_CONFIRMATIONS,[3,4,5]);
});
test('later candles cannot change previously computed Vector events',()=>{
 const b=active(300);
 const before=vectorAIT(b).slice(0,200).map(x=>[x.signal,x.direction]);
 const altered=b.map(x=>({...x}));
 for(let i=200;i<altered.length;i++)altered[i]={...altered[i],volume:100000,open:100,close:105,high:106};
 const after=vectorAIT(altered).slice(0,200).map(x=>[x.signal,x.direction]);
 assert.deepEqual(before,after);
});
test('train-only selection remains unchanged if held-out price paths change',()=>{
 const b=active(),cutoffTime=b[300].time;
 const a=studyVectorConfirmations([{candles:b}],{cutoffTime,minTrainTrades:1,minTestTrades:1});
 const updated=b.map(x=>({...x}));
 for(let i=310;i<updated.length;i++)updated[i].volume*=2;
 const c=studyVectorConfirmations([{candles:updated}],{cutoffTime,minTrainTrades:1,minTestTrades:1});
 assert.equal(a.diagnostics.usableWindows,1);
 assert.equal(a.bySide.long.selectedOnTrain,c.bySide.long.selectedOnTrain);
 assert.equal(a.bySide.short.selectedOnTrain,c.bySide.short.selectedOnTrain);
 assert.ok(a.bySide.long.candidates['4'].train.trades>0);
 assert.ok(a.bySide.short.candidates['4'].train.trades>0);
 assert.equal(a.assumptions.exit,'fixed_1_5_3_12');
});
test('too few trades blocks selection and a gap is rejected',()=>{
 const b=rows(250);
 const x=studyVectorConfirmations([{candles:b}],{cutoffTime:b[130].time});
 assert.equal(x.bySide.long.selectedOnTrain,null);
 assert.equal(x.bySide.long.holdout.status,'insufficient_train_trades');
 assert.equal(x.bySide.long.holdout.researchPass,false);
 const g=rows(250);g[120].time+=step;
 const y=studyVectorConfirmations([{candles:g}],{cutoffTime:b[130].time});
 assert.equal(y.diagnostics.rejectedGaps,1);
 assert.equal(y.diagnostics.usableWindows,0);
});
