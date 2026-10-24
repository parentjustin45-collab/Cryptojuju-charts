import test from 'node:test';
import assert from 'node:assert/strict';
import {speedColorScenarios} from './speed-color-scenarios.mjs';
test('four colors are separated into directional and unconfirmed reversal hypotheses',()=>{
 const r=speedColorScenarios([
  {time:1,color:'green',closed:true},{time:2,color:'red',closed:true},
  {time:3,color:'blue',closed:true},{time:4,color:'pink',closed:true}
 ]);
 assert.deepEqual(r.directional.map(x=>x.side),['long','short']);
 assert.deepEqual(r.earlyReversal.map(x=>x.side),['long','short']);
 assert.equal(r.combined.length,4);
 assert.equal(r.reversalAlerts[0].confirmed,false);
 assert.equal(r.reversalAlerts[0].lookaheadBars,5);
});
test('rejects unclosed, unknown or duplicate candle colors',()=>{
 assert.throws(()=>speedColorScenarios([{time:1,color:'blue',closed:false}]));
 assert.throws(()=>speedColorScenarios([{time:1,color:'bullHigh',closed:true}]));
 assert.throws(()=>speedColorScenarios([{time:1,color:'red',closed:true},{time:1,color:'pink',closed:true}]));
});
