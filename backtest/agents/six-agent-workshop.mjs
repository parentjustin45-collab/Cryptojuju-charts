/*
 * CryptoJuju — seven-role research workshop V1.
 * Each deterministic responsibility lives in a separate module. No LLM
 * reasoning, no autonomous code pushes, no trading and no deployment.
 */
import {auditData} from './roles/01-bitunix-data.mjs';
import {executeBacktests} from './roles/02-backtests.mjs';
import {diagnose} from './roles/03-diagnostics.mjs';
import {prepareCorrections} from './roles/04-corrections.mjs';
import {validateWorkshop} from './roles/05-validation.mjs';
import {coordinate} from './roles/06-coordination.mjs';
import {analyzeMarketContext} from './roles/07-market-context.mjs';
export {SEVEN_AGENT_ROLES,SIX_AGENT_ROLES} from './roles/06-coordination.mjs';

export function runSevenAgentWorkshop(input={}) {
  const data=auditData(input);
  const backtests=executeBacktests(input,data);
  const diagnostics=diagnose(data,backtests);
  const corrections=prepareCorrections(diagnostics);
  const validation=validateWorkshop(data,backtests,diagnostics,corrections);
  const marketContext=analyzeMarketContext(input.marketContext);
  return coordinate(input,[data,backtests,diagnostics,corrections,validation,marketContext]);
}

// Compatibility export for existing scripts; output now contains seven roles.
export const runSixAgentWorkshop=runSevenAgentWorkshop;

export function formatWorkshopMarkdown(report) {
  const rows=report.agents.map(a=>`| ${a.id} | ${a.status} |`).join('\n');
  const findings=report.agents.find(a=>a.id==='diagnostics')?.details.findings??[];
  const market=report.agents.find(a=>a.id==='market-context');
  const lines=[
    '# CryptoJuju — Rapport des sept rôles',
    '',
    `Statut : **${report.status}**`,
    '',
    '| Rôle | État |','|---|---|',rows,
    '',
    '## Diagnostics',
    ...(findings.length?findings.map(f=>`- ${f.code} : ${f.strategy??f.explanation??'à vérifier'}`):['- Aucune anomalie diagnostiquée sur ce lot.']),
    '',
    '## Contexte multi-marchés',
    ...(market?.details?.markets??[])
      .map(m=>`- ${m.symbol} : rendement ${m.returnPct.toFixed(2)} %, plage ${m.range.location} (${m.range.positionPct.toFixed(1)} %).`),
    ...(market?.details?.markets?.length?[]:['- Contexte bloqué ou absent; aucune conclusion multi-marchés.']),
    ...(market?.status==='PASS_SYNTHETIC_ONLY'?['- **Fixtures synthétiques : ces chiffres ne décrivent pas le marché réel.**']:[]),
    ...(market?.details?.dataLimit?[`- Limite : ${market.details.dataLimit}`]:[]),
    '',
    '> Tests de recherche uniquement. Aucune transaction ni modification de main.',
    ''
  ];
  return lines.join('\n');
}
