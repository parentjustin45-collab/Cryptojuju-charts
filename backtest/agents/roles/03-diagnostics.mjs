/* Role 3: flag source, signal, sample-size and out-of-sample issues. */
import {record} from './shared.mjs';
export function diagnose(data,backtests) {
  const findings=[];
  if (data.status!=='PASS') {
    findings.push({code:'SOURCE_DATA',severity:'BLOCKING',explanation:'Unverified OHLC/market prevents backtesting'});
  }
  if (backtests.status!=='PASS') {
    findings.push({code:'BACKTEST_BLOCKED',severity:'BLOCKING',explanation:backtests.details.reason??'Unknown backtest failure'});
  }
  if (backtests.status==='PASS') {
    const res=backtests.details.result;
    for(const [id,s] of Object.entries(res.holdout)){
      if(s.indicatorParity!=='VERIFIED')
        findings.push({code:'PARITY_UNVERIFIED',severity:'REVIEW',strategy:id});
      if(s.tradeCount<5)
        findings.push({code:'LOW_HOLDOUT_SAMPLE',severity:'REVIEW',strategy:id,count:s.tradeCount});
      if(s.returnPct<0)
        findings.push({code:'NEGATIVE_HOLDOUT_RETURN',severity:'REVIEW',strategy:id,returnPct:s.returnPct});
      if(s.maxDrawdownPct>=20)
        findings.push({code:'DRAWDOWN_REVIEW',severity:'REVIEW',strategy:id,maxDrawdownPct:s.maxDrawdownPct});
      const training=res.training[id];
      if(training && training.returnPct>0 && s.returnPct<0)
        findings.push({code:'TRAIN_HOLDOUT_DISAGREEMENT',severity:'REVIEW',strategy:id});
    }
  }
  return record('diagnostics','PASS',{findings});
}
