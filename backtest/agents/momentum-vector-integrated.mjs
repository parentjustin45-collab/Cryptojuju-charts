/*
 * CryptoJuju — three preregistered research comparisons:
 * 1. Vector V1.1 raw confirmed signals, 2. Momentum Fusion V1 source
 * bull/bear CROSS alerts, 3. Vector V1.1 with a previously studied
 * CLOSED-BAR Momentum composite/EMA gate (NOT newly optimized).
 *
 * A rejected opposing reversal emits FLAT next open; otherwise the old
 * position could be misleadingly held. All candidates, parity, and fills
 * remain research-only. Pine numerical parity is NOT established.
 */
import {vectorAIT} from '../vector-ait-v1.mjs';
import {applyVectorConfirmation} from '../vector-antiwhipsaw-v12.mjs';
import {calculateMomentumFusion,MOMFUSION_DEFAULTS}
 from '../momentum-fusion-v1.mjs';
import {INTEGRATED_MOMENTUM_IDS}
 from './vector-integrated-risk.mjs';

export const MOMENTUM_VECTOR_PILOT_LOCK=Object.freeze({
  study:'CJ_V11_MOMFUSION_PAIRED_INTEGRATED_1H_V1',
  symbols:['BTCUSDT','HYPEUSDT','1000PEPEUSDT'],
  timeframe:'1h',closedBars:960,
  warmupBars:168,
  strategies:[...INTEGRATED_MOMENTUM_IDS],
  momParameters:MOMFUSION_DEFAULTS,
  combinedGate:'Vector LONG: composite>50 and EMA21>EMA55; SHORT composite<50 and EMA21<EMA55',
  directionFrom:'confirmation-bar close; execute next-bar open',
  rejectedOpposite:'FLAT next bar open',
  dailyApplied:false,
  sourceParity:'UNVERIFIED_PINE_TV'
});
const ok=n=>typeof n==='number'&&Number.isFinite(n);
export function buildMomentumVectorVariants({
  bars,contract
}={}){
 if(!Array.isArray(bars)||bars.length<169||
    !contract||!Number.isFinite(contract.priceStep)||
    contract.priceStep<=0||contract.stepStatus!=='RESEARCH_PRICE_PRECISION_NOT_TV_MINTICK')
  throw Error('Missing completed OHLC and verified Bitunix precision metadata');
 for(let i=0;i<bars.length;i++){
  const b=bars[i];
  if(!Number.isSafeInteger(b?.time)||!(i===0||b.time-bars[i-1].time===3600000)||
     ![b?.open,b?.high,b?.low,b?.close].every(ok)||
     b.open<=0||b.close<=0||b.low<=0||
     b.high<Math.max(b.open,b.close)||b.low>Math.min(b.open,b.close))
   throw Error('Unverified, malformed or discontinuous 1h OHLC');
 }
 const vector=applyVectorConfirmation(bars,vectorAIT(bars,{minTick:contract.priceStep}),
   'baseline_v11').events;
 const momentum=calculateMomentumFusion(bars);
 const strategies=Object.fromEntries(INTEGRATED_MOMENTUM_IDS.map(id=>[id,[]]));
 const cases=[],counts={
  vectorCandidates:0,momentumLongSignals:0,momentumShortSignals:0,
  vectorAcceptedByMomentum:0,vectorRejectedByMomentum:0,
  combinedFlatsOnRejectedOpposites:0,notReady:0
 };
 let virtualSide=null;
 for(let i=MOMENTUM_VECTOR_PILOT_LOCK.warmupBars;i<bars.length-1;i++){
  const bar=bars[i],v=vector[i]?.signal,m=momentum[i];
  if(m.time!==bar.time||vector[i]?.time!==bar.time)
   throw Error('Indicator chronology mismatch');
  const bullish=ok(m.composite)&&m.composite>50&&m.bullTrend;
  const bearish=ok(m.composite)&&m.composite<50&&m.bearTrend;
  if(m.bullSignal&&m.bearSignal)
   throw Error('Momentum simultaneously bullish and bearish');
  if(m.bullSignal){
   strategies.momentum_fusion_v1.push({time:bar.time,side:'long'});
   counts.momentumLongSignals++;
  }else if(m.bearSignal){
   strategies.momentum_fusion_v1.push({time:bar.time,side:'short'});
   counts.momentumShortSignals++;
  }
  if(!v)continue;
  if(v!=='long'&&v!=='short')throw Error('Unexpected Vector direction');
  counts.vectorCandidates++;
  strategies.vector_v11.push({time:bar.time,side:v});
  let decision='REJECT';
  if(!ok(m.composite)) {
   counts.notReady++;decision='UNAVAILABLE';
  }else if(v==='long'&&bullish||v==='short'&&bearish)
   decision='ACCEPT';
  if(decision==='ACCEPT'){
   counts.vectorAcceptedByMomentum++;
   virtualSide=v;
   strategies.vector_v11_momentum_confirmed.push({time:bar.time,side:v});
  }else{
   counts.vectorRejectedByMomentum++;
   if(virtualSide&&virtualSide!==v){
    strategies.vector_v11_momentum_confirmed.push({time:bar.time,side:'flat'});
    virtualSide=null;
    counts.combinedFlatsOnRejectedOpposites++;
   }
  }
  cases.push({time:bar.time,signal:v,decision,
    momentumComposite:m.composite,emaBull:m.bullTrend,emaBear:m.bearTrend,
    momentumBullCross:m.bullSignal,momentumBearCross:m.bearSignal,
    confirmationCloseAt:bar.time+3600000,earliestEntryAt:bars[i+1].time});
 }
 return {status:'CAUSAL_COMMANDS_RESEARCH_ONLY',
  lock:MOMENTUM_VECTOR_PILOT_LOCK,
  commandsByVariant:strategies,
  counts,pairedEvents:cases,tradeOrdersPlaced:false,
  warnings:[
   'Vector and Momentum source inputs are unchanged; Pine/TradingView parity still unverified.',
   'Momentum-only trades arise ONLY from original Momentum Fusion bullSignal/bearSignal close-bar alerts.',
   'Vector+Momentum applies the previously tested composite 50 and EMA21/55 directional rule, NOT an optimized filter.',
   'When an opposing Vector reversal is rejected, the combined policy closes a previously authorized position to FLAT at next open.',
   'This study has no Daily filter. Add Daily only in a separate preregistered test.',
   'No future bar high/low/close is used to create signals. Historical results remain non-prospective.'
  ]
 };
}
