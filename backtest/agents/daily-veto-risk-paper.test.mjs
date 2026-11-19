import test from 'node:test';
import assert from 'node:assert/strict';
import {runDailyVetoRiskPaperExperiment,VETO_TRADE_POLICY}
 from './daily-veto-risk-paper.mjs';

const H=3600000,T=Date.UTC(2026,10,16);
const bars=Array.from({length:100},(_,i)=>({
  time:T+i*H,open:100,high:100.2,low:99.8,close:100,volume:100+i
}));
const market={exchange:'Bitunix',priceType:'LAST_PRICE',
 symbol:'BTCUSDT',timeframe:'1h'};
const window={startTime:T,endTime:T+100*H,intervalMs:H};
const signal=(i,side='long',reason='daily_opposed')=>({
  confirmedBarOpenMs:T+i*H,
  signalConfirmedAtMs:T+(i+1)*H,
  entryAllowedAtMs:T+(i+1)*H,
  vectorSide:side,reason,
  neutralPolicy:'block',accepted:reason==='aligned',
  dailyClosedAtMs:T-86400000
});
const base=(overrides={})=>runDailyVetoRiskPaperExperiment({
  bars,market,historyWindow:window,
  observations:[signal(24),signal(30,'short','aligned'),
    signal(81),signal(86,'short','aligned')],
  ...overrides
});
test('standalone paper trades stay separate by cohort, phase and friction; no orders',()=>{
  const r=base();
  assert.equal(r.status,'SIMULATED_RISK_TRADE_COHORTS_ONLY');
  assert.equal(r.splitAtUtc,new Date(T+70*H).toISOString());
  assert.equal(r.ordersPlaced,false);
  assert.equal(r.autoPromotion,false);
  for(const costs of ['base','stress'])
    for(const group of ['daily_opposed','aligned'])
      for(const phase of ['training','holdout']){
        const x=r.scenarios[costs][group][phase];
        assert.ok(x.tradeCount>=1);
        assert.equal(x.pnlIsSimulated,true);
        assert.equal(x.scenarioIsNotIntegratedPortfolio,true);
        assert.ok(Number.isFinite(x.finalCapital));
        assert.ok(x.trades.every(z=>z.entryMs>z.confirmationOpenMs));
        assert.ok(x.trades.every(z=>z.entryFee>=0&&z.exitFee>=0));
      }
});
test('if both stop AND target are touched, adverse stop fills first',()=>{
  const bad=bars.map(b=>({...b}));
  bad[26]={...bad[26],high:102,low:98,close:100};
  const r=base({bars:bad,observations:[signal(25)]});
  const trades=r.scenarios.base.daily_opposed.training.trades;
  assert.equal(trades.length,1);
  assert.equal(trades[0].reason,'stop');
  assert.equal(trades[0].stopAndTargetSameBarStopWins,true);
  assert.ok(trades[0].netPnl<0);
  assert.equal(r.scenarios.base.aligned.training.tradeCount,0);
  assert.equal(r.scenarios.base.aligned.training.winRatePct,null);
});
test('bad opening price gap after entry fills worse than planned stop',()=>{
  const b=bars.map(x=>({...x}));
  b[27]={...b[27],open:94,low:93.9,high:94.2,close:94};
  const r=base({bars:b,observations:[signal(25)]});
  const t=r.scenarios.base.daily_opposed.training.trades[0];
  assert.equal(t.reason,'stop');
  assert.ok(t.exitFillPrice<94);
  assert.ok(t.exitFillPrice<t.stop);
});
test('overlapping subsequent confirmed signals are skipped, not stacked',()=>{
  const r=base({observations:[signal(25),signal(26),signal(27)]});
  const x=r.scenarios.base.daily_opposed.training;
  assert.equal(x.candidateSignals,3);
  assert.equal(x.tradeCount,1);
  assert.equal(x.skippedOverlap,2);
});
test('a training-end signal cannot open a holdout position',()=>{
 const r=base({observations:[signal(69),signal(70)]});
 const train=r.scenarios.base.daily_opposed.training;
 const hold=r.scenarios.base.daily_opposed.holdout;
 assert.equal(train.excludedPhaseBoundary,1);
 assert.equal(hold.candidateSignals,1);
 assert.equal(hold.tradeCount,1);
 assert.ok(hold.trades[0].entryMs>=T+70*H);
});
test('future changing bar prices after a completed trade does not change its prior causal result',()=>{
 const original=base({observations:[signal(25)]});
 const changed=bars.map(x=>({...x}));
 changed[93].high*=1.5;
 const later=base({bars:changed,observations:[signal(25)]});
 assert.deepEqual(
 original.scenarios.base.daily_opposed.training.trades,
 later.scenarios.base.daily_opposed.training.trades
 );
});
test('hard blocks malformed source data, future Daily lookahead, duplicate signals and invalid costs',()=>{
 assert.throws(()=>base({bars:bars.slice(1)}),/blocked/i);
 const invalid=bars.map(x=>({...x}));
 invalid[55].low=invalid[55].high+1;
 assert.throws(()=>base({bars:invalid}),/blocked/i);
 assert.throws(()=>base({observations:[signal(25),signal(25)]}),/duplicate/i);
 const obs={...signal(25),dailyClosedAtMs:T+26*H};
 assert.throws(()=>base({observations:[obs]}),/Lookahead/i);
 assert.throws(()=>base({policy:{...VETO_TRADE_POLICY,riskFraction:0.3}}),/Unsafe/);
 assert.throws(()=>base({policy:{...VETO_TRADE_POLICY,costCases:{
  base:{feeRate:0.0006,slippageRate:-0.2},
  stress:{feeRate:.001,slippageRate:.002}
 }}}),/Invalid fixed/);
});

test('out-of-order confirmed Vector signals are rejected before risk/PnL calculations',()=>{
 const reversed=[signal(81),signal(24)];
 assert.throws(()=>base({observations:reversed}),/strictly chronological/);
 const ordered=[signal(24),signal(81)];
 const r=base({observations:ordered});
 assert.equal(r.scenarios.base.daily_opposed.training.tradeCount,1);
 assert.equal(r.scenarios.base.daily_opposed.holdout.tradeCount,1);
});
test('impossible Daily reasons cannot manufacture completed-day entries',()=>{
 assert.throws(()=>base({observations:[
  {...signal(25),dailyClosedAtMs:null}
 ]}),/reason contradicts/);
 assert.throws(()=>base({observations:[
  {...signal(25),reason:'daily_not_yet_available',dailyClosedAtMs:T-86400000}
 ]}),/reason contradicts/);
 assert.throws(()=>base({observations:[
  {...signal(25,'long','mixed_allowed'),neutralPolicy:'block'}
 ]}),/reason contradicts/);
 const unknown={...signal(25),reason:'daily_not_yet_available',dailyClosedAtMs:null};
 const r=base({observations:[unknown]});
 assert.equal(r.scenarios.base.daily_opposed.training.tradeCount,0);
 assert.equal(r.scenarios.base.aligned.training.tradeCount,0);
});
