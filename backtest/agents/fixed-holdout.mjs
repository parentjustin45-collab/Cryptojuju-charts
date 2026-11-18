/*
 * CryptoJuju agents — fixed chronological split, read-only evaluation.
 * Not an optimizer. Indicator signals must be generated causally in advance.
 * Distinct starting capital and FLAT position for each phase; no leakage
 * through position carryover or a boundary signal executed in the next phase.
 */
import {classifyHistory,requireCleanHistory} from '../quality-gate.mjs';
import {runResearchBatch} from './research-batch.mjs';

function summarize(result) {
  return Object.fromEntries(result.results.map(({id,report,signalCount,indicatorParity})=>[
    id,{
      signalCount,
      indicatorParity,
      tradeCount:report.tradeCount,
      winRatePct:report.tradeCount?report.winRate:null,
      returnPct:report.returnPct,
      netProfit:report.netProfit,
      maxDrawdownPct:report.maxDrawdownPct,
      finalCapital:report.finalCapital
    }
  ]));
}

/**
 * holdoutStartTime is the OPEN timestamp of the first untouched evaluation candle.
 * It must be chosen before tuning the strategy; this function cannot establish that.
 * All signals are timestamps of bars confirmed at their closes.
 */
export function runFixedHoldout({
  market,historyWindow,candles,experiments,costs,holdoutStartTime
}={}) {
  if (!historyWindow || !Array.isArray(candles) || !Array.isArray(experiments) || !experiments.length)
    throw Error('History window, candles and experiments are required');
  const {startTime,endTime,intervalMs}=historyWindow;
  const classified=classifyHistory(candles,historyWindow);
  const clean=requireCleanHistory(classified);
  if (!Number.isSafeInteger(holdoutStartTime)
      || (holdoutStartTime-startTime)%intervalMs!==0
      || holdoutStartTime<=startTime+2*intervalMs
      || holdoutStartTime>=endTime-2*intervalMs) {
    throw Error('Fixed aligned holdoutStartTime must leave at least three candles in each phase');
  }
  const fullTimes=new Set(clean.map(c=>c.time));
  const lastFullTime=endTime-intervalMs;
  const split={training:{startTime,endTime:holdoutStartTime,intervalMs},
               holdout:{startTime:holdoutStartTime,endTime,intervalMs}};
  const phaseSets={training:[],holdout:[]};
  const droppedAtBoundary=[];
  const ids=new Set();

  for (const exp of experiments) {
    if (!exp || typeof exp.id!=='string' || !/^[A-Za-z0-9_-]{1,60}$/.test(exp.id)
        || ids.has(exp.id) || !Array.isArray(exp.signals)
        || exp.signalTimeConvention!=='confirmation-bar-open') {
      throw Error('Invalid experiment, duplicate id or unconfirmed signal convention');
    }
    ids.add(exp.id);
    const seen=new Set();
    const filtered={training:[],holdout:[]};
    for(const signal of exp.signals) {
      const time=signal?.time;
      if (!Number.isSafeInteger(time) || !fullTimes.has(time)
          || !['long','short','flat'].includes(signal?.side)
          || seen.has(time) || time===lastFullTime)
        throw Error('Invalid, duplicated, out-of-range or non-executable signal');
      seen.add(time);
      const phase=time<holdoutStartTime?'training':'holdout';
      // A signal confirmed on the final training candle cannot enter on
      // holdout's first open because each phase starts FLAT and independent.
      if (time===holdoutStartTime-intervalMs) {
        droppedAtBoundary.push({id:exp.id,time,reason:'no-position-carryover'});
      } else {
        filtered[phase].push(signal);
      }
    }
    for (const phase of ['training','holdout'])
      phaseSets[phase].push({...exp,signals:filtered[phase]});
  }
  const trainingCandles=clean.filter(c=>c.time<holdoutStartTime);
  const holdoutCandles=clean.filter(c=>c.time>=holdoutStartTime);
  const training=runResearchBatch({
    market,historyWindow:split.training,candles:trainingCandles,
    experiments:phaseSets.training,costs
  });
  const holdout=runResearchBatch({
    market,historyWindow:split.holdout,candles:holdoutCandles,
    experiments:phaseSets.holdout,costs
  });
  return {
    status:'RESEARCH_ONLY',
    splitAt:holdoutStartTime,
    market:training.market,
    windows:{
      training:{...split.training,bars:trainingCandles.length},
      holdout:{...split.holdout,bars:holdoutCandles.length}
    },
    training:summarize(training),
    holdout:summarize(holdout),
    droppedAtBoundary,
    warnings:[
      'Holdout time must be selected before seeing the results; this function cannot verify that.',
      'Signals may still look ahead unless indicator implementations have separately passed a causal/no-repaint audit.',
      'Each phase starts flat with fresh capital; positions do not carry over. Boundary signals are discarded and reported.',
      'No winner selection, tuning, automated trading, or order placement is performed.',
      'Fees and slippage are simulated, not guaranteed execution prices.'
    ]
  };
}
