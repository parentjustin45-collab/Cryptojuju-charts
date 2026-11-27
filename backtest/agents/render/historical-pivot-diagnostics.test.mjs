import test from 'node:test';
import assert from 'node:assert/strict';
import {studySignals,CHANNELS,findPivots} from './historical-pivot-diagnostics.mjs';
const bars=Array.from({length:180},(_,i)=>{const c=100+10*Math.sin(i*Math.PI/20);return {time:i*900000,open:c,close:c,high:c+.1,low:c-.1,volume:1};});
const empty=()=>Object.fromEntries(CHANNELS.map(k=>[k,{signals:[]}]));
test('strict extrema require both sides and never cross a phase',()=>{
 const p=findPivots(bars,bars.map(()=>1),0,90);
 assert.ok(p.length>=2);assert.ok(p.every(x=>x.index>=15&&x.index<75));
 assert.ok(p.some(x=>x.side==='short')&&p.some(x=>x.side==='long'));
});
test('every event and every pivot reconciles, duplicate signals cannot inflate matches',()=>{
 const x=empty();
 x.vector.signals=[{time:bars[30].time,side:'long'},{time:bars[30].time,side:'long'},{time:bars[31].time,side:'long'},{time:bars[89].time,side:'short'},{time:bars[130].time,side:'short'}];
 const r=studySignals(bars,x,90),s=r.training.channels.vector;
 assert.equal(s.events,4);assert.equal(s.edgeExcluded,1);assert.equal(s.eligible,3);
 assert.equal(s.onPivot,1);assert.equal(s.redundant,2);assert.equal(s.missed,s.pivots-1);
 assert.equal(r.holdout.channels.vector.events,1);assert.equal(r.training.channels.cipher.missed,r.training.pivots);
});
test('early and late are retrospective; signal without matching pivot remains separate',()=>{
 const x=empty();
 x.vector.signals=[{time:bars[28].time,side:'long'},{time:bars[51].time,side:'short'},{time:bars[40].time,side:'long'}];
 const s=studySignals(bars,x,90).training.channels.vector;
 assert.equal(s.early,1);assert.equal(s.late,1);assert.equal(s.outsidePivot,1);
 assert.equal(s.forwardSamples,3);
});
test('flat series produces no false pivot and no eligible zero-ATR events',()=>{
 const flat=bars.map(x=>({...x,open:100,high:100,low:100,close:100}));
 const x=empty();x.speed.signals=[{time:flat[30].time,side:'long'}];
 const s=studySignals(flat,x,90).training.channels.speed;assert.equal(s.pivots,0);assert.equal(s.edgeExcluded,1);
});
