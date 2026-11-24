import {checkFiveByFiveComplete} from './five-by-five.mjs';
/*
 * CryptoJuju Render research schedule: six specialists, ONE process at a time.
 * Each entry is deterministic research, not a persistent LLM agent.
 * Never executes market orders or promotes indicator versions.
 */
export const SPECIALISTS = Object.freeze([
  Object.freeze({id:'bitunix-data',minute:4,timeoutMs:540000,description:'Double-read closed Bitunix OHLC'}),
  Object.freeze({id:'vector',minute:14,timeoutMs:540000,description:'Original Vector V1.1 research + experimental V1.2'}),
  Object.freeze({id:'momentum',minute:24,timeoutMs:540000,description:'Momentum Fusion original research'}),
  Object.freeze({id:'speed',minute:34,timeoutMs:540000,description:'SPEED V3 research'}),
  Object.freeze({id:'cipher',minute:44,timeoutMs:540000,description:'CJ Cipher WT research'}),
  Object.freeze({id:'diagnostics',minute:54,timeoutMs:60000,description:'Causal review of the five reports, proposals only'})
]);
export function utcSlot(now) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw Error('Valid Date required');
  return now.toISOString().slice(0,13)+':00:00.000Z';
}
export function dueSpecialists(now) {
  utcSlot(now);
  return SPECIALISTS.filter(r=>now.getUTCMinutes()>=r.minute);
}
export function assessBitunixData(summary) {
  const expanded=summary?.cohort==='FIVE_BY_FIVE';
  const expected=expanded?25:9;
  if (!summary || !Array.isArray(summary.checks) || summary.checks.length!==expected ||
    (expanded&&!checkFiveByFiveComplete(summary.checks)) ||
    (expanded&&summary.expectedCases!==25) ||
      summary.status!=='PASS_PUBLIC_BITUNIX_DATA_WINDOWS' ||
      summary.passed!==expected || summary.blocked!==0 ||
      summary.checks.some(c=>c.status!=='DATA_READY_FOR_RESEARCH_ONLY' ||
        c.consistencyStatus!=='STABLE_TWO_READS' ||
        c.acceptedBars!==c.requestedBars ||
        typeof c.sha256!=='string' || !/^[0-9a-f]{64}$/i.test(c.sha256))) {
    return {status:'BLOCKED',reason:'BITUNIX_DATA_PROVENANCE_OR_READBACK_FAILED'};
  }
  return {status:'DATA_READY_FOR_RESEARCH_ONLY',reason:null};
}
export function summarizeDiagnostics(reports) {
  const known = new Set(SPECIALISTS.filter(a=>a.id!=='diagnostics').map(a=>a.id));
  const byId = new Map(reports.filter(r=>known.has(r.agent)).map(r=>[r.agent,r]));
  const concerns=[];
  for(const id of known) {
    const r=byId.get(id);
    if(!r) concerns.push({agent:id,code:'MISSING_REPORT',action:'Check deployment, process and schedule'});
    else if(r.status!=='DATA_READY_FOR_RESEARCH_ONLY' && r.status!=='EXECUTED_RESEARCH_ONLY')
      concerns.push({agent:id,code:r.status,action:'Inspect raw evidence, causal timestamps, hashes and logs before any new experiment'});
  }
  return {kind:'DETERMINISTIC_DIAGNOSTICS_NOT_LLM',
    status:concerns.length?'REVIEW_REQUIRED':'REPORTS_PRESENT_NOT_PERFORMANCE_VALIDATED',
    concerns,automaticCodeChanges:false,automaticPromotion:false,
    warns:'A completed process is not evidence of profitability, Pine parity or indicator quality.'};
}
