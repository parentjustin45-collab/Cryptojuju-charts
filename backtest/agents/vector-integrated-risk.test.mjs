import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEmaConfirmedDailyRecovery,runIntegratedVectorRiskStudy,
 INTEGRATED_RECOVERY_LOCK} from './vector-integrated-risk.mjs';

const H=3600000,T=Date.UTC(2026,10,1);
const bars=Array.from({length:960},(_,i)=>({
 time:T+i*H,open:100,high:100.1,low:99.9,close:100,volume:1000+i
}));
const market={exchange:'Bitunix',priceType:'LAST_PRICE',
 symbol:'BTCUSDT',timeframe:'1h'};
const historyWindow={startTime:T,endTime:T+960*H,intervalMs:H};
const v=(i,side)=>({time:T+i*H,side});
const variants=(signals=[])=>Object.fromEntries(
 INTEGRATED_RECOVERY_LOCK.strategyIds.map(id=>[id,signals]));
const run=(extra={})=>runIntegratedVectorRiskStudy({
 bars,market,historyWindow,commandsByVariant:variants(),...extra
});
const obs=(i,side='long',reason='daily_opposed')=>({
 confirmedBarOpenMs:T+i*H,signalConfirmedAtMs:T+(i+1)*H,
 entryAllowedAtMs:T+(i+1)*H,vectorSide:side,reason,
 dailyClosedAtMs:T-86400000,neutralPolicy:'block',
 accepted:reason==='aligned'
});
const features=bars.map((b,i)=>({
 time:b.time,regime:i===100?'bull_stack':'mixed'
}));
test('no signals produces the same unchanged capital across 4 strategies and 2 frictions',()=>{
 const a=run();
 assert.equal(a.status,'SIMULATED_ONE_POSITION_PORTFOLIO_ONLY');
 assert.equal(a.ordersPlaced,false);
 assert.equal(a.promotedStrategy,null);
 for(const name of ['base','stress'])for(const id of INTEGRATED_RECOVERY_LOCK.strategyIds)
   for(const phase of ['training','holdout']){
     assert.equal(a.scenarios[name][id][phase].tradeCount,0);
     assert.equal(a.scenarios[name][id][phase].finalCapital,1000);
   }
});
test('one real portfolio position at a time, reversal closes then flips, FLAT closes',()=>{
 const cmd=[v(70,'long'),v(72,'short'),v(74,'flat')];
 const a=run({commandsByVariant:variants(cmd)});
 const t=a.scenarios.base.v11_original.training.trades;
 assert.equal(t.length,2);
 assert.equal(t[0].side,'long');
 assert.equal(t[1].side,'short');
 assert.equal(t[0].exitReason,'vector_signal');
 assert.equal(t[1].exitReason,'vector_signal');
 assert.equal(t[0].entryTime,T+71*H);
 assert.equal(t[0].exitTime,T+73*H);
 assert.equal(t[1].entryTime,T+73*H);
 assert.equal(t[1].exitTime,T+75*H);
 assert.ok(t.every(x=>x.entryFee>0&&x.exitFee>0));
 assert.equal(a.scenarios.base.v11_original.training.stats.reversals,1);
 assert.equal(a.scenarios.base.v11_original.training.stats.flatExits,1);
 assert.equal(a.scenarios.base.v11_original.training.stats.entryCount,2);
});
test('stops trump targets when both reached in a single CLOSED OHLC candle',()=>{
 const altered=structuredClone(bars);
 altered[71]={...altered[71],high:104,low:96};
 const z=run({bars:altered,commandsByVariant:variants([v(70,'long')])});
 const trade=z.scenarios.base.v11_original.training.trades[0];
 assert.equal(trade.exitReason,'stop');
 assert.equal(trade.stopTargetCollision,true);
 assert.ok(trade.netPnl<0);
 assert.equal(z.scenarios.base.v11_original.training.stats.stopTargetCollision,1);
});
test('gap through stop fills worse at the next candle OPEN; stress fees worsen results',()=>{
 const altered=structuredClone(bars);
 // Ensure neither friction scenario hits its stop on the entry bar (71).
 // Only then can bar 72 isolate and test the deliberately adverse gap.
 altered[71]={...altered[71],low:99.95};
 altered[72]={...altered[72],open:90,high:90.1,low:89.9,close:90};
 const x=run({bars:altered,commandsByVariant:variants([v(70,'long')])});
 const base=x.scenarios.base.v11_original.training.trades[0];
 const stress=x.scenarios.stress.v11_original.training.trades[0];
 assert.equal(base.exitReason,'stop');
 assert.ok(base.exitPrice<base.initialStop);
 assert.ok(base.netPnl<0);
 assert.ok(stress.exitPrice<base.exitPrice);
 assert.ok(stress.entryPrice>base.entryPrice);
});
test('phase boundary starts FLAT with fresh capital and never executes training-end signal',()=>{
 const z=run({commandsByVariant:variants([v(671,'long'),v(700,'long')])});
 const base=z.scenarios.base.v11_original;
 assert.equal(base.training.tradeCount,0);
 assert.equal(base.holdout.tradeCount,1);
 assert.equal(base.holdout.trades[0].side,'long');
 assert.equal(base.holdout.trades[0].entryTime,T+701*H);
});
test('causal 1H EMA confirms only some Daily-opposed signals; restores FLAT without duplicate command',()=>{
 const strict=[v(100,'flat'),v(120,'short')];
 const observations=[obs(100),obs(115,'short','daily_opposed'),obs(120,'short','aligned')];
 const x=buildEmaConfirmedDailyRecovery({
  strictSignals:strict,observations,features,bars,intervalMs:H
 });
 assert.equal(x.stats.recoveryCandidates,2);
 assert.equal(x.stats.recovered,1);
 assert.equal(x.stats.rejectedByClosedEma,1);
 assert.equal(x.stats.futureDailyUsed,false);
 assert.deepEqual(x.signals,[v(100,'long'),v(120,'short')]);
 assert.deepEqual(strict,[v(100,'flat'),v(120,'short')]);
 const k=run({commandsByVariant:{
  ...variants([]),
  v11_daily_strict:strict,
  v13_ema_confirmed_recovery:x.signals
 }});
 assert.ok(k.scenarios.base.v13_ema_confirmed_recovery.training.tradeCount>=1);
 assert.equal(k.scenarios.base.v11_daily_strict.training.tradeCount,1);
});
test('future Daily, fabricated acceptance and unsorted observations are blocked',()=>{
 const args={strictSignals:[],observations:[obs(100)],features,bars,intervalMs:H};
 assert.throws(()=>buildEmaConfirmedDailyRecovery({
  ...args,observations:[{...obs(100),dailyClosedAtMs:T+101*H}]
 }),/unverified or future/);
 assert.throws(()=>buildEmaConfirmedDailyRecovery({
  ...args,observations:[obs(120),obs(100)]
 }),/unverified or future/);
 assert.throws(()=>buildEmaConfirmedDailyRecovery({
  ...args,observations:[{...obs(100),accepted:true}]
 }),/unverified or future/);
 assert.throws(()=>run({commandsByVariant:variants([v(101,'long'),v(100,'short')])}),
 /Non-causal/);
 assert.throws(()=>run({commandsByVariant:variants([v(959,'long')])}),
 /Non-causal/);
});
test('different post-entry candles cannot change earlier completed trade',()=>{
 const base=run({commandsByVariant:variants([v(70,'long'),v(72,'flat')])});
 const changed=structuredClone(bars);changed[810].high=101;
 const replay=run({bars:changed,commandsByVariant:variants([v(70,'long'),v(72,'flat')])});
 assert.deepEqual(base.scenarios.base.v11_original.training.trades,
  replay.scenarios.base.v11_original.training.trades);
 assert.equal(base.usesFutureForDecisions,false);
});
