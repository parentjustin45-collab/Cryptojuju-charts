/* CryptoJuju 5×5 research cohort (cryptocurrencies only).
 * Keep existing 3×3 pilot and historical five-market XAU/NVDA studies unchanged.
 * LIVE deployment opt-in: CJ_RENDER_RESEARCH_COHORT=FIVE_BY_FIVE.
 */
export const FIVE_CRYPTO_SYMBOLS=Object.freeze([
  'BTCUSDT','ETHUSDT','SOLUSDT','HYPEUSDT','1000PEPEUSDT'
]);
export const FIVE_TIMEFRAMES=Object.freeze(['15m','30m','1h','4h','1d']);
export const FIVE_CASES=Object.freeze(FIVE_CRYPTO_SYMBOLS.flatMap(symbol=>
  FIVE_TIMEFRAMES.map(timeframe=>Object.freeze({symbol,timeframe}))));
export const FIVE_BY_FIVE='FIVE_BY_FIVE';
export const LEGACY_PILOT='LEGACY_3X3';
export function isFiveByFive(env=process.env){
  return env.CJ_RENDER_RESEARCH_COHORT===FIVE_BY_FIVE;
}
export function cohortCases(env=process.env){
  return isFiveByFive(env)?FIVE_CASES:null;
}
export function checkFiveByFiveComplete(rows){
  const expected=new Set(FIVE_CASES.map(x=>x.symbol+'|'+x.timeframe));
  return Array.isArray(rows)&&rows.length===25&&
    rows.every(x=>expected.delete(x.symbol+'|'+x.timeframe))&&expected.size===0;
}
