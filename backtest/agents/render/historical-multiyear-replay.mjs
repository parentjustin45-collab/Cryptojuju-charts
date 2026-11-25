/*
 * CryptoJuju continuous two-year research replay v1.
 * Analyzes all validated closed bars ONCE per source sequence, not a rolling
 * 480-bar report. Four indicator originals + Frank v2.2 webapp research port.
 * Metrics are descriptive forward outcomes, NOT optimized trading rules,
 * real fills, prospective performance, Pine parity or return forecasts.
 */
import {loadHistoricalPeriod,historicalTargetFor,expectedHistoricalBars}
  from './historical-period.mjs';
import {vectorAIT} from '../../vector-ait-v1.mjs';
import {calculateMomentumFusion} from '../../momentum-fusion-v1.mjs';
import {classifySpeedCandleV3} from '../../speed-candle-v3.mjs';
import {calculateCjCipherWaveTrend} from '../cj-cipher-wavetrend-v1.mjs';
import {calculateFrankTestV22} from '../frank-test-v22-research.mjs';

const HORIZONS=[1,4,12];
const SIDE=new Set(['long','short']);
function requireStep(step){
  if(!Number.isFinite(step)||step<=0||step>10000)
    throw Error('VERIFIED_BITUNIX_PRICE_STEP_REQUIRED');
}
const id=(time,side,tag)=>({time,side,tag});
function extractSignals(bars,results){
  const events={vector:[],momentum:[],speed:[],cipher:[],
    frank_cross:[],frank_divergence:[]};
  const index=new Map(bars.map((b,i)=>[b.time,i]));
  for(let i=0;i<bars.length;i++){
    const time=bars[i].time;
    if(SIDE.has(results.vector[i].signal))
      events.vector.push(id(time,results.vector[i].signal,'vector_v11'));
    if(results.momentum[i].bullSignal||results.momentum[i].bearSignal)
      events.momentum.push(id(time,results.momentum[i].bullSignal?'long':'short','momentum_fusion'));
    if(results.speed[i].color){
      const color=results.speed[i].color;
      events.speed.push(id(time,color.startsWith('bull')?'long':'short',color));
    }
    if(SIDE.has(results.cipher[i].signal))
      events.cipher.push(id(time,results.cipher[i].signal,'cj_cipher_wt'));
  }
  for(const e of [...results.frank.buy,...results.frank.sell])
    events.frank_cross.push(id(e.confirmedAt,e.side,'frank_cross_webapp'));
  for(const e of results.frank.divergences)
    events.frank_divergence.push(id(e.confirmationTime,
      e.type.endsWith('+')?'long':'short',e.type));
  for(const [kind,rows] of Object.entries(events)){
    rows.sort((a,b)=>a.time-b.time);
    for(const e of rows)
      if(!index.has(e.time))throw Error('HISTORICAL_EVENT_NOT_ON_VERIFIED_CANDLE_'+kind);
  }
  return events;
}
function summarizeOutcome(bars,rows,splitIndex){
  const positions=new Map(bars.map((x,i)=>[x.time,i]));
  const phases={training:{events:0,horizons:{}},
    holdout:{events:0,horizons:{}}};
  for(const phase of Object.values(phases))
    for(const h of HORIZONS)phase.horizons[h]={samples:0,meanDirectionReturnPct:0,
      meanFavorableExcursionPct:0,meanAdverseExcursionPct:0,positivePct:0};
  for(const evt of rows){
    const i=positions.get(evt.time);
    if(!Number.isInteger(i)||i+1>=bars.length)continue;
    const side=evt.side==='long'?1:-1;
    const isHoldout=i>=splitIndex;
    const phase=isHoldout?phases.holdout:phases.training;
    phase.events++;
    for(const h of HORIZONS){
      const last=i+h;
      if(last>=bars.length||(!isHoldout&&last>=splitIndex))continue;
      const entry=bars[i+1].open,exit=bars[last].close;
      if(entry<=0||!Number.isFinite(entry)||!Number.isFinite(exit))continue;
      let hi=-Infinity,lo=Infinity;
      for(let k=i+1;k<=last;k++){
        hi=Math.max(hi,bars[k].high);lo=Math.min(lo,bars[k].low);
      }
      const pnl=100*side*(exit-entry)/entry;
      const favorable=100*(side===1?hi-entry:entry-lo)/entry;
      const adverse=100*(side===1?entry-lo:hi-entry)/entry;
      const stat=phase.horizons[h];
      stat.samples++;
      stat.meanDirectionReturnPct+=pnl;
      stat.meanFavorableExcursionPct+=favorable;
      stat.meanAdverseExcursionPct+=adverse;
      stat.positivePct+=Number(pnl>0);
    }
  }
  for(const phase of Object.values(phases))
    for(const stat of Object.values(phase.horizons))
      if(stat.samples){
        for(const k of ['meanDirectionReturnPct','meanFavorableExcursionPct',
          'meanAdverseExcursionPct','positivePct'])
          stat[k]/=stat.samples;
        stat.positivePct*=100;
      }else{
        for(const k of ['meanDirectionReturnPct','meanFavorableExcursionPct',
          'meanAdverseExcursionPct','positivePct'])stat[k]=null;
      }
  return phases;
}
function causalChecks(bars,results,priceStep){
  const n=bars.length;
  const cuts=[240,480,Math.floor(n*.7),n-1].filter(x=>x>=240&&x<n);
  let checked=0;
  for(const cut of new Set(cuts)){
    const truncated=bars.slice(0,cut);
    const v=vectorAIT(truncated,{minTick:priceStep});
    const m=calculateMomentumFusion(truncated);
    const s=classifySpeedCandleV3(truncated,{minTick:priceStep});
    const c=calculateCjCipherWaveTrend(truncated);
    const f=calculateFrankTestV22(truncated);
    const i=cut-1;
    if(JSON.stringify(v[i])!==JSON.stringify(results.vector[i])||
      JSON.stringify(m[i])!==JSON.stringify(results.momentum[i])||
      JSON.stringify(s[i])!==JSON.stringify(results.speed[i])||
      JSON.stringify(c[i])!==JSON.stringify(results.cipher[i])||
      f.oscillator[i]!==results.frank.oscillator[i])
      throw Error('HISTORICAL_REPLAY_LOOKAHEAD_OR_NONDETERMINISM_AT_'+cut);
    const fullDivs=results.frank.divergences.filter(x=>x.confirmationIndex<=i)
      .map(x=>[x.type,x.pivotIndex,x.confirmationIndex]);
    const shortDivs=f.divergences.map(x=>[x.type,x.pivotIndex,x.confirmationIndex]);
    if(JSON.stringify(fullDivs)!==JSON.stringify(shortDivs))
      throw Error('FRANK_HISTORICAL_DIVERGENCE_REPAINT_AT_'+cut);
    checked++;
  }
  return checked;
}
export function studyContinuousHistoricalPeriod(source,{priceStep}={}){
  requireStep(priceStep);
  const target=historicalTargetFor(source?.market?.symbol,source?.market?.timeframe);
  if(source?.source!=='CJ_HISTORICAL_POSTGRES_TWO_READ_VERIFIED_V1'||
    source.status!=='CONTIGUOUS_SHA256_VERIFIED_UTC'||
    source.market?.priceType!=='LAST_PRICE'||
    !/^[a-f0-9]{64}$/.test(source.sequenceSha256??'')||
    source.historyWindow?.startTime!==target.startMs||
    source.historyWindow?.endTime!==target.endMs||
    source.candles?.length!==expectedHistoricalBars({
      timeframe:source.market.timeframe,
      startMs:source.historyWindow.startTime,endMs:source.historyWindow.endTime
    }))
    throw Error(target.coverageKind==='FULL_TWO_YEAR'?'REPLAY_REQUIRES_COMPLETE_TWO_YEAR_VERIFIED_SOURCE':'REPLAY_REQUIRES_COMPLETE_LISTING_ADJUSTED_VERIFIED_SOURCE');
  const bars=source.candles,n=bars.length;
  const results={
    vector:vectorAIT(bars,{minTick:priceStep}),
    momentum:calculateMomentumFusion(bars),
    speed:classifySpeedCandleV3(bars,{minTick:priceStep}),
    cipher:calculateCjCipherWaveTrend(bars),
    frank:calculateFrankTestV22(bars)
  };
  if(Object.values(results).slice(0,4).some(x=>x.length!==n))
    throw Error('INDICATOR_REPLAY_OUTPUT_LENGTH_MISMATCH');
  const prefixChecks=causalChecks(bars,results,priceStep);
  const events=extractSignals(bars,results),splitIndex=Math.floor(n*.7);
  const byIndicator=Object.fromEntries(
    Object.entries(events).map(([name,rows])=>[name,{
      signalCount:rows.length,
      trainHoldout:summarizeOutcome(bars,rows,splitIndex),
      signals:rows
    }]));
  return {
    protocol:'CJ_CONTINUOUS_TWO_YEAR_FIVE_INDICATOR_REPLAY_V1',
    status:target.coverageKind==='FULL_TWO_YEAR'?'TWO_YEAR_CAUSAL_RESEARCH_COMPLETE_NOT_PERFORMANCE_CERTIFIED':'LISTING_ADJUSTED_CAUSAL_RESEARCH_COMPLETE_NOT_PERFORMANCE_CERTIFIED',
    coverageKind:target.coverageKind,launchMs:target.launchMs,
    symbol:source.market.symbol,timeframe:source.market.timeframe,
    startTime:source.historyWindow.startTime,endTime:source.historyWindow.endTime,
    sourceSequenceSha256:source.sequenceSha256,
    closedCandles:n,causalPrefixChecks:prefixChecks,
    holdoutStartTime:bars[splitIndex].time,
    executionConvention:'signal confirmed at candle close, hypothetical entry next candle open',
    horizonBars:HORIZONS,
    priceStep,priceStepSource:'verified Bitunix trading_pairs caller',
    indicators:byIndicator,
    frankImplementation:'WEBAPP_v2.2_PORT_NOT_PINE_PARITY',
    noLookaheadTestsPassed:true,trainingOptimizationPerformed:false,
    feesAndSlippageIncluded:false,marketOrdersPlaced:0,
    profitCertification:false,
    disclaimer:'Forward excursions are descriptive and hypothetical; no real trading performance, lookahead profit, price prediction or optimized signals.'
  };
}
export async function replayCompletePeriodFromPostgres(db,{symbol,timeframe,priceStep}={}){
  const source=await loadHistoricalPeriod(db,{symbol,timeframe});
  return studyContinuousHistoricalPeriod(source,{priceStep});
}
