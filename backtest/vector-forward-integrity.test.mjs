import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {checkReport,asMarkdown,REPORT_LOCK} from './vector-forward-integrity.mjs';
const START=Date.parse(REPORT_LOCK.firstSignal),H=3600000;
const make=()=>({protocol:REPORT_LOCK.protocol,status:'PROSPECTIVE_COLLECTING',
 generatedAtUtc:new Date(START+20*H).toISOString(),commit:REPORT_LOCK.code,
 source:'Bitunix public 1h futures LAST_PRICE via readonly CryptoJuju proxy',
 lock:{protocol:REPORT_LOCK.protocol,earliestSignalTime:REPORT_LOCK.firstSignal,
  risk:REPORT_LOCK.risk,feePerSide:REPORT_LOCK.fee,slippagePerSide:REPORT_LOCK.slippage,
  interval:'1h',minimumClosedTradesPerMode:30,status:'RESEARCH_SHADOW_ONLY',
  instrument:REPORT_LOCK.markets,evaluationModes:REPORT_LOCK.modes},
 results:REPORT_LOCK.markets.map(symbol=>({symbol,status:'INSUFFICIENT_NEW_CLOSED_TRADES',
 feed:{quality:'READY',expected:180,received:180,excluded:0,windows:1},
 audit:{trades:[],byMode:Object.fromEntries(REPORT_LOCK.modes.map(m=>[m,{signalCount:0,entries:0,
 closed:0,pending:0,censoredGap:0,notFillable:0,winning:0,stop:0,take:0,
 timeout:0,sumNetPct:0,netPctSum:0,meanNetPct:null,winRatePct:null,sufficientSample:false}]))}}))});
const addClosed=d=>{
 const r=d.results[0],b=r.audit.byMode['V1.1'],net=0.8794;
 r.audit.trades.push({symbol:r.symbol,mode:'V1.1',side:'long',signalTime:START+H,
 entryTime:START+2*H,entryPrice:100,originTime:START+H,status:'closed',
 reason:'timeout',exitTime:START+4*H,grossPct:1,netPct:net});
 Object.assign(b,{signalCount:1,entries:1,closed:1,winning:1,stop:0,take:0,
 timeout:1,sumNetPct:net,netPctSum:net,meanNetPct:net,winRatePct:100});
 return d;
};
test('optional real Bitunix preflight has no premature trades',()=>{
 const p=process.env.CJ_FORWARD_PREFLIGHT_JSON;
 if(!p)return;
 const r=checkReport(JSON.parse(fs.readFileSync(p,'utf8')),{now:Date.parse('2026-10-26T20:00:00Z')});
 assert.equal(r.status,'PASS_WITH_WARNINGS');
 assert.equal(r.rows.length,6);
 assert.ok(r.rows.every(x=>x.filledEntries===0&&x.closed===0&&x.meanNetPct===null));
 assert.match(asMarkdown(r),/Entrées simulées/);
});
test('source, experiment start and locked costs cannot silently change',()=>{
 const d=make();d.lock.earliestSignalTime='2026-10-27T00:00:00Z';
 assert.equal(checkReport(d,{now:START+20*H}).status,'BLOCKED');
});
test('closed paper trade reconciles exact direction-signed gross vs fee-charged net',()=>{
 const r=checkReport(addClosed(make()),{now:START+20*H});
 assert.equal(r.status,'PASS');
 assert.equal(r.rows[0].closed,1);
 assert.equal(r.rows[0].filledEntries,1);
 assert.equal(r.rows[0].meanNetPct,.879);
});
test('undelivered next-open signal is shown pending but NOT counted as filled entry',()=>{
 const d=addClosed(make()),r=d.results[0],b=r.audit.byMode['V1.1'];
 r.audit.trades.push({symbol:r.symbol,mode:'V1.1',side:'short',
 signalTime:START+19*H,entryTime:START+20*H,entryPrice:null,
 status:'open_pending',reason:null,exitTime:null,netPct:null});
 b.signalCount++;b.entries++;b.pending++;
 const x=checkReport(d,{now:START+20*H});
 assert.equal(x.status,'PASS_WITH_WARNINGS');
 assert.equal(x.rows[0].filledEntries,1);
 assert.equal(x.rows[0].awaitingNextOpen,1);
});
test('backdated signal is blocked, no OHLC pre-start leakage',()=>{
 const d=addClosed(make());d.results[0].audit.trades[0].signalTime=START-H;
 assert.equal(checkReport(d,{now:START+20*H}).status,'BLOCKED');
});
test('pending trade with realized P&L is blocked',()=>{
 const d=addClosed(make());d.results[0].audit.trades[0].status='open_pending';
 assert.equal(checkReport(d,{now:START+20*H}).status,'BLOCKED');
});
test('fee reconciliation detects omitted commissions without trading changes',()=>{
 const d=addClosed(make());d.results[0].audit.trades[0].netPct=1;
 assert.equal(checkReport(d,{now:START+20*H}).status,'BLOCKED');
});
test('before first future candle zero trades and no invented successes',()=>{
 const d=make();d.status='ARMED_NOT_STARTED';d.generatedAtUtc=new Date(START-H).toISOString();
 assert.equal(checkReport(d,{now:START-H}).status,'PASS');
 d.results[0].audit.trades.push({symbol:'BTCUSDT',mode:'V1.1',side:'long',
 signalTime:START-3*H,entryTime:START-2*H,entryPrice:null,netPct:null,status:'open_pending'});
 assert.equal(checkReport(d,{now:START-H}).status,'BLOCKED');
});