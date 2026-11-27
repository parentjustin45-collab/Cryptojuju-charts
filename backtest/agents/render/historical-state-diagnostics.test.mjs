import test from 'node:test';import assert from 'node:assert/strict';
import {traceVector} from './state-vector-trace.mjs';import {traceFrank} from './state-frank-trace.mjs';
import {vectorAIT} from '../../vector-ait-v1.mjs';import {calculateFrankTestV22} from '../frank-test-v22-research.mjs';
import {studySignals as original,CHANNELS} from './historical-pivot-diagnostics.mjs';
import {studySignals as observed} from './state-pivot-observer.mjs';
import {analyzeState} from './historical-state-diagnostics.mjs';
import {calculateMomentumFusion} from '../../momentum-fusion-v1.mjs';import {classifySpeedCandleV3} from '../../speed-candle-v3.mjs';import {calculateCjCipherWaveTrend} from '../cj-cipher-wavetrend-v1.mjs';
const bars=Array.from({length:600},(_,i)=>{const c=100+10*Math.sin(i*Math.PI/20)+Math.sin(i*1.9),o=c+Math.sin(i*2);return {time:Date.UTC(2025,0,1)+i*900000,open:o,close:c,high:Math.max(c,o)+1,low:Math.min(c,o)-1,volume:10+i%23*5};});
test('traces preserve entire baseline output',()=>{assert.deepEqual(traceVector(bars,{minTick:.01}).map(({trace,...x})=>x),vectorAIT(bars,{minTick:.01}));const {trace,...f}=traceFrank(bars);assert.deepEqual(f,calculateFrankTestV22(bars));});
test('full event parity, training labels and feature counts',()=>{
 const ev=(time,side,tag)=>({time,side,tag});const v=vectorAIT(bars,{minTick:.01}),m=calculateMomentumFusion(bars),s=classifySpeedCandleV3(bars,{minTick:.01}),c=calculateCjCipherWaveTrend(bars),f=calculateFrankTestV22(bars);
 const signals={vector:v.filter(x=>x.signal).map(x=>ev(x.time,x.signal,'vector_v11')),momentum:m.filter(x=>x.bullSignal||x.bearSignal).map(x=>ev(x.time,x.bullSignal?'long':'short','momentum_fusion')),speed:s.filter(x=>x.color).map(x=>ev(x.time,x.color.startsWith('bull')?'long':'short',x.color)),cipher:c.filter(x=>x.signal).map(x=>ev(x.time,x.signal,'cj_cipher_wt')),frank_cross:[...f.buy,...f.sell].map(x=>ev(x.confirmedAt,x.side,'frank_cross_webapp')),frank_divergence:f.divergences.map(x=>ev(x.confirmationTime,x.type.endsWith('+')?'long':'short',x.type))};
 const report={priceStep:.01,indicators:Object.fromEntries(CHANNELS.map(k=>[k,{signals:signals[k].sort((a,b)=>a.time-b.time)}]))};
 const prior=original(bars,report.indicators,420);assert.deepEqual(observed(bars,report.indicators,420),prior);
 const z=analyzeState(bars,report,prior);assert.equal(Object.keys(z).length,6);
 for(const k of CHANNELS){assert.equal(z[k].events,signals[k].length);for(const x of Object.values(z[k].samples))assert.ok(x.time<bars[420].time);}
 report.indicators.cipher.signals.pop();assert.throws(()=>analyzeState(bars,report,prior),/PARITY/);
});
