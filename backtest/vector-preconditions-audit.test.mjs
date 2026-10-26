import test from 'node:test';
import assert from 'node:assert/strict';
import {PRECONDITIONS_LOCK,auditPreconditions,causalFeatureRow}
 from './vector-preconditions-audit.mjs';
const H=3600000;
function synthetic(n=185){
 let price=100,x=0xced123;
 const rnd=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};
 return Array.from({length:n},(_,i)=>{
  const open=price,delta=(rnd()-.5)*2.5*(i%17===0?3:1);
  const close=Math.max(25,open+delta),high=Math.max(open,close)+.1+rnd()*.6,
   low=Math.max(.01,Math.min(open,close)-.1-rnd()*.6);
  price=close;
  return {time:i*H,open,high,low,close,volume:80+rnd()*250+(i%11===0?10000:0)};
 });
}
test('A fixed repeatable Bitunix 90-day OHLC window and known review examples',()=>{
 assert.equal(PRECONDITIONS_LOCK.periodEnd-PRECONDITIONS_LOCK.periodStart,90*24*H);
 assert.equal(PRECONDITIONS_LOCK.cutoff-PRECONDITIONS_LOCK.periodStart,45*24*H);
 assert.deepEqual(PRECONDITIONS_LOCK.symbols,['BTCUSDT','ETHUSDT','SOLUSDT']);
 assert.equal(PRECONDITIONS_LOCK.modes.length,2);
 assert.equal(PRECONDITIONS_LOCK.reviewCases.length,2);
});
test('The signal features NEVER consult candles after their close (up and down)',()=>{
 const b=synthetic(),i=100;
 const original=causalFeatureRow(b,i,'long'),short=causalFeatureRow(b,i,'short');
 const future=b.map((x,j)=>j>i?{...x,open:900,high:1000,low:800,close:920,volume:1e8}:x);
 assert.deepEqual(original,causalFeatureRow(future,i,'long'));
 assert.deepEqual(short,causalFeatureRow(future,i,'short'));
 assert.equal(original.signedPrior3hPct,-short.signedPrior3hPct);
 assert.equal(original.signedEma50SlopePct,-short.signedEma50SlopePct);
});
test('Constant 6-bar prices are classified as no directional efficiency, not division by zero',()=>{
 const b=Array.from({length:90},(_,i)=>({time:i*H,open:100,high:101,low:99,close:100,volume:100}));
 const f=causalFeatureRow(b,80,'short');
 assert.equal(f.efficiency6,0);
 assert.equal(f.atrPct,2);
 assert.equal(f.bodyAtr,0);
 assert.equal(f.directionalStructure4,false);
});
test('Invalid side, incomplete warmup or noncontiguous history is refused',()=>{
 const b=synthetic();
 assert.throws(()=>causalFeatureRow(b,99,'BUY'),/Invalid/);
 assert.throws(()=>causalFeatureRow(b.slice(0,20),10,'long'),/55/);
 b[60].time+=H;
 assert.throws(()=>causalFeatureRow(b,100,'long'),/Discontinuous/);
});
test('Each rejected raw Vector reversal has exactly one retrospective label',()=>{
 const r=auditPreconditions([{candles:synthetic()}],{cutoffTime:80*H});
 assert.equal(r.status,'EXPLORATORY_PRECONDITION_AUDIT');
 assert.equal(r.cleanWindows,1);
 for(const mode of PRECONDITIONS_LOCK.modes){
  const v=r.byMode[mode],groupSum=Object.values(v.groups).reduce((a,bySide)=>
   a+Object.values(bySide).reduce((b,byLabel)=>b+Object.values(byLabel)
    .reduce((c,item)=>c+item.count,0),0),0);
  assert.equal(groupSum,v.rows.length);
  assert.equal(v.rows.every(x=>PRECONDITIONS_LOCK.groups.includes(x.hindsightLabel)),true);
 }
});
test('Observed features do not become labels and future labels are censored at split',()=>{
 const b=synthetic();
 const r=auditPreconditions([{candles:b}],{cutoffTime:80*H});
 for(const mode of PRECONDITIONS_LOCK.modes){
  for(const rec of r.byMode[mode].rows){
   assert.ok(rec.features.atrPct>=0);
   assert.ok(rec.features.efficiency6>=0&&rec.features.efficiency6<=1);
   assert.ok(rec.features.directionalStructure4===true||rec.features.directionalStructure4===false);
   const index=rec.time/H;
   if(rec.period==='earlier'&&index>=68){
    assert.equal(rec.gross12hPct,null);
    assert.equal(rec.hindsightLabel,'censored');
   }
  }
 }
});
test('Later prices do not alter earlier feature labels when horizon is wholly before edit',()=>{
 const b=synthetic(),r=auditPreconditions([{candles:b}],{cutoffTime:90*H});
 const alt=b.map((c,i)=>i>=140?{...c,open:100,high:111,low:89,close:103,volume:1e6}:{...c});
 const z=auditPreconditions([{candles:alt}],{cutoffTime:90*H});
 for(const mode of PRECONDITIONS_LOCK.modes){
  const early=x=>x.byMode[mode].rows.filter(y=>y.time<120*H);
  assert.deepEqual(early(r),early(z));
 }
});
