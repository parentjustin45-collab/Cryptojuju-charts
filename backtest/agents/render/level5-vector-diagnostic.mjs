/* Level 5 pilot: only the reviewed Vector diagnostic, not arbitrary LLM code.
 * Matching is performed on the unchanged full signal set before stratification.
 * Original and V4 parent are compared on the audited 70% training segment.
 */
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {verifiedParent} from './adaptive-research.mjs';
import {buildPacket,validateProposal} from './llm-research.mjs';
import {generate,experimentChannel} from './autonomous-rule-candidates.mjs';
import {scoreFold} from './historical-single-change-experiments.mjs';
import {atr14,findPivots} from './state-pivot-observer.mjs';
import {historicalTargetFor,loadHistoricalPeriod} from './historical-period.mjs';
import {storageState} from './storage-policy.mjs';
export const VERSION='CJ_L5_VECTOR_BODY_DIAGNOSTIC_V1';
export const APPROVED_SHA='bc1628f43adcdd0cc745f31b01c067f2e0d025133ccd6c1b430edbd2699ca12c';
const hash=x=>createHash('sha256').update(x).digest('hex');
const need=(x,m)=>{if(!x)throw Error(m)};
const trim=x=>String(x??'').trim();
const groups=['tagged','untagged','unclassified'];
const blank=()=>({events:0,excluded:0,eligible:0,early:0,on:0,late:0,redundant:0,outside:0,samples:0,positive0:0,positive10:0,positive20:0,sumGrossBps:0});
export function bodyTag(bars,i){
 const a=bars[i],b=bars[i-1];
 if(!a||!b||!(a.high>a.low)||!(b.high>b.low))return 'unclassified';
 return Math.abs(a.close-a.open)/(a.high-a.low)<Math.abs(b.close-b.open)/(b.high-b.low)?'tagged':'untagged';
}
function summarize(s){return {...s,precision:s.eligible?(s.early+s.on+s.late)/s.eligible:null,meanGrossBps:s.samples?s.sumGrossBps/s.samples:null,meanNet10Bps:s.samples?s.sumGrossBps/s.samples-10:null,meanNet20Bps:s.samples?s.sumGrossBps/s.samples-20:null};}
export function stratifyFold(bars,atr,positions,pivots,generated,start,end){
 const full=scoreFold(bars,atr,positions,pivots,generated,start,end);
 const g=Object.fromEntries(groups.map(k=>[k,blank()]));
 const pmap=new Set(pivots.map(p=>p.side+'|'+p.index)),near=new Set(),matched=new Set(),used=new Set(),candidates=[],eligible=[];
 for(let k=0;k<generated.signals.length;k++){
  const e=generated.signals[k],i=positions.get(e.time);
  need(Number.isInteger(i),'SIGNAL_INDEX');if(i<start||i>=end)continue;
  const s=g[bodyTag(bars,i)];s.events++;
  if(i<Math.max(start+12,14)||i>=end-12||!(atr[i]>0)){s.excluded++;continue;}
  s.eligible++;eligible.push({k,s});for(let d=-3;d<=3;d++){const key=e.side+'|'+(i+d);if(pmap.has(key)){candidates.push({k,key,delta:-d,s});near.add(k);}}
  const gross=10000*(e.side==='long'?1:-1)*(bars[i+12].close-bars[i+1].open)/bars[i+1].open;
  s.samples++;s.positive0+=Number(gross>0);s.positive10+=Number(gross>10);s.positive20+=Number(gross>20);s.sumGrossBps+=gross;
 }
 candidates.sort((a,b)=>Math.abs(a.delta)-Math.abs(b.delta)||a.k-b.k||a.key.localeCompare(b.key));
 for(const c of candidates){if(matched.has(c.k)||used.has(c.key))continue;matched.add(c.k);used.add(c.key);c.s[c.delta<0?'early':c.delta>0?'late':'on']++;}
 for(const {k,s} of eligible)if(!matched.has(k))s[near.has(k)?'redundant':'outside']++;
 for(const k of Object.keys(blank())){
  const a=Object.values(g).reduce((n,s)=>n+s[k],0),b=Object.values(full).reduce((n,s)=>n+s[k],0);
  need(Math.abs(a-b)<(k==='sumGrossBps'?1e-6:0.5),'STRATIFICATION_PARITY_'+k);
 }
 return {groups:Object.fromEntries(groups.map(k=>[k,summarize(g[k])])),full};
}
export function evaluate(folds){
 const systems={};
 for(const mode of ['original','parent']){
  const pooled=Object.fromEntries(groups.map(k=>{const s=blank();for(const f of folds)for(const key of Object.keys(s))s[key]+=f[mode].groups[k][key];return [k,summarize(s)];}));
  const wins=folds.filter(f=>{const g=f[mode].groups;return g.tagged.eligible>0&&g.untagged.eligible>0&&g.tagged.precision>g.untagged.precision;}).length;
  const pass=pooled.tagged.eligible>=5&&pooled.untagged.eligible>0&&pooled.tagged.precision>pooled.untagged.precision&&wins>=2;
  systems[mode]={pooled,foldWins:wins,pass};
 }
 return {systems,decision:Object.values(systems).every(x=>x.pass)?'EXPLORATORY_SUPPORT_ONLY':'REJECT_OR_INSUFFICIENT_EVIDENCE',noPromotion:true,noTrading:true,holdoutUsed:false};
}
export async function runLevel5Pilot(db){
 if(process.memoryUsage().rss>350*1024*1024)return {status:'PAUSED_MEMORY'};
 const cap=await db.query('SELECT pg_database_size(current_database())::bigint AS bytes');if(storageState(Number(cap.rows[0]?.bytes)).warning)return {status:'PAUSED_STORAGE'};
 const c=await db.connect();
 try{
  await c.query('BEGIN');
  const lock=await c.query("SELECT pg_try_advisory_xact_lock(hashtext('CJ_LEVEL5_PILOT_V1')) AS locked");
  if(!lock.rows[0].locked){await c.query('ROLLBACK');return {status:'BUSY'};}
  await c.query("CREATE TABLE IF NOT EXISTS cj_llm_diagnostic_results (id char(64) PRIMARY KEY,proposal_sha256 char(64) NOT NULL,report text NOT NULL,report_sha256 char(64) NOT NULL,created_at timestamptz DEFAULT now())");
  const id=hash(JSON.stringify([VERSION,APPROVED_SHA]));
  const existing=await c.query('SELECT trim(report_sha256) AS sha,report FROM cj_llm_diagnostic_results WHERE id=$1',[id]);
  if(existing.rowCount){const row=existing.rows[0];need(hash(row.report)===row.sha,'DIAGNOSTIC_SHA');await c.query('COMMIT');return {status:'ALREADY_COMPLETED',reportSha256:row.sha,decision:JSON.parse(row.report).evaluation.decision};}
  const q=await c.query("SELECT l.result,l.packet,trim(l.packet_sha256) AS packet_sha,trim(a.id) AS adaptive_id,a.report AS adaptive_report,trim(a.report_sha256) AS adaptive_sha,trim(p.id) AS parent_id,p.report AS parent_report,trim(p.report_sha256) AS parent_sha FROM cj_llm_research_attempts l JOIN cj_adaptive_research a ON a.id=l.parent_id JOIN cj_autonomous_experiments p ON p.id=a.parent_id WHERE l.status='HUMAN_REVIEW_ONLY' AND l.result_sha256=$1 AND a.status='COMPLETED' AND p.status='COMPLETED'",[APPROVED_SHA]);
  need(q.rowCount===1,'APPROVED_REPORT_REQUIRED');const row=q.rows[0],result=JSON.parse(row.result),packet=buildPacket(row);
  need(hash(row.result)===APPROVED_SHA&&hash(row.packet)===row.packet_sha&&hash(JSON.stringify(packet))===row.packet_sha&&result.packetSha256===row.packet_sha,'LLM_PROVENANCE');
  const proposal=validateProposal(result.proposal);
  need(result.noExecution===true&&result.noTrading===true&&result.noPromotion===true&&proposal.kind==='DIAGNOSTIC_ONLY'&&packet.channel==='vector'&&packet.symbol==='BTCUSDT'&&packet.timeframe==='1d','PILOT_SCOPE');
  const parent=verifiedParent({id:row.parent_id,report:row.parent_report,report_sha256:row.parent_sha}),{e,receipt}=parent;
  const target=historicalTargetFor(packet.symbol,packet.timeframe),src=await loadHistoricalPeriod(c,{symbol:packet.symbol,timeframe:packet.timeframe,...target});
  need(src.sequenceSha256===receipt.sourceSequenceSha256&&src.barCount===receipt.bars,'SOURCE_SHA');
  const rq=await c.query('SELECT report_gzip,raw_bytes,report_sha256 FROM cj_multiyear_replay_reports WHERE symbol=$1 AND timeframe=$2 AND period_start_ms=$3 AND period_end_ms=$4 AND engine_version=$5',[packet.symbol,packet.timeframe,target.startMs,target.endMs,'CJ_FIVE_INDICATOR_TWO_YEAR_REPLAY_V1_20261124']);
  need(rq.rowCount===1,'BASE_REPORT_REQUIRED');const rr=rq.rows[0],raw=gunzipSync(rr.report_gzip,{maxOutputLength:16*1024*1024});
  need(raw.length===Number(rr.raw_bytes)&&hash(raw)===receipt.reportSha256&&hash(raw)===trim(rr.report_sha256),'BASE_REPORT_SHA');
  const archive=JSON.parse(raw),n=Math.floor(src.barCount*.7),bars=src.candles.slice(0,n);
  need(archive.holdoutStartTime===src.candles[n].time,'TRAIN_BOUNDARY');
  need(JSON.stringify(experimentChannel('vector',src.candles,archive))===JSON.stringify(e.experiment),'PARENT_REPLAY');
  const original=generate('vector',bars,archive.priceStep,false),candidate=generate('vector',bars,archive.priceStep,true);
  const cuts=[0,Math.floor(n/3),Math.floor(n*2/3),n],atr=atr14(bars),positions=new Map(bars.map((b,i)=>[b.time,i])),folds=[];
  for(let i=0;i<3;i++){const start=cuts[i],end=cuts[i+1],pivots=findPivots(bars,atr,start,end);folds.push({fold:i+1,startTime:bars[start].time,endTime:bars[end-1].time,original:stratifyFold(bars,atr,positions,pivots,original,start,end),parent:stratifyFold(bars,atr,positions,pivots,candidate,start,end)});}
  const evaluation=evaluate(folds),report={version:VERSION,proposalSha256:APPROVED_SHA,packetSha256:row.packet_sha,sourceSha256:src.sequenceSha256,symbol:packet.symbol,timeframe:packet.timeframe,trainingBars:n,holdoutBars:src.barCount-n,folds,evaluation,noSignalChanges:true,noPromotion:true,noTrading:true,holdoutUsed:false};
  const body=JSON.stringify(report),sha=hash(body);need(Buffer.byteLength(body)<1000000,'REPORT_TOO_LARGE');
  const size=await c.query('SELECT pg_database_size(current_database())::bigint AS bytes');need(!storageState(Number(size.rows[0]?.bytes),undefined,Buffer.byteLength(body)).warning,'CAPACITY_GUARD');
  await c.query('INSERT INTO cj_llm_diagnostic_results(id,proposal_sha256,report,report_sha256) VALUES($1,$2,$3,$4)',[id,APPROVED_SHA,body,sha]);
  await c.query('COMMIT');return {status:'COMPLETED',reportSha256:sha,...report};
 }catch(e){await c.query('ROLLBACK');return {status:'BLOCKED',reason:String(e.message).slice(0,120),noTrading:true};}finally{c.release();}
}
