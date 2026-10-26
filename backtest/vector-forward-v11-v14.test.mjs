import test from 'node:test';
import assert from 'node:assert/strict';
import {studyForwardWindows,runForwardPaper,FORWARD_LOCK}
 from './vector-forward-v11-v14.mjs';
const H=3600000,START=Date.parse(FORWARD_LOCK.earliestSignalTime);
function fixture(n=115,offset=60){
 const begin=START-offset*H;
 return Array.from({length:n},(_,i)=>({
  time:begin+i*H,open:100,high:101,low:99,close:100,volume:100}));
}
const impulse=(bars,index,side)=>{
 const positive=side==='long';
 bars[index]={...bars[index],
  open:100,close:positive?102:98,high:positive?102.4:100.2,
  low:positive?99.8:97.6,volume:150000};
};
test('Research contract locks future start, same fixed exits and no live orders',()=>{
 assert.equal(FORWARD_LOCK.protocol,'cj-vector-v11-v14-forward-paper-btc-eth-sol-1h-v1');
 assert.equal(FORWARD_LOCK.earliestSignalTime,'2026-10-28T00:00:00Z');
 assert.equal(FORWARD_LOCK.risk,'fixed_1_5_3_12');
 assert.equal(FORWARD_LOCK.feePerSide,.0006);
 assert.equal(FORWARD_LOCK.slippagePerSide,.0005);
 assert.deepEqual(FORWARD_LOCK.evaluationModes,['V1.1','V1.4']);
 assert.equal(FORWARD_LOCK.status,'RESEARCH_SHADOW_ONLY');
});
test('A pre-start scan NEVER adds a realized historical trade',()=>{
 const r=studyForwardWindows([{candles:fixture()}],{
  asOfMs:START-1*H});
 assert.equal(r.status,'ARMED_NOT_STARTED');
 assert.equal(r.trades.length,0);
 assert.equal(r.byMode['V1.1'].closed,0);
 assert.equal(r.byMode['V1.4'].closed,0);
});
test('Pre-start signals are WARMUP ONLY; post-start impulse executes NEXT open',()=>{
 const candles=fixture(115);
 impulse(candles,22,'short'); // before lock (index 60)
 impulse(candles,70,'long');
 const result=studyForwardWindows([{candles}],{asOfMs:candles.at(-1).time+H});
 assert.ok(result.quality.signalsBeforeStartExcluded>0);
 const t=result.trades.filter(x=>x.signalTime===candles[70].time);
 assert.ok(t.length>=1,'Post-start impulse expected at least V1.1 trade');
 assert.ok(t.every(x=>x.entryTime===candles[71].time));
 assert.ok(t.every(x=>x.entryTime>=START));
 assert.ok(result.trades.every(x=>x.signalTime>=START));
});
test('Partial stop/take trade is pending, then CLOSED only when future bars are confirmed',()=>{
 const bars=fixture(115);impulse(bars,22,'short');impulse(bars,70,'long');
 const partial=studyForwardWindows([{candles:bars.slice(0,74)}],{
  asOfMs:bars[74].time});
 const r=partial.trades.find(x=>x.signalTime===bars[70].time&&x.mode==='V1.1');
 assert.ok(r);
 assert.equal(r.status,'open_pending');
 assert.equal(r.netPct,null);
 const full=studyForwardWindows([{candles:bars}],{asOfMs:bars.at(-1).time+H});
 const t=full.trades.find(x=>x.signalTime===bars[70].time&&x.mode==='V1.1');
 assert.equal(t.status,'closed');
 assert.equal(t.reason,'timeout');
 assert.ok(t.netPct<0);
 assert.ok(full.byMode['V1.1'].closed>=1);
});
test('Same-bar stop and take obey STOP FIRST with trading cost on both sides',()=>{
 const bars=fixture(115);impulse(bars,22,'short');impulse(bars,70,'long');
 // Following bar low pierces stop and high pierces take; must assume adverse stop.
 bars[71]={...bars[71],open:100,high:110,low:90,close:100};
 const r=studyForwardWindows([{candles:bars}],{asOfMs:bars.at(-1).time+H});
 const trade=r.trades.find(x=>x.signalTime===bars[70].time&&x.mode==='V1.1');
 assert.equal(trade.status,'closed');
 assert.equal(trade.reason,'stop');
 assert.ok(trade.netPct<-1.5,'Net P&L includes costs');
});
test('A last-bar signal has no fabricated next-open entry',()=>{
 const bars=fixture(85);impulse(bars,22,'short');impulse(bars,84,'long');
 const r=studyForwardWindows([{candles:bars}],{asOfMs:bars.at(-1).time+H});
 assert.ok(r.trades.some(t=>t.signalTime===bars[84].time&&t.status==='open_pending'));
});
test('Incomplete time range after data gap never fills future through absent candles',()=>{
 const bars=fixture(115);impulse(bars,22,'short');impulse(bars,70,'long');
 const split=[{candles:bars.slice(0,74)},{candles:bars.slice(75)}];
 const r=studyForwardWindows(split,{asOfMs:bars.at(-1).time+H});
 assert.ok(r.trades.some(x=>x.signalTime===bars[70].time&&x.status==='censored_gap'));
 assert.ok(r.trades.every(x=>x.status!=='closed'||Number.isFinite(x.netPct)));
});
test('Future changes do not alter past signal, entry, or closed outcome',()=>{
 const bars=fixture(130);impulse(bars,22,'short');impulse(bars,70,'long');
 const original=studyForwardWindows([{candles:bars}],{asOfMs:bars[100].time+H});
 const later=bars.map((x,i)=>i<101?{...x}:{...x,open:101,high:109,low:95,close:105,volume:150000});
 const changed=studyForwardWindows([{candles:later}],{asOfMs:bars[100].time+H});
 assert.deepEqual(original,changed);
});
test('A full injected future sample keeps the official start barrier for all markets',async()=>{
 const nowMs=START+18*H,trace=[];
 const fetchPage=async({symbol,interval,startTime,endTime})=>{
  trace.push({symbol,interval});
  return Array.from({length:(endTime-startTime)/H},(_,i)=>({
   time:startTime+i*H,open:100,high:101,low:99,close:100,volume:100}));
 };
 const r=await runForwardPaper({nowMs,fetchPage});
 assert.equal(r.status,'PROSPECTIVE_COLLECTING');
 assert.equal(r.results.length,3);
 assert.ok(r.results.every(x=>x.audit.trades.length===0));
 assert.ok(trace.every(x=>x.interval==='1h'));
 assert.ok(r.results.every(x=>x.feed.quality==='READY'));
});
test('Before the scheduled start a feed preflight is NOT invented prospective evidence',async()=>{
 const nowMs=START-30*H;
 const fetchPage=async({startTime,endTime})=>
  Array.from({length:(endTime-startTime)/H},(_,i)=>({
   time:startTime+i*H,open:100,high:101,low:99,close:100,volume:100}));
 const r=await runForwardPaper({nowMs,fetchPage});
 assert.equal(r.status,'ARMED_NOT_STARTED');
 assert.ok(r.results.every(x=>x.audit.byMode['V1.1'].closed===0));
});
