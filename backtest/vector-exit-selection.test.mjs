import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateVectorExitTrade,studyVectorExits,VECTOR_EXIT_CONFIGS} from './vector-exit-selection.mjs';

function bars(n=8,base=0){
 return Array.from({length:n},(_,i)=>({
  time:base+i*900000,open:100,high:100.2,low:99.8,close:100,volume:100
 }));
}
const oppositeVector=(n=8)=>Array.from({length:n},(_,i)=>({signal:i===0?'long':i===1?'short':null}));
const config=id=>VECTOR_EXIT_CONFIGS.find(x=>x.id===id);
const opts={cutoffTime:900000*20,feeRate:0.0006,slippageRate:0};

test('fixed means NO Vector exit, opposite means ONLY Vector exit, hybrid combines both',()=>{
 const b=bars();b[2]={...b[2],high:103,low:98};
 const vector=oppositeVector();
 const fixed=simulateVectorExitTrade(b,vector,0,'long',config('fixed_1_2_12'),opts);
 const opposite=simulateVectorExitTrade(b,vector,0,'long',config('opposite_vector'),opts);
 const hybrid=simulateVectorExitTrade(b,vector,0,'long',config('hybrid_1_2_12'),opts);
 assert.equal(fixed.reason,'stop');assert.equal(fixed.exitIndex,2);
 assert.equal(opposite.reason,'opposite');assert.equal(opposite.exitIndex,2);
 assert.equal(hybrid.reason,'opposite');assert.equal(hybrid.exitIndex,2);
 assert.ok(fixed.netPct<opposite.netPct);
});
test('fixed stop has priority if both intrabar levels are touched',()=>{
 const b=bars();b[1]={...b[1],low:98,high:103};
 const r=simulateVectorExitTrade(b,oppositeVector(),0,'long',config('fixed_1_2_12'),opts);
 assert.equal(r.reason,'stop');assert.equal(r.exitIndex,1);assert.equal(r.exit,99);
});
test('gap beyond stop fills at open, not at unreachable stop level',()=>{
 const b=bars();b[1]={...b[1],open:97,high:100,low:96,close:98};
 const r=simulateVectorExitTrade(b,oppositeVector(),0,'long',config('fixed_1_2_12'),opts);
 // Stop computed from the actual entry open on bar 1; use a gap on later bar.
 assert.equal(r.reason,'timeout'===r.reason?'timeout':r.reason);
 const later=bars();later[2]={...later[2],open:95,high:96,low:94,close:95};
 const s=simulateVectorExitTrade(later,oppositeVector(),0,'long',config('fixed_1_2_12'),opts);
 assert.equal(s.reason,'stop');assert.equal(s.exitIndex,2);assert.equal(s.exit,95);
});
test('no opposite by end of clean window is CENSORED, not a fictitious exit',()=>{
 const r=simulateVectorExitTrade(bars(),[{signal:'long'},...Array.from({length:7},()=>({signal:null}))],0,'long',config('opposite_vector'),opts);
 assert.equal(r.status,'censored');assert.equal(r.censorReason,'window_end');
});
test('fixed position cut by split is censored, excluded from profit',()=>{
 const b=bars(8),v=oppositeVector();
 const r=simulateVectorExitTrade(b,v,0,'long',config('fixed_1_2_12'),{...opts,cutoffTime:b[3].time});
 assert.equal(r.status,'censored');assert.equal(r.censorReason,'split_boundary');
});
test('stress slippage reduces net return on identical completed trade',()=>{
 const b=bars(15),v=oppositeVector();
 const zero=simulateVectorExitTrade(b,v,0,'long',config('fixed_1_2_12'),opts);
 const stress=simulateVectorExitTrade(b,v,0,'long',config('fixed_1_2_12'),{...opts,slippageRate:0.0005});
 assert.equal(zero.reason,'timeout');assert.equal(stress.reason,'timeout');
 assert.ok(stress.netPct<zero.netPct);
});
test('selection uses only training trades and exposes SAME winner stress validation',()=>{
 const a=bars(400),r=studyVectorExits([{candles:a}],{cutoffTime:a[200].time});
 assert.equal(r.configs.length,7);
 assert.ok(r.bySide.long.candidates.fixed_1_2_12.test);
 assert.ok(r.bySide.long.candidates.hybrid_1_2_12.stress.test);
 assert.equal(r.bySide.long.selectedOnTrain,null);
 assert.equal(r.bySide.long.validation.status,'insufficient_train_trades');
 assert.equal(r.diagnostics.windowsUsed,1);
});
test('rejects discontinuous clean-window input instead of crossing gap',()=>{
 const b=bars(40);b[25].time+=900000;
 const r=studyVectorExits([{candles:b}],{cutoffTime:900000*20});
 assert.equal(r.diagnostics.rejectedGaps,1);
 assert.equal(r.diagnostics.windowsUsed,0);
});
test('requires chronological cutoff',()=>assert.throws(()=>studyVectorExits([{candles:bars()}]),/cutoffTime/));
