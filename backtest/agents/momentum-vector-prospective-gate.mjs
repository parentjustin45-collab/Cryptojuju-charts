/*
 * Immutable Momentum+Vector prospective eligibility gate (research only).
 * Applies preregistered cutoff 2026-11-21T00:00:00Z EXCLUSIVELY.
 * Pre-cutoff bars may warm up indicators but NEVER count as prospective
 * signals or closed trades. No network, orders, parameter changes or
 * historical "winner" selection.
 */
export const MOM_VECTOR_PROSPECTIVE_LOCK=Object.freeze({
 cutoffMs:Date.parse('2026-11-21T00:00:00Z'),
 intervalMs:3600000,closedBars:960,
 symbols:Object.freeze(['BTCUSDT','HYPEUSDT','1000PEPEUSDT']),
 strategies:Object.freeze(['momentum_fusion_v1','vector_v11','vector_v11_momentum_confirmed']),
 minimumDays:30,minimumClosedTradesPerArmPerMarket:30,
 priceType:'LAST_PRICE'
});
const validSha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const fail=(reason,details={})=>({
 status:'BLOCKED',reason,...details,eligibleSignals:[],eligibleTrades:[],
 promoted:false,ordersPlaced:false
});
/**
 * Both source and repeatability reports MUST refer to the exact 960 closed
 * candles and same time window; source SHA and overlap SHA must match.
 * Each trade must have its own confirmation timestamp (not merely entry),
 * and a verified exit candle's close. This is an eligibility audit only,
 * not a portfolio backtest or a claim of profitability.
 */
