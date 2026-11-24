/*
 * Historical indicator bridge: reusable, causal four-indicator research on
 * EXACTLY contiguous, fingerprinted candles retrieved from PostgreSQL.
 * First stage: 480 candles. Not yet the full two-year warmup/holdout engine.
 */
import {loadContiguousHistoricalWindow} from './historical-library.mjs';
import {vectorAIT} from '../../vector-ait-v1.mjs';
import {calculateMomentumFusion} from '../../momentum-fusion-v1.mjs';
import {classifySpeedCandleV3} from '../../speed-candle-v3.mjs';
import {calculateCjCipherWaveTrend} from '../cj-cipher-wavetrend-v1.mjs';
import {buildCjCipherComparison} from '../cj-cipher-comparison.mjs';

const prefixCuts=[240,360,480];
const signals=(rows,kind)=>{
  if(kind==='vector')return rows.filter(x=>['long','short'].includes(x.signal)).length;
  return rows.filter(x=>x.bullSignal===true||x.bearSignal===true).length;
};
export function studyFourIndicatorsOnHistoricalCandles(source,{priceStep}={}){
  if(source?.source!=='CJ_HISTORICAL_POSTGRES_TWO_READ_VERIFIED_V1'||
    source.market?.priceType!=='LAST_PRICE'||
    !Number.isFinite(priceStep)||priceStep<=0||
    source.candles?.length!==480||
    source.historyWindow?.endTime-source.historyWindow?.startTime!==
      480*source.historyWindow?.intervalMs)
    throw Error('REPLAY_REQUIRES_STRICT_480_BAR_DB_SOURCE_AND_PRICE_STEP');
  const bars=source.candles;
  const vector=vectorAIT(bars,{minTick:priceStep});
  const momentum=calculateMomentumFusion(bars);
  const speed=classifySpeedCandleV3(bars);
  const cipher=calculateCjCipherWaveTrend(bars);
  const combined=buildCjCipherComparison(bars,{priceStep});
  if([vector,momentum,speed,cipher].some(x=>x.length!==480))
    throw Error('HISTORICAL_INDICATOR_OUTPUT_INCOMPLETE');
  for(const cut of prefixCuts){
    const reduced=bars.slice(0,cut);
    const versions=[
      [vector,vectorAIT(reduced,{minTick:priceStep})],
      [momentum,calculateMomentumFusion(reduced)],
      [speed,classifySpeedCandleV3(reduced)],
      [cipher,calculateCjCipherWaveTrend(reduced)]
    ];
    for(const [full,partial] of versions){
      if(JSON.stringify(full[cut-1])!==JSON.stringify(partial[cut-1]))
        throw Error('HISTORICAL_REPLAY_POSSIBLE_LOOKAHEAD');
    }
  }
  return {
    protocol:'CJ_FOUR_INDICATOR_HISTORICAL_REPLAY_V1',
    status:'CAUSAL_480_BAR_POSTGRES_REPLAY_COMPLETE',
    symbol:source.market.symbol,timeframe:source.market.timeframe,
    historyWindow:source.historyWindow,
    evaluatedBars:480,prefixChecks:3,
    source:'CANONICAL_POSTGRES_VERIFIED_CANDLES',
    priceStep,priceStepOrigin:'CALLER_MUST_VERIFY_BITUNIX_METADATA',
    vectorSignals:signals(vector,'vector'),
    momentumSignals:signals(momentum,'momentum'),
    speedSignalChanges:speed.filter(x=>x.color).length,
    cipherSignals:signals(cipher,'cipher'),
    combinedSignals:combined.signalCounts,
    eventTimeline:{
      vector:vector.filter(x=>x.signal).map(x=>({time:x.time,side:x.signal})),
      momentum:momentum.filter(x=>x.bullSignal||x.bearSignal)
        .map(x=>({time:x.time,side:x.bullSignal?'long':'short'})),
      cipher:cipher.filter(x=>x.signal).map(x=>({time:x.time,side:x.signal})),
      speed:speed.filter(x=>x.color).map(x=>({time:x.time,
        color:x.color,side:x.color.startsWith('bull')?'long':'short'}))
    },
    historicalTwoYearsComplete:false,trainingOptimizationPerformed:false,
    independentTradingViewParity:false,tradingEnabled:false,ordersPlaced:0,
    warning:'This is a 480-bar prototype. Full two-year sequence, warmup, train/holdout, performance and improvement studies remain to be implemented.'
  };
}
export async function replayFourFromHistoricalLibrary(db,selector){
  const source=await loadContiguousHistoricalWindow(db,selector);
  return studyFourIndicatorsOnHistoricalCandles(source,{priceStep:selector.priceStep});
}
