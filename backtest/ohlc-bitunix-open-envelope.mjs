/* CryptoJuju DEV V1.26.0 — opt-in, auditable Bitunix candle envelope.
 * DO NOT modify raw Bitunix rows or silently repair arbitrary prices.
 *
 * Restricted hypothesis: Bitunix LAST_PRICE OPEN == preceding CLOSE, but
 * certain recorded H/L cover trades only (so OPEN lies just outside H/L).
 * When and ONLY when a previous consecutive bar confirms that OPEN, derive
 * H=max(raw H, OPEN), L=min(raw L, OPEN). Keep before/after evidence.
 *
 * This is NOT independent TradingView verification or proof of live parity.
 * All unreconciled defects, gaps and duplicates block strict backtests.
 */
export const BITUNIX_ENVELOPE_VERSION='bitunix-open-envelope-v1';
const FIELDS=['open','high','low','close','volume'];
export function normalizeBitunixOpenEnvelope(rawRows,{intervalMs,openCloseTolerance=0.000001}={}){
 if(!Array.isArray(rawRows)||!Number.isSafeInteger(intervalMs)||intervalMs<=0||
    !Number.isFinite(openCloseTolerance)||openCloseTolerance<0||openCloseTolerance>0.01)
  throw Error('Unsafe envelope normalization configuration');
 const originals=rawRows.map(r=>{
  const c={time:Number(r?.time)};
  for(const k of FIELDS)c[k]=Number(r?.[k]??(k==='volume'?0:NaN));
  return c;
 }).sort((a,b)=>a.time-b.time);
 const candles=[],changes=[],issues=[];
 for(let i=0;i<originals.length;i++){
  const r=originals[i],prev=originals[i-1],p=candles[i-1];
  const validBasic=Number.isSafeInteger(r.time)&&r.time>=0&&r.time%intervalMs===0&&
   FIELDS.every(k=>Number.isFinite(r[k]))&&
   r.open>0&&r.high>0&&r.low>0&&r.close>0&&r.volume>=0&&r.high>=r.low;
  if(!validBasic){
   issues.push({time:r.time,reason:'INVALID_BASIC_OHLC'});candles.push({...r});continue;
  }
  if(prev&&r.time!==prev.time+intervalMs){
   issues.push({time:r.time,reason:r.time===prev.time?'DUPLICATE':'GAP_OR_ORDER'});
  }
  const badHigh=r.high<Math.max(r.open,r.close);
  const badLow=r.low>Math.min(r.open,r.close);
  if(!badHigh&&!badLow){candles.push({...r});continue}
  // Disallow anomalies involving the CLOSE or mutually incompatible extrema.
  const highOnlyOpen=badHigh&&r.high<r.open&&r.high>=r.close;
  const lowOnlyOpen=badLow&&r.low>r.open&&r.low<=r.close;
  const compatible=(badHigh?!badLow&&highOnlyOpen:badLow&&lowOnlyOpen);
  const previousConfirmed=prev&&p&&r.time===prev.time+intervalMs&&
   Math.abs(r.open-prev.close)<=openCloseTolerance&&
   p.high>=Math.max(p.open,p.close)&&p.low<=Math.min(p.open,p.close);
  if(!compatible||!previousConfirmed){
   issues.push({time:r.time,reason:'UNCONFIRMED_OPEN_ENVELOPE',raw:{...r},
    previousClose:prev?.close??null});candles.push({...r});continue;
  }
  const c={...r,high:Math.max(r.high,r.open),low:Math.min(r.low,r.open)};
  changes.push({time:r.time,utc:new Date(r.time).toISOString(),
   reason:'PREVIOUS_CLOSE_CONFIRMS_OPEN_OUTSIDE_EXCHANGE_HL',
   original:{open:r.open,high:r.high,low:r.low,close:r.close},
   derived:{open:c.open,high:c.high,low:c.low,close:c.close},
   previousClose:prev.close});
  candles.push(c);
 }
 return {version:BITUNIX_ENVELOPE_VERSION,rawRowCount:rawRows.length,
  candles,changes,issues,
  status:issues.length?'BLOCKED':changes.length?'READY_DERIVED_WITH_PROVENANCE':'READY_UNMODIFIED',
  note:'Only a derived, explicitly selected series; original Bitunix data was not mutated. Do not use as TradingView-proven parity.'};
}
