/* Small timeframe pilot: first 12,000 bars of the existing training portion,
 * never a rolling window or holdout. The full source digest is still checked. */
import {createHash} from 'node:crypto';
import {generate} from './autonomous-rule-candidates.mjs';
export const SMALL_TIMEFRAMES=Object.freeze(['30m','15m']);
export const SMALL_WINDOW_BARS=12000;
export const SMALL_WINDOW_POLICY='CJ_FIRST_12000_TRAINING_BARS_V1';
const need=(v,m)=>{if(!v)throw Error(m)};
export function boundedTrainingWindow(source,archive,channel){
 const total=source.barCount,n=Math.floor(total*.7),candles=source.candles;
 need(Array.isArray(candles)&&candles.length===total&&n>=150&&archive.holdoutStartTime===candles[n]?.time,'WINDOW_TRAIN_BOUNDARY');
 const small=SMALL_TIMEFRAMES.includes(source.market.timeframe);
 const count=small?Math.min(n,SMALL_WINDOW_BARS):n;
 need(count<=14000,'WINDOW_TRAIN_LIMIT');
 const bars=candles.slice(0,count);
 const window=small?{policy:SMALL_WINDOW_POLICY,startTime:bars[0].time,endTime:bars.at(-1).time,trainingBars:count,totalTrainingBars:n,unusedTrainingBars:n-count,holdoutBars:total-n,windowSha256:createHash('sha256').update(JSON.stringify(bars)).digest('hex')}:null;
 // Reproduce all original signals in this bounded prefix, including confirmation dates.
 const original=generate(channel,bars,archive.priceStep,false);
 const expected=archive.indicators[channel].signals.filter(x=>x.time<=bars.at(-1).time);
 need(JSON.stringify(original.signals)===JSON.stringify(expected),'WINDOW_BASELINE_SIGNAL_PARITY');
 return {bars,window,holdoutBars:total-n,totalTrainingBars:n};
}
