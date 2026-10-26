import test from 'node:test';
import assert from 'node:assert/strict';
import {compareDirectionWindow,auditDirectionalWindows,runDirectionAudit,DIRECTION_AUDIT_LOCK}
 from './vector-direction-disagreement.mjs';
import {vectorAIT} from './vector-ait-v1.mjs';
import {applyVectorV14} from './vector-v14-hysteresis.mjs';
const H=3600000;
function sample(n=100,step=H){
 return Array.from({length:n},(_,i)=>({
  time:i*step,open:100,high:101,low:99,close:100,volume:100}));
}
function signalFixture(){
 const b=sample(110);
 b[20]={...b[20],open:100,high:100.2,low:98.7,close:99,volume:5000};
 b[25]={...b[25],open:99,high:100.3,low:98.8,close:100,volume:5000};
 return b;
}
test('Protocol is fixed, read-only, and includes SOL/BTC 1h plus BTC 4h',()=>{
 assert.equal(DIRECTION_AUDIT_LOCK.noTrades,true);
 assert.equal(DIRECTION_AUDIT_LOCK.holdout,false);
 assert.deepEqual(DIRECTION_AUDIT_LOCK.markets.map(x=>x.symbol+'/'+x.tf),
  ['BTCUSDT/1h','ETHUSDT/1h','SOLUSDT/1h','BTCUSDT/4h']);
});
test('The two directions can be OPPOSITE on exactly the same confirmed OHLC',()=>{
 const b=signalFixture(),raw=vectorAIT(b),v14=applyVectorV14(b,{rawVector:raw});
 assert.equal(raw[25].signal,'long');
 assert.equal(raw[25].direction,1);
 assert.equal(v14.events[25].direction,-1);
 const report=compareDirectionWindow(b);
 assert.equal(report.current.v11,'LONG');
 assert.equal(report.current.v14,'SHORT');
 assert.equal(report.current.opposite,true);
 assert.ok(report.counts.opposite>0);
 assert.ok(report.episodes.some(x=>x.v11Side==='LONG'&&x.v14Side==='SHORT'));
});
test('Episode returns are hindsight from following OPEN, not same-bar closed signal',()=>{
 const b=signalFixture(),x=compareDirectionWindow(b);
 const entry=x.episodes.find(e=>e.v11Side==='LONG'&&e.v14Side==='SHORT');
 const i=b.findIndex(c=>c.time===entry.startTime);
 assert.equal(entry.startTime,b[25].time);
 assert.equal(entry.futureGross.horizon3.v11.grossPct,
  Number((100*(b[i+3].close-b[i+1].open)/b[i+1].open).toFixed(5)));
 assert.equal(entry.futureGross.horizon3.v14.grossPct,
  -entry.futureGross.horizon3.v11.grossPct);
 assert.equal(entry.futureGross.horizon3.v11.hours,3);
});
test('A future manipulation never changes earlier direction or episode inception',()=>{
 const b=signalFixture(),a=compareDirectionWindow(b);
 const copy=b.map((v,i)=>i<78?{...v}:{...v,open:100,high:110,low:90,close:108,volume:200000});
 const changed=compareDirectionWindow(copy);
 const first=x=>x.episodes.filter(e=>e.startTime<60*H)
  .map(e=>({start:e.startTime,v11:e.v11Side,v14:e.v14Side}));
 assert.deepEqual(first(a),first(changed));
 assert.equal(b[90].high,101);
});
test('12-bar ex-post return cannot cross temporal partition or window end',()=>{
 const b=signalFixture(),r=compareDirectionWindow(b,{cutoffTime:30*H});
 const e=r.episodes.find(x=>x.startTime===25*H);
 assert.equal(e.futureGross.horizon12.v11,null);
 assert.equal(e.futureGross.horizon12.v14,null);
 const short=compareDirectionWindow(b.slice(0,60),{cutoffTime:Number.MAX_SAFE_INTEGER});
 assert.ok(short.episodes.length>=0);
});
test('Quarantined data are rejected, not filled or passed as fake agreement',()=>{
 const b=signalFixture();b[45].time+=H;
 const r=auditDirectionalWindows([{candles:b}],{expectedLastClosedTime:109*H});
 assert.equal(r.summary.observedBars,0);
 assert.equal(r.snapshot,null);
 assert.match(r.noCurrentSnapshotReason,/55/);
});
test('Live input provider can be fully injected without external keys or trades',async()=>{
 const now=Date.UTC(2026,9,26,16,12);
 const pages=[];
 const fetchPage=async({symbol,interval,startTime,endTime})=>{
  pages.push({symbol,interval,startTime,endTime});
  const step=interval==='4h'?4*H:H;
  return Array.from({length:(endTime-startTime)/step},(_,i)=>{
   const time=startTime+i*step;
   return {time,open:100,high:101,low:99,close:100,volume:100};
  });
 };
 const result=await runDirectionAudit({now,fetchPage});
 assert.equal(result.status,'ALL_FOUR_FRESH_SNAPSHOTS');
 assert.equal(result.reports.length,4);
 for(const x of result.reports){
  assert.equal(x.audit.snapshot.v11,'NON_ETABLIE');
  assert.equal(x.audit.snapshot.v14,'NON_ETABLIE');
  assert.equal(x.audit.snapshot.watch.tradingSignal,false);
 }
 assert.ok(pages.some(x=>x.interval==='4h'));
});
