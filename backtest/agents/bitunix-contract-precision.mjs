/*
 * Official public Bitunix price precision. This is the quote price precision
 * of a Bitunix contract, NOT independently verified TradingView syminfo.mintick.
 * No authentication, write APIs or secret keys.
 */
const ENDPOINT='https://fapi.bitunix.com/api/v1/futures/market/trading_pairs';
export const PILOT_CONTRACTS=Object.freeze(['BTCUSDT','ETHUSDT','SOLUSDT']);

export async function readBitunixContractPrecision({
  fetchImpl=globalThis.fetch, symbols=PILOT_CONTRACTS
}={}){
  if(typeof fetchImpl!=='function' || !Array.isArray(symbols) || !symbols.length ||
    symbols.some(x=>!PILOT_CONTRACTS.includes(x)) || new Set(symbols).size!==symbols.length)
    throw Error('Unsupported official Bitunix metadata request');
  const url=new URL(ENDPOINT);
  url.searchParams.set('symbols',symbols.join(','));
  const reply=await fetchImpl(url.href,{
    method:'GET',cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(18000)
  });
  if(!reply?.ok)throw Error('Bitunix metadata HTTP '+String(reply?.status??'unknown'));
  const payload=await reply.json();
  if(!['0','200'].includes(String(payload?.code))||!Array.isArray(payload?.data))
    throw Error('Invalid Bitunix trading_pairs response');
  const entries=[];
  for(const symbol of symbols){
    const matches=payload.data.filter(p=>p?.symbol===symbol);
    if(matches.length!==1)throw Error('Missing or duplicate metadata for '+symbol);
    const found=matches[0], precision=Number(found.quotePrecision);
    if(!Number.isInteger(precision)||precision<0||precision>12)
      throw Error('Invalid Bitunix quotePrecision for '+symbol);
    if(found.symbolStatus!=='OPEN')throw Error('Bitunix contract not OPEN: '+symbol);
    const priceStep=10**(-precision);
    entries.push({
      symbol,quotePrecision:precision,
      priceStep,source:'BITUNIX_PUBLIC_TRADING_PAIRS',
      endpoint:ENDPOINT,
      stepStatus:'RESEARCH_PRICE_PRECISION_NOT_TV_MINTICK'
    });
  }
  return {
    status:'BITUNIX_PUBLIC_PRECISION_RECEIVED',
    source:ENDPOINT,
    tradingViewMintickVerified:false,
    contracts:entries
  };
}
