import test from 'node:test';
import assert from 'node:assert/strict';
import {createControlCenterSnapshot,renderControlCenterHtml} from './control-center.mjs';

const ids=['bitunix-data','backtests','diagnostics','corrections','validation','coordination','market-context'];
const fakeReport={
  status:'RESEARCH_READY',
  agents:ids.map(id=>({id,status:id==='corrections'?'PROPOSALS_ONLY':'PASS',
    details:id==='diagnostics'?{findings:[{code:'LOW_HOLDOUT_SAMPLE'}]}:{}}))
};
test('control center always identifies synthetic provenance and rejects fake real designation',()=>{
 const snap=createControlCenterSnapshot(fakeReport,{gitSha:'abcdef0123456789',createdAt:'2026-11-19T13:00:00Z'});
 assert.equal(snap.sourceKind,'SYNTHETIC_CI_ONLY_NOT_BITUNIX');
 assert.equal(snap.autonomousAgentsActive,false);
 assert.equal(snap.continuousRuntime,false);
 assert.equal(snap.realMarketEvidence,false);
 assert.equal(snap.roles.length,7);
 assert.equal(snap.diagnosticCount,1);
 assert.match(renderControlCenterHtml(snap),/MODE DÉMONSTRATION/);
 assert.throws(()=>createControlCenterSnapshot(fakeReport,{sourceKind:'REAL_BITUNIX'}),/not permitted/);
});
test('blocked roles render visibly as failed, not successful',()=>{
 const snap=createControlCenterSnapshot({...fakeReport,status:'BLOCKED',
  agents:fakeReport.agents.map(a=>a.id==='backtests'?{...a,status:'BLOCKED'}:a)});
 assert.equal(snap.blockingRoleCount,1);
 assert.match(renderControlCenterHtml(snap),/state bad/);
});
test('untrusted status strings cannot inject HTML or scripts into an archived report',()=>{
 const inject='</strong><script>window.hacked=1</script>';
 const snap=createControlCenterSnapshot({...fakeReport,
  agents:fakeReport.agents.map(a=>a.id==='backtests'?{...a,status:inject}:a)});
 const html=renderControlCenterHtml(snap);
 assert.ok(!html.includes('<script>'));
 assert.match(html,/&lt;script&gt;/);
});
test('missing, misordered or unknown role contracts are refused',()=>{
 assert.throws(()=>createControlCenterSnapshot({...fakeReport,agents:fakeReport.agents.slice(0,5)}),/Seven ordered/);
 assert.throws(()=>createControlCenterSnapshot({...fakeReport,agents:[...fakeReport.agents].reverse()}),/Unexpected role/);
 assert.throws(()=>renderControlCenterHtml({schema:'fake',sourceKind:'UNVERIFIED_INPUT',roles:fakeReport.agents}),/schema/);
});
