/* Level 5.5 bounded feedback cycles. A follow-up references a completed
 * structured experiment, never a failed provider call or a pending result.
 * Existing parent_id uniqueness is retained using a deterministic child key.
 */
import {createHash} from 'node:crypto';
import {feedbackFromStructured,readFeedback,validateNewRule} from './level5-rule-contract.mjs';
export const MAX_FOLLOWUP_ROUNDS=2;
const hash=x=>createHash('sha256').update(x).digest('hex');
const need=(v,m)=>{if(!v)throw Error(m)};
const trim=x=>String(x??'').trim();
export function followupIdentity(parentId,priorAttempt,priorReportSha,previousRound){
 need([parentId,priorAttempt,priorReportSha].every(x=>/^[a-f0-9]{64}$/.test(x)),'FOLLOWUP_ID');
 need(Number.isInteger(previousRound)&&previousRound>=0&&previousRound<MAX_FOLLOWUP_ROUNDS,'FOLLOWUP_ROUND');
 const round=previousRound+1;
 return {parentId,priorAttempt,priorReportSha,round,reservationParentId:hash(JSON.stringify(['CJ_L5_FOLLOWUP_V1',parentId,priorAttempt,priorReportSha,round]))};
}
export async function initializeRefinement(db){
 await db.query("ALTER TABLE cj_llm_research_attempts ADD COLUMN IF NOT EXISTS origin_parent_id char(64), ADD COLUMN IF NOT EXISTS cycle_round integer NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS prior_attempt_id char(64), ADD COLUMN IF NOT EXISTS prior_report_sha256 char(64)");
}
export function verifyFollowup(row,packet,memory){
 const previous=feedbackFromStructured(row,packet);
 need(previous&&previous.sameScope&&previous.holdoutUsed===false,'FOLLOWUP_SCOPE');
 const identity=followupIdentity(packet.parentId,trim(row.attempt_id),trim(row.sha),Number(row.cycle_round));
 need(memory.some(x=>x.ruleId===previous.ruleId&&x.reportSha256===previous.reportSha256&&x.sameScope),'FOLLOWUP_MEMORY');
 return {identity,previous};
}
export function requirePriorFeedback(feedback,prior){
 need(feedback.some(x=>x.sameScope&&x.reportSha256===prior.reportSha256&&x.ruleId===prior.ruleId),'FOLLOWUP_EXPORT_REQUIRED');
}
export async function nextFollowup(db,buildPacket){
 const q=await db.query("SELECT trim(x.attempt_id) AS attempt_id,trim(x.rule_id) AS rule_id,trim(x.report_sha256) AS sha,x.report,l.result,trim(l.result_sha256) AS proposal_sha,l.packet,trim(l.packet_sha256) AS packet_sha,l.cycle_round,trim(a.id) AS adaptive_id,a.report AS adaptive_report,trim(a.report_sha256) AS adaptive_sha,trim(p.id) AS parent_id,p.report AS parent_report,trim(p.report_sha256) AS parent_sha FROM cj_llm_structured_executions x JOIN cj_llm_research_attempts l ON l.id=x.attempt_id JOIN cj_adaptive_research a ON a.id=coalesce(l.origin_parent_id,l.parent_id) JOIN cj_autonomous_experiments p ON p.id=a.parent_id WHERE x.status='COMPLETED' AND l.status='HUMAN_REVIEW_ONLY' AND a.status='COMPLETED' AND p.status='COMPLETED' AND l.cycle_round<$1 AND NOT EXISTS(SELECT 1 FROM cj_llm_research_attempts child WHERE child.prior_attempt_id=l.id) ORDER BY l.cycle_round,x.created_at,x.attempt_id LIMIT 1",[MAX_FOLLOWUP_ROUNDS]);
 if(!q.rowCount)return null;
 const row=q.rows[0],packet=buildPacket(row),memory=await readFeedback(db,packet),{identity,previous}=verifyFollowup(row,packet,memory);
 // The immediately preceding report must be first in the request envelope.
 const ordered=[previous,...memory.filter(x=>x.ruleId!==previous.ruleId)];
 return {packet,memory:ordered,identity,previous};
}
