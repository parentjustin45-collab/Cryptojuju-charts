import test from 'node:test';
import assert from 'node:assert/strict';
import {loadBitunixHistory} from './bitunix-history.mjs';
import {makeBitunixFetchPage} from './bitunix-adapter.mjs';
import {makeCryptoJujuFetchPage} from './cryptojuju-adapter.mjs';
const H=3600000,BASE=Date.UTC(2026,10,10);
const bars=Array.from({length:7},(_,i)=>({time:BASE+i*H,open:String(100+i),high:String(102+i),low:String(99+i),close:String(101+i),baseVol:'1'}));
const requested=[];
function fakeBitunixResponse(url){
 const upstream=new URL(new URL(url).pathname==='/api/bitunix/proxy'?new URL(url).searchParams.get('url'):url);
 assert.equal(upstream.searchParams.has('startTime'),false,'Bitunix no longer accepts startTime');
 assert.equal(upstream.searchParams.get('interval'),'1h');
 const end=Number(upstream.searchParams.get('endTime')),limit=Number(upstream.searchParams.get('limit'));
 requested.push({end,limit});
 const data=bars.filter(x=>x.time<end).slice(-limit).reverse();
 return {ok:true,json:async()=>({code:0,data})};
}
async function checkPaging(fetchPage){
 requested.length=0;
 const result=await loadBitunixHistory({symbol:'BTCUSDT',interval:'1h',startTime:BASE,endTime:BASE+5*H,intervalMs:H,limit:2,fetchPage,maxPages:10});
 assert.deepEqual(result.candles.map(b=>b.time),[BASE,BASE+H,BASE+2*H,BASE+3*H,BASE+4*H]);
 assert.equal(result.quality.gaps.length,0);
 assert.equal(result.quality.pages,3);
 assert.deepEqual(requested.map(x=>x.end),[BASE+2*H,BASE+4*H,BASE+5*H],'fetch each historical page forward, despite API backward semantics');
 assert.deepEqual(requested.map(x=>x.limit),[2,2,2]);
}
test('official Bitunix REST adapter correctly pages historic 1h bars',async()=>{
 await checkPaging(makeBitunixFetchPage({fetchImpl:fakeBitunixResponse}));
});
test('CryptoJuju proxy correctly pages historic Bitunix 1h bars',async()=>{
 await checkPaging(makeCryptoJujuFetchPage({fetchImpl:fakeBitunixResponse}));
});
