/*
 * Role 7: descriptive multi-market context from pre-accepted closed candles.
 * No network reads, prediction, indicator tuning or trade signals.
 */
import {createHash} from 'node:crypto';
import {record} from './shared.mjs';

const HOUR_MS=3_600_000;
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const mean=values=>values.reduce((sum,value)=>sum+value,0)/values.length;
const safeSymbol=value=>typeof value==='string'&&/^[A-Z0-9_]{3,40}$/.test(value);

/** Hash the normalized candle rows in a fixed column order. */
export function fingerprintMarketCandles(candles){
  const canonical=candles.map(c=>[c.time,c.open,c.high,c.low,c.close,c.volume]
    .map(Number));
  return `sha256:${createHash('sha256').update(JSON.stringify(canonical)).digest('hex')}`;
}

function blocked(reason,details={}){
  return record('market-context','BLOCKED',{reason,...details});
}

function validateSeries(series,context,syntheticOnly){
  const candles=series?.acceptedCandles;
  const provenance=series?.provenance;
  const window=series?.historyWindow;
  const expectedExchange=syntheticOnly?'SYNTHETIC':'Bitunix';
  if(series?.market?.exchange!==expectedExchange||series.market.priceType!=='LAST_PRICE'
      ||series.market.timeframe!=='1h'||!safeSymbol(series.market.symbol))
    return 'Only Bitunix LAST_PRICE 1h series are supported in this phase';
  if(!Array.isArray(candles)||candles.length<25)
    return 'At least 25 closed candles are required for the 24-hour comparison';
  if(!window||window.intervalMs!==HOUR_MS||!Number.isSafeInteger(window.startTime)
      ||!Number.isSafeInteger(window.endTime)||window.startTime%HOUR_MS!==0
      ||window.endTime%HOUR_MS!==0||window.endTime-window.startTime!==candles.length*HOUR_MS)
    return 'History window must be a complete, exclusive UTC 1h window';
  if(window.startTime!==context.startTime||window.endTime!==context.endTime)
    return 'All markets must use the same UTC history window';
  const expectedSource=syntheticOnly?'SYNTHETIC_FIXTURE':'Bitunix';
  const expectedAcceptance=syntheticOnly?'FIXTURE_ONLY':'PASS';
  if(provenance?.acceptanceStatus!==expectedAcceptance||provenance?.source!==expectedSource
      ||provenance?.priceType!=='LAST_PRICE'||provenance?.paginationComplete!==true
      ||provenance?.repeatedFetchMatches!==true||provenance?.formingBarExcluded!==true
      ||provenance?.ohlcAlignedToSource!==true)
    return 'Upstream Bitunix pagination, repeatability, closed-bar and OHLC-alignment checks must pass';
  if(!/^sha256:[a-f0-9]{64}$/.test(provenance?.candleFingerprint??'')
      ||fingerprintMarketCandles(candles)!==provenance.candleFingerprint)
    return 'Normalized candle fingerprint is missing or does not match the supplied rows';
  if(context.asOfTime<window.endTime||context.asOfTime%HOUR_MS!==0)
    return 'asOfTime must be an aligned UTC hour at or after the exclusive window end';
  for(let i=0;i<candles.length;i++){
    const c=candles[i];
    if(![c?.time,c?.open,c?.high,c?.low,c?.close,c?.volume].every(finite))
      return `Candle ${i} contains a non-finite OHLCV value`;
    if(c.time!==window.startTime+i*HOUR_MS||c.time+HOUR_MS>context.asOfTime)
      return `Candle ${i} is unaligned, missing, duplicated or not closed as of the report time`;
    if(c.open<=0||c.close<=0||c.low<=0||c.volume<0||c.high<Math.max(c.open,c.close,c.low)
        ||c.low>Math.min(c.open,c.close,c.high))
      return `Candle ${i} has invalid OHLCV relationships`;
  }
  return null;
}

function summarize(series,lookbackBars){
  const candles=series.acceptedCandles.slice(-(lookbackBars+1));
  const returns=[];
  for(let i=1;i<candles.length;i++)
    returns.push(Math.log(Number(candles[i].close)/Number(candles[i-1].close)));
  const average=mean(returns);
  const hourlyVolatility=Math.sqrt(mean(returns.map(value=>(value-average)**2)));
  const range=candles.slice(1);
  const high=Math.max(...range.map(c=>Number(c.high)));
  const low=Math.min(...range.map(c=>Number(c.low)));
  const close=Number(candles.at(-1).close);
  const rangePositionPct=high===low?50:100*(close-low)/(high-low);
  return {
    symbol:series.market.symbol,
    returnPct:100*(close/Number(candles[0].close)-1),
    hourlyLogReturnVolatilityPct:100*hourlyVolatility,
    positiveBars:returns.filter(value=>value>0).length,
    negativeBars:returns.filter(value=>value<0).length,
    range:{lookbackBars,high,low,close,positionPct:rangePositionPct,
      distanceFromHighPct:100*(close/high-1),distanceFromLowPct:100*(close/low-1),
      location:rangePositionPct<=10?'near_range_low':rangePositionPct>=90?'near_range_high':'inside_range'}
  };
}

