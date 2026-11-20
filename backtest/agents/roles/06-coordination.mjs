/* Role 6: coordinate reports; no background scheduler or LLM implied. */
import {record} from './shared.mjs';
const CORE_ROLES=[
  {id:'bitunix-data',title:'Intégrité des données Bitunix'},
  {id:'backtests',title:'Backtests historiques'},
  {id:'diagnostics',title:'Diagnostics et anomalies'},
  {id:'corrections',title:'Préparation des corrections'},
  {id:'validation',title:'Validation et non-régression'},
];
export const SIX_AGENT_ROLES=Object.freeze([
  ...CORE_ROLES,{id:'coordination',title:'Coordination et rapports'}
]);
export const SEVEN_AGENT_ROLES=Object.freeze([
  ...CORE_ROLES,
  {id:'coordination',title:'Coordination et rapports'},
  {id:'market-context',title:'Contexte multi-marchés et plages récentes'}
]);

export function coordinate(input,stages){
  const blocked=stages.some(s=>s.status==='BLOCKED');
  const complete=stages.length===5||stages.length===6;
  const seven=stages.length===6;
  const coordination=record('coordination','PASS',{
    reportingOnly:true,
    noAutomaticTrades:true,
    noMainChanges:true
  });
  const result={
    status:blocked?'BLOCKED':complete?'RESEARCH_READY':'INCOMPLETE',
    summary:blocked?'A required data/backtest/validation gate failed; no strategy success declared':
      `${seven?'Seven':'Six'} deterministic role checks completed, without orders or automatic code changes`,
    market:input?.market?{exchange:input.market.exchange,symbol:input.market.symbol,timeframe:input.market.timeframe}:null,
    agents:seven?[...stages.slice(0,5),coordination,stages[5]]:[...stages,coordination],
    disclaimer:`Research orchestration only, not ${seven?'seven':'six'} autonomous LLM agents; no deployment, account access or trading.`
  };
  return result;
}
