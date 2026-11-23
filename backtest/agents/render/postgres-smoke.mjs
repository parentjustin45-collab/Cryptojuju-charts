/*
 * Real ephemeral PostgreSQL 18 smoke using synthetic research file outputs.
 * Never fetches Bitunix or uses real data, orders or production DB.
 * Tests durable gzip archive + manifest + restore on actual Postgres.
 */
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {initializeDb,runDueCycle} from './supervisor.mjs';
import {restoreArchivedRun} from './archive.mjs';
import {rememberFinding,recallFindings} from './knowledge.mjs';
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL required for PostgreSQL smoke');
const db=await initializeDb();
const slot=new Date('2026-11-22T15:58:00Z');
const slotIso='2026-11-22T15:00:00.000Z';
const folder=join(tmpdir(),'cryptojuju-agent-research','2026-11-22T15');
const restoreTo=await mkdtemp(join(tmpdir(),'cj-pg-restore-'));
try {
  await mkdir(join(folder,'data'),{recursive:true});
  await mkdir(join(folder,'cipher'),{recursive:true});
  const write=(sub,name,content)=>writeFile(join(folder,sub,name),content);
  const source=JSON.stringify({origin:'synthetic-ci-only',sourceSha256:'a'.repeat(64),
    candles:Array.from({length:480},(_,i)=>({time:i,close:i+100}))});
  await write('data','BTCUSDT-1h.json',source);
  await write('data','summary.json',JSON.stringify({status:'PASS_SYNTHETIC_CI'}));
  await write('data','summary.md','Synthetic CI fixture\n');
  await write('data','vector-v11-summary.json',JSON.stringify({agent:'vector',ci:true}));
  await write('data','BTCUSDT-1h-vector-v11.json',JSON.stringify({test:'vector'}));
  await write('data','momentum-render-summary.json',JSON.stringify({agent:'momentum',ci:true}));
  await write('data','speed-render-summary.json',JSON.stringify({agent:'speed',ci:true}));
  await write('cipher','cj-cipher-pilot-summary.json',JSON.stringify({agent:'cipher',ci:true}));
  await write('cipher','HYPEUSDT-source-first.json',source);
  const executor=async agent=>({
    status:agent.id==='bitunix-data'?'DATA_READY_FOR_RESEARCH_ONLY':'EXECUTED_RESEARCH_ONLY',
    evidence:{testFixture:true,automaticPromotion:false}
  });
  const allowedIds=['bitunix-data','vector','momentum','speed','cipher','diagnostics'];
  const first=await runDueCycle(db,slot,{executor,allowedIds,sourceFilesReady:async()=>true});
  assert.equal(first.completed.length,6);
  assert.deepEqual(first.completed.map(x=>x.agent),
    ['bitunix-data','vector','momentum','speed','cipher','diagnostics']);
  const repeat=await runDueCycle(db,slot,{executor,allowedIds});
  assert.equal(repeat.completed.length,0);
  const rows=await db.query('SELECT agent,status,evidence FROM cj_agent_runs WHERE slot=$1',[first.slot]);
  assert.equal(rows.rowCount,6);
  console.log('CJ_PG18_ARCHIVE_DIAGNOSTIC '+JSON.stringify(rows.rows.map(x=>({agent:x.agent,status:x.status,reason:x.evidence?.reason??null,archiveError:x.evidence?.archiveError??null,receipt:x.evidence?.archive?.files??null}))));
  assert.equal(rows.rows.find(x=>x.agent==='bitunix-data').status,'DATA_READY_FOR_RESEARCH_ONLY');
  assert.equal(rows.rows.find(x=>x.agent==='diagnostics').evidence.automaticCodeChanges,false);
  for(const id of ['bitunix-data','vector','momentum','speed','cipher']){
    const receipt=rows.rows.find(x=>x.agent===id).evidence.archive;
    assert.equal(receipt.status,'ARCHIVED_DURABLY');
    assert.ok(receipt.files>=1);
  }
  const manifests=await db.query('SELECT agent,slot,path,sha256 FROM cj_archive_manifest ORDER BY agent,path');
  assert.ok(manifests.rowCount>=9);
  const objects=await db.query('SELECT count(*)::int AS count FROM cj_archive_objects');
  assert.ok(objects.rows[0].count>=6);
  const restore=await restoreArchivedRun(db,{agent:'bitunix-data',slot:slotIso,destination:restoreTo});
  assert.ok(restore.restored>=2);
  assert.equal(await readFile(join(restoreTo,'data','BTCUSDT-1h.json'),'utf8'),source);
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
  console.log('CJ_PG18_SMOKE PASS : six runs, archive objects and manifests, SHA256 recovery, specialist memory');
}finally{
  await rm(folder,{recursive:true,force:true});
  await rm(restoreTo,{recursive:true,force:true});
  await db.end();
}
