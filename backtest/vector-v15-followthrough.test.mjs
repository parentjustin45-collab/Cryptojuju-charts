import test from 'node:test';
import assert from 'node:assert/strict';
import {applyVectorV15,V15_LOCK} from './vector-v15-followthrough.mjs';
import {applyVectorV14} from './vector-v14-hysteresis.mjs';
const H=3600000;
function candles(n=85){return Array.from({length:n},(_,i)=>({
 time:i*H,open:100,high:101.6,low:99.4,close:100,volume:100
}));}
function raw(b,p={}){return b.map((v,i)=>({
 time:v.time,bullishVector:p[i]==='long',bearishVector:p[i]==='short',signal:null,direction:0
}));}
const signals=r=>r.events.flatMap((e,i)=>e.signal?[{i,side:e.signal,why:e.why,src:e.sourceIndex}]:[]);
function fixture(){
 const b=candles(),v=raw(b,{30:'short',37:'long'});
 b[30]={...b[30],open:100.2,close:99.85};
 b[37]={...b[37],open:99.9,close:100.02};
 b[38]={...b[38],open:100.02,close:100.4};
 b[39]={...b[39],open:100.4,close:101.15};
 return {b,v};
}
test('Research V1.5 pre-registration is deterministic, no edits to V1.4 lock',()=>{
 assert.equal(V15_LOCK.followThroughMinAgeBars,2);
 assert.equal(V15_LOCK.followThroughMaxAgeBars,3);
 assert.equal(V15_LOCK.previousProgressAtr,.15);
 assert.equal(V15_LOCK.followThroughProgressAtr,.45);
 assert.equal(V15_LOCK.minBarsAfterFlip,3);
});
test('Two qualifying closes confirm reversal; V1.4 continues to reject the same case',()=>{
 const {b,v}=fixture();
 const old=applyVectorV14(b,{rawVector:v});
 const exp=applyVectorV15(b,{rawVector:v});
 assert.deepEqual(signals(old),[{i:30,side:'short',why:'initial',src:30}]);
 assert.deepEqual(signals(exp),[
  {i:30,side:'short',why:'initial',src:30},
  {i:39,side:'long',why:'two_close_follow_through',src:37}
 ]);
 assert.equal(exp.audit.followThrough,1);
});
test('A one-bar fakeout does not confirm and leaves the original SHORT intact',()=>{
 const {b,v}=fixture();
 b[39]={...b[39],open:100.4,close:100.03};
 const out=applyVectorV15(b,{rawVector:v});
 assert.deepEqual(signals(out),[{i:30,side:'short',why:'initial',src:30}]);
});
test('No lookahead: modifying all future candles never changes prior emitted signals',()=>{
 const {b,v}=fixture(),x=applyVectorV15(b,{rawVector:v});
 const changed=b.map((bar,i)=>i>=45?{...bar,open:104,high:108,
  low:96,close:105}:{...bar});
 const y=applyVectorV15(changed,{rawVector:v});
 assert.deepEqual(x.events.slice(0,45),y.events.slice(0,45));
});
test('Symmetrical follow-through SHORT after an initial LONG',()=>{
 const {b}=fixture(),v=raw(b,{30:'long',37:'short'});
 b[37]={...b[37],open:100.1,close:99.98};
 b[38]={...b[38],open:99.98,close:99.6};
 b[39]={...b[39],open:99.6,close:98.85};
 const res=applyVectorV15(b,{rawVector:v});
 assert.equal(signals(res).at(-1).side,'short');
 assert.equal(signals(res).at(-1).why,'two_close_follow_through');
});
test('A gap blocks the whole window rather than inventing a continuous trade',()=>{
 const {b,v}=fixture();b[40].time+=H;
 assert.throws(()=>applyVectorV15(b,{rawVector:v}),/Discontinuous/);
});
test('Original reference candles and synthetic V1.4 outputs do not mutate',()=>{
 const {b,v}=fixture(),before=JSON.stringify({b,v});
 assert.deepEqual(applyVectorV15(b,{rawVector:v}),applyVectorV15(b,{rawVector:v}));
 assert.equal(JSON.stringify({b,v}),before);
 assert.equal(applyVectorV14(b,{rawVector:v}).events[39].signal,null);
});
