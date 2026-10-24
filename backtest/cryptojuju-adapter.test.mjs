import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCryptoJujuFetchPage} from './cryptojuju-adapter.mjs';
test('proxy uses verified route and preserves requested historical window',async()=>{
 let target;
 const fetchPage=makeCryptoJujuFetchPage({fetchImpl:async url=>{target=new URL(url);return {ok:true,json:async()=>({code:0,data:[{time:'1792854000000',open:'100',high:'101',low:'99',close:'100',baseVol:'4'}]})};}});
 const rows=await fetchPage({symbol:'BTCUSDT',interval:'15m',startTime:1792681200000,endTime:1792854000000,limit:200});
 assert.equal(target.pathname,'/api/bitunix/proxy');
 const upstream=new URL(target.searchParams.get('url'));
 assert.equal(upstream.origin,'https://fapi.bitunix.com');
 assert.equal(upstream.searchParams.get('startTime'),'1792681200000');
 assert.equal(upstream.searchParams.get('endTime'),'1792854000000');
 assert.equal(rows[0].volume,'4');
});
test('proxy rejects unsafe symbol and bad time range',async()=>{
 const page=makeCryptoJujuFetchPage({fetchImpl:async()=>{throw Error('must not call')}});
 await assert.rejects(page({symbol:'BTCUSDT&evil',interval:'15m',startTime:1,endTime:2}),/Invalid symbol/);
 await assert.rejects(page({symbol:'BTCUSDT',interval:'15m',startTime:2,endTime:1}),/Invalid range/);
});
