import test from 'node:test';
import assert from 'node:assert/strict';
import {CASES,requireVerifiedInput,researchSpecialist,VALID_STATUSES}
  from './run-render-indicator-pilot.mjs';

function fixture(symbol,timeframe){
 const step={'15m':900000,'1h':3600000,'4h':14400000}[timeframe];
 const start=Date.UTC(2026,9,1), sha='a'.repeat(64);
 const candles=Array.from({length:480},(_,i)=>{
   const open=100+Math.sin(i/6)*7+i*.01;
   const close=open+Math.sin(i/3)*1.3;
   return {time:start+i*step,open,close,high:Math.max(open,close)+1,
     low:Math.min(open,close)-1,volume:1000+Math.floor(500*Math.sin(i/13)**2)};
 });
 const source={status:'DATA_READY_FOR_RESEARCH_ONLY',
   market:{exchange:'Bitunix',priceType:'LAST_PRICE',symbol,timeframe},
   provenance:{source:'Bitunix public Futures REST',formingBarExcluded:true,
     priceType:'LAST_PRICE',rawSha256:sha},
   historyWindow:{startTime:start,endTime:start+480*step,intervalMs:step},
   acceptedCandles:candles};
 const repeat={status:'STABLE_TWO_READS',checkedDerived:480,
   differenceCount:0,market:{symbol,timeframe,exchange:'Bitunix'},
   historyWindow:source.historyWindow,firstRawSha256:sha,
   overlapRawSha256First:'b'.repeat(64),overlapRawSha256Second:'b'.repeat(64)};
 return {source,repeat};
}
test('both specialists accept only complete same-market closed double reads',()=>{
 const {source,repeat}=fixture('BTCUSDT','1h');
 assert.equal(requireVerifiedInput(source,repeat,{symbol:'BTCUSDT',timeframe:'1h'}).length,480);
 assert.throws(()=>requireVerifiedInput(source,repeat,{symbol:'ETHUSDT',timeframe:'1h'}));
 assert.throws(()=>requireVerifiedInput(source,{...repeat,differenceCount:1},{symbol:'BTCUSDT',timeframe:'1h'}));
 assert.throws(()=>requireVerifiedInput(source,{...repeat,firstRawSha256:'c'.repeat(64)},{symbol:'BTCUSDT',timeframe:'1h'}));
 assert.throws(()=>requireVerifiedInput({...source,acceptedCandles:source.acceptedCandles.slice(1)},repeat,{symbol:'BTCUSDT',timeframe:'1h'}));
});
test('Momentum and SPEED complete nine isolated deterministic research summaries',async()=>{
 const fixtureCache=new Map(CASES.map(c=>[c.symbol+'-'+c.timeframe,fixture(c.symbol,c.timeframe)]));
 const read=async filename=>{
   const name=String(filename).split('/').at(-1);
   const key=name.replace(/-repeatability.json$|.json$/,'');
   const v=fixtureCache.get(key);
   if(!v)throw Error('Unknown synthetic fixture '+name);
   return JSON.stringify(name.endsWith('-repeatability.json')?v.repeat:v.source);
 };
 for(const kind of ['momentum','speed']){
   const r=await researchSpecialist(kind,'/synthetic/in-memory-only',{read});
   assert.equal(r.status,VALID_STATUSES[kind],kind);
   assert.equal(r.passed,9,kind);assert.equal(r.blocked,0,kind);
   assert.equal(r.cases.length,9,kind);
   assert.equal(r.cases.every(c=>c.evidence.sampledPrefixChecks===3),true);
   assert.equal(r.performanceVerified,false);
   assert.equal(r.liveOrders,false);
 }
});
test('missing or forged source blocks an individual case, never fabricates a pass',async()=>{
 const result=await researchSpecialist('speed','/tmp/not-real',{read:async()=>{throw Error('missing')}});
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.passed,0);
 assert.equal(result.blocked,9);
 await assert.rejects(()=>researchSpecialist('unknown','/'));
});
