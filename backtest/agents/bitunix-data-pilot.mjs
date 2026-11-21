/*
 * Read-only market data ingress for the CryptoJuju control center.
 * Public Bitunix FUTURES LAST_PRICE only. Every sample and price mutation
 * is kept for review; no strategy signals, orders, API keys or deployments.
 * endTime is EXCLUSIVE in Bitunix API, so the forming candle is excluded.
 */
import {createHash} from 'node:crypto';
import {makeBitunixFetchPage} from '../bitunix-adapter.mjs';
import {classifyHistory} from '../quality-gate.mjs';
import {normalizeBitunixOpenEnvelope} from '../ohlc-bitunix-open-envelope.mjs';
import {auditData} from './roles/01-bitunix-data.mjs';
import {VERIFIED_INTERVALS} from './research-batch.mjs';

export const PILOT_SYMBOLS=Object.freeze(['BTCUSDT','ETHUSDT','SOLUSDT']);
export const PILOT_TIMEFRAMES=Object.freeze(['15m','1h','4h']);
export const DAILY_RESEARCH_SYMBOLS=Object.freeze([
  'BTCUSDT','HYPEUSDT','1000PEPEUSDT','XAUUSDT','NVDAUSDT'
]);
export const DAILY_INTRADAY_RESEARCH_SYMBOLS=DAILY_RESEARCH_SYMBOLS;
const SOURCE_URL='https://fapi.bitunix.com/api/v1/futures/market/kline';
const sha256=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const pause=ms=>new Promise(r=>setTimeout(r,ms));

function fail(reason,base,rawRows=[],normalization=null,extra={}) {
  return {
    ...base,status:'BLOCKED',reason,
    provenance:{...base.provenance,rawCount:rawRows.length,rawSha256:sha256(rawRows),
      sourceIndependence:'Single public Bitunix feed, NOT independent TradingView'},
    rawRows,corrections:normalization?.changes??[],normalizationIssues:normalization?.issues??[],
    acceptedCandles:[],...extra,
    warning:'Blocked research ingest. Never generate indicator signals from this series.'
  };
}

/*
 * Inject fetchPage only for isolated/offline tests. Production default
 * reuses existing Bitunix REST adapter, not the legacy history loader
 * that would silently discard malformed candles.
 */
