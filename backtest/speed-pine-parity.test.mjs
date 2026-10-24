import test from 'node:test';
import assert from 'node:assert/strict';
import {classifySpeedCandleV3} from './speed-candle-v3.mjs';
import {speedClassificationsToColorEvents,speedColorScenarios} from './speed-color-scenarios.mjs';
// Independent reference translation of Pine V3 default raw conditions.
// EMA, sweep, context and follow-through filters are OFF by default.
function pineReference(rows,minTick){
 return rows.map((c,i)=>{
  const sample=rows.slice(i-19,i+1);
  const volumeSma=i>=19?sample.reduce((n,x)=>n+x.volume,0)/20:null;
  const rangeSma=i>=19?sample.reduce((n,x)=>n+x.high-x.low,0)/20:null;
  const vp=c.volume/Math.max(volumeSma??c.volume,1)*100;
  const range=Math.max(c.high-c.low,minTick);
  const sp=range/Math.max(rangeSma??range,minTick)*100;
  const bull=c.close>c.open,bear=c.close<c.open;
  const high=vp>=200,mid=vp>=150;
  const color=bull&&high?'bullHigh':bear&&high?'bearHigh':bull&&mid&&!high?'bullMid':bear&&mid&&!high?'bearMid':null;
  return {color,volumePercent:vp,speedPercent:sp};
 });
}
const bar=(i,volume=100,up=true)=>({time:i*900000,open:100,close:up?101:99,high:102,low:98,volume});
test('Pine default parity: all four classifications and exact metrics',()=>{
 const rows=Array.from({length:40},(_,i)=>bar(i));
 rows[25]=bar(25,250,true);rows[26]=bar(26,250,false);
 rows[27]=bar(27,180,true);rows[28]=bar(28,190,false);
 const expected=pineReference(rows,0.1),actual=classifySpeedCandleV3(rows,{minTick:0.1});
 for(let i=0;i<rows.length;i++){
  assert.equal(actual[i].color,expected[i].color,'classification at '+i);
  assert.ok(Math.abs(actual[i].volumePercent-expected[i].volumePercent)<1e-9,'volume at '+i);
  assert.ok(Math.abs(actual[i].speedPercent-expected[i].speedPercent)<1e-9,'speed at '+i);
 }
 const events=speedClassificationsToColorEvents(actual);
 const scenarios=speedColorScenarios(events);
 assert.deepEqual(events.map(e=>e.color),['green','red','blue','pink']);
 assert.deepEqual(scenarios.directional.map(e=>e.side),['long','short']);
 assert.deepEqual(scenarios.earlyReversal.map(e=>e.side),['long','short']);
});
test('Pine syminfo.mintick applies to zero-range candles',()=>{
 const rows=Array.from({length:20},(_,i)=>({time:i*900000,open:100,high:100,low:100,close:100,volume:100}));
 const result=classifySpeedCandleV3(rows,{minTick:0.01});
 assert.equal(result[19].speedPercent,100);
 assert.deepEqual(result.map(x=>x.color).filter(Boolean),[]);
 assert.throws(()=>classifySpeedCandleV3(rows,{minTick:0}),/minTick/);
});
test('prefix stability after SMA warmup and exact threshold priority',()=>{
 const rows=Array.from({length:45},(_,i)=>bar(i,i===30?300:100));
 const full=classifySpeedCandleV3(rows,{minTick:0.1});
 assert.deepEqual(full.slice(0,31),classifySpeedCandleV3(rows.slice(0,31),{minTick:0.1}));
});
