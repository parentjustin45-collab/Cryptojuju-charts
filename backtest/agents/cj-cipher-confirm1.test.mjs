import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {calculateCjCipherWaveTrend} from './cj-cipher-wavetrend-v1.mjs';
import {buildCipherConfirmOne,runCipherConfirmOneStudy,
 auditCipherOpportunityCost,evaluateCipherConfirmationForward,
 CIPHER_CONFIRM1_LOCK} from './cj-cipher-confirm1.mjs';
import {runIntegratedVectorRiskStudy,INTEGRATED_RECOVERY_LOCK}
 from './vector-integrated-risk.mjs';
const H=3600000,T=Date.UTC(2026,10,1);
const rows=(n=20)=>Array.from({length:n},(_,i)=>({
 time:T+i*H,signal:null,wt1:1,wt2:0}));
const bars=Array.from({length:960},(_,i)=>{
 const p=100+0.01*i+3*Math.sin(i*.2);
 return {time:T+i*H,open:p,high:p+.4,low:p-.4,close:p,volume:1000};
});
const market={exchange:'Bitunix',priceType:'LAST_PRICE',symbol:'BTCUSDT',timeframe:'1h'};
const historyWindow={startTime:T,endTime:T+960*H,intervalMs:H};
test('entry waits for one extra closed candle; flat exit keeps original cross timing',()=>{
 const x=rows();x[5].signal='long';
 const z=buildCipherConfirmOne(x);
 assert.deepEqual(z.commandsByVariant.cj_cipher_v10_atr,[{time:T+5*H,side:'long'}]);
 assert.deepEqual(z.commandsByVariant.cj_cipher_v11_confirm1_atr,[
  {time:T+5*H,side:'flat'},{time:T+6*H,side:'long'}]);
 assert.equal(z.events[0].entryTime,T+7*H);
 assert.equal(z.events[0].disposition,'accepted');
});
test('opposite cross cancels pending entry and creates its own delayed candidate',()=>{
 const x=rows();x[5].signal='long';
 x[6]={...x[6],signal:'short',wt1:-1};x[7].wt1=-2;
 const z=buildCipherConfirmOne(x);
 assert.equal(z.events[0].disposition,'rejected_opposite_cross');
 assert.equal(z.events[1].disposition,'accepted');
 assert.deepEqual(z.commandsByVariant.cj_cipher_v11_confirm1_atr,[
  {time:T+5*H,side:'flat'},{time:T+6*H,side:'flat'},
  {time:T+7*H,side:'short'}]);
});
test('equality cancels without later retry or a fabricated entry',()=>{
 const x=rows();x[5].signal='long';x[6].wt1=0;
 const z=buildCipherConfirmOne(x);
 assert.equal(z.events[0].disposition,'rejected_nonpersistent');
 assert.equal(z.commandsByVariant.cj_cipher_v11_confirm1_atr.length,1);
});
test('a repeated same-side cross after equality does not close an authorized same-side position',()=>{
 const x=rows();x[5].signal='long';x[8].wt1=0;x[9].signal='long';
 const z=buildCipherConfirmOne(x).commandsByVariant.cj_cipher_v11_confirm1_atr;
 assert.ok(!z.some(c=>c.time===T+9*H&&c.side==='flat'));
 assert.ok(z.some(c=>c.time===T+10*H&&c.side==='long'));
});
test('phase boundary discards late confirmation and never imports training pending into holdout',()=>{
 const x=rows(960);x[670].signal='long';x[671].signal='long';x[958].signal='long';
 const z=buildCipherConfirmOne(x);
 assert.ok(z.events.every(e=>e.disposition==='phase_boundary'));
 assert.ok(!z.commandsByVariant.cj_cipher_v11_confirm1_atr.some(c=>c.side==='long'));
 assert.ok(!z.commandsByVariant.cj_cipher_v11_confirm1_atr.some(c=>c.time===T+672*H));
});
test('changing future OHLC cannot change past confirmation commands',()=>{
 const a=buildCipherConfirmOne(calculateCjCipherWaveTrend(bars));
 const future=bars.map((b,i)=>i<500?{...b}:{...b,open:150,high:160,low:140,close:151});
 const b=buildCipherConfirmOne(calculateCjCipherWaveTrend(future));
 const before=x=>x.commandsByVariant.cj_cipher_v11_confirm1_atr.filter(c=>c.time<T+500*H);
 assert.deepEqual(before(a),before(b));
 assert.ok(a.events.filter(e=>e.disposition==='accepted').every(e=>e.entryTime===e.originTime+2*H));
});
test('both Cipher arms use exactly the existing Vector ATR execution kernel',()=>{
 const x=runCipherConfirmOneStudy({bars,market,historyWindow});
 for(const id of CIPHER_CONFIRM1_LOCK.strategyIds){
  const commands=x.commandsByVariant[id];
  const reference=runIntegratedVectorRiskStudy({bars,market,historyWindow,
   policy:CIPHER_CONFIRM1_LOCK.risk,commandsByVariant:Object.fromEntries(
    INTEGRATED_RECOVERY_LOCK.strategyIds.map(k=>[k,commands]))});
  for(const cost of ['base','stress'])
   assert.deepEqual(x.portfolio.scenarios[cost][id],reference.scenarios[cost].v11_original);
 }
 assert.equal(x.productionIndicatorChanged,false);
 assert.equal(x.promotedStrategy,null);
 assert.ok(x.portfolio.scenarios.base.cj_cipher_v11_confirm1_atr.holdout.trades.length>0);
});
test('opportunity labels count rejected winners AND rejected losers separately',()=>{
 const origin=T+20*H;
 const trade=(time,pnl)=>({entryTime:time+H,netPnl:pnl,side:'long'});
 const events=[{originTime:origin,side:'long',phase:'training',disposition:'rejected_opposite_cross',entryTime:null},
  {originTime:origin+3*H,side:'long',phase:'training',disposition:'rejected_nonpersistent',entryTime:null},
  {originTime:origin+6*H,side:'long',phase:'training',disposition:'accepted',entryTime:origin+8*H}];
 const z=auditCipherOpportunityCost({baseline:{trades:[trade(origin,10),trade(origin+3*H,-5),trade(origin+6*H,8)]},
  variant:{trades:[{entryTime:origin+8*H,netPnl:-2,side:'long'}]},events,bars,phase:'training'});
 assert.equal(z.baselineWinners,2);
 assert.equal(z.rejectedWinningBaselineTrades,1);
 assert.equal(z.rejectedLosingBaselineTrades,1);
 assert.equal(z.delayedBaselineWinnersNowNonpositive,1);
 assert.equal(z.baselineWinnersRetainedFraction,0);
});
test('unordered, gapped or inconsistent directional snapshots block',()=>{
 const a=rows();a[8].time+=H;
 assert.throws(()=>buildCipherConfirmOne(a),/chronology/);
 const b=rows();b[5].signal='short';
 assert.throws(()=>buildCipherConfirmOne(b),/direction/);
 assert.equal(CIPHER_CONFIRM1_LOCK.confirmationBars,1);
 assert.equal(Object.isFrozen(CIPHER_CONFIRM1_LOCK.risk.costCases.base),true);
});
test('future collection refuses early evaluation before touching network or output',()=>{
 if(Date.now()>=Date.parse(CIPHER_CONFIRM1_LOCK.prospective.endExclusiveUtc)+120000)return;
 const result=spawnSync(process.execPath,[
  'backtest/agents/run-cj-cipher-confirm1.mjs','--prospective','/tmp/cipher-forward-must-not-exist'
 ],{encoding:'utf8'});
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/PROSPECTIVE_WINDOW_NOT_COMPLETE/);
});
test('registered future criteria cannot promote missing, undersized or losing comparisons',()=>{
 const comparison=()=>({baseline:{tradeCount:25,returnPct:1,closeMarkedMaxDrawdownPct:5,rapidOppositeExit6:10},
  variant:{tradeCount:24,returnPct:2,closeMarkedMaxDrawdownPct:4,rapidOppositeExit6:5},
  opportunity:{baselineWinners:10,baselineWinnersRetained:8}});
 const cases=CIPHER_CONFIRM1_LOCK.symbols.map(symbol=>({symbol,comparisons:{
  base:{holdout:comparison()},stress:{holdout:comparison()}}}));
 assert.equal(evaluateCipherConfirmationForward([]).status,'BLOCKED_MISSING_MARKETS');
 assert.equal(evaluateCipherConfirmationForward(cases).status,'ELIGIBLE_FOR_BROADER_RESEARCH_ONLY');
 cases[0].comparisons.stress.holdout.variant.returnPct=-1;
 assert.equal(evaluateCipherConfirmationForward(cases).status,'LOCKED_CRITERIA_NOT_MET');
 cases[0].comparisons.stress.holdout.variant.tradeCount=19;
 assert.equal(evaluateCipherConfirmationForward(cases).status,'INSUFFICIENT_TRADES');
 assert.equal(evaluateCipherConfirmationForward(cases).eligibleForBroaderResearch,false);
});
