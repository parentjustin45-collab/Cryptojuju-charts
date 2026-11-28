import test from 'node:test';
import assert from 'node:assert/strict';
import {buildConfluences,studyConfluence} from './level6-confluence.mjs';
import {generate} from './autonomous-rule-candidates.mjs';
import {CHANNELS} from './state-pivot-observer.mjs';
const empty=()=>Object.fromEntries(CHANNELS.map(c=>[c,[]]));
const makeBars=n=>Array.from({length:n},(_,i)=>{const open=100+Math.sin(i/7)*10+i*.03,close=open+Math.sin(i/3)*2;return {time:1700000000000+i*86400000,open,close,high:Math.max(open,close)+1,low:Math.min(open,close)-1,volume:100+(i%17)*10};});
const evt=(bars,i,side='long')=>({time:bars[i].time,side,tag:'fixture'});
test('Frank is one vote, quorum fires only at the confirming closed candle and rearms after expiry',()=>{
 const bars=makeBars(12),e=empty();
 e.frank_cross=[evt(bars,1)];e.frank_divergence=[evt(bars,1)];
 e.momentum=[evt(bars,2),evt(bars,3),evt(bars,8)];e.cipher=[evt(bars,3),evt(bars,9)];
 const r=buildConfluences(bars,e);
 assert.deepEqual(r.quorum2.map(x=>x.time),[bars[2].time,bars[9].time]);
 assert.deepEqual(r.quorum3.map(x=>x.time),[bars[3].time]);
 assert.equal(r.quorum2[0].support.length,2);
 assert.equal(r.quorum2[0].support.find(x=>x.family==='frank').events.length,2);
});
test('opposing votes veto agreement and expired votes cannot count',()=>{
 const bars=makeBars(12),e=empty();
 e.vector=[evt(bars,1),evt(bars,8)];e.momentum=[evt(bars,2),evt(bars,5)];e.speed=[evt(bars,2,'short')];
 e.frank_cross=[evt(bars,8)];e.frank_divergence=[evt(bars,8,'short')];
 const r=buildConfluences(bars,e);
 assert.equal(r.quorum2.length,0);assert.equal(r.quorum3.length,0);assert.ok(r.conflictBars>0);
});
test('future events never change an existing consensus; malformed streams blocked',()=>{
 const bars=makeBars(20),e=empty();e.vector=[evt(bars,2),evt(bars,13,'short')];e.momentum=[evt(bars,3),evt(bars,14,'short')];
 const full=buildConfluences(bars,e),prefix=bars.slice(0,10),p=Object.fromEntries(CHANNELS.map(ch=>[ch,e[ch].filter(x=>x.time<=prefix.at(-1).time)]));
 assert.deepEqual(buildConfluences(prefix,p).quorum2,full.quorum2.filter(x=>x.time<=prefix.at(-1).time));
 assert.throws(()=>buildConfluences(bars,{...e,cipher:[{time:1,side:'long'}]}),/CONFLUENCE_EVENT/);
});
test('same training folds compare five individual agents, union and quorums without holdout or promotion',()=>{
 const bars=makeBars(510),priceStep=.1,archive={priceStep,indicators:Object.fromEntries(CHANNELS.map(ch=>[ch,{signals:generate(ch,bars,priceStep,false).signals}]))};
 const r=studyConfluence(bars,archive);
 assert.equal(r.folds.length,3);assert.equal(r.prefixChecks,2);assert.equal(r.noPromotion,true);assert.equal(r.holdoutUsed,false);
 assert.equal(Object.keys(r.pooled).length,8);
 for(const v of Object.values(r.pooled)){assert.equal(v.samples,v.eligible);assert.equal(v.matched+v.missed,v.pivots);assert.ok(v.precision===null||v.precision>=0&&v.precision<=1);}
 assert.throws(()=>studyConfluence(bars,{...archive,indicators:{...archive.indicators,vector:{signals:[...archive.indicators.vector.signals,{time:bars[0].time,side:'long',tag:'deliberately_corrupt_fixture'}]}}}),/CONFLUENCE_ARCHIVE_PARITY/);
});
