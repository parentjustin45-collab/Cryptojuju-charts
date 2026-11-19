/* Role 6: coordinate reports; no background scheduler or LLM implied. */
import {record} from './shared.mjs';
export const SIX_AGENT_ROLES=Object.freeze([
  {id:'bitunix-data',title:'Intégrité des données Bitunix'},
  {id:'backtests',title:'Backtests historiques'},
  {id:'diagnostics',title:'Diagnostics et anomalies'},
  {id:'corrections',title:'Préparation des corrections'},
  {id:'validation',title:'Validation et non-régression'},
  {id:'coordination',title:'Coordination et rapports'}
]);

export function coordinate(input,stages){
  const blocked=stages.some(s=>s.status==='BLOCKED');
  const complete=stages.length===5;
  const result={
    status:blocked?'BLOCKED':complete?'RESEARCH_READY':'INCOMPLETE',
    summary:blocked?'A required data/backtest/validation gate failed; no strategy success declared':
      'Six deterministic role checks completed, without orders or automatic code changes',
    market:input?.market?{exchange:input.market.exchange,symbol:input.market.symbol,timeframe:input.market.timeframe}:null,
    agents:[...stages,record('coordination','PASS',{
      reportingOnly:true,
      noAutomaticTrades:true,
      noMainChanges:true
    })],
    disclaimer:'Research orchestration only, not six autonomous LLM agents; no deployment, account access or trading.'
  };
  return result;
}
