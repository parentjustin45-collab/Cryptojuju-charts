/*
 * CryptoJuju Night Control Center — static offline report snapshot.
 * NEVER makes network calls or claims real-market or autonomous execution.
 * The source-kind is always explicitly synthetic/unverified in this phase.
 */
const ROLE_IDS=Object.freeze([
  'bitunix-data','backtests','diagnostics','corrections','validation','coordination'
]);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const labels=Object.freeze({
  'bitunix-data':'01 · Données Bitunix',
  'backtests':'02 · Backtests',
  'diagnostics':'03 · Diagnostics',
  'corrections':'04 · Corrections',
  'validation':'05 · Validation',
  'coordination':'06 · Coordination'
});
const statusClass=status=>status==='BLOCKED'?'bad':
  status==='PROPOSALS_ONLY'?'pending':
  status.startsWith('PASS')?'ok':'pending';
const descriptions=Object.freeze({
  'bitunix-data':'Qualité de la fenêtre OHLC',
  'backtests':'Exécution historique simulée',
  'diagnostics':'Contrôles et signaux suspects',
  'corrections':'Propositions sans écriture de code',
  'validation':'Tests et règles de sécurité',
  'coordination':'Rapport et prochaines vérifications'
});
export function createControlCenterSnapshot(report,{sourceKind='SYNTHETIC_CI_ONLY_NOT_BITUNIX',gitSha=null,createdAt=null}={}){
  if(!report||!Array.isArray(report.agents)||report.agents.length!==ROLE_IDS.length)
    throw Error('Six ordered role reports required');
  for(let i=0;i<ROLE_IDS.length;i++)
    if(report.agents[i]?.id!==ROLE_IDS[i]||typeof report.agents[i].status!=='string')
      throw Error('Unexpected role order or missing status');
  if(!['SYNTHETIC_CI_ONLY_NOT_BITUNIX','UNVERIFIED_INPUT'].includes(sourceKind))
    throw Error('Real-market designation not permitted without a separately verified provenance contract');
  if(gitSha!==null && !/^[0-9a-f]{7,40}$/.test(gitSha))
    throw Error('Invalid Git SHA');
  if(createdAt!==null && (typeof createdAt!=='string'||!Number.isFinite(Date.parse(createdAt))))
    throw Error('Invalid creation timestamp');
  const warnings=['AUCUNE DONNÉE RÉELLE CERTIFIÉE DANS CE TABLEAU',
    'Ce centre de contrôle est une photographie du dernier lot fourni, pas un moniteur en direct.',
    'Six modules déterministes seulement : pas encore six agents IA autonomes.',
    'Aucune opération de trading ni déploiement autorisée.'];
  const findings=(report.agents.find(x=>x.id==='diagnostics')?.details?.findings??[]);
  return {
    schema:'cj-night-control-center-v1',
    sourceKind,generatedAt:createdAt,
    gitSha,
    overallStatus:report.status,
    autonomousAgentsActive:false,
    continuousRuntime:false,
    realMarketEvidence:false,
    roles:report.agents.map(a=>({
      id:a.id,title:labels[a.id],status:a.status,description:descriptions[a.id]
    })),
    diagnosticCount:Array.isArray(findings)?findings.length:0,
    blockingRoleCount:report.agents.filter(a=>a.status==='BLOCKED').length,
    warnings
  };
}
export function renderControlCenterHtml(snapshot){
  if(snapshot?.schema!=='cj-night-control-center-v1'
      ||!['SYNTHETIC_CI_ONLY_NOT_BITUNIX','UNVERIFIED_INPUT'].includes(snapshot.sourceKind)
      ||!Array.isArray(snapshot.roles)||snapshot.roles.length!==ROLE_IDS.length)
    throw Error('Unknown report schema or unverified source');
  const list=snapshot.roles.map(a=>{
    if(!ROLE_IDS.includes(a.id) || typeof a.status!=='string')
      throw Error('Unexpected role');
    return `<article class="role"><div><strong>${esc(a.title)}</strong><small>${esc(a.description)}</small></div><span class="state ${statusClass(a.status)}">${esc(a.status)}</span></article>`;
  }).join('\n');
  const warnings=snapshot.warnings.map(s=>`<li>${esc(s)}</li>`).join('');
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>CryptoJuju · Centre de contrôle nocturne — démonstration</title>
<style>
:root{font-family:system-ui,-apple-system,sans-serif;background:#08120e;color:#eff9f1}
*{box-sizing:border-box}body{max-width:940px;margin:auto;padding:24px 16px 48px}
h1{font-size:clamp(1.5rem,4vw,2.4rem);margin:.45rem 0}
h2{font-size:1.1rem;margin:0 0 16px}
p{line-height:1.6}.muted,small{color:#a9bfb2}
.banner{border:1px solid #b78c46;border-radius:14px;padding:14px 18px;background:#201a10;color:#ffe0a7;font-weight:700}
.panel{border:1px solid #294a35;background:#122319;padding:18px;border-radius:16px;margin:20px 0}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.metric{border-radius:12px;background:#1a3023;padding:14px}.metric b{display:block;font-size:1.3rem;color:#99f0b4}
.role{display:flex;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid #2b4b36;padding:14px 0}
.role:first-of-type{border:0}.role strong,.role small{display:block}.role small{margin-top:4px;font-size:.83rem}
.state{border-radius:10px;padding:7px 10px;font-size:.78rem;white-space:nowrap;border:1px solid #527660}
.state.ok{color:#a2ffbb;border-color:#397b4b}.state.bad{color:#ffc1bd;border-color:#af5a53}
.state.pending{color:#ffe1a5;border-color:#9b7d3d}
ul{padding-left:22px;line-height:1.7}footer{font-size:.82rem;color:#a9bfb2}
@media(max-width:560px){.grid{grid-template-columns:1fr}.role{align-items:flex-start;flex-direction:column}.state{align-self:flex-start}}
</style></head><body>
<header><small>CRYPTOJUJU CHARTS · ATELIER DE RECHERCHE</small><h1>Centre de contrôle nocturne</h1>
<div class="banner">MODE DÉMONSTRATION — DONNÉES SYNTHÉTIQUES OU NON VÉRIFIÉES</div>
<p class="muted">Rapport statique · Généré : ${esc(snapshot.generatedAt??'non renseigné')} · Commit : ${esc(snapshot.gitSha??'non renseigné')}</p></header>
<section class="panel"><h2>État de cet essai technique</h2><div class="grid">
<div class="metric">Atelier<b>${esc(snapshot.overallStatus)}</b></div>
<div class="metric">Rôles exécutés<b>${snapshot.roles.length} / 6</b></div>
<div class="metric">Blocages<b>${snapshot.blockingRoleCount}</b></div>
</div></section>
<section class="panel"><h2>Six modules séparés</h2>${list}</section>
<section class="panel"><h2>Avertissements</h2><ul>${warnings}</ul></section>
<footer>Aucune connexion temps réel · Aucun ordre de trading · Aucun agent IA autonome en continu · Ne pas interpréter les résultats comme des performances historiques.</footer>
</body></html>\n`;
}
