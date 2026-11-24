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
import {restoreArchivedRun,archiveAgentArtifacts} from './archive.mjs';
import {FIVE_CASES} from './five-by-five.mjs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {initializeHistoricalLibrary,ingestVerifiedHistoricalSource,reconcileHourlyArchives,reconcileLegacyArchives,historicalCoverage,loadContiguousHistoricalWindow} from './historical-library.mjs';
import {runHistoricalBridgeBatch} from './historical-bridge-scheduler.mjs';
import {replayFourFromHistoricalLibrary} from './historical-replay.mjs';
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
  for(const kind of ['momentum','speed'])
    for(const symbol of ['BTCUSDT','ETHUSDT','SOLUSDT'])
      for(const tf of ['15m','1h','4h'])
        await write('data',kind+'-'+symbol+'-'+tf+'-detail.json',
          JSON.stringify({kind,symbol,timeframe:tf,sourceSha256:'a'.repeat(64),
            bars:Array.from({length:480},(_,i)=>({time:i,indicator:Math.sin(i/6)}))}));

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
  // Secondary fixture: verify the ENTIRE 5×5 per-indicator archive can be
  // committed and restored against real PostgreSQL. Never touches Render prod.
  const scratch25=await mkdtemp(join(tmpdir(),'cj-postgres25-'));
  const restored25=await mkdtemp(join(tmpdir(),'cj-postgres25-restore-'));
  const oldCohort=process.env.CJ_RENDER_RESEARCH_COHORT;
  try{
    process.env.CJ_RENDER_RESEARCH_COHORT='FIVE_BY_FIVE';
    await mkdir(join(scratch25,'data'));
    await mkdir(join(scratch25,'cipher'));
    const testSlot='2026-11-22T16:00:00.000Z';
    for(const agent of ['bitunix-data','vector','momentum','speed','cipher'])
      await db.query("INSERT INTO cj_agent_runs(agent,slot,status) VALUES($1,$2,'RUNNING')",[agent,testSlot]);
    await writeFile(join(scratch25,'data','summary.json'),'{"status":"PASS_SYNTHETIC_CI"}');
    await writeFile(join(scratch25,'data','vector-v11-summary.json'),'{"status":"PASS_SYNTHETIC_CI"}');
    await writeFile(join(scratch25,'data','momentum-render-summary.json'),'{"status":"PASS_SYNTHETIC_CI"}');
    await writeFile(join(scratch25,'data','speed-render-summary.json'),'{"status":"PASS_SYNTHETIC_CI"}');
    await writeFile(join(scratch25,'cipher','cj-cipher-pilot-summary.json'),'{"status":"PASS_SYNTHETIC_CI"}');
    for(const item of FIVE_CASES){
      const key=item.symbol+'-'+item.timeframe;
      await writeFile(join(scratch25,'data',key+'.json'),
        JSON.stringify({source:'SYNTHETIC_POSTGRES_25',key,bars:[{time:1,close:2}]}));
      await writeFile(join(scratch25,'data',key+'-vector-v11.json'),
        JSON.stringify({status:'SYNTHETIC_ONLY',key}));
      for(const kind of ['momentum','speed'])
        await writeFile(join(scratch25,'data',kind+'-'+key+'-detail.json'),
          JSON.stringify({kind,key,sourceSha256:'b'.repeat(64),
            bars:Array.from({length:480},(_,i)=>({time:i,signal:i%2===0}))}));
      await writeFile(join(scratch25,'cipher',key+'-cipher-mtf-detail.json'),
        JSON.stringify({kind:'cipher',key,actions:Array.from({length:480},(_,i)=>i%2)}));
    }
    for(const agent of ['bitunix-data','vector','momentum','speed','cipher']){
      const proof=await archiveAgentArtifacts(db,agent,testSlot,{root:scratch25});
      assert.equal(proof.status,'ARCHIVED_DURABLY');
      const expectedFiles={'momentum':26,'speed':26,'cipher':26}[agent];
      if(expectedFiles)assert.equal(proof.files,expectedFiles);
      assert.ok(proof.manifestSha256.length===64);
    }
    const audit25=await db.query(
      'SELECT agent,count(*)::int AS files FROM cj_archive_manifest WHERE slot=$1 GROUP BY agent',
      [testSlot]);
    assert.equal(audit25.rowCount,5);
    assert.equal(audit25.rows.find(x=>x.agent==='momentum').files,26);
    assert.equal(audit25.rows.find(x=>x.agent==='cipher').files,26);
    const receipt=await restoreArchivedRun(db,{agent:'cipher',slot:testSlot,destination:restored25});
    assert.equal(receipt.restored,26);
    console.log('CJ_PG18_25_CASE_ARCHIVE PASS : Bitunix, Vector, Momentum, SPEED, Cipher 25-case archive SHA256 restoration');
  }finally{
    if(oldCohort===undefined)delete process.env.CJ_RENDER_RESEARCH_COHORT;
    else process.env.CJ_RENDER_RESEARCH_COHORT=oldCohort;
    await rm(scratch25,{recursive:true,force:true});
    await rm(restored25,{recursive:true,force:true});
  }
  // End-to-end canonical candle library from actual PostgreSQL archive
  // object bytes and a matching independently signed two-read report.
  await initializeHistoricalLibrary(db);
  const hSlot='2026-11-22T17:00:00.000Z';
  await db.query("INSERT INTO cj_agent_runs(agent,slot,status) VALUES('bitunix-data',$1,'DATA_READY_FOR_RESEARCH_ONLY')",[hSlot]);
  const histEnd=Date.UTC(2026,10,21),step=900000,begin=histEnd-480*step;
  const validCandles=Array.from({length:480},(_,i)=>{
    const p=110+i*.01;return {time:begin+i*step,open:p,high:p+1,low:p-1,
      close:p+.2,volume:10+i};
  });
  const hdigest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
  const hRaw=hdigest(validCandles);
  const hWindow={startTime:begin,endTime:histEnd,intervalMs:step};
  const hSource={status:'DATA_READY_FOR_RESEARCH_ONLY',
    market:{exchange:'Bitunix',priceType:'LAST_PRICE',symbol:'BTCUSDT',timeframe:'15m'},
    historyWindow:hWindow,acceptedCandles:validCandles,rawRows:validCandles,
    provenance:{source:'Bitunix public Futures REST',priceType:'LAST_PRICE',
      formingBarExcluded:true,rawSha256:hRaw,derivedSha256:hdigest(validCandles)},
    role1:{status:'PASS'},quality:{unresolved:0}};
  const hRepeat={status:'STABLE_TWO_READS',checkedDerived:480,differenceCount:0,
    firstRawSha256:hRaw,overlapRawSha256First:'f'.repeat(64),
    overlapRawSha256Second:'f'.repeat(64),
    market:{symbol:'BTCUSDT',timeframe:'15m',exchange:'Bitunix'},
    historyWindow:hWindow};
  const toArchive=async(path,body)=>{
    const raw=Buffer.from(JSON.stringify(body)+'\n');
    const hash=createHash('sha256').update(raw).digest('hex');
    await db.query("INSERT INTO cj_archive_objects(sha256,raw_bytes,compressed_bytes,encoding,content) "+
      "VALUES($1,$2,$3,'gzip',$4) ON CONFLICT(sha256) DO NOTHING",
      [hash,raw.length,gzipSync(raw).length,gzipSync(raw)]);
    await db.query('INSERT INTO cj_archive_manifest(agent,slot,path,sha256) VALUES($1,$2,$3,$4)',
      ['bitunix-data',hSlot,path,hash]);
    return hash;
  };
  await toArchive('data/BTCUSDT-15m.json',hSource);
  await toArchive('data/BTCUSDT-15m-repeatability.json',hRepeat);
  const dry=await reconcileHourlyArchives(db,{limit:1,commit:false});
  assert.equal(dry.results[0].status,'DRY_RUN_VERIFIED',JSON.stringify(dry));
  const imported=await reconcileHourlyArchives(db,{limit:1,commit:true});
  assert.equal(imported.results[0].status,'RECONCILED',JSON.stringify(imported));
  assert.equal(imported.results[0].insertedBars,480);
  const count=await db.query("SELECT count(*)::int AS c FROM cj_historical_candles WHERE symbol='BTCUSDT' AND timeframe='15m'");
  assert.equal(count.rows[0].c,480);
  const replay=await ingestVerifiedHistoricalSource(db,{first:hSource,repeat:hRepeat,
    sourceKey:'hourly-bitunix|other-slot|data/BTCUSDT-15m.json'});
  assert.equal(replay.insertedBars,0);
  assert.equal(replay.reusedBars,480);
  const again=await ingestVerifiedHistoricalSource(db,{first:hSource,repeat:hRepeat,
    sourceKey:imported.results[0].sourceKey});
  assert.equal(again.status,'ALREADY_RECONCILED');
  // Changed historical OHLC must NEVER overwrite the original, even when
  // supplied with a fresh internally consistent source hash.
  const changed=structuredClone(hSource);
  changed.acceptedCandles[0].close+=.05;
  changed.rawRows[0].close+=.05;
  changed.provenance.rawSha256=hdigest(changed.rawRows);
  changed.provenance.derivedSha256=hdigest(changed.acceptedCandles);
  const changedRepeat={...hRepeat,firstRawSha256:changed.provenance.rawSha256};
  await assert.rejects(ingestVerifiedHistoricalSource(db,{first:changed,repeat:changedRepeat,
    sourceKey:'hourly-bitunix|conflict-slot|data/BTCUSDT-15m.json'}),
    /HISTORICAL_OHLC_CONFLICT/);
  const after=await db.query("SELECT count(*)::int AS c FROM cj_historical_candles WHERE symbol='BTCUSDT' AND timeframe='15m'");
  assert.equal(after.rows[0].c,480);
  const coverage=await historicalCoverage(db);
  assert.equal(coverage.find(x=>x.symbol==='BTCUSDT'&&x.timeframe==='15m').uniqueBars,480);
  const loadedHist=await loadContiguousHistoricalWindow(db,{symbol:'BTCUSDT',timeframe:'15m',endMs:histEnd,bars:480});
  assert.equal(loadedHist.candles.length,480);
  const fourReplay=await replayFourFromHistoricalLibrary(db,{symbol:'BTCUSDT',timeframe:'15m',endMs:histEnd,bars:480,priceStep:.01});
  assert.equal(fourReplay.status,'CAUSAL_480_BAR_POSTGRES_REPLAY_COMPLETE');
  assert.equal(fourReplay.evaluatedBars,480);
  assert.equal(fourReplay.historicalTwoYearsComplete,false);
  await assert.rejects(loadContiguousHistoricalWindow(db,{symbol:'BTCUSDT',timeframe:'15m',endMs:histEnd+step,bars:480}),/GAPS/);
  // Legacy references migrated from GitHub artifacts use different original
  // path naming: -first.json + -readback.json. Verify the SAME 480 candles
  // without duplicate insertion, and run the cursor-backed scheduler.
  await db.query("CREATE TABLE IF NOT EXISTS cj_legacy_file_refs ("+
    "dataset text NOT NULL,artifact_id bigint NOT NULL,original_path text NOT NULL,"+
    "sha256 char(64) NOT NULL REFERENCES cj_archive_objects(sha256),"+
    "source_run_url text NOT NULL,source_archive text NOT NULL,"+
    "original_expiry_utc timestamptz,created_at timestamptz NOT NULL DEFAULT now(),"+
    "PRIMARY KEY(dataset,artifact_id,original_path))");
  const legacyHashes=await db.query("SELECT path,trim(sha256) AS sha256 FROM cj_archive_manifest "+
    "WHERE agent='bitunix-data' AND slot=$1 AND path IN ($2,$3)",[hSlot,
      'data/BTCUSDT-15m.json','data/BTCUSDT-15m-repeatability.json']);
  assert.equal(legacyHashes.rowCount,2);
  for(const entry of legacyHashes.rows){
    const name=entry.path.endsWith('-repeatability.json')
      ?'BTCUSDT-15m-readback.json':'BTCUSDT-15m-first.json';
    await db.query("INSERT INTO cj_legacy_file_refs ("+
      "dataset,artifact_id,original_path,sha256,source_run_url,source_archive) "+
      "VALUES($1,$2,$3,$4,$5,$6)",['CJ-HISTORICAL-DEDUP-V1-20261124',
        14553812202,name,entry.sha256,'https://github.com/example/actions/runs/1','fixture.zip']);
  }
  const legacyDry=await reconcileLegacyArchives(db,{limit:1,offset:0,commit:false});
  assert.equal(legacyDry.results[0].status,'DRY_RUN_VERIFIED',JSON.stringify(legacyDry));
  const legacyImported=await reconcileLegacyArchives(db,{limit:1,offset:0,commit:true});
  assert.equal(legacyImported.results[0].status,'RECONCILED',JSON.stringify(legacyImported));
  assert.equal(legacyImported.results[0].insertedBars,0);
  const scheduled=await runHistoricalBridgeBatch(db,{hourlyLimit:1,legacyLimit:1});
  assert.equal(scheduled.status,'HISTORICAL_BRIDGE_BATCH_COMPLETED');
  assert.equal(scheduled.indexedUniqueBars,480);
  assert.ok(scheduled.legacy.validatedSources===1);
  console.log('CJ_HISTORICAL_LEGACY_PG18 PASS : real artifact refs + protected cursor + no duplicate OHLC');
  console.log('CJ_HISTORICAL_REPLAY_PG18 PASS : 480 verified database candles through Vector, Momentum, SPEED, Cipher, no lookahead');
  console.log('CJ_HISTORICAL_BRIDGE_PG18 PASS : SHA256 archive decompression, 480 candles, dry-run, idempotent ingest, collision rollback and coverage');
  console.log('CJ_PG18_SMOKE PASS : six runs, archive objects and manifests, SHA256 recovery, specialist memory');
}finally{
  await rm(folder,{recursive:true,force:true});
  await rm(restoreTo,{recursive:true,force:true});
  await db.end();
}