export async function fetchBitunixDataPilot({
  symbol='BTCUSDT',timeframe='15m',closedBars=96,
  nowMs=Date.now(),anchorBars=3,pageBars=150,
  fetchPage=makeBitunixFetchPage(),retries=2
}={}) {
  const intraday=(PILOT_SYMBOLS.includes(symbol)&&PILOT_TIMEFRAMES.includes(timeframe))
    ||(PILOT_TIMEFRAMES.includes(timeframe)&&DAILY_INTRADAY_RESEARCH_SYMBOLS.includes(symbol));
  const daily=timeframe==='1d'&&DAILY_RESEARCH_SYMBOLS.includes(symbol);
  if(!intraday&&!daily)
    throw Error('Pilot restricted to 9 original intraday cases, five 15m/1h/4h cohort cases and five Daily cases');
  const intervalMs=VERIFIED_INTERVALS[timeframe];
  if(!Number.isSafeInteger(nowMs)||nowMs<1_000_000_000_000)
    throw Error('UTC nowMs must be realistic Unix milliseconds');
  if(!Number.isInteger(closedBars)||closedBars<4||closedBars>8760||
    !Number.isInteger(anchorBars)||anchorBars<1||anchorBars>12||
    !Number.isInteger(pageBars)||pageBars<1||pageBars>200||
    !Number.isInteger(retries)||retries<0||retries>3||
    typeof fetchPage!=='function')throw Error('Unsafe pilot sizing or page client');
  const endTime=Math.floor(nowMs/intervalMs)*intervalMs;
  const startTime=endTime-closedBars*intervalMs;
  const anchorStart=startTime-anchorBars*intervalMs;
  const market={exchange:'Bitunix',priceType:'LAST_PRICE',symbol,timeframe};
  const window={startTime,endTime,intervalMs};
  const extendedWindow={startTime:anchorStart,endTime,intervalMs};
  const provenance={
    source:'Bitunix public Futures REST',endpoint:SOURCE_URL,
    priceType:'LAST_PRICE',symbol,timeframe,
    fetchedAtUtc:new Date(nowMs).toISOString(),
    historyStartUtc:new Date(startTime).toISOString(),
    historyEndExclusiveUtc:new Date(endTime).toISOString(),
    closedBarsRequested:closedBars,anchorBars,
    endTimeExclusive:true,formingBarExcluded:true
  };
  const base={market,historyWindow:window,provenance};
  const rawRows=[],requests=[];
  let incompletePage=false;
  for(let start=anchorStart;start<endTime;start+=pageBars*intervalMs){
    const end=Math.min(endTime,start+pageBars*intervalMs);
    const limit=(end-start)/intervalMs;
    let chunk,lastError=null,attempts=0;
    for(let trial=0;trial<=retries;trial++){
      attempts++;
      try{
        chunk=await fetchPage({symbol,interval:timeframe,startTime:start,endTime:end,limit});
        if(!Array.isArray(chunk))throw Error('Bitunix page response must be an array');
        if(chunk.length!==limit)
          throw Error(`Bitunix incomplete page: expected ${limit}, received ${chunk.length}`);
        lastError=null;break;
      }catch(e){
        lastError=String(e?.message??e);
        if(trial<retries)await pause(300*(trial+1));
      }
    }
    requests.push({startTime:start,endTime:end,limit,attempts,received:chunk?.length??0,error:lastError});
    if(lastError!==null){
      if(!Array.isArray(chunk))
        return fail('PUBLIC_REST_REQUEST_FAILED',base,rawRows,null,{requests,fetchError:lastError});
      // Retain observed rows for diagnostics and explicit shorter-history
      // eligibility checks. An incomplete page can NEVER be accepted.
      incompletePage=true;
    }
    // Do not allow an incomplete or padded page to go unnoticed. The
    // existing fetchPage adapter may filter extra rows: count all expected.
    rawRows.push(...chunk);
  }

  const fullClass=classifyHistory(rawRows,extendedWindow);
  const derived=normalizeBitunixOpenEnvelope(rawRows,{intervalMs});
  const normalizedClass=classifyHistory(derived.candles,extendedWindow);
  const expectedRaw=closedBars+anchorBars;
  const quality={
    expectedWithAnchors:expectedRaw,rawCount:rawRows.length,
    rawInvalid:fullClass.quality.invalid,rawMissing:fullClass.quality.missing,
    rawDuplicates:fullClass.quality.duplicates,rawOutOfRange:fullClass.quality.outOfRange,
    corrected:derived.changes.length,unresolved:derived.issues.length,
    derivedInvalid:normalizedClass.quality.invalid,
    derivedMissing:normalizedClass.quality.missing,
    derivedDuplicates:normalizedClass.quality.duplicates,
    derivedOutOfRange:normalizedClass.quality.outOfRange
  };
  const ready=rawRows.length===expectedRaw && fullClass.quality.missing===0 &&
    fullClass.quality.duplicates===0 && fullClass.quality.outOfRange===0 &&
    derived.status!=='BLOCKED' &&
    normalizedClass.status==='READY'&&
    normalizedClass.quality.outOfRange===0&&
    normalizedClass.candles.length===expectedRaw;
  if(incompletePage||!ready)
    return fail('OHLC_PROVENANCE_OR_CONTINUITY_FAILED',base,rawRows,derived,{requests,quality});
  const acceptedCandles=normalizedClass.candles.filter(x=>x.time>=startTime&&x.time<endTime);
  const role1=auditData({market,historyWindow:window,candles:acceptedCandles});
  if(role1.status!=='PASS'||acceptedCandles.length!==closedBars)
    return fail('AGENT_1_QUALITY_GATE_BLOCKED',base,rawRows,derived,{requests,quality,role1});

  return {
    ...base,status:'DATA_READY_FOR_RESEARCH_ONLY',
    provenance:{...provenance,rawCount:rawRows.length,rawSha256:sha256(rawRows),
      derivedSha256:sha256(acceptedCandles),
      normalizationVersion:derived.version,
      sourceIndependence:'Single public Bitunix feed, NOT independent TradingView'},
    rawRows,acceptedCandles,corrections:derived.changes,
    normalizationIssues:[],requests,quality,role1,
    execution:{
      backtests:'NOT_RUN_NO_VERIFIED_SIGNALS',
      indicators:'NOT_VALIDATED',
      liveOrders:false,autonomousAgents:false
    },
    warning:'Only Bitunix public data consistency checked. Not TradingView parity, indicator correctness, profitability or continuous uptime.'
  };
}
