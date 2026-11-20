/*
 * CJ Cipher V1.0 failure-mode diagnosis, NOT a V1.1 optimizer.
 * Reconstruct EXACT historical one-position reversal trades from
 * archived double-read Bitunix source, with matching costs and split.
 *
 * Ex post categories do NOT represent causal filters, live decisions,
 * independent holdouts or reliable probabilities.
 * The original CJ Cipher formula and rules are NOT changed.
 */
import {runBacktest} from '../engine.mjs';
import {calculateCjCipherWaveTrend,cjCipherConfirmedCommands}
 from './cj-cipher-wavetrend-v1.mjs';

export const CIPHER_DIAGNOSIS_LOCK=Object.freeze({
 id:'CJ_CIPHER_WT_V1_EXACT_ARCHIVED_TRADE_FAILURE_MODES',
 runId:44656240484,
 symbols:['BTCUSDT','HYPEUSDT','1000PEPEUSDT'],
 timeframe:'1h',closedBars:960,trainingBars:672,
 rapidReversalBars:[3,6],
 visualExtremeReference:53,
 selectionOfNewParameters:false,
 forwardSignalUse:false
});
const round=n=>Number.isFinite(n)?Math.round(n*1e6)/1e6:null;
const sum=x=>x.reduce((a,b)=>a+b,0);
const mean=x=>x.length?sum(x)/x.length:null;
function getBucket(){
 return {count:0,netWins:0,netLosses:0,
   rawDirectionalPositive:0,rawDirectionalNegative:0,
   rawPositiveButNetNegative:0,netPnlSum:0};
}
function push(bucket,x){
 bucket.count++;
 if(x.netPnl>0)bucket.netWins++;
 if(x.netPnl<0)bucket.netLosses++;
 if(x.rawDirectionalPct>0)bucket.rawDirectionalPositive++;
 if(x.rawDirectionalPct<0)bucket.rawDirectionalNegative++;
 if(x.rawDirectionalPct>0&&x.netPnl<0)
  bucket.rawPositiveButNetNegative++;
 bucket.netPnlSum+=x.netPnl;
}
function finalize(b){
 return {...b,netPnlSum:round(b.netPnlSum),
  netWinRatePct:b.count?round(b.netWins/b.count*100):null};
}
function median(arr){
 if(!arr.length)return null;
 const s=[...arr].sort((a,b)=>a-b),i=Math.floor(s.length/2);
 return s.length%2?s[i]:(s[i-1]+s[i])/2;
}
/*
 * bars are EXACTLY one phase: no carry-over across the 70/30 boundary.
 * input wholeSourceSignals were confirmed on closed candles, and entries
 * are next OPEN, independently of how a graphical cross is drawn.
 */
