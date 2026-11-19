/* Role 2: run closed-candle fixed-holdout research. No real orders. */
import {runFixedHoldout} from '../fixed-holdout.mjs';
import {record} from './shared.mjs';
export function executeBacktests(input,data) {
  if (data.status!=='PASS')
    return record('backtests','BLOCKED',{reason:'Data quality gate failed'});
  try {
    const result=runFixedHoldout(input);
    return record('backtests','PASS',{result});
  } catch (err) {
    return record('backtests','BLOCKED',{reason:String(err?.message??err)});
  }
}
