import test from 'node:test';
import assert from 'node:assert/strict';
import {readBitunixContractPrecision} from './bitunix-contract-precision.mjs';
const records=[
 {symbol:'BTCUSDT',symbolStatus:'OPEN',quotePrecision:1},
 {symbol:'ETHUSDT',symbolStatus:'OPEN',quotePrecision:2},
 {symbol:'SOLUSDT',symbolStatus:'OPEN',quotePrecision:2}
];
const fetchResponse=body=>async (url,options)=>{
 assert.match(url,/^https:\/\/fapi\.bitunix\.com\/api\/v1\/futures\/market\/trading_pairs\?/);
 assert.equal(options.method,'GET');
 return {ok:true,json:async()=>body};
};
test('official contract precision is explicit and never advertised as TV mintick parity',async()=>{
 const r=await readBitunixContractPrecision({fetchImpl:fetchResponse({code:0,data:records})});
 assert.equal(r.status,'BITUNIX_PUBLIC_PRECISION_RECEIVED');
 assert.deepEqual(r.contracts.map(x=>x.priceStep),[0.1,0.01,0.01]);
 assert.equal(r.tradingViewMintickVerified,false);
 assert.ok(r.contracts.every(x=>x.stepStatus==='RESEARCH_PRICE_PRECISION_NOT_TV_MINTICK'));
});
test('missing/closed contracts or invalid price precision fail closed',async()=>{
 await assert.rejects(readBitunixContractPrecision({fetchImpl:fetchResponse({code:0,data:records.slice(1)})}),/Missing/);
 await assert.rejects(readBitunixContractPrecision({fetchImpl:fetchResponse({code:0,data:records.map(x=>({...x,symbolStatus:'STOP'}))})}),/not OPEN/);
 await assert.rejects(readBitunixContractPrecision({fetchImpl:fetchResponse({code:0,data:[{...records[0],quotePrecision:'bad'},...records.slice(1)]})}),/quotePrecision/);
 await assert.rejects(readBitunixContractPrecision({fetchImpl:fetchResponse({code:401,data:records})}),/Invalid/);
});
