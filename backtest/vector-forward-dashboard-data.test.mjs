import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeForwardReport,fmtPercent,START_UTC,PROTOCOL} from './vector-forward-dashboard-data.mjs';
const skeleton=()=>({
 protocol:PROTOCOL,status:'ARMED_NOT_STARTED',generatedAtUtc:'2026-10-26T14:00:00Z',
 lock:{earliestSignalTime:START_UTC,instrument:['BTCUSDT','ETHUSDT','SOLUSDT'],evaluationModes:['V1.1','V1.4']},
 source:'Bitunix public 1h futures LAST_PRICE',commit:'744da2b',runId:'123',
 results:['BTCUSDT','ETHUSDT','SOLUSDT'].map(symbol=>({
  symbol,status:'ARMED_NOT_STARTED',
  audit:{byMode:{'V1.1':{signalCount:0,closed:0,winning:0,meanNetPct:null,medianNetPct:null},
   'V1.4':{signalCount:0,closed:0,winning:0,meanNetPct:null,medianNetPct:null}},
   trades:[]},feed:{received:0,excluded:0,quality:'PRE_START'}}))
});
test('Dashboard starts at ZERO; no fabricated gains or fake winning trades',()=>{
 const data=analyzeForwardReport(skeleton());
 assert.equal(data.rows.length,6);
 assert.equal(data.trades.length,0);
 assert.equal(data.totals.closed,0);
 assert.equal(data.totals.sufficient,0);
 assert.ok(data.rows.every(r=>r.winRate===null && r.netMean===null));
 assert.equal(fmtPercent(null),'—');
});
test('Modes are separate and 30 closed trades are required per market/model',()=>{
 const r=skeleton();r.status='PROSPECTIVE_COLLECTING';
 const bt=r.results[0];bt.audit.byMode['V1.1']={
  closed:30,winning:12,pending:1,censoredGap:2,notFillable:0,signalCount:33,
  meanNetPct:-0.3,medianNetPct:-1.2,netPctSum:-9,
  stop:19,take:10,timeout:1};
 bt.audit.byMode['V1.4']={
  closed:8,winning:6,pending:1,censoredGap:0,signalCount:9,
  meanNetPct:0.7,medianNetPct:0.5,netPctSum:5.6};
 const data=analyzeForwardReport(r);
 assert.equal(data.totals.closed,38);
 assert.equal(data.totals.sufficient,1);
 assert.equal(data.rows[0].winRate,40);
 assert.equal(data.rows[0].progress,100);
 assert.equal(data.rows[1].progress,8/30*100);
 assert.equal(data.rows[1].sufficient,false);
});
test('Reject pre-start signals and fabricated open-position returns',()=>{
 const r=skeleton();r.status='PROSPECTIVE_COLLECTING';
 r.results[1].audit.trades.push({symbol:'ETHUSDT',mode:'V1.4',
  status:'open_pending',signalTime:Date.parse(START_UTC),netPct:2});
 assert.throws(()=>analyzeForwardReport(r),/incomplète/);
 r.results[1].audit.trades[0].netPct=null;
 r.results[1].audit.trades[0].signalTime=Date.parse(START_UTC)-3600000;
 assert.throws(()=>analyzeForwardReport(r),/antérieur/);
});
test('Reject protocol, changed date, extra duplicated markets and inappropriate status',()=>{
 const a=skeleton();a.protocol='other';
 assert.throws(()=>analyzeForwardReport(a),/Protocole/);
 const b=skeleton();b.lock.earliestSignalTime='2026-10-20T00:00:00Z';
 assert.throws(()=>analyzeForwardReport(b),/départ/);
 const c=skeleton();c.results[2].symbol='BTCUSDT';
 assert.throws(()=>analyzeForwardReport(c),/répété/);
 const d=skeleton();d.results.pop();
 assert.throws(()=>analyzeForwardReport(d),/trois marchés/);
});
test('No phantom performance in ARMED_NOT_STARTED payload',()=>{
 const r=skeleton();r.results[0].audit.byMode['V1.1'].closed=1;
 assert.throws(()=>analyzeForwardReport(r),/avant le démarrage/);
});
