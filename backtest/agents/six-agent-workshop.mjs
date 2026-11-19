/*
 * CryptoJuju — six-role research workshop V1.
 * Each deterministic responsibility lives in a separate module. No LLM
 * reasoning, no autonomous code pushes, no trading and no deployment.
 */
import {auditData} from './roles/01-bitunix-data.mjs';
import {executeBacktests} from './roles/02-backtests.mjs';
import {diagnose} from './roles/03-diagnostics.mjs';
import {prepareCorrections} from './roles/04-corrections.mjs';
import {validateWorkshop} from './roles/05-validation.mjs';
import {coordinate} from './roles/06-coordination.mjs';
export {SIX_AGENT_ROLES} from './roles/06-coordination.mjs';

export function runSixAgentWorkshop(input={}) {
  const data=auditData(input);
  const backtests=executeBacktests(input,data);
  const diagnostics=diagnose(data,backtests);
  const corrections=prepareCorrections(diagnostics);
  const validation=validateWorkshop(data,backtests,diagnostics,corrections);
  return coordinate(input,[data,backtests,diagnostics,corrections,validation]);
}

export function formatWorkshopMarkdown(report) {
  const rows=report.agents.map(a=>`| ${a.id} | ${a.status} |`).join('\n');
  const findings=report.agents.find(a=>a.id==='diagnostics')?.details.findings??[];
  const lines=[
    '# CryptoJuju — Rapport des six rôles',
    '',
    `Statut : **${report.status}**`,
    '',
    '| Rôle | État |','|---|---|',rows,
    '',
    '## Diagnostics',
    ...(findings.length?findings.map(f=>`- ${f.code} : ${f.strategy??f.explanation??'à vérifier'}`):['- Aucune anomalie diagnostiquée sur ce lot.']),
    '',
    '> Tests de recherche uniquement. Aucune transaction ni modification de main.',
    ''
  ];
  return lines.join('\n');
}
