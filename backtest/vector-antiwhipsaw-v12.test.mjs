import test from 'node:test';
import assert from 'node:assert/strict';
import {vectorAIT} from './vector-ait-v1.mjs';
import {applyVectorConfirmation,studyVectorAntiWhipsaw,VECTOR_CONFIRMATION_MODES} from './vector-antiwhipsaw-v12.mjs';
const STEP=900000;
const bars=(n=70)=>Array.from({length:n},(_,i)=>({
 time:i*STEP,open:100,high:101,low:99,close:100,volume:100,
}));
const raw=n=>Array.from({length:n},()=>({bullishVector:false,bearishVector:false,signal:null,direction:0}));
function active(n=600){
 const b=bars(n);
 for(let i=30,k=0;i<n-1;i+=12,k++){
  b[i]=k%2?{...b[i],open:103,close:100,high:104,low:99,volume:10000}
            :{...b[i],open:100,close:103,high:104,low:99,volume:10000};
 }
 return b;
}
test('baseline emits the exact V1.1 signal index and direction with zero delay',()=>{
 const b=active(120),v=vectorAIT(b),o=applyVectorConfirmation(b,v);
 assert.deepEqual(o.events.map(x=>x.signal),v.map(x=>x.signal));
 assert.deepEqual(o.events.map(x=>x.direction),v.map(x=>x.direction));
 assert.ok(o.events.filter(x=>x.signal).every(x=>x.delayBars===0));
 assert.equal(VECTOR_CONFIRMATION_MODES.length,3);
});
test('follow-through accepts only next COMPLETED candle, never original Vector bar',()=>{
 const b=bars(),v=raw(b.length);
 b[30]={...b[30],open:100,close:102,high:103,low:99};
 b[31]={...b[31],open:102,close:102.5,high:103,low:100};
 v[30].bullishVector=true;
 const out=applyVectorConfirmation(b,v,'follow_close_1');
 assert.equal(out.events[30].signal,null);
 assert.equal(out.events[31].signal,'long');
 assert.equal(out.events[31].sourceIndex,30);
 assert.equal(out.events[31].delayBars,1);
 assert.equal(out.events[32].direction,1);
});
test('structure rule waits up to 2 candles for confirmed CLOSE beyond Vector high',()=>{
 const b=bars(),v=raw(b.length);
 b[30]={...b[30],open:100,close:102,high:105,low:99};
 b[31]={...b[31],open:103,close:104,high:106,low:101};
 b[32]={...b[32],open:104,close:106,high:107,low:102};
 v[30].bullishVector=true;
 const out=applyVectorConfirmation(b,v,'break_extreme_2');
 assert.equal(out.events[30].signal,null);
 assert.equal(out.events[31].signal,null);
 assert.equal(out.events[32].signal,'long');
 assert.equal(out.events[32].delayBars,2);
 // Bar 31's high above Vector high is insufficient, because only CLOSE counts.
});
test('failed continuation expires, opposing Vector cancels pending and requires its own confirmation',()=>{
 const b=bars(),v=raw(b.length);
 b[30]={...b[30],open:100,close:102,high:103,low:99};
 b[31]={...b[31],open:101,close:100,high:102,low:98};
 b[32]={...b[32],open:100,close:99,high:101,low:98};
 v[30].bullishVector=true;
 v[31].bearishVector=true;
 const out=applyVectorConfirmation(b,v,'follow_close_1');
 assert.equal(out.events[31].signal,null);
 assert.equal(out.events[32].signal,'short');
 assert.equal(out.diagnostics.cancelledOpposite,1);
 assert.equal(out.events[32].sourceIndex,31);
});
test('editing future candles cannot alter signals already emitted',()=>{
 const b=active(250),v=vectorAIT(b);
 const first=applyVectorConfirmation(b,v,'break_extreme_2').events.slice(0,170);
 const changed=b.map(x=>({...x}));
 for(let i=170;i<changed.length;i++)changed[i]={...changed[i],open:90,close:110,high:111,low:89,volume:10000};
 const later=applyVectorConfirmation(changed,vectorAIT(changed),'break_extreme_2').events.slice(0,170);
 assert.deepEqual(first,later);
});
test('selection is train-only; no candidacy based on later market changes',()=>{
 const b=active(),cutoffTime=b[300].time;
 const before=studyVectorAntiWhipsaw([{candles:b}],{cutoffTime,minTrainTrades:1,minTestTrades:1});
 const changed=b.map(x=>({...x}));
 for(let i=330;i<changed.length;i++)changed[i].volume*=2;
 const after=studyVectorAntiWhipsaw([{candles:changed}],{cutoffTime,minTrainTrades:1,minTestTrades:1});
 for(const side of ['long','short']){
  assert.ok(before.bySide[side].candidates.baseline_v11.train.trades>0);
  assert.equal(before.bySide[side].selectedOnTrain,after.bySide[side].selectedOnTrain);
 }
 assert.equal(before.assumptions.exit,'fixed_1_5_3_12');
 assert.equal(before.diagnostics.usableWindows,1);
});
test('insufficient samples cannot be promoted; gaps are excluded',()=>{
 const b=bars(180),cutoffTime=b[90].time;
 const baseline=studyVectorAntiWhipsaw([{candles:b}],{cutoffTime});
 assert.equal(baseline.bySide.long.selectedOnTrain,null);
 assert.equal(baseline.bySide.long.holdout.preliminaryPass,false);
 const broken=bars(180);broken[100].time+=STEP;
 const rejected=studyVectorAntiWhipsaw([{candles:broken}],{cutoffTime});
 assert.equal(rejected.diagnostics.usableWindows,0);
 assert.equal(rejected.diagnostics.rejectedGaps,1);
});
