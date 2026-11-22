/*
 * Persistent, provenance-linked specialist memory contract.
 * This stores hypotheses and counterevidence; does not train or run an LLM.
 * Promotion, real orders, source edits and deployment are NEVER authorized.
 */
import {createHash} from 'node:crypto';
import {SPECIALISTS} from './plan.mjs';

const IDS=new Set(SPECIALISTS.map(x=>x.id));
const SHA=/^[a-f0-9]{64}$/i;
const STAGES=new Set(['HYPOTHESIS','DIAGNOSTIC','REJECTED','REVIEW_ONLY']);
const clamp=(v,min,max,name)=>{
  if(typeof v!=='string'||v.trim().length<min||v.trim().length>max)
    throw Error('Invalid '+name);
  return v.trim();
};
const iso=(s,name)=>{
  if(typeof s!=='string'||!/^20\d{2}-\d{2}-\d{2}T/.test(s)||
    !Number.isFinite(Date.parse(s)))throw Error('Invalid '+name);
  return new Date(s).toISOString();
};
export function normalizeSpecialistFinding(input){
  if(!input||!IDS.has(input.agent))throw Error('Unknown research specialist');
  const agent=input.agent;
  const stage=input.stage??'HYPOTHESIS';
  if(!STAGES.has(stage))throw Error('Unsupported finding stage');
  const title=clamp(input.title,5,150,'title');
  const hypothesis=clamp(input.hypothesis,10,2000,'hypothesis');
  const counterEvidence=clamp(input.counterEvidence??'Not tested yet',5,2000,'counterEvidence');
  const nextTest=clamp(input.nextTest,10,2000,'nextTest');
  const codeCommit=clamp(input.codeCommit,40,40,'codeCommit');
  if(!/^[a-f0-9]{40}$/i.test(codeCommit))throw Error('Invalid code commit');
  const sourceSha256=input.sourceSha256??null;
  if(sourceSha256!==null&&!SHA.test(sourceSha256))throw Error('Invalid source hash');
  if(stage==='REVIEW_ONLY' && !sourceSha256)
    throw Error('Review claims require provenance');
  const observedAtUtc=iso(input.observedAtUtc,'observedAtUtc');
  const evidenceKnownAtUtc=iso(input.evidenceKnownAtUtc??input.observedAtUtc,'evidenceKnownAtUtc');
  if(Date.parse(evidenceKnownAtUtc)>Date.parse(observedAtUtc))
    throw Error('Future information cannot support an earlier research decision');
  const markets=input.markets??[];
  if(!Array.isArray(markets)||markets.length>50||
    markets.some(s=>typeof s!=='string'||!/^[A-Z0-9]{3,20}$/.test(s)))
    throw Error('Invalid markets');
  const holdoutTradeCount=input.holdoutTradeCount??null;
  if(holdoutTradeCount!==null&&(!Number.isSafeInteger(holdoutTradeCount)||holdoutTradeCount<0))
    throw Error('Invalid holdout count');
  const reviewStatus=stage==='REVIEW_ONLY' && holdoutTradeCount!==null &&
    holdoutTradeCount>=20?'HUMAN_REVIEW_ONLY':'INSUFFICIENT_EVIDENCE';
  const payload={agent,stage,title,hypothesis,counterEvidence,nextTest,
    observedAtUtc,evidenceKnownAtUtc,sourceSha256,codeCommit,
    markets:[...new Set(markets)],holdoutTradeCount,reviewStatus,
    automaticPromotion:false,canPlaceOrders:false,canModifyMain:false,
    caveat:'No autonomous learning or real-money performance claim.'};
  const id=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  return Object.freeze({...payload,id});
}

export async function initializeSpecialistMemory(db){
  await db.query(
    'CREATE TABLE IF NOT EXISTS cj_agent_insights ('+
    'id char(64) PRIMARY KEY, agent text NOT NULL, observed_at timestamptz NOT NULL,'+
    'stage text NOT NULL, source_sha256 char(64), code_commit char(40) NOT NULL,'+
    'content jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now())');
}
export async function rememberFinding(db,input){
  const entry=normalizeSpecialistFinding(input);
  const q=await db.query(
    'INSERT INTO cj_agent_insights(id,agent,observed_at,stage,source_sha256,code_commit,content)'+
    ' VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING',
    [entry.id,entry.agent,entry.observedAtUtc,entry.stage,
      entry.sourceSha256,entry.codeCommit,JSON.stringify(entry)]);
  return {id:entry.id,inserted:q.rowCount===1,status:entry.reviewStatus};
}
export async function recallFindings(db,agent,{limit=20}={}){
  if(!IDS.has(agent))throw Error('Unknown research specialist');
  if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('Invalid memory limit');
  const r=await db.query(
    'SELECT content FROM cj_agent_insights WHERE agent=$1 ORDER BY observed_at DESC LIMIT $2',
    [agent,limit]);
  return r.rows.map(x=>x.content);
}
