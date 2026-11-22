/*
 * Real ephemeral PostgreSQL integration smoke.
 * All research executions mocked; no Bitunix calls, no trading, no external DB.
 */
import assert from 'node:assert/strict';
import {initializeDb,runDueCycle} from './supervisor.mjs';
import {rememberFinding,recallFindings} from './knowledge.mjs';
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL required for PostgreSQL smoke');
const db=await initializeDb();
const slot=new Date('2026-11-22T15:58:00Z');
try {
  const executor=async agent=>({
    status:agent.id==='bitunix-data'?'DATA_READY_FOR_RESEARCH_ONLY':'EXECUTED_RESEARCH_ONLY',
    evidence:{testFixture:true,automaticPromotion:false}
  });
  const first=await runDueCycle(db,slot,{executor});
  assert.equal(first.completed.length,6);
  assert.deepEqual(first.completed.map(x=>x.agent),
    ['bitunix-data','vector','momentum','speed','cipher','diagnostics']);
  const repeat=await runDueCycle(db,slot,{executor});
  assert.equal(repeat.completed.length,0);
  const rows=await db.query('SELECT agent,status,evidence FROM cj_agent_runs WHERE slot=$1',[first.slot]);
  assert.equal(rows.rowCount,6);
  assert.equal(rows.rows.find(x=>x.agent==='bitunix-data').status,'DATA_READY_FOR_RESEARCH_ONLY');
  assert.equal(rows.rows.find(x=>x.agent==='diagnostics').evidence.automaticCodeChanges,false);
  const finding={
    agent:'vector',title:'Late signal reversal hypothesis',
    hypothesis:'A delayed signal may coincide with the strict confirmation gate.',
    counterEvidence:'No prospective holdout has established this possibility.',
    nextTest:'Verify exact bar confirmation and time-ordered out-of-sample windows.',
    codeCommit:'a'.repeat(40),sourceSha256:'b'.repeat(64),
    observedAtUtc:'2026-11-22T15:00:00Z',
    evidenceKnownAtUtc:'2026-11-22T14:00:00Z',
    markets:['BTCUSDT'],holdoutTradeCount:2
  };
  const written=await rememberFinding(db,finding);
  assert.equal(written.inserted,true);
  const duplicated=await rememberFinding(db,finding);
  assert.equal(duplicated.inserted,false);
  const loaded=await recallFindings(db,'vector');
  assert(loaded.some(x=>x.id===written.id));
  assert(loaded.every(x=>x.canPlaceOrders===false));
  const others=await recallFindings(db,'speed');
  assert.equal(others.length,0);
  console.log('CJ_PG18_SMOKE PASS : two persistent tables, six idempotent runs, per-agent isolated memory');
}finally{
  await db.end();
}
