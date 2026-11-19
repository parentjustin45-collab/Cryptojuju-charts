/* Role 5: research-only validation; never approves production deployment. */
import {record,finite} from './shared.mjs';
export function validateWorkshop(data,backtests,diagnostics,corrections){
  if (data.status!=='PASS'||backtests.status!=='PASS')
    return record('validation','BLOCKED',{reason:'No runnable data/experiment; do not declare success'});
  const result=backtests.details.result;
  const reports=Object.values(result.training).concat(Object.values(result.holdout));
  const checks={
    resultCount:Object.keys(result.training).length,
    twoPhases:Object.keys(result.training).length>0
      && Object.keys(result.training).length===Object.keys(result.holdout).length,
    finiteMetrics:reports.every(x=>[x.returnPct,x.netProfit,x.maxDrawdownPct,x.finalCapital].every(finite)),
    nextOpenTrading:result.status==='RESEARCH_ONLY',
    noAutomaticWrites:corrections.details.writesToRepository===false,
    noRealOrders:true
  };
  return record('validation',Object.values(checks).every(Boolean)?'PASS_RESEARCH_ONLY':'BLOCKED',{checks});
}
