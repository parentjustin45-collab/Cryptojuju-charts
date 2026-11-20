import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateCjCipherWaveTrend,cjCipherConfirmedCommands,
 CJ_CIPHER_WT_V1_DEFAULTS} from './cj-cipher-wavetrend-v1.mjs';

const H=3600000,T=Date.UTC(2026,10,1);
const candle=(i,price)=>({time:T+i*H,open:price,
  high:price+1,low:price-1,close:price,volume:100+i});
const fixed=prices=>prices.map((p,i)=>candle(i,p));
const wave=(n=400)=>fixed(Array.from({length:n},(_,i)=>
  100+0.018*i+5*Math.sin(i*.14)+2*Math.sin(i*.041)));
test('Pine v6 original WaveTrend inputs preserved and without divergences',()=>{
 assert.deepEqual(CJ_CIPHER_WT_V1_DEFAULTS,{
  channelLength:10,averageLength:21,signalSmoothing:4,
  overbought1:60,overbought2:53,oversold1:-60,oversold2:-53,
  confirmClose:true,showDots:true,showDelta:true
 });
 const rows=calculateCjCipherWaveTrend(wave());
 assert.ok(rows.every(x=>!Object.hasOwn(x,'divergences')));
 assert.ok(rows.every(x=>x.confirmedAtClose===true));
 assert.ok(rows.every(x=>x.levels.ob1===60&&x.levels.os1===-60));
});
test('Pine EMA starts on first valid HLC3 and zero deviation maps CI=0',()=>{
 const prices=[100,110,90,120];
 const xs=calculateCjCipherWaveTrend(fixed(prices),{
   channelLength:2,averageLength:1,signalSmoothing:2
 });
 assert.equal(xs[0].esa,100);
 assert.equal(xs[0].deviation,0);
 assert.equal(xs[0].ci,0);
 assert.equal(xs[0].wt1,0);
 assert.equal(xs[0].wt2,null);
 assert.ok(Math.abs(xs[1].esa-106.66666666666667)<1e-8);
 assert.ok(Math.abs(xs[1].ci-100)<1e-8);
 assert.equal(xs[1].crossUp,false,'no cross before WT2 has a previous value');
 assert.equal(xs[2].bearSignal,true);
 assert.equal(xs[3].bullSignal,true);
 assert.equal(xs[2].signal,'short');
 assert.equal(xs[3].signal,'long');
});
test('fully flat OHLC has no fabricated oscillator entries or divide-by-zero',()=>{
 const xs=calculateCjCipherWaveTrend(fixed(Array(180).fill(100)));
 assert.ok(xs.every(x=>x.wt1===0&&x.ci===0));
 assert.ok(xs.every(x=>!x.bullSignal&&!x.bearSignal));
 assert.equal(cjCipherConfirmedCommands(xs).length,0);
});
test('visual settings and level lines do not alter WT cross decisions',()=>{
 const c=wave(),a=calculateCjCipherWaveTrend(c);
 const b=calculateCjCipherWaveTrend(c,{
   showDots:false,showDelta:false,
   overbought1:80,overbought2:75,oversold1:-80,oversold2:-75
 });
 for(let i=0;i<a.length;i++){
  assert.equal(a[i].wt1,b[i].wt1);
  assert.equal(a[i].wt2,b[i].wt2);
  assert.equal(a[i].signal,b[i].signal);
  assert.equal(b[i].displayWaveDifference,null);
  assert.equal(b[i].dotValue,null);
 }
 assert.ok(a.some(x=>x.dotColor==='lime'));
 assert.ok(a.some(x=>x.dotColor==='red'));
});
test('confirmClose=false cannot fabricate historical intrabar ticks or alerts',()=>{
 const c=wave();
 const a=calculateCjCipherWaveTrend(c);
 const b=calculateCjCipherWaveTrend(c,{confirmClose:false});
 assert.deepEqual(a.map(x=>x.signal),b.map(x=>x.signal));
 assert.ok(b.every(x=>x.historicalIntrabarAlertsNotReconstructed));
 assert.ok(a.every(x=>!x.historicalIntrabarAlertsNotReconstructed));
});
test('future candles cannot change earlier WT1 WT2 or cross on completed bars',()=>{
 const c=wave(450);
 const before=calculateCjCipherWaveTrend(c);
 const after=calculateCjCipherWaveTrend(c.map((x,i)=>i<350?{...x}:{
  ...x,open:170,high:180,low:160,close:175
 }));
 assert.deepEqual(before.slice(0,350),after.slice(0,350));
});
test('commands are stamped at the confirmed signal bar and final bar is never executed',()=>{
 const a=calculateCjCipherWaveTrend(wave());
 const commands=cjCipherConfirmedCommands(a);
 assert.ok(commands.length>5);
 const map=new Map(a.map(x=>[x.time,x]));
 assert.ok(commands.every(x=>map.get(x.time).signal===x.side));
 assert.ok(commands.every(x=>x.time<a.at(-1).time));
 assert.ok(commands.every(x=>x.time+H<=a.at(-1).time));
 assert.ok(commands.every(x=>['long','short'].includes(x.side)));
});
test('bad OHLC, unsupported settings or duplicate outputs must block',()=>{
 const c=wave();
 const broken=c.map(x=>({...x}));broken[18].low=broken[18].high+1;
 assert.throws(()=>calculateCjCipherWaveTrend(broken),/Invalid or unordered/);
 assert.throws(()=>calculateCjCipherWaveTrend(c,{signalSmoothing:0}),/Invalid CJ Cipher WaveTrend length/);
 assert.throws(()=>calculateCjCipherWaveTrend(c,{confirmClose:'yes'}),/Invalid CJ Cipher boolean/);
 assert.throws(()=>calculateCjCipherWaveTrend(c,{n1:10}),/Unknown CJ Cipher input/);
 const out=calculateCjCipherWaveTrend(c);
 out[37].time=out[36].time;
 assert.throws(()=>cjCipherConfirmedCommands(out),/Duplicate or invalid/);
});
