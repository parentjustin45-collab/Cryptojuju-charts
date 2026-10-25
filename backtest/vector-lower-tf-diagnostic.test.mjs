import test from 'node:test';
import assert from 'node:assert/strict';
import {LTF_LOCK,completedContextIndex,lastCompletedContext,scanLowerTfSignals} from './vector-lower-tf-diagnostic.mjs';
const H=3600000,D=24*H,Q=900000;
const bars=(n,step)=>Array.from({length:n},(_,i)=>({
 time:i*step,open:100,high:101,low:99,close:100,volume:100
}));
function shortAt(c,i){
 c[i]={...c[i],open:103,close:100,high:104,low:99,volume:1e6};
}
function longAt(c,i){
 c[i]={...c[i],open:100,close:103,high:104,low:99,volume:1e6};
}
test('Diagnostic lock uses fixed BTC 15m, 30m and 1h scopes; no order model',()=>{
 assert.equal(LTF_LOCK.symbol,'BTCUSDT');
 assert.deepEqual(LTF_LOCK.entries,['15m','30m','1h']);
 assert.deepEqual(LTF_LOCK.modes,['baseline_v11','break_extreme_2']);
 assert.equal(LTF_LOCK.historyDays,45);
});
test('Higher timeframe direction becomes visible at CLOSE, never earlier',()=>{
 const c=bars(25,H);
 const index=completedContextIndex([{candles:c}],H);
 assert.equal(lastCompletedContext(index,H-1),null);
 assert.equal(lastCompletedContext(index,H),'neutral');
 assert.equal(lastCompletedContext(index,2*H-1),'neutral');
 index.byClose.set(2*H,'bear');
 assert.equal(lastCompletedContext(index,2*H-1),'neutral');
 assert.equal(lastCompletedContext(index,2*H),'bear');
 index.byClose.delete(2*H);
 assert.equal(lastCompletedContext(index,2*H),null);
});
test('15m Vector SHORT and 15m delayed confirmation use ONLY prior closed 1h/4h',()=>{
 const c=bars(80,Q);shortAt(c,31);
 c[32]={...c[32],open:100,high:101,low:97,close:98};
 const contexts={
  '1h':{step:H,byClose:new Map([[8*H,'bear'],[9*H,'bull']])},
  '4h':{step:4*H,byClose:new Map([[8*H,'bear']])},
  '1d':{step:D,byClose:new Map()}
 };
 const r=scanLowerTfSignals({entryWindows:[{candles:c}],interval:'15m',contexts});
 const v1=r.modes.baseline_v11.bySide.short;
 const v2=r.modes.break_extreme_2.bySide.short;
 assert.ok(v1.signals>=1);
 assert.ok(v2.signals>=1);
 assert.equal(v1.context['1h'].aligned,1);
 assert.equal(v1.context['4h'].aligned,1);
 assert.equal(v1.context['1d'].unknown,1);
 assert.equal(v2.context['1h'].aligned,1);
 assert.equal(v2.context['4h'].aligned,1);
});
test('Rapid opposites are reported as directional flip diagnostics, NOT false-trade percentages',()=>{
 const c=bars(100,Q);
 shortAt(c,31);longAt(c,37);
 const r=scanLowerTfSignals({entryWindows:[{candles:c}],interval:'15m'});
 assert.ok(r.modes.baseline_v11.oppositePairs>=1);
 assert.ok(r.modes.baseline_v11.rapidOppositePairs>=1);
 assert.equal(r.modes.baseline_v11.bySide.long.context['4h'].unknown>=1,true);
});
test('No gaps can silently connect separated windows',()=>{
 const c=bars(80,Q),bad=c.map(x=>({...x}));
 bad[45].time+=Q;
 assert.throws(()=>scanLowerTfSignals({entryWindows:[{candles:bad}],interval:'15m'}),/Discontinuous/);
});
test('Unsupported interval and context steps are blocked',()=>{
 assert.throws(()=>scanLowerTfSignals({entryWindows:[],interval:'1d'}),/Unsupported/);
 assert.throws(()=>completedContextIndex([],Q),/Unsupported/);
});
test('Future context does not affect already emitted 15m classification',()=>{
 const c=bars(80,Q);shortAt(c,31);
 const contexts={'1h':{step:H,byClose:new Map([[8*H,'bear']])}};
 const one=scanLowerTfSignals({entryWindows:[{candles:c}],interval:'15m',contexts});
 contexts['1h'].byClose.set(9*H,'bull');
 const two=scanLowerTfSignals({entryWindows:[{candles:c}],interval:'15m',contexts});
 assert.equal(one.modes.baseline_v11.bySide.short.context['1h'].aligned,
  two.modes.baseline_v11.bySide.short.context['1h'].aligned);
});
