import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
  shouldArchive,listArchiveInputs,archiveAgentArtifacts,
  restoreArchivedRun,archiveCapacity,initializeArchive
} from './render/archive.mjs';

const SLOT='2026-11-23T02:00:00.000Z';
function fakePool(){
  const objects=new Map(),manifest=new Map(),sqls=[];
  const client={
    async query(sql,args=[]){
      sqls.push(sql);
      if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK')return {rows:[]};
      if(sql.startsWith('INSERT INTO cj_archive_objects')){
        if(!objects.has(args[0]))objects.set(args[0],{
          sha256:args[0],raw_bytes:args[1],content:args[3]
        });
        return {rowCount:1};
      }
      if(sql.startsWith('INSERT INTO cj_archive_manifest')){
        const key=args[0]+'|'+args[1]+'|'+args[2];
        if(!manifest.has(key))manifest.set(key,{agent:args[0],slot:args[1],
          path:args[2],sha256:args[3]});
        return {rowCount:1};
      }
      if(sql.startsWith('SELECT path,trim(sha256)')){
        return {rows:[...manifest.values()]
          .filter(x=>x.agent===args[0]&&x.slot===args[1])
          .sort((a,b)=>a.path.localeCompare(b.path))
          .map(x=>({path:x.path,sha256:x.sha256}))};
      }
      throw Error('Unsupported statement '+sql);
    },
    release(){}
  };
  return {
    objects,manifest,sqls,
    async connect(){return client;},
    async query(sql,args=[]){
      sqls.push(sql);
      if(sql.startsWith('SELECT pg_database_size'))
        return {rows:[{used_bytes:'840000000'}]};
      if(sql.startsWith('SELECT m.path,trim(m.sha256)')){
        const rows=[...manifest.values()]
          .filter(x=>x.agent===args[0]&&x.slot===args[1])
          .sort((a,b)=>a.path.localeCompare(b.path))
          .map(x=>({path:x.path,sha256:x.sha256,
            raw_bytes:objects.get(x.sha256).raw_bytes,
            content:objects.get(x.sha256).content}));
        return {rows};
      }
      return {rows:[]};
    }
  };
}
test('archive allowlists include all native test reports without leaking adjacent agents',()=>{
  assert.equal(shouldArchive('bitunix-data','BTCUSDT-1h.json'),true);
  assert.equal(shouldArchive('vector','BTCUSDT-1h.json'),false);
  assert.equal(shouldArchive('vector','BTCUSDT-1h-vector-v11.json'),true);
  assert.equal(shouldArchive('vector','vector-market-regimes-summary.md'),true);
  assert.equal(shouldArchive('momentum','momentum-render-summary.json'),true);
  assert.equal(shouldArchive('momentum','momentum-BTCUSDT-1h-detail.json'),true);
  assert.equal(shouldArchive('speed','speed-SOLUSDT-15m-detail.json'),true);
  assert.equal(shouldArchive('speed','speed-render-summary.json'),true);
  assert.equal(shouldArchive('cipher','HYPEUSDT-source-first.json'),true);
  assert.equal(shouldArchive('bitunix-data','../secrets.json'),false);
  assert.equal(shouldArchive('bitunix-data','DATABASE_URL.env'),false);
});
test('nine-source archive is compressed, content-deduplicated and restorable bit for bit',async()=>{
  const root=await mkdtemp(join(tmpdir(),'cj-archive-test-'));
  const destination=await mkdtemp(join(tmpdir(),'cj-archive-restore-'));
  try{
    await mkdir(join(root,'data'));
    const body=JSON.stringify({ohlc:Array.from({length:480},(_,i)=>({t:i,c:100+i}))});
    await writeFile(join(root,'data','BTCUSDT-1h.json'),body);
    await writeFile(join(root,'data','BTCUSDT-4h.json'),body);
    await writeFile(join(root,'data','summary.json'),'{"status":"PASS"}');
    await writeFile(join(root,'data','summary.md'),'Research summary');
    const db=fakePool();
    await initializeArchive(db);
    const first=await archiveAgentArtifacts(db,'bitunix-data',SLOT,{root});
    assert.equal(first.status,'ARCHIVED_DURABLY');
    assert.equal(first.files,4);
    assert.equal(db.objects.size,3);
    assert.equal(db.manifest.size,4);
    assert.equal(first.manifestSha256.length,64);
    assert.ok(first.compressedBytes<first.rawBytes);
    const restored=await restoreArchivedRun(db,{agent:'bitunix-data',slot:SLOT,destination});
    assert.equal(restored.restored,4);
    assert.equal(await readFile(join(destination,'data','BTCUSDT-1h.json'),'utf8'),body);
    await assert.rejects(()=>restoreArchivedRun(db,{
      agent:'bitunix-data',slot:SLOT,destination}),/EEXIST/);
  }finally{
    await rm(root,{recursive:true,force:true});
    await rm(destination,{recursive:true,force:true});
  }
});
test('a missing mandatory source summary prevents a false archival success',async()=>{
  const root=await mkdtemp(join(tmpdir(),'cj-archive-empty-'));
  try{
    await mkdir(join(root,'data'));
    await writeFile(join(root,'data','BTCUSDT-1h.json'),'{}');
    await assert.rejects(()=>listArchiveInputs('bitunix-data',SLOT,{root}),
      /MISSING_MANDATORY_ARCHIVE_SUMMARY/);
  }finally{await rm(root,{recursive:true,force:true});}
});
test('restore rejects altered archive bytes, never returns misleading data',async()=>{
  const root=await mkdtemp(join(tmpdir(),'cj-archive-corrupt-'));
  const destination=await mkdtemp(join(tmpdir(),'cj-archive-restore-'));
  try{
    await mkdir(join(root,'data'));
    await writeFile(join(root,'data','summary.json'),'{"hello":1}');
    const db=fakePool();
    await archiveAgentArtifacts(db,'bitunix-data',SLOT,{root});
    const x=[...db.objects.values()][0];
    x.content=Buffer.from('not a gzip');
    await assert.rejects(()=>restoreArchivedRun(db,{agent:'bitunix-data',slot:SLOT,destination}));
  }finally{
    await rm(root,{recursive:true,force:true});
    await rm(destination,{recursive:true,force:true});
  }
});
test('storage capacity logs real pg database usage and warns before quota',async()=>{
  const cap=await archiveCapacity(fakePool());
  assert.equal(cap.dbBytes,840000000);
  assert.equal(cap.warning,true);
  assert.equal(cap.configuredBudgetBytes,1073741824);
});

test('successful Momentum and SPEED archives require all nine per-bar timelines',async()=>{
  const root=await mkdtemp(join(tmpdir(),'cj-perbar-incomplete-'));
  try{
    await mkdir(join(root,'data'));
    await writeFile(join(root,'data','momentum-render-summary.json'),'{"passed":9}');
    await writeFile(join(root,'data','speed-render-summary.json'),'{"passed":9}');
    await assert.rejects(()=>listArchiveInputs('momentum',SLOT,{root}),
      /MISSING_NINE_PER_BAR_RESEARCH_ARCHIVES/);
    await assert.rejects(()=>listArchiveInputs('speed',SLOT,{root}),
      /MISSING_NINE_PER_BAR_RESEARCH_ARCHIVES/);
  }finally{await rm(root,{recursive:true,force:true});}
});
