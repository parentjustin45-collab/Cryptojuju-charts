/* Role 4: propose corrections ONLY; never write to GitHub. */
import {record,safeList} from './shared.mjs';
export function prepareCorrections(diagnostics) {
  const plan=new Map();
  for(const f of safeList(diagnostics.details.findings)) {
    if(f.code==='SOURCE_DATA')
      plan.set('DATA_PROVENANCE','Review raw Bitunix candles, preserve source values and verify provenance; do not synthesize OHLC');
    else if(f.code==='BACKTEST_BLOCKED')
      plan.set('CAUSALITY','Investigate confirmation timestamp, history window and signal contract before changing strategy code');
    else if(f.code==='PARITY_UNVERIFIED')
      plan.set('PINE_PARITY','Compare indicator outputs against independent TradingView samples before any accuracy claim');
    else if(f.code==='LOW_HOLDOUT_SAMPLE')
      plan.set('MORE_SAMPLES','Collect additional disjoint validation windows before ranking strategies');
    else if(f.code==='NEGATIVE_HOLDOUT_RETURN'||f.code==='TRAIN_HOLDOUT_DISAGREEMENT')
      plan.set('REVIEW_CONFLUENCE','Review false signals and costs; propose changes for human review, never optimize on holdout');
    else if(f.code==='DRAWDOWN_REVIEW')
      plan.set('REVIEW_RISK','Compare exits and risk settings on separate unseen windows; no live trading');
  }
  return record('corrections','PROPOSALS_ONLY',{
    proposals:[...plan].map(([code,description])=>({code,description})),
    writesToRepository:false,requiresHumanApproval:true
  });
}
