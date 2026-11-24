/*
 * Durable, content-addressed research artifacts for the Render pilot.
 * One hourly run -> immutable manifest entries -> gzipped objects in Postgres.
 * NEVER silently discard test output; failed archival blocks the run.
 * No public download endpoint, market orders, API tokens, or auto promotion.
 */
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {readdir,readFile,lstat,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {FIVE_CRYPTO_SYMBOLS,FIVE_TIMEFRAMES,isFiveByFive} from './five-by-five.mjs';

export const MAX_FILE_BYTES=16*1024*1024;
export const MAX_RUN_BYTES=80*1024*1024;
const sha=b=>createHash('sha256').update(b).digest('hex');
const baseFor=slot=>join(tmpdir(),'cryptojuju-agent-research',slot.slice(0,13).replaceAll(':','-'));
const agentRoots={ 'bitunix-data':'data',vector:'data',momentum:'data',speed:'data',cipher:'cipher'};
const summaryFiles={
  'bitunix-data':'summary.json',vector:'vector-v11-summary.json',
  momentum:'momentum-render-summary.json',speed:'speed-render-summary.json',
  cipher:'cj-cipher-pilot-summary.json'
};
export function shouldArchive(agent,name){
  if(!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,179}\.(json|md|html)$/.test(name))return false;
  if(agent==='bitunix-data')return true; // First stage owns entire data folder.
  if(agent==='vector')return /vector|regime|scoreboard|timing/i.test(name);
  if(agent==='momentum'||agent==='speed'){
    if(name===agent+'-render-summary.json')return true;
    const re=new RegExp('^'+agent+'-([A-Z0-9]+)-(15m|30m|1h|4h|1d)-detail\\.json
  if(agent==='cipher')return true;
  return false;
}
export async function listArchiveInputs(agent,slot,{root=baseFor(slot),requireSummary=true}={}){
  const sub=agentRoots[agent];
  if(!sub)throw Error('No file archive for agent '+agent);
  const folder=join(root,sub);
  const names=(await readdir(folder)).filter(name=>shouldArchive(agent,name)).sort();
  if(requireSummary&&!names.includes(summaryFiles[agent]))
    throw Error('MISSING_MANDATORY_ARCHIVE_SUMMARY');
  if(requireSummary&&['momentum','speed'].includes(agent)&&
      names.filter(name=>name.startsWith(agent+'-')&&name.endsWith('-detail.json')).length!==(isFiveByFive()?25:9))
    throw Error('MISSING_PER_BAR_RESEARCH_ARCHIVES');
  if(requireSummary&&agent==='cipher'&&isFiveByFive()&&
      names.filter(name=>name.endsWith('-cipher-mtf-detail.json')).length!==25)
    throw Error('MISSING_25_CIPHER_RESEARCH_ARCHIVES');
  if(names.length>250)throw Error('ARCHIVE_FILE_COUNT_EXCEEDED');
  let total=0;
  const files=[];
  for(const name of names){
    const filename=join(folder,name);
    const stat=await lstat(filename);
    if(!stat.isFile()||stat.isSymbolicLink())throw Error('ARCHIVE_NON_REGULAR_FILE');
    if(stat.size>MAX_FILE_BYTES)throw Error('ARCHIVE_FILE_TOO_LARGE');
    total+=stat.size;
    if(total>MAX_RUN_BYTES)throw Error('ARCHIVE_RUN_TOO_LARGE');
    const body=await readFile(filename);
    if(body.length!==stat.size)throw Error('ARCHIVE_FILE_CHANGED_WHILE_READING');
    const path=sub+'/'+name;
    files.push({path,sha256:sha(body),body,gzip:gzipSync(body,{level:6})});
  }
  return files;
}
export async function initializeArchive(db){
  await db.query(
    'CREATE TABLE IF NOT EXISTS cj_archive_objects ('+
    'sha256 char(64) PRIMARY KEY, raw_bytes bigint NOT NULL, '+
    'compressed_bytes bigint NOT NULL, encoding text NOT NULL '+
    "DEFAULT 'gzip', content bytea NOT NULL, created_at timestamptz NOT NULL DEFAULT now())");
  await db.query(
    'CREATE TABLE IF NOT EXISTS cj_archive_manifest ('+
    'agent text NOT NULL, slot timestamptz NOT NULL, '+
    'path text NOT NULL, sha256 char(64) NOT NULL REFERENCES cj_archive_objects(sha256), '+
    'created_at timestamptz NOT NULL DEFAULT now(), '+
    'PRIMARY KEY(agent,slot,path), '+
    'FOREIGN KEY(agent,slot) REFERENCES cj_agent_runs(agent,slot))');
  await db.query('CREATE INDEX IF NOT EXISTS cj_archive_manifest_sha_idx ON cj_archive_manifest(sha256)');
}
export async function archiveAgentArtifacts(db,agent,slot,opts={}){
  const files=await listArchiveInputs(agent,slot,opts);
  const manifestSha256=sha(Buffer.from(files.map(f=>f.path+'\t'+f.sha256).join('\n')));
  const client=await db.connect();
  try{
    await client.query('BEGIN');
    for(const f of files){
      await client.query(
        "INSERT INTO cj_archive_objects(sha256,raw_bytes,compressed_bytes,encoding,content) "+
        "VALUES($1,$2,$3,'gzip',$4) ON CONFLICT(sha256) DO NOTHING",
        [f.sha256,f.body.length,f.gzip.length,f.gzip]);
      await client.query(
        'INSERT INTO cj_archive_manifest(agent,slot,path,sha256) VALUES($1,$2,$3,$4) '+
        'ON CONFLICT(agent,slot,path) DO NOTHING',
        [agent,slot,f.path,f.sha256]);
    }
    // Readback verifies one manifest row per file before accepting a completed run.
    const check=await client.query(
      'SELECT path,trim(sha256) AS sha256 FROM cj_archive_manifest WHERE agent=$1 AND slot=$2 ORDER BY path',
      [agent,slot]);
    // PostgreSQL path collation need not match JavaScript's default .sort().
    // Verify the exact content-addressed set, independently of row ordering.
    const readback=new Map(check.rows.map(x=>[x.path,String(x.sha256).trim()]));
    if(check.rows.length!==files.length||readback.size!==files.length||
      files.some(f=>readback.get(f.path)!==f.sha256))
      throw Error('ARCHIVE_DATABASE_READBACK_MISMATCH');
    await client.query('COMMIT');
  }catch(e){
    try{await client.query('ROLLBACK');}catch{}
    throw e;
  }finally{client.release();}
  return {status:'ARCHIVED_DURABLY',files:files.length,
    rawBytes:files.reduce((n,x)=>n+x.body.length,0),
    compressedBytes:files.reduce((n,x)=>n+x.gzip.length,0),
    manifestSha256, deduplication:'sha256-content-addressed',
    storage:'POSTGRESQL_PERSISTENT_NOT_LOCAL_DISK'};
}
export async function archiveCapacity(db){
  const r=await db.query('SELECT pg_database_size(current_database())::bigint AS used_bytes');
  const used=Number(r.rows[0]?.used_bytes);
  const diskBudget=Number(process.env.CJ_ARCHIVE_DISK_BUDGET_BYTES??1073741824);
  if(!Number.isFinite(used)||used<0)throw Error('ARCHIVE_DISK_USAGE_UNKNOWN');
  const ratio=Number.isFinite(diskBudget)&&diskBudget>0?used/diskBudget:null;
  return {dbBytes:used,configuredBudgetBytes:diskBudget,
    ratio,warning:ratio!==null&&ratio>=0.70,
    action:'Measure disk and scale storage before 1 GB quota; NEVER prune history silently.'};
}
export async function restoreArchivedRun(db,{agent,slot,destination}){
  if(!agentRoots[agent])throw Error('Unknown archive agent');
  if(!/^\d{4}-\d\d-\d\dT\d\d:00:00\.000Z$/.test(slot))throw Error('Invalid hourly slot');
  const output=resolve(destination);
  const r=await db.query(
    'SELECT m.path,trim(m.sha256) AS sha256,o.content,o.raw_bytes '+
    'FROM cj_archive_manifest m JOIN cj_archive_objects o ON o.sha256=m.sha256 '+
    'WHERE m.agent=$1 AND m.slot=$2 ORDER BY m.path',[agent,slot]);
  if(!r.rows.length)throw Error('No archived artifacts for this run');
  for(const x of r.rows){
    if(!/^((data)|(cipher))\/[A-Za-z0-9][A-Za-z0-9_.-]{0,179}\.(json|md|html)$/.test(x.path))
      throw Error('Unsafe archive path');
    const destinationFile=resolve(output,x.path);
    if(!destinationFile.startsWith(output+sep))throw Error('Archive path traversal');
    const body=gunzipSync(x.content);
    if(sha(body)!==x.sha256||body.length!==Number(x.raw_bytes))
      throw Error('Archived content hash verification failed');
    await mkdir(resolve(output,x.path.split('/')[0]),{recursive:true});
    await writeFile(destinationFile,body,{flag:'wx'});
  }
  return {agent,slot,restored:r.rows.length,destination:output};
}
);
    const m=name.match(re);
    return !!m&&FIVE_CRYPTO_SYMBOLS.includes(m[1])&&FIVE_TIMEFRAMES.includes(m[2]);
  }
  if(agent==='cipher')return true;
  return false;
}
export async function listArchiveInputs(agent,slot,{root=baseFor(slot),requireSummary=true}={}){
  const sub=agentRoots[agent];
  if(!sub)throw Error('No file archive for agent '+agent);
  const folder=join(root,sub);
  const names=(await readdir(folder)).filter(name=>shouldArchive(agent,name)).sort();
  if(requireSummary&&!names.includes(summaryFiles[agent]))
    throw Error('MISSING_MANDATORY_ARCHIVE_SUMMARY');
  if(requireSummary&&['momentum','speed'].includes(agent)&&
      names.filter(name=>name.startsWith(agent+'-')&&name.endsWith('-detail.json')).length!==9)
    throw Error('MISSING_NINE_PER_BAR_RESEARCH_ARCHIVES');
  if(names.length>250)throw Error('ARCHIVE_FILE_COUNT_EXCEEDED');
  let total=0;
  const files=[];
  for(const name of names){
    const filename=join(folder,name);
    const stat=await lstat(filename);
    if(!stat.isFile()||stat.isSymbolicLink())throw Error('ARCHIVE_NON_REGULAR_FILE');
    if(stat.size>MAX_FILE_BYTES)throw Error('ARCHIVE_FILE_TOO_LARGE');
    total+=stat.size;
    if(total>MAX_RUN_BYTES)throw Error('ARCHIVE_RUN_TOO_LARGE');
    const body=await readFile(filename);
    if(body.length!==stat.size)throw Error('ARCHIVE_FILE_CHANGED_WHILE_READING');
    const path=sub+'/'+name;
    files.push({path,sha256:sha(body),body,gzip:gzipSync(body,{level:6})});
  }
  return files;
}
export async function initializeArchive(db){
  await db.query(
    'CREATE TABLE IF NOT EXISTS cj_archive_objects ('+
    'sha256 char(64) PRIMARY KEY, raw_bytes bigint NOT NULL, '+
    'compressed_bytes bigint NOT NULL, encoding text NOT NULL '+
    "DEFAULT 'gzip', content bytea NOT NULL, created_at timestamptz NOT NULL DEFAULT now())");
  await db.query(
    'CREATE TABLE IF NOT EXISTS cj_archive_manifest ('+
    'agent text NOT NULL, slot timestamptz NOT NULL, '+
    'path text NOT NULL, sha256 char(64) NOT NULL REFERENCES cj_archive_objects(sha256), '+
    'created_at timestamptz NOT NULL DEFAULT now(), '+
    'PRIMARY KEY(agent,slot,path), '+
    'FOREIGN KEY(agent,slot) REFERENCES cj_agent_runs(agent,slot))');
  await db.query('CREATE INDEX IF NOT EXISTS cj_archive_manifest_sha_idx ON cj_archive_manifest(sha256)');
}
export async function archiveAgentArtifacts(db,agent,slot,opts={}){
  const files=await listArchiveInputs(agent,slot,opts);
  const manifestSha256=sha(Buffer.from(files.map(f=>f.path+'\t'+f.sha256).join('\n')));
  const client=await db.connect();
  try{
    await client.query('BEGIN');
    for(const f of files){
      await client.query(
        "INSERT INTO cj_archive_objects(sha256,raw_bytes,compressed_bytes,encoding,content) "+
        "VALUES($1,$2,$3,'gzip',$4) ON CONFLICT(sha256) DO NOTHING",
        [f.sha256,f.body.length,f.gzip.length,f.gzip]);
      await client.query(
        'INSERT INTO cj_archive_manifest(agent,slot,path,sha256) VALUES($1,$2,$3,$4) '+
        'ON CONFLICT(agent,slot,path) DO NOTHING',
        [agent,slot,f.path,f.sha256]);
    }
    // Readback verifies one manifest row per file before accepting a completed run.
    const check=await client.query(
      'SELECT path,trim(sha256) AS sha256 FROM cj_archive_manifest WHERE agent=$1 AND slot=$2 ORDER BY path',
      [agent,slot]);
    // PostgreSQL path collation need not match JavaScript's default .sort().
    // Verify the exact content-addressed set, independently of row ordering.
    const readback=new Map(check.rows.map(x=>[x.path,String(x.sha256).trim()]));
    if(check.rows.length!==files.length||readback.size!==files.length||
      files.some(f=>readback.get(f.path)!==f.sha256))
      throw Error('ARCHIVE_DATABASE_READBACK_MISMATCH');
    await client.query('COMMIT');
  }catch(e){
    try{await client.query('ROLLBACK');}catch{}
    throw e;
  }finally{client.release();}
  return {status:'ARCHIVED_DURABLY',files:files.length,
    rawBytes:files.reduce((n,x)=>n+x.body.length,0),
    compressedBytes:files.reduce((n,x)=>n+x.gzip.length,0),
    manifestSha256, deduplication:'sha256-content-addressed',
    storage:'POSTGRESQL_PERSISTENT_NOT_LOCAL_DISK'};
}
export async function archiveCapacity(db){
  const r=await db.query('SELECT pg_database_size(current_database())::bigint AS used_bytes');
  const used=Number(r.rows[0]?.used_bytes);
  const diskBudget=Number(process.env.CJ_ARCHIVE_DISK_BUDGET_BYTES??1073741824);
  if(!Number.isFinite(used)||used<0)throw Error('ARCHIVE_DISK_USAGE_UNKNOWN');
  const ratio=Number.isFinite(diskBudget)&&diskBudget>0?used/diskBudget:null;
  return {dbBytes:used,configuredBudgetBytes:diskBudget,
    ratio,warning:ratio!==null&&ratio>=0.70,
    action:'Measure disk and scale storage before 1 GB quota; NEVER prune history silently.'};
}
export async function restoreArchivedRun(db,{agent,slot,destination}){
  if(!agentRoots[agent])throw Error('Unknown archive agent');
  if(!/^\d{4}-\d\d-\d\dT\d\d:00:00\.000Z$/.test(slot))throw Error('Invalid hourly slot');
  const output=resolve(destination);
  const r=await db.query(
    'SELECT m.path,trim(m.sha256) AS sha256,o.content,o.raw_bytes '+
    'FROM cj_archive_manifest m JOIN cj_archive_objects o ON o.sha256=m.sha256 '+
    'WHERE m.agent=$1 AND m.slot=$2 ORDER BY m.path',[agent,slot]);
  if(!r.rows.length)throw Error('No archived artifacts for this run');
  for(const x of r.rows){
    if(!/^((data)|(cipher))\/[A-Za-z0-9][A-Za-z0-9_.-]{0,179}\.(json|md|html)$/.test(x.path))
      throw Error('Unsafe archive path');
    const destinationFile=resolve(output,x.path);
    if(!destinationFile.startsWith(output+sep))throw Error('Archive path traversal');
    const body=gunzipSync(x.content);
    if(sha(body)!==x.sha256||body.length!==Number(x.raw_bytes))
      throw Error('Archived content hash verification failed');
    await mkdir(resolve(output,x.path.split('/')[0]),{recursive:true});
    await writeFile(destinationFile,body,{flag:'wx'});
  }
  return {agent,slot,restored:r.rows.length,destination:output};
}
