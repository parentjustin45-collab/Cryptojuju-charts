/*
 * CryptoJuju research agents — phase 1, deterministic/read-only foundation.
 * No autonomous trading, network calls, deployment or AI-generated orders.
 * Expects externally supplied CLOSED, validated Bitunix LAST_PRICE candles.
 * A signal is timestamped on the bar that CONFIRMED it (not a backdated pivot).
 */
import {classifyHistory, requireCleanHistory} from '../quality-gate.mjs';
import {runBacktest} from '../engine.mjs';

export const VERIFIED_INTERVALS = Object.freeze({'15m':900000,'1h':3600000,'4h':14400000});

function checkMarket(market, window) {
  if (!market || market.exchange!=='Bitunix' || market.priceType!=='LAST_PRICE'
      || !/^[A-Z0-9_]{3,40}$/.test(market.symbol??'')
      || !Object.hasOwn(VERIFIED_INTERVALS,market.timeframe)) {
    throw Error('Only Bitunix LAST_PRICE 15m/1h/4h markets are supported by this research pilot');
  }
  if (!window || window.intervalMs!==VERIFIED_INTERVALS[market.timeframe])
    throw Error('Timeframe does not match historyWindow intervalMs');
}

function validateSignals(signals,bars) {
  if (!Array.isArray(signals)) throw Error('Strategy signals must be an array');
  const barIndexes=new Map(bars.map((bar,i)=>[Number(bar.time),i]));
  const seen=new Set();
  for (const signal of signals) {
    const time=signal?.time;
    if (!Number.isSafeInteger(time) || !['long','short','flat'].includes(signal.side))
      throw Error('Invalid strategy signal');
    if (seen.has(time)) throw Error('Duplicate strategy signal');
    seen.add(time);
    const index=barIndexes.get(time);
    if (index===undefined) throw Error('Signal timestamp is not a validated closed candle');
    if (index===bars.length-1) throw Error('Signal on final candle has no next open for execution');
  }
}

/*
 * Each experiment must provide independent, causal signal arrays.
 * This code does NOT invent signals or certify TradingView parity.
 */
export function runResearchBatch({
  market,historyWindow,candles,experiments,
  costs={feeRate:0.0006,slippageRate:0.0005,initialCapital:1000,allocation:1}
}={}) {
  checkMarket(market,historyWindow);
  if (!Array.isArray(candles)) throw Error('Candles array required');
  if (!Array.isArray(experiments) || !experiments.length) throw Error('At least one experiment required');
  if (!costs || !Number.isFinite(costs.feeRate) || !Number.isFinite(costs.slippageRate))
    throw Error('Explicit finite fee and slippage rates required');

  // Reject gaps, duplicates or unexplained OHLC. No implicit repair here:
  // source-side, provenance-checked normalisation must happen beforehand.
  const classified=classifyHistory(candles,historyWindow);
  const clean=requireCleanHistory(classified);
  if (clean.length<3) throw Error('At least three closed bars required');

  const names=new Set(), results=[];
  for (const exp of experiments) {
    if (!exp || typeof exp.id!=='string' || !/^[A-Za-z0-9_-]{1,60}$/.test(exp.id) || names.has(exp.id))
      throw Error('Invalid or duplicate experiment id');
    names.add(exp.id);
    if (exp.signalTimeConvention!=='confirmation-bar-open')
      throw Error('Signals must be timestamped at their confirmed candle, never backdated to a pivot');
    validateSignals(exp.signals,clean);
    // No order routing. Existing engine executes at NEXT candle open.
    const report=runBacktest(clean,exp.signals,{
      ...costs, historyWindow,bitunixOpenEnvelopeResearch:false
    });
    results.push({
      id:exp.id,
      signalCount:exp.signals.length,
      indicatorParity:exp.indicatorParity==='VERIFIED'?'VERIFIED':'UNVERIFIED',
      report
    });
  }
  return {
    status:'RESEARCH_ONLY',
    market:{exchange:market.exchange,priceType:market.priceType,symbol:market.symbol,timeframe:market.timeframe},
    historyWindow:{...historyWindow},
    dataGate:{status:'READY',checkedClosedBars:clean.length,invalid:0,missing:0,duplicates:0},
    results,
    warnings:[
      'Bitunix data quality passed this window only; no independent exhaustive TradingView comparison is claimed.',
      'Indicator parity and signal profitability require independent validation and out-of-sample testing.',
      'No orders are placed. No real funds or autonomous trading are enabled.',
      'Separate strategies use independent starting capital; returns must not be added together.'
    ]
  };
}
