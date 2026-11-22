import test from 'node:test';
import assert from 'node:assert/strict';
import {probeDatabase} from './render/db-readiness.mjs';
const uri='postgresql://example:secret@hostname.internal:5432/research';
class GoodPool {
 static calls=0;
 constructor(config){assert.equal(config.connectionString,uri);}
 async query(sql){GoodPool.calls++;assert.match(sql,/has_schema_privilege/);
   assert.doesNotMatch(sql,/CREATE TABLE|INSERT INTO/i);
   return {rows:[{version_num:180001,can_create_tables:true,is_replica:false}]};}
 async end(){}
}
test('read-only connection returns readiness without credentials or hostname',async()=>{
 const result=await probeDatabase({url:uri,PoolClass:GoodPool});
 assert.equal(result.status,'READY_FOR_SCHEMA_INITIALIZATION');
 assert.equal(result.versionMajor,18);
 assert.equal(JSON.stringify(result).includes('secret'),false);
 assert.equal(JSON.stringify(result).includes('hostname'),false);
 assert.equal(GoodPool.calls>0,true);
});
test('invalid/missing URLs are rejected before connecting',async()=>{
 for (const value of [undefined,'','http://example','postgresql://username@host/db','postgres://user:pass@host/']) {
  const r=await probeDatabase({url:value??'',PoolClass:GoodPool});
  assert.equal(r.status,'BLOCKED');
 }
});
test('no CREATE privilege or replica blocks schema initialization',async()=>{
 class NoCreate extends GoodPool{async query(){return {rows:[{version_num:180001,can_create_tables:false,is_replica:false}]};}}
 class Replica extends GoodPool{async query(){return {rows:[{version_num:180001,can_create_tables:true,is_replica:true}]};}}
 assert.equal((await probeDatabase({url:uri,PoolClass:NoCreate})).code,'DB_SCHEMA_CREATE_PERMISSION_MISSING');
 assert.equal((await probeDatabase({url:uri,PoolClass:Replica})).code,'DB_READ_ONLY_REPLICA');
});
test('a driver error must not expose secrets in probe result',async()=>{
 class Failing extends GoodPool{async query(){const e=new Error('Secret leak '+uri);e.code='28P01';throw e;}}
 const r=await probeDatabase({url:uri,PoolClass:Failing});
 assert.equal(r.code,'AUTH_FAILED');
 assert.equal(JSON.stringify(r).includes(uri),false);
});
