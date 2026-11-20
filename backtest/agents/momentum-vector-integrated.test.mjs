import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMomentumVectorVariants,MOMENTUM_VECTOR_PILOT_LOCK}
 from './momentum-vector-integrated.mjs';
import {runIntegratedVectorRiskStudy,INTEGRATED_MOMENTUM_IDS,
 INTEGRATED_RECOVERY_LOCK} from './vector-integrated-risk.mjs';
import {calculateMomentumFusion,MOMFUSION_DEFAULTS}
 from '../momentum-fusion-v1.mjs';
const H=3600000,T=Date.UTC(2026,8,1);
const symbol='BTCUSDT';
const contract={symbol,priceStep:0.01,quotePrecision:2,
 stepStatus:'RESEARCH_PRICE_PRECISION_NOT_TV_MINTICK'};
const bars=(()=>{let last=100;
 return Array.from({length:960},(_,i)=>{
  const open=last;
  const shock=i%63===0?(i%126===0?4.8:-4.8):0;
  const change=0.45*Math.sin(i*.31)+0.22*Math.sin(i*.061)+shock;
  const close=Math.max(30,open+change);
  const high=Math.max(open,close)+0.25;
  const low=Math.min(open,close)-0.25;
  last=close;
  return {time:T+i*H,open,high,low,close,volume:100+i};
 });
})();
const source={market:{exchange:'Bitunix',priceType:'LAST_PRICE',
 symbol,timeframe:'1h'},historyWindow:{startTime:T,endTime:T+960*H,intervalMs:H}};
const run=()=>buildMomentumVectorVariants({bars,contract});
test('pilot lock is exactly three separate variants without Daily',()=>{
 assert.deepEqual(MOMENTUM_VECTOR_PILOT_LOCK.strategies,INTEGRATED_MOMENTUM_IDS);
 assert.equal(MOMENTUM_VECTOR_PILOT_LOCK.dailyApplied,false);
 assert.equal(MOMENTUM_VECTOR_PILOT_LOCK.sourceParity,'UNVERIFIED_PINE_TV');
 assert.equal(MOMENTUM_VECTOR_PILOT_LOCK.warmupBars,168);
 assert.equal(MOMENTUM_VECTOR_PILOT_LOCK.momParameters,MOMFUSION_DEFAULTS);
});
test('Momentum-alone uses ONLY original bull/bear alerts from CLOSED bars',()=>{
 const r=run();
 const m=calculateMomentumFusion(bars);
 const expected=m.flatMap((x,i)=>i<168||i===bars.length-1?[]:
  x.bullSignal?[{time:x.time,side:'long'}]:
  x.bearSignal?[{time:x.time,side:'short'}]:[]);
 assert.deepEqual(r.commandsByVariant.momentum_fusion_v1,expected);
 assert.equal(expected.length,r.counts.momentumLongSignals+r.counts.momentumShortSignals);
 assert.equal(r.tradeOrdersPlaced,false);
});
test('Vector-alone and combined use exact same original Vector events; combined only filters or FLAT',()=>{
 const r=run();
 const all=new Map(r.commandsByVariant.vector_v11.map(s=>[s.time,s.side]));
 const combined=r.commandsByVariant.vector_v11_momentum_confirmed;
 for(const cmd of combined){
  assert.ok(all.has(cmd.time));
  assert.ok(cmd.side===all.get(cmd.time)||cmd.side==='flat');
 }
 assert.equal(r.counts.vectorCandidates,r.pairedEvents.length);
 assert.equal(r.counts.vectorCandidates,
  r.counts.vectorAcceptedByMomentum+r.counts.vectorRejectedByMomentum);
 assert.ok(r.pairedEvents.every(x=>x.earliestEntryAt===x.confirmationCloseAt));
 assert.ok(r.pairedEvents.every(x=>x.decision!=='ACCEPT'||
   (x.signal==='long'&&x.momentumComposite>50&&x.emaBull)||
   (x.signal==='short'&&x.momentumComposite<50&&x.emaBear)));
 assert.ok(r.commandsByVariant.vector_v11.every(x=>x.time>=T+168*H));
});
test('earlier commands remain identical after later candle values are changed',()=>{
 const baseline=run();
 const altered=bars.map((x,i)=>i<900?{...x}:{
  ...x,close:x.open+0.9,high:x.open+1.5,low:x.open-0.5
 });
 const changed=buildMomentumVectorVariants({bars:altered,contract});
 for(const key of INTEGRATED_MOMENTUM_IDS){
  const earlier=x=>x.commandsByVariant[key].filter(t=>t.time<T+899*H);
  assert.deepEqual(earlier(baseline),earlier(changed));
 }
});
test('three strategies have identical integrated ATR/fill/costs; original four remain supported',()=>{
 const b=run();
 const paper=runIntegratedVectorRiskStudy({
  bars,...source,commandsByVariant:b.commandsByVariant,
  strategyIds:INTEGRATED_MOMENTUM_IDS
 });
 assert.equal(paper.protocol,'CJ_INTEGRATED_RISK_MOMENTUM_VECTOR_V1');
 assert.deepEqual(paper.strategies,INTEGRATED_MOMENTUM_IDS);
 assert.equal(paper.ordersPlaced,false);
 assert.equal(paper.promotedStrategy,null);
 for(const cost of ['base','stress'])for(const id of INTEGRATED_MOMENTUM_IDS){
  const phases=paper.scenarios[cost][id];
  assert.ok(Number.isFinite(phases.training.finalCapital));
  assert.ok(Number.isFinite(phases.holdout.finalCapital));
  assert.ok(phases.training.trades.every(t=>t.entryTime>=T+168*H));
  assert.ok(phases.holdout.trades.every(t=>t.entryTime>=T+672*H));
 }
 const defaultKeys=Object.fromEntries(INTEGRATED_RECOVERY_LOCK.strategyIds.map(id=>[id,[]]));
 const old=runIntegratedVectorRiskStudy({bars,...source,commandsByVariant:defaultKeys});
 assert.equal(old.protocol,'CJ_INTEGRATED_RISK_VECTOR_DAILY_RECOVERY_V1');
 assert.deepEqual(old.strategies,INTEGRATED_RECOVERY_LOCK.strategyIds);
});
test('reject arbitrary strategy IDs and incomplete input; block gapped feed',()=>{
 const r=run();
 assert.throws(()=>runIntegratedVectorRiskStudy({
  bars,...source,commandsByVariant:r.commandsByVariant,
  strategyIds:['vector_v11','fake_strategy','momentum_fusion_v1']
 }),/invalid fixed integrated strategy variants/);
 assert.throws(()=>runIntegratedVectorRiskStudy({
  bars,...source,commandsByVariant:{vector_v11:[]},
  strategyIds:INTEGRATED_MOMENTUM_IDS
 }),/invalid fixed integrated strategy variants/);
 const broken=structuredClone(bars);
 broken[800].time+=2*H;
 assert.throws(()=>buildMomentumVectorVariants({bars:broken,contract}),
  /discontinuous/);
});