export function auditMomentumVectorProspective({
 source,repeatability,symbol,strategy,asOfMs,signals=[],trades=[]
}={}){
 const lock=MOM_VECTOR_PROSPECTIVE_LOCK,H=lock.intervalMs,C=lock.cutoffMs;
 if(!lock.symbols.includes(symbol)||!lock.strategies.includes(strategy))
  return fail('UNREGISTERED_MARKET_OR_STRATEGY');
 if(!Number.isSafeInteger(asOfMs)||asOfMs<=C)
  return fail('PROSPECTIVE_PERIOD_NOT_STARTED');
 if(!Array.isArray(signals)||!Array.isArray(trades))
  return fail('INVALID_EVENT_COLLECTION');
 const bars=source?.acceptedCandles,w=source?.historyWindow,r=repeatability;
 if(source?.status!=='DATA_READY_FOR_RESEARCH_ONLY'||
    source.market?.exchange!=='Bitunix'||source.market?.priceType!==lock.priceType||
    source.market?.symbol!==symbol||source.market?.timeframe!=='1h'||
    !w||w.intervalMs!==H||!Number.isSafeInteger(w.startTime)||
    !Number.isSafeInteger(w.endTime)||w.endTime-w.startTime!==960*H||
    !Array.isArray(bars)||bars.length!==960||
    source.provenance?.formingBarExcluded!==true||
    !validSha(source.provenance?.rawSha256)||
    !validSha(source.provenance?.derivedSha256))
  return fail('INVALID_960_CLOSED_BITUNIX_SOURCE');
 if(r?.status!=='STABLE_TWO_READS'||r.differenceCount!==0||
    r.checkedDerived!==960||
    r.market?.exchange!=='Bitunix'||r.market?.symbol!==symbol||
    r.market?.timeframe!=='1h'||r.historyWindow?.startTime!==w.startTime||
    r.historyWindow?.endTime!==w.endTime||r.historyWindow?.intervalMs!==H||
    r.firstRawSha256!==source.provenance.rawSha256||
    !validSha(r.secondRawSha256)||
    !validSha(r.overlapRawSha256First)||
    r.overlapRawSha256First!==r.overlapRawSha256Second)
  return fail('DOUBLE_READ_NOT_VERIFIED');
 const index=new Map();
 for(let i=0;i<bars.length;i++){
  const b=bars[i],expected=w.startTime+i*H;
  if(b?.time!==expected||b.time+H>asOfMs||
     ![b.open,b.high,b.low,b.close].every(Number.isFinite)||
     b.open<=0||b.close<=0||b.low<=0||
     b.high<Math.max(b.open,b.close)||b.low>Math.min(b.open,b.close))
   return fail('GAPPED_FORMING_OR_INVALID_CLOSED_OHLC');
  index.set(b.time,b);
 }
 const eligibleSignals=[],eligibleTrades=[],seenSignals=new Set(),seenTrades=new Set();
 for(const e of signals){
  if(!Number.isSafeInteger(e?.time)||seenSignals.has(e.time)||
     !['long','short','flat'].includes(e.side)||!index.has(e.time))
   return fail('INVALID_OR_DUPLICATE_SIGNAL');
  seenSignals.add(e.time);
  const confirmedAtCloseMs=e.time+H;
  if(confirmedAtCloseMs>C){
   if(confirmedAtCloseMs>=w.endTime||confirmedAtCloseMs>asOfMs)
    return fail('SIGNAL_WITHOUT_NEXT_OPEN_OR_CONFIRMED_CLOSE');
   eligibleSignals.push({...e,confirmedAtCloseMs,
    earliestExecutionAtMs:confirmedAtCloseMs});
  }
 }
 for(const t of trades){
  const {confirmationTime,entryTime,exitTime}=t??{};
  if(![confirmationTime,entryTime,exitTime].every(Number.isSafeInteger)||
     !index.has(confirmationTime)||!index.has(entryTime)||!index.has(exitTime)||
     entryTime!==confirmationTime+H||entryTime>exitTime||
     seenTrades.has([confirmationTime,entryTime,exitTime].join(':')))
   return fail('INVALID_TRADE_TIMELINE_OR_UNVERIFIED_CANDLE');
  seenTrades.add([confirmationTime,entryTime,exitTime].join(':'));
  // A closed trade must originate from an actually supplied, confirmed
  // directional event. Otherwise an arbitrary PnL record could be counted
  // without the strategy ever producing that entry (fabricated attribution).
  const origin=signals.find(e=>e.time===confirmationTime);
  if(!origin||!['long','short'].includes(origin.side)||
     (t.side!==undefined&&t.side!==origin.side))
   return fail('TRADE_WITHOUT_MATCHING_CONFIRMED_SIGNAL');
  const confirmedAtCloseMs=confirmationTime+H;
  const entryClosedAtMs=entryTime+H,exitClosedAtMs=exitTime+H;
  if(confirmedAtCloseMs>C&&entryTime>C&&exitTime>C){
   if(exitClosedAtMs>asOfMs||exitClosedAtMs>w.endTime)
    return fail('EXIT_CANDLE_NOT_YET_CLOSED');
   eligibleTrades.push({...t,confirmedAtCloseMs,entryClosedAtMs,exitClosedAtMs});
  }
 }
 const elapsedMs=Math.max(0,Math.min(asOfMs,w.endTime)-C);
 const days=elapsedMs/86400000;
 const sufficient=days>=lock.minimumDays&&
  eligibleTrades.length>=lock.minimumClosedTradesPerArmPerMarket;
 return {
  status:sufficient?'DESCRIPTIVE_SAMPLE_THRESHOLD_MET':'INSUFFICIENT_PROSPECTIVE_EVIDENCE',
  symbol,strategy,asOfMs,cutoffExclusiveMs:C,
  elapsedVerifiedDays:days,verifiedClosedBars:bars.length,
  eligibleSignals,eligibleTrades,eligibleSignalCount:eligibleSignals.length,
  eligibleClosedTradeCount:eligibleTrades.length,
  excludedWarmupSignals:signals.length-eligibleSignals.length,
  excludedWarmupOrBoundaryTrades:trades.length-eligibleTrades.length,
  sourceRawSha256:source.provenance.rawSha256,
  sourceDerivedSha256:source.provenance.derivedSha256,
  repeatability:'STABLE_TWO_READS',
  note:'Threshold met is descriptive only, not proof of predictive power. This gate does not reconstruct positions or PnL.',
  promoted:false,ordersPlaced:false
 };
}