function correlation(a,b){
  const avgA=mean(a),avgB=mean(b);
  const cov=mean(a.map((value,i)=>(value-avgA)*(b[i]-avgB)));
  const sdA=Math.sqrt(mean(a.map(value=>(value-avgA)**2)));
  const sdB=Math.sqrt(mean(b.map(value=>(value-avgB)**2)));
  return sdA===0||sdB===0?null:cov/(sdA*sdB);
}

/**
 * `marketContext.series` must contain at least two upstream-accepted Bitunix 1h
 * histories. The accepted status is an upstream assertion; this offline role
 * checks schema, continuity, OHLC relations and the normalized-row fingerprint.
 */
export function analyzeMarketContext(marketContext){
  const seriesList=marketContext?.series;
  const asOfTime=marketContext?.asOfTime;
  const lookbackBars=marketContext?.lookbackBars??24;
  const syntheticOnly=marketContext?.fixtureKind==='SYNTHETIC_CI_ONLY_NOT_BITUNIX';
  if(!Array.isArray(seriesList)||seriesList.length<2||seriesList.length>100)
    return blocked('Provide 2–100 independently accepted markets');
  if(!Number.isSafeInteger(asOfTime)||!Number.isInteger(lookbackBars)
      ||lookbackBars<2||lookbackBars>168)
    return blocked('Provide an aligned UTC asOfTime and a lookback from 2 to 168 hours');
  const first=seriesList[0];
  const context={asOfTime,startTime:first?.historyWindow?.startTime,endTime:first?.historyWindow?.endTime};
  const symbols=seriesList.map(series=>series?.market?.symbol);
  if(symbols.some(symbol=>!safeSymbol(symbol))||new Set(symbols).size!==symbols.length)
    return blocked('Market symbols must be valid and unique');
  for(const series of seriesList){
    const error=validateSeries(series,context,syntheticOnly);
    if(error)return blocked(error,{symbol:series?.market?.symbol??null});
    if(series.acceptedCandles.length<lookbackBars+1)
      return blocked(`Market ${series.market.symbol} has fewer rows than the requested lookback`,{lookbackBars});
  }
  const markets=seriesList.map(series=>summarize(series,lookbackBars));
  const up=markets.filter(market=>market.returnPct>0).length;
  const down=markets.filter(market=>market.returnPct<0).length;
  const flat=markets.length-up-down;
  const breadthPct=100*(up-down)/markets.length;
  const regime=breadthPct>=40?'broadly_up':breadthPct<=-40?'broadly_down':'mixed';
  const returnRows=seriesList.map(series=>{
    const candles=series.acceptedCandles.slice(-(lookbackBars+1));
    return candles.slice(1).map((c,index)=>Math.log(Number(c.close)/Number(candles[index].close)));
  });
  const correlations=[];
  for(let i=0;i<seriesList.length;i++)for(let j=i+1;j<seriesList.length;j++)
    correlations.push({symbols:[symbols[i],symbols[j]],correlation:correlation(returnRows[i],returnRows[j])});
  return record('market-context',syntheticOnly?'PASS_SYNTHETIC_ONLY':'PASS_RESEARCH_ONLY',{
    source:syntheticOnly?'SYNTHETIC_CI_ONLY_NOT_BITUNIX':'Bitunix',priceType:'LAST_PRICE',timeframe:'1h',asOfTime,
    historyWindow:{startTime:context.startTime,endTime:context.endTime,intervalMs:HOUR_MS},
    lookbackBars,marketCount:markets.length,
    provenance:seriesList.map(series=>({symbol:series.market.symbol,source:series.provenance.source,
      candleFingerprint:series.provenance.candleFingerprint,
      paginationComplete:series.provenance.paginationComplete,
      repeatedFetchMatches:series.provenance.repeatedFetchMatches,
      formingBarExcluded:series.provenance.formingBarExcluded,
      ohlcAlignedToSource:series.provenance.ohlcAlignedToSource})),
    breadth:{up,down,flat,breadthPct},regime,markets,correlations,
    interpretation:'Descriptive context and rolling range location only; near-range highs/lows are not confirmed market tops/bottoms.',
    dataLimit:'Upstream acceptance is asserted by the caller and is not independently authenticated by this offline role.',
    descriptiveOnly:true,noTradeSignals:true,noInvestmentRecommendation:true,
    noIndicatorParameterChanges:true,noNetworkFetches:true
  });
}
