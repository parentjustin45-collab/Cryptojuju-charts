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
import {runHistoricalBackfillBatch} from './historical-backfill-worker.mjs';
import {replayFourFromHistoricalLibrary} from './historical-replay.mjs';
import {replayCompletePeriodFromPostgres} from './historical-multiyear-replay.mjs';
import {historicalTargetFor,HYPE_LAUNCH_MS} from './historical-period.mjs';
import {runEligibleMultiYearReplay} from './historical-replay-worker.mjs';
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
  // Synthetic REST window exercising the exact bounded 2-year backfill code.
  // No remote Bitunix calls and no production database; source is verified
  // twice and raw evidence is compressed in SAME PostgreSQL transaction.
  const syntheticPage=async({interval,startTime,endTime,limit})=>{
    const stepMs={'15m':900000,'30m':1800000,'1h':3600000,
      '4h':14400000,'1d':86400000}[interval];
    const out=[];
    for(let t=startTime;t<endTime;t+=stepMs)
      out.push({time:t,open:100,high:101,low:99,close:100.5,volume:50});
    assert.equal(out.length,limit);
    return out;
  };
  const hBackfill=await runHistoricalBackfillBatch(db,{
    limit:2,fetchPage:syntheticPage,pause:async()=>{},
    now:()=>Date.UTC(2026,10,24,18,32)
  });
  assert.equal(hBackfill.attempted,2);
  assert.equal(hBackfill.verified,2,JSON.stringify(hBackfill.samples));
  assert.equal(hBackfill.insertedBars,960);
  const historicEvidence=await db.query('SELECT count(*)::int AS count FROM cj_historical_backfill_evidence');
  assert.equal(historicEvidence.rows[0].count,2);
  const savedBackfill=await db.query('SELECT count(*)::int AS count FROM cj_historical_backfill_attempts');
  assert.equal(savedBackfill.rows[0].count,2);
  assert.equal((await historicalCoverage(db)).reduce((n,x)=>n+x.uniqueBars,0),1440);
  // Independent full-period two-year DAILY fixture, inserted through the
  // SAME SHA256 double-read and transactional archive pipeline as production.
  // The first chunk is 480 days and the second 250; no overlapping gaps.
  const dailyStart=Date.UTC(2024,10,24),day=86400000,dailyTotal=730;
  const dailyBars=Array.from({length:dailyTotal},(_,i)=>{
    const t=dailyStart+i*day,p=190+Math.sin(i/13)*12+Math.cos(i/31)*5+i*.05;
    return {time:t,open:p,close:p+.7*Math.cos(i*1.7),
      high:p+2,low:p-2,volume:100+i%35};
  });
  for(const [from,size] of [[0,480],[480,250]]){
    const rows=dailyBars.slice(from,from+size),finish=dailyStart+(from+size)*day;
    const h={startTime:dailyStart+from*day,endTime:finish,intervalMs:day};
    const first={status:'DATA_READY_FOR_RESEARCH_ONLY',
      market:{exchange:'Bitunix',priceType:'LAST_PRICE',symbol:'BTCUSDT',timeframe:'1d'},
      acceptedCandles:rows,rawRows:rows,
      historyWindow:h,
      provenance:{source:'Bitunix public Futures REST',priceType:'LAST_PRICE',
        formingBarExcluded:true,rawSha256:hdigest(rows),derivedSha256:hdigest(rows)},
      role1:{status:'PASS'},quality:{unresolved:0}};
    const repeat={status:'STABLE_TWO_READS',checkedDerived:size,differenceCount:0,
      firstRawSha256:hdigest(rows),overlapRawSha256First:'d'.repeat(64),
      overlapRawSha256Second:'d'.repeat(64),
      market:{exchange:'Bitunix',symbol:'BTCUSDT',timeframe:'1d'},
      historyWindow:h};
    const proof=await ingestVerifiedHistoricalSource(db,{first,repeat,
      sourceKey:'pg18-two-year-test|BTCUSDT|1d|'+from,archiveEvidence:true});
    assert.equal(proof.status,'RECONCILED');
    assert.equal(proof.insertedBars,size);
  }
  const longReport=await replayCompletePeriodFromPostgres(db,{
    symbol:'BTCUSDT',timeframe:'1d',priceStep:.01});
  assert.equal(longReport.closedCandles,730);
  assert.equal(longReport.status,'TWO_YEAR_CAUSAL_RESEARCH_COMPLETE_NOT_PERFORMANCE_CERTIFIED');
  assert.equal(longReport.causalPrefixChecks,4);
  assert.equal(Object.keys(longReport.indicators).length,6); // Frank cross + divergences separate
  assert.equal(longReport.marketOrdersPlaced,0);
  assert(longReport.indicators.frank_divergence.signalCount>=0);
  const officialPrice=async({symbols})=>({contracts: [{
    symbol:symbols[0],source:'BITUNIX_PUBLIC_TRADING_PAIRS',
    stepStatus:'RESEARCH_PRICE_PRECISION_NOT_TV_MINTICK',
    quotePrecision:2,priceStep:0.01
  }]});
  const archivedLong=await runEligibleMultiYearReplay(db,{
    maxPairs:1,precisionReader:officialPrice
  });
  assert.equal(archivedLong.status,'MULTIYEAR_HISTORICAL_INDICATOR_REPLAY_ARCHIVED');
  assert.equal(archivedLong.completed[0].status,'REPLAY_PERSISTED');
  assert.equal(archivedLong.completed[0].symbol,'BTCUSDT');
  assert.equal(archivedLong.completed[0].timeframe,'1d');
  const countReports=await db.query('SELECT count(*)::int AS n FROM cj_multiyear_replay_reports');
  assert.equal(countReports.rows[0].n,1);
  const repeatLong=await runEligibleMultiYearReplay(db,{
    maxPairs:1,precisionReader:officialPrice
  });
  assert.equal(repeatLong.alreadyArchived,1);
  assert.equal(repeatLong.status,'AWAITING_COMPLETE_HISTORICAL_COHORT');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM cj_multiyear_replay_reports')).rows[0].n,1);
  // Durable retry queue: transient source failure, cooldown, cursor independence,
  // recovery, exhaustion and preservation of unresolved gaps.
  const options={limit:1,fetchPage:syntheticPage,pause:async()=>{},
    now:()=>Date.UTC(2026,10,24,18,32)};
  const failWindow=async()=>({status:'BLOCKED',reason:'TEST_TRANSIENT'});
  const failed=await runHistoricalBackfillBatch(db,{...options,fetchWindow:failWindow});
  assert.equal(failed.blocked,1);
  assert.equal(failed.queuedGaps,1);
  const f=failed.samples[0];
  const key=[f.symbol,f.timeframe,f.startMs,f.endMs];
  const readAttempt=async()=> (await db.query(
    'SELECT status,attempts FROM cj_historical_backfill_attempts WHERE symbol=$1 AND timeframe=$2 AND start_ms=$3 AND end_ms=$4',key)).rows[0];
  const readCursor=async()=> (await db.query(
    'SELECT next_ms,windows_seen FROM cj_historical_backfill_cursor WHERE symbol=$1 AND timeframe=$2',key.slice(0,2))).rows[0];
  const cursor=await readCursor();
  assert.equal(Number(cursor.next_ms),f.endMs);
  const cooldown=await runHistoricalBackfillBatch(db,options);
  assert.equal(cooldown.retryAttempts,0);
  assert.equal((await readAttempt()).attempts,1);
  await db.query("UPDATE cj_historical_backfill_attempts SET updated_at=now()-interval '2 hours' WHERE symbol=$1 AND timeframe=$2 AND start_ms=$3 AND end_ms=$4",key);
  const recovered=await runHistoricalBackfillBatch(db,options);
  assert.equal(recovered.retryAttempts,1);
  assert.equal(recovered.recovered,1,JSON.stringify(recovered));
  assert.equal(recovered.queuedGaps,0);
  assert.equal((await readAttempt()).status,'VERIFIED_TWO_READS_ARCHIVED');
  assert.equal((await readAttempt()).attempts,2);
  assert.deepEqual(await readCursor(),cursor);
  const terminal=await runHistoricalBackfillBatch(db,{...options,fetchWindow:failWindow});
  assert.equal(terminal.blocked,1);
  const t=terminal.samples[0],tk=[t.symbol,t.timeframe,t.startMs,t.endMs];
  await db.query("UPDATE cj_historical_backfill_attempts SET attempts=4,updated_at=now()-interval '9 hours' WHERE symbol=$1 AND timeframe=$2 AND start_ms=$3 AND end_ms=$4",tk);
  const exhausted=await runHistoricalBackfillBatch(db,{...options,fetchWindow:failWindow});
  assert.equal(exhausted.retryAttempts,1);
  assert.equal(exhausted.exhaustedGaps,1);
  assert.equal(exhausted.samples[0].attemptNumber,5);
  const afterExhaustion=await runHistoricalBackfillBatch(db,options);
  assert.equal(afterExhaustion.retryAttempts,0);
  assert.equal(afterExhaustion.exhaustedGaps,1);
  const missing=await db.query('SELECT count(*)::int AS n FROM cj_historical_candles WHERE symbol=$1 AND timeframe=$2 AND open_ms>=$3 AND open_ms<$4',tk);
  assert.equal(missing.rows[0].n,0);
  // Existing deployment migration: rebase HYPE only, keep old failed rows
  // (including overlapping windows), and prove listing-adjusted replay.
  const hype=historicalTargetFor('HYPEUSDT','1d');
  assert.equal(HYPE_LAUNCH_MS,Date.UTC(2025,2,27,8));
  assert.equal(hype.startMs,Date.UTC(2025,2,31));
  assert.equal((hype.endMs-hype.startMs)/day,603);
  assert.equal(historicalTargetFor('BTCUSDT','1d').startMs,dailyStart);
  const btcBefore=(await db.query("SELECT next_ms FROM cj_historical_backfill_cursor WHERE symbol='BTCUSDT' AND timeframe='1d'")).rows[0];
  await db.query("UPDATE cj_historical_backfill_cursor SET last_attempt_at=now()");
  await db.query("UPDATE cj_historical_backfill_cursor SET next_ms=$1,target_start_ms=NULL,last_attempt_at=NULL WHERE symbol='HYPEUSDT' AND timeframe='1d'",[dailyStart+480*day]);
  for(const end of [dailyStart+4*day,dailyStart+480*day])
    await db.query("INSERT INTO cj_historical_backfill_attempts(symbol,timeframe,start_ms,end_ms,status,reason,attempts) VALUES('HYPEUSDT','1d',$1,$2,'BLOCKED','OLD_PROVENANCE_FAILURE',2)",[dailyStart,end]);
  const hypePage=async({interval,startTime,endTime,limit})=>{
    assert.equal(interval,'1d');const rows=[];
    assert.ok(startTime>=Date.UTC(2025,2,28));
    for(let t=startTime;t<endTime;t+=day){
      const i=(t-hype.startMs)/day,p=190+Math.sin(i/13)*12+Math.cos(i/31)*5+i*.05;
      rows.push({time:t,open:p,close:p+.7*Math.cos(i*1.7),high:p+2,low:p-2,volume:100+Math.abs(i%35)});
    }
    assert.equal(rows.length,limit);return rows;
  };
  const h1=await runHistoricalBackfillBatch(db,{...options,fetchPage:hypePage});
  assert.equal(h1.samples[0].symbol,'HYPEUSDT');
  assert.equal(h1.samples[0].startMs,hype.startMs);
  assert.equal(h1.verified,1,JSON.stringify(h1.samples));
  const retired=await db.query("SELECT status,reason,attempts FROM cj_historical_backfill_attempts WHERE symbol='HYPEUSDT' AND timeframe='1d' AND start_ms=$1 ORDER BY end_ms",[dailyStart]);
  assert.deepEqual(retired.rows.map(x=>x.status),['OUTSIDE_LISTING_ADJUSTED_TARGET','SUPERSEDED_LISTING_BOUNDARY']);
  assert.ok(retired.rows.every(x=>x.reason==='OLD_PROVENANCE_FAILURE'&&x.attempts===2));
  assert.deepEqual((await db.query("SELECT next_ms FROM cj_historical_backfill_cursor WHERE symbol='BTCUSDT' AND timeframe='1d'")).rows[0],btcBefore);
  await db.query("UPDATE cj_historical_backfill_cursor SET last_attempt_at=NULL WHERE symbol='HYPEUSDT' AND timeframe='1d'");
  const h2=await runHistoricalBackfillBatch(db,{...options,fetchPage:hypePage});
  assert.equal(h2.samples[0].startMs,hype.startMs+480*day);
  assert.equal(h2.insertedBars,123);
  const hr=await runEligibleMultiYearReplay(db,{maxPairs:1,precisionReader:officialPrice});
  assert.equal(hr.completed[0].symbol,'HYPEUSDT');
  assert.equal(hr.completed[0].coverageKind,'LISTING_ADJUSTED_WITH_THREE_ANCHORS');
  assert.equal(hr.completed[0].closedBars,603);
  assert.equal(hr.completed[0].startMs,hype.startMs);
  const hr2=await runEligibleMultiYearReplay(db,{maxPairs:1,precisionReader:officialPrice});
  assert.equal(hr2.alreadyArchived,2);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM cj_multiyear_replay_reports')).rows[0].n,2);
  // New method: the very first anchor has an open outside its range,
  // but the previous genuine closed candle confirms the open.
  const gapStart=dailyStart+480*1800000*10,gapEnd=gapStart+480*1800000;
  const gapKey=['BTCUSDT','30m',gapStart,gapEnd];
  await db.query("INSERT INTO cj_historical_backfill_attempts(symbol,timeframe,start_ms,end_ms,status,reason,attempts,anchor_repair_checked) VALUES($1,$2,$3,$4,'BLOCKED','BITUNIX_SOURCE_OHLC_PROVENANCE_OR_CONTINUITY_FAILED',5,false)",gapKey);
  const btcGapCursor=await db.query("SELECT next_ms,windows_seen FROM cj_historical_backfill_cursor WHERE symbol='BTCUSDT' AND timeframe='30m'");
  const anchorPage=async args=>{
    const rows=await syntheticPage(args);
    return rows.map(x=>x.time===gapStart-3*1800000?
      {...x,open:100.5,high:100.4,close:100.1}:x);
  };
  const repair=await runHistoricalBackfillBatch(db,{...options,limit:10,repairOnly:true,fetchPage:anchorPage});
  assert.equal(repair.attempted,1);
  assert.equal(repair.recovered,1,JSON.stringify(repair.samples));
  assert.equal(repair.samples[0].anchorBars,4);
  assert.equal(repair.samples[0].attemptNumber,6);
  assert.equal(repair.insertedBars,480);
  assert.equal(repair.samples[0].startMs,gapStart);
  assert.deepEqual((await db.query("SELECT next_ms,windows_seen FROM cj_historical_backfill_cursor WHERE symbol='BTCUSDT' AND timeframe='30m'")).rows,btcGapCursor.rows);
  const repairedAttempt=(await db.query("SELECT status,attempts,anchor_repair_checked FROM cj_historical_backfill_attempts WHERE symbol=$1 AND timeframe=$2 AND start_ms=$3 AND end_ms=$4",gapKey)).rows[0];
  assert.deepEqual(repairedAttempt,{status:'VERIFIED_TWO_READS_ARCHIVED',attempts:6,anchor_repair_checked:true});
  const againRepair=await runHistoricalBackfillBatch(db,{...options,limit:10,repairOnly:true,fetchPage:anchorPage});
  assert.equal(againRepair.attempted,0);
  // A real missing row must never be manufactured or accepted by the new method.
  const badStart=gapEnd,badEnd=badStart+480*1800000;
  await db.query("INSERT INTO cj_historical_backfill_attempts(symbol,timeframe,start_ms,end_ms,status,reason,attempts,anchor_repair_checked) VALUES('BTCUSDT','30m',$1,$2,'BLOCKED','BITUNIX_SOURCE_OHLC_PROVENANCE_OR_CONTINUITY_FAILED',5,false)",[badStart,badEnd]);
  const badPage=async args=>(await syntheticPage(args)).filter(x=>x.time!==badStart+1800000);
  const refused=await runHistoricalBackfillBatch(db,{...options,limit:10,repairOnly:true,fetchPage:badPage});
  assert.equal(refused.blocked,1);
  assert.equal(refused.insertedBars,0);
  assert.equal((await runHistoricalBackfillBatch(db,{...options,limit:10,repairOnly:true,fetchPage:badPage})).attempted,0);
  console.log('CJ_HISTORICAL_ANCHOR_REPAIR_PG18 PASS : extended genuine predecessor, immutable 480-bar source, bounded migration, no missing-row fabrication');
  console.log('CJ_HYPE_LISTING_PG18 PASS : old gap evidence retained, rebase once, 603 verified bars, separate immutable report, no duplicate BTC');
  console.log('CJ_HISTORICAL_RETRY_PG18 PASS : cooldown, recovery, persistent cursor, bounded exhaustion, no synthetic data');
  console.log('CJ_TWO_YEAR_FIVE_INDICATOR_ARCHIVE_PG18 PASS : auto eligibility, official price-step contract, immutable gzip report, one replay per pair');
  console.log('CJ_TWO_YEAR_FIVE_INDICATOR_PG18 PASS : 730 contiguous real SQL rows, five algorithms, causal gates and independent 70/30 outcomes');
  console.log('CJ_HISTORICAL_BACKFILL_PG18 PASS : two actual 2024-26 cursored windows, 960 twice-read candles, durable raw provenance and exact coverage');
  console.log('CJ_HISTORICAL_LEGACY_PG18 PASS : real artifact refs + protected cursor + no duplicate OHLC');
  console.log('CJ_HISTORICAL_REPLAY_PG18 PASS : 480 verified database candles through Vector, Momentum, SPEED, Cipher, no lookahead');
  console.log('CJ_HISTORICAL_BRIDGE_PG18 PASS : SHA256 archive decompression, 480 candles, dry-run, idempotent ingest, collision rollback and coverage');
  console.log('CJ_PG18_SMOKE PASS : six runs, archive objects and manifests, SHA256 recovery, specialist memory');
}finally{
  await rm(folder,{recursive:true,force:true});
  await rm(restoreTo,{recursive:true,force:true});
  await db.end();
}