export function diagnoseCjCipherPhase({
 bars,wholeSourceSignals,phase,market,costs,sourceWarmup=null
}={}){
 if(!Array.isArray(bars)||bars.length<3||
    !Array.isArray(wholeSourceSignals)||
    !['training','holdout'].includes(phase)||
    market?.exchange!=='Bitunix'||
    market?.priceType!=='LAST_PRICE'||
    market?.timeframe!=='1h'||
    !CIPHER_DIAGNOSIS_LOCK.symbols.includes(market.symbol)||
    !costs||!(costs.initialCapital>0)||
    !Number.isFinite(costs.feeRate)||
    !Number.isFinite(costs.slippageRate)||
    costs.allocation!==1)
  throw Error('Invalid fixed CJ Cipher archived diagnostic inputs');
 const step=3600000,byTime=new Map();
 for(let i=0;i<bars.length;i++){
  if(!Number.isSafeInteger(bars[i]?.time)||
     (i>0&&bars[i].time-bars[i-1].time!==step))
   throw Error('Non-continuous closed history');
  byTime.set(bars[i].time,i);
 }
 const signalMap=new Map();let last=-Infinity;
 for(const sig of wholeSourceSignals){
  if(!Number.isSafeInteger(sig?.time)||sig.time<=last||
     !['long','short'].includes(sig.side))
   throw Error('Noncausal, duplicate or invalid original WaveTrend signal');
  last=sig.time;
  if(!byTime.has(sig.time))continue;
  if(byTime.get(sig.time)===bars.length-1)
   continue; // next OPEN lies across phase boundary: explicitly excluded
  signalMap.set(sig.time,sig.side);
 }
 const signals=[...signalMap].map(([time,side])=>({time,side}));
 const window={startTime:bars[0].time,
   endTime:bars.at(-1).time+step,intervalMs:step};
 const report=runBacktest(bars,signals,{...costs,historyWindow:window,
   bitunixOpenEnvelopeResearch:false});
 const wave=sourceWarmup??calculateCjCipherWaveTrend(bars);
 const byWave=new Map(wave.map(x=>[x.time,x]));
 const stats={totalTrades:0,netWinners:0,netLosers:0,
  grossNegative:0,rawPositiveButNetNegative:0,
  reversedWithin3:0,reversedWithin6:0,
  timedOutAtPhaseEnd:0,
  favorableExtremeSignals:0,otherZoneSignals:0,
  favorableExtremeNetWins:0,otherZoneNetWins:0,
  long: getBucket(),short:getBucket(),
  favorableExtreme:getBucket(),otherZone:getBucket(),
  holdBars:[],rawDirectionalPct:[],netTradePct:[]};
 const details=[];
 const times=new Map(bars.map((b,i)=>[b.time,i]));
 for(const t of report.trades){
  const index=times.get(t.entryTime),exitIndex=times.get(t.exitTime);
  if(index===undefined||exitIndex===undefined||index<=0||exitIndex<index)
   throw Error('Impossible next-open paper trade chronology');
  const signalBar=bars[index-1],side=t.side==='long'?1:-1;
  if(signalMap.get(signalBar.time)!==t.side)
   throw Error('Paper trade not backed by an original confirmed cross');
  const waveSignal=byWave.get(signalBar.time);
  if(!waveSignal||waveSignal.signal!==t.side)
   throw Error('Source WaveTrend values and paper trading disagree');
  const exitBar=bars[exitIndex];
  const rawExit=t.reason==='end_of_data'?exitBar.close:exitBar.open;
  const rawEntry=bars[index].open;
  const rawDirectionalPct=100*side*(rawExit/rawEntry-1);
  const netTradePct=100*t.pnl/(t.entry*t.quantity);
  const holdBars=(t.exitTime-t.entryTime)/step;
  const rapidReversal=t.reason==='signal';
  const favorableExtreme=t.side==='long'?waveSignal.wt2<=-53:
   waveSignal.wt2>=53;
  const item={
    signalUtc:new Date(signalBar.time).toISOString(),
    entryUtc:new Date(t.entryTime).toISOString(),
    exitUtc:new Date(t.exitTime).toISOString(),
    side:t.side,exitReason:t.reason,holdBars,
    wt1:round(waveSignal.wt1),wt2:round(waveSignal.wt2),
    crossGapAbs:round(Math.abs(waveSignal.wt1-waveSignal.wt2)),
    favorableExtreme,
    rawDirectionalPct:round(rawDirectionalPct),
    netTradePct:round(netTradePct),
    netPnl:round(t.pnl),entryRaw:rawEntry,exitRaw:rawExit,
    profitAfterFees:t.pnl>0,
    rawFavorableButNetLoss:rawDirectionalPct>0&&t.pnl<0
  };
  details.push(item);
  stats.totalTrades++;
  stats.netWinners+=Number(t.pnl>0);
  stats.netLosers+=Number(t.pnl<0);
  stats.grossNegative+=Number(rawDirectionalPct<0);
  stats.rawPositiveButNetNegative+=Number(item.rawFavorableButNetLoss);
  stats.reversedWithin3+=Number(rapidReversal&&holdBars<=3);
  stats.reversedWithin6+=Number(rapidReversal&&holdBars<=6);
  stats.timedOutAtPhaseEnd+=Number(t.reason==='end_of_data');
  if(favorableExtreme){
   stats.favorableExtremeSignals++;
   stats.favorableExtremeNetWins+=Number(t.pnl>0);
  }else{
   stats.otherZoneSignals++;
   stats.otherZoneNetWins+=Number(t.pnl>0);
  }
  push(stats[t.side],item);
  push(stats[favorableExtreme?'favorableExtreme':'otherZone'],item);
  stats.holdBars.push(holdBars);
  stats.rawDirectionalPct.push(rawDirectionalPct);
  stats.netTradePct.push(netTradePct);
 }
 if(details.length!==report.tradeCount)
  throw Error('Diagnostic reconstructed trade count does not match engine');
 const result={
   phase,sourceSignals:signals.length,
   realizedTradeCount:report.tradeCount,
   sourceLastBarTimeUtc:new Date(bars.at(-1).time).toISOString(),
   simulatedReturnPct:round(report.returnPct),
   simulatedWinRatePct:round(report.winRate),
   simulatedMaxDrawdownPct:round(report.maxDrawdownPct),
   netWinners:stats.netWinners,netLosers:stats.netLosers,
   grossNegative:stats.grossNegative,
   rawPositiveButNetNegative:stats.rawPositiveButNetNegative,
   rapidOpposite3:stats.reversedWithin3,
   rapidOpposite6:stats.reversedWithin6,
   finalBarForcedExits:stats.timedOutAtPhaseEnd,
   medianHoldBars:round(median(stats.holdBars)),
   meanHoldBars:round(mean(stats.holdBars)),
   medianRawDirectionalMovePct:round(median(stats.rawDirectionalPct)),
   meanRawDirectionalMovePct:round(mean(stats.rawDirectionalPct)),
   directionalGroups:{
    long:finalize(stats.long),short:finalize(stats.short)
   },
   waveReferenceGroups:{
    favorableExtreme:finalize(stats.favorableExtreme),
    otherZone:finalize(stats.otherZone)
   },
   details,
   warnings:[
    'Reason categories and favorable-extreme thresholds are descriptive. No V1.1 parameters were selected on these returns.',
    'Gross directional move uses the source next-open/exit next-open (or final close) and excludes fee/slippage; net PnL uses the original paper engine.',
    'First 70% and final 30% history are already inspected; not independent or prospective.',
    'A rapid opposite cross is not necessarily a false signal; it may be an appropriate exit or a late entry.',
    'This historical reversal-only simulator has NO ATR stop, take profit, or duration cap.',
    'WT1/WT2 are port estimates on Bitunix LAST_PRICE; TradingView numerical parity not established, but is not required to develop hypotheses.',
    'Research-only. No real orders or automatic promotion.'
   ]
 };
 return result;
}
