/*
 * CryptoJuju historical-data repeatability gate (public Bitunix only).
 *
 * Two independent HTTP reads of the SAME CLOSED candle timestamps can expose
 * upstream revisions, stale responses and parsing instability.
 * A STABLE result is a local point-in-time check, NOT 24/7 uptime, external
 * TradingView parity or an assurance about future data revisions.
 */
import {createHash} from 'node:crypto';

const PRICE_FIELDS=['open','high','low','close','volume'];
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fail=(reason,extra={})=>({
  protocol:'CJ_BITUNIX_CLOSED_CANDLE_REPEATABILITY_V1',
  status:'BLOCKED',
  reason,
  checkedRaw:0,checkedDerived:0,
  differences:[],
  ...extra,
  evidence:'Read-only Bitunix LAST_PRICE double read; no signal or trading orders',
  disclaimer:'A single repeatability check does not prove always-on service, TradingView parity or strategy performance.'
});
function sameMarket(a,b){
  return a?.exchange===b?.exchange&&a?.symbol===b?.symbol&&
    a?.timeframe===b?.timeframe&&a?.priceType==='LAST_PRICE'&&
    b?.priceType==='LAST_PRICE';
}
function index(rows){
  if(!Array.isArray(rows))throw Error('Missing OHLC rows');
  const out=new Map();
  for(const row of rows){
    if(!Number.isSafeInteger(row?.time)||out.has(row.time))
      throw Error('Invalid/duplicated candle time in repeated snapshot');
    out.set(row.time,row);
  }
  return out;
}
function compareArray(left,right,kind){
  const originals=index(left),repeated=index(right);
  const issues=[];
  for(const [time,c] of repeated){
    const prev=originals.get(time);
    if(!prev){issues.push({kind,time,field:'time',cause:'MISSING_IN_FIRST_READ'});continue}
    for(const field of PRICE_FIELDS){
      const old=Number(prev[field]),next=Number(c[field]);
      if(!Number.isFinite(old)||!Number.isFinite(next)||old!==next)
        issues.push({kind,time,field,before:prev[field],after:c[field],
          cause:'SAME_CLOSED_CANDLE_CHANGED'});
    }
  }
  return {checked:repeated.size,issues};
}
export function compareBitunixReadbacks(first,second){
  if(!first||!second||first.status!=='DATA_READY_FOR_RESEARCH_ONLY'||
     second.status!=='DATA_READY_FOR_RESEARCH_ONLY')
    return fail('ONE_OR_BOTH_SNAPSHOTS_NOT_VERIFIED');
  if(!sameMarket(first.market,second.market)||
     first.provenance?.source!=='Bitunix public Futures REST'||
     second.provenance?.source!=='Bitunix public Futures REST')
    return fail('MARKET_OR_SOURCE_MISMATCH');
  const a=first.historyWindow,b=second.historyWindow;
  if(!a||!b||a.intervalMs!==b.intervalMs||a.endTime!==b.endTime||
     b.startTime<a.startTime||b.startTime>=b.endTime)
    return fail('WINDOW_END_MISMATCH_OR_NONOVERLAP');
  try {
    const raw=compareArray(first.rawRows,second.rawRows,'raw');
    const derived=compareArray(first.acceptedCandles,second.acceptedCandles,'derived');
    const expectedDerived=(b.endTime-b.startTime)/b.intervalMs;
    if(derived.checked!==expectedDerived)
      return fail('MISSING_CLOSED_BAR_IN_REPEAT',{checkedRaw:raw.checked,checkedDerived:derived.checked});
    const expectedRaw=expectedDerived+(second.provenance?.anchorBars??0);
    if(raw.checked!==expectedRaw)
      return fail('MISSING_REPEAT_ANCHOR',{checkedRaw:raw.checked,checkedDerived:derived.checked});
    const differences=[...raw.issues,...derived.issues];
    const stable=!differences.length;
    return {
      protocol:'CJ_BITUNIX_CLOSED_CANDLE_REPEATABILITY_V1',
      status:stable?'STABLE_TWO_READS':'BLOCKED',
      reason:stable?null:'CLOSED_CANDLE_REVISION_OR_MISMATCH',
      market:{symbol:first.market.symbol,timeframe:first.market.timeframe,exchange:'Bitunix'},
      historyWindow:{...b},
      checkedRaw:raw.checked,checkedDerived:derived.checked,
      firstRawSha256:first.provenance.rawSha256,
      secondRawSha256:second.provenance.rawSha256,
      overlapRawSha256First:digest([...index(first.rawRows).entries()]
        .filter(([time])=>index(second.rawRows).has(time)).sort(([a],[b])=>a-b)),
      overlapRawSha256Second:digest([...index(second.rawRows).entries()].sort(([a],[b])=>a-b)),
      differences: differences.slice(0,20),
      differenceCount:differences.length,
      evidence:'Read-only Bitunix LAST_PRICE double read; no signal or trading orders',
      disclaimer:'A single repeatability check does not prove always-on service, TradingView parity or strategy performance.'
    };
  }catch(e){return fail('REPEATABILITY_COMPARISON_ERROR',{error:String(e?.message??e)})}
}
