import test from 'node:test';
import assert from 'node:assert/strict';
import {runDueCycle,parseAllowedSpecialists} from './render/supervisor.mjs';
function fakeLedger(){
  const rows=new Map();
  return {rows,async query(sql,parameters){
    const slot=parameters?.[1]??parameters?.[0];
    if(sql.startsWith('INSERT INTO')){
      const key=parameters[0]+'|'+parameters[1];
      if(rows.has(key))return {rowCount:0,rows:[]};
      rows.set(key,{agent:parameters[0],slot:parameters[1],status:'RUNNING'});
      return {rowCount:1,rows:[{agent:parameters[0]}]};
    }
    if(sql.startsWith('UPDATE cj_agent_runs')){
      const key=parameters[0]+'|'+parameters[1];
      const previous=rows.get(key);
      rows.set(key,{...previous,status:parameters[2],exit_code:parameters[3],
        evidence:JSON.parse(parameters[4])});
      return {rowCount:1,rows:[]};
    }
    if(sql.includes("agent='bitunix-data'")){
      return {rows:[rows.get('bitunix-data|'+parameters[0])].filter(Boolean)};
    }
    if(sql.startsWith('SELECT agent,status,exit_code')){
      return {rows:[...rows.values()].filter(r=>r.slot===parameters[0]&&r.agent!=='diagnostics')};
    }
    throw Error('Unexpected SQL in test: '+sql);
  }};
}
test('all six are recorded once in PostgreSQL ledger without subprocesses in test',async()=>{
  const db=fakeLedger(),calls=[];
  const executor=async agent=>{
    calls.push(agent.id);
    return {status:agent.id==='bitunix-data'?'DATA_READY_FOR_RESEARCH_ONLY':'EXECUTED_RESEARCH_ONLY',
      evidence:{testFixture:true}};
  };
  const now=new Date('2026-11-22T15:58:00Z');
  const allowedIds=['bitunix-data','vector','momentum','speed','cipher','diagnostics'];
  const first=await runDueCycle(db,now,{executor,allowedIds,sourceFilesReady:async()=>true});
  assert.equal(first.completed.length,6);
  assert.equal(calls.length,5);
  assert.equal(db.rows.get('diagnostics|'+first.slot).evidence.automaticCodeChanges,false);
  const second=await runDueCycle(db,now,{executor,allowedIds,sourceFilesReady:async()=>true});
  assert.equal(second.completed.length,0);
  assert.equal(db.rows.size,6);
});
test('Vector refuses to run without passing exact current-hour Bitunix gate',async()=>{
  const db=fakeLedger(),calls=[];
  const result=await runDueCycle(db,new Date('2026-11-22T15:15:00Z'),{
    allowedIds:['bitunix-data','vector'],
    executor:async a=>{
      calls.push(a.id);
      return {status:'BLOCKED',evidence:{reason:'MOCK_DATA_FAILED'}};
    }
  });
  assert.deepEqual(calls,['bitunix-data']);
  const vector=db.rows.get('vector|'+result.slot);
  assert.equal(vector.status,'BLOCKED');
  assert.equal(vector.evidence.reason,'DEPENDENCY_BITUNIX_DATA_NOT_READY');
});

test('runtime defaults to no research and refuses unrecognized allowlist values',async()=>{
 const db=fakeLedger();
 const calls=[];
 const executor=async a=>{calls.push(a.id);return {status:'EXECUTED_RESEARCH_ONLY',evidence:{}}};
 const result=await runDueCycle(db,new Date('2026-11-22T15:58:00Z'),{executor});
 assert.deepEqual(result.completed,[]);
 assert.deepEqual(calls,[]);
 assert.deepEqual(parseAllowedSpecialists('bitunix-data'),['bitunix-data']);
 assert.deepEqual(parseAllowedSpecialists(''),[]);
 assert.throws(()=>parseAllowedSpecialists('bitunix-data,invalid'));
 assert.throws(()=>parseAllowedSpecialists('bitunix-data,bitunix-data'));
 const gated=await runDueCycle(db,new Date('2026-11-22T15:58:00Z'),{
  executor,allowedIds:['bitunix-data']});
 assert.deepEqual(gated.completed.map(x=>x.agent),['bitunix-data']);
 assert.deepEqual(calls,['bitunix-data']);
 assert.equal(db.rows.size,1);
});

test('Vector rehydrates absent disk data only through an accepted fresh Bitunix check',async()=>{
  const db=fakeLedger(),called=[];
  const executor=async agent=>{
    called.push(agent.id);
    return agent.id==='bitunix-data'
      ? {status:'DATA_READY_FOR_RESEARCH_ONLY',
         evidence:{checks:[{symbol:'BTCUSDT',timeframe:'1h',sha256:'a'.repeat(64),status:'DATA_READY_FOR_RESEARCH_ONLY'}]}}
      : {status:'EXECUTED_RESEARCH_ONLY',evidence:{summary:{cases:9,passed:9}}};
  };
  const res=await runDueCycle(db,new Date('2026-11-22T15:58:00Z'),{
    executor,allowedIds:['bitunix-data','vector'],sourceFilesReady:async()=>false
  });
  assert.deepEqual(called,['bitunix-data','bitunix-data','vector']);
  assert.equal(db.rows.get('vector|'+res.slot).status,'EXECUTED_RESEARCH_ONLY');
  assert.equal(db.rows.get('vector|'+res.slot).evidence.sourceRehydrated,true);
  assert.equal(res.completed.find(x=>x.agent==='vector').sourceRehydrated,true);
});
test('Vector rejects failed data refresh without proceeding to Vector itself',async()=>{
  const db=fakeLedger(),called=[];
  const executor=async agent=>{
    called.push(agent.id);
    return {status:called.length===1?'DATA_READY_FOR_RESEARCH_ONLY':'BLOCKED',evidence:{}};
  };
  const res=await runDueCycle(db,new Date('2026-11-22T15:58:00Z'),{
    executor,allowedIds:['bitunix-data','vector'],sourceFilesReady:async()=>false
  });
  assert.deepEqual(called,['bitunix-data','bitunix-data']);
  const vector=db.rows.get('vector|'+res.slot);
  assert.equal(vector.status,'BLOCKED');
  assert.equal(vector.evidence.reason,'RESEARCH_INPUT_REHYDRATION_FAILED');
});

test('Momentum and SPEED cannot start without accepted exact-hour data',async()=>{
 const db=fakeLedger(),calls=[];
 const result=await runDueCycle(db,new Date('2026-11-22T15:58:00Z'),{
  allowedIds:['bitunix-data','momentum','speed'],
  executor:async a=>{calls.push(a.id);return {status:'BLOCKED',evidence:{}};},
  sourceFilesReady:async()=>false
 });
 assert.deepEqual(calls,['bitunix-data']);
 for(const id of ['momentum','speed']){
  const row=db.rows.get(id+'|'+result.slot);
  assert.equal(row.status,'BLOCKED');
  assert.equal(row.evidence.reason,'DEPENDENCY_BITUNIX_DATA_NOT_READY');
 }
});
