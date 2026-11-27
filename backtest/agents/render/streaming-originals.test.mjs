import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createStreamingReplay,CHANNELS} from './streaming-originals.mjs';
import {streamVerifiedPeriod} from './streaming-period.mjs';
import {generateFrozen} from './prospective-validation.mjs';
import {vectorAIT} from '../../vector-ait-v1.mjs';import {classifySpeedCandleV3} from '../../speed-candle-v3.mjs';import {calculateMomentumFusion} from '../../momentum-fusion-v1.mjs';import {calculateCjCipherWaveTrend} from '../cj-cipher-wavetrend-v1.mjs';import {calculateFrankTestV22} from '../frank-test-v22-research.mjs';
const start=Date.UTC(2021,10,24),step=900000,tick=.01;
function bars(n){return Array.from({length:n},(_,i)=>{const c=i<160?100:100+10*Math.sin(i*Math.PI/20)+Math.sin(i*1.9),o=i<160?100:c+Math.sin(i*2);return {time:start+i*step,open:o,close:c,high:Math.max(o,c)+1,low:Math.min(o,c)-1,volume:i%211===0?0:10+i%23*5};});}
const digest=events=>{const h=createHash('sha256');for(const e of events)h.update(JSON.stringify(e)+'\n');return h.digest('hex');};
test('exact internal numeric state and original events across irregular pages, flat warmup',()=>{
 const a=bars(5000),v=vectorAIT(a,{minTick:tick}),s=classifySpeedCandleV3(a,{minTick:tick}),m=calculateMomentumFusion(a),c=calculateCjCipherWaveTrend(a),f=calculateFrankTestV22(a),events=Object.fromEntries(CHANNELS.map(k=>[k,[]]));
 const stream=createStreamingReplay({priceStep:tick,intervalMs:step});let i=0;
 for(let p=0;p<a.length;){const n=[1,7,19,100,481][p%5];stream.consumePage(a.slice(p,p+n),x=>{
  assert.deepEqual(x.vector,v[i]);assert.deepEqual(x.speed,s[i]);
  for(const [k,y] of Object.entries(x.momentum))assert.equal(y,m[i][k],k+' '+i);
  for(const [k,y] of Object.entries(x.cipher))assert.equal(y,c[i][k],k+' '+i);
  for(const [k,y] of Object.entries(x.frank))assert.equal(y,Number.isNaN(f[k][i])?null:f[k][i],k+' '+i);
  for(const ch of CHANNELS)events[ch].push(...x.events[ch]);i++;
 });p+=n;}
 const z=stream.finish();assert.equal(z.bars,a.length);
 for(const ch of CHANNELS){const expected=generateFrozen(ch,'original',a,tick).signals;assert.deepEqual(events[ch],expected,ch);assert.equal(z.eventSha256[ch],digest(expected));}
});
test('175296 bars, exact events vs original full-array implementation, two page layouts',()=>{
 const a=bars(175296),one=createStreamingReplay({priceStep:tick,intervalMs:step}),two=createStreamingReplay({priceStep:tick,intervalMs:step});
 for(let p=0;p<a.length;p+=2000)one.consumePage(a.slice(p,p+2000));
 for(let p=0;p<a.length;p+=7919)two.consumePage(a.slice(p,p+7919));
 const x=one.finish(),y=two.finish();assert.deepEqual(x,y);assert.equal(x.bars,175296);assert.equal(x.stateWindowSizes.momentum,100);
 for(const ch of CHANNELS){const expected=generateFrozen(ch,'original',a,tick).signals;assert.equal(x.counts[ch],expected.length,ch);assert.equal(x.eventSha256[ch],digest(expected),ch);}
 console.log('CJ_STREAM_LONG_PASS '+JSON.stringify(x));
});
test('source-specific SQL hashes and fail-closed gaps',async()=>{
 const a=bars(260),symbol='BTCUSDT',timeframe='15m';
 const mk=exchange=>({query:async(sql,args)=>{assert.ok(sql.includes(exchange==='Binance'?'cj_binance_um_candles':'cj_historical_candles'));return {rows:a.filter(b=>b.time>=args[2]&&b.time<args[3]).slice(0,args[4]).map(b=>({open_ms:b.time,open_price:b.open,high_price:b.high,low_price:b.low,close_price:b.close,volume:b.volume,fingerprint:createHash('sha256').update(JSON.stringify([...(exchange==='Binance'?['BINANCE_UM']:[]),symbol,timeframe,b.time,b.open,b.high,b.low,b.close,b.volume])).digest('hex')}))};}});
 const opts={symbol,timeframe,startMs:start,endMs:start+260*step,priceStep:tick,pageSize:100};
 const x=await streamVerifiedPeriod(mk('Bitunix'),{...opts,exchange:'Bitunix'}),y=await streamVerifiedPeriod(mk('Binance'),{...opts,exchange:'Binance'});assert.equal(x.pages,3);assert.deepEqual(x.eventSha256,y.eventSha256);assert.notEqual(x.sequenceSha256,y.sequenceSha256);
 await assert.rejects(()=>streamVerifiedPeriod(mk('Bitunix'),{...opts,exchange:'Bitunix',endMs:start+261*step}),/SOURCE_GAP/);
 const z=createStreamingReplay({priceStep:tick,intervalMs:step});z.consume(a[0]);assert.throws(()=>z.consume(a[2]),/NONCONTIGUOUS/);
});
