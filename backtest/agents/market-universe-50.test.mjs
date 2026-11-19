import test from 'node:test';
import assert from 'node:assert/strict';
import {GROUPS,readCryptoJujuWatchlist,chooseResearch50,
 fetchOpenContractMetadata,renderAdmissionReport} from './market-universe-50.mjs';
const candidates=[...new Set(GROUPS.flatMap(g=>[...g.names,...g.reserve]))];
const siteRows=candidates.map(symbol=>({symbol,tv:symbol+'.P',label:symbol+'.P'}));
const html='const WATCHLIST='+JSON.stringify([...siteRows,siteRows[0],siteRows[1]])+';';
const watchlist=readCryptoJujuWatchlist(html);
const meta=candidates.map(symbol=>({symbol,quotePrecision:4,symbolStatus:'OPEN'}));
test('read 667-style watchlist without hiding duplicates',()=>{
 assert.equal(watchlist.total,candidates.length+2);
 assert.equal(watchlist.unique,candidates.length);
 assert.equal(watchlist.duplicates,2);
 assert.throws(()=>readCryptoJujuWatchlist('const NOT_LIST=[];'),/unavailable/);
});
test('choose 50 candidate markets in five explicit asset buckets',()=>{
 const r=chooseResearch50(watchlist,meta);
 assert.equal(r.status,'TARGET_50_OPEN_CONTRACTS_FOUND');
 assert.equal(r.selectedCount,50);
 assert.equal(new Set(r.admitted.map(x=>x.symbol)).size,50);
 assert.deepEqual(r.groups.map(x=>x.selected),[10,12,12,6,10]);
 assert.equal(r.historyValidated,false);
 assert.equal(r.backtestsPerformed,false);
 assert.equal(r.forexStatus,'NO_DIRECT_FOREX_PAIR_IN_SITE_WATCHLIST');
});
test('closed or unlisted products remain explicitly unavailable',()=>{
 const bad=new Set(['XRPUSDT','XAUUSDT','TRUMPUSDT','TSLAUSDT']);
 const modified=meta.map(x=>bad.has(x.symbol)?{...x,symbolStatus:'STOP'}:x);
 const r=chooseResearch50(watchlist,modified);
 assert.equal(r.status,'PARTIAL_NOT_50');
 assert.equal(r.selectedCount,49);
 assert.equal(r.groups.find(x=>x.group==='metal_energy_linked').shortfall,1);
 assert.ok(r.unavailable.some(x=>x.symbol==='XAUUSDT'));
 assert.ok(r.admitted.every(x=>!bad.has(x.symbol)));
});
test('do not add invented exchange instruments absent from site list',()=>{
 const r=chooseResearch50(watchlist,[...meta,{
  symbol:'FAKEUSDT',quotePrecision:2,symbolStatus:'OPEN'}]);
 assert.equal(r.selectedCount,50);
 assert.ok(!r.admitted.some(x=>x.symbol==='FAKEUSDT'));
});
test('invalid or duplicated active metadata fails closed',()=>{
 assert.throws(()=>chooseResearch50(watchlist,[...meta,meta[0]]),/Duplicate/);
 assert.throws(()=>chooseResearch50({symbols:null},meta),/No verified/);
});
test('public metadata is GET-only, and invalid code rejected',async()=>{
 const calls=[];
 const fetchImpl=async(url,opts)=>{calls.push({url,method:opts.method});
  return {ok:true,json:async()=>({code:0,data:meta})};};
 assert.equal((await fetchOpenContractMetadata(fetchImpl)).length,meta.length);
 assert.match(calls[0].url,/market\/trading_pairs$/);
 assert.equal(calls[0].method,'GET');
 await assert.rejects(fetchOpenContractMetadata(async()=>({
  ok:true,json:async()=>({code:401,data:meta})})),/Invalid/);
});
test('report is metadata-only, not evidence of trading backtests',()=>{
 const text=renderAdmissionReport(chooseResearch50(watchlist,meta));
 assert.match(text,/50 \/ 50/);
 assert.match(text,/NON TESTÉ/);
 assert.match(text,/aucun backtest/);
});
