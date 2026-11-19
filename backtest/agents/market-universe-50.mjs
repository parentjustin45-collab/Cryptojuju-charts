import {createHash} from 'node:crypto';
// Research buckets, NOT verification of capitalization, backing assets or risk.
export const GROUPS=[
 {id:'major_crypto',quota:10,names:'BTC ETH SOL XRP BNB ADA LTC LINK AVAX SUI',reserve:'BCH TRX XLM ETC ICP'},
 {id:'other_crypto',quota:12,names:'HYPE APT NEAR ATOM DOT ARB OP INJ RENDER TAO ONDO AAVE',reserve:'UNI FIL PENDLE LDO JUP RUNE WLD FET'},
 {id:'meme_crypto',quota:12,names:'DOGE 1000PEPE 1000SHIB WIF PENGU TRUMP FARTCOIN POPCAT BRETT BOME MEW TURBO',reserve:'PNUT GOAT DOGS TOSHI USELESS GIGGLE MEME'},
 {id:'metal_energy_linked',quota:6,names:'CL BZ XAU XAG XAUT PAXG',reserve:''},
 {id:'equity_ticker_linked',quota:10,names:'NVDA AAPL TSLA AMD MSFT META COIN MSTR PLTR HOOD',reserve:'NFLX INTC GOOGL SAMSUNG SKHYNIX SPY QQQ AMZN'}
].map(g=>({...g,names:g.names.split(' ').map(x=>x+'USDT'),
 reserve:g.reserve?g.reserve.split(' ').map(x=>x+'USDT'):[]}));
const sha=s=>createHash('sha256').update(s).digest('hex');
export function readCryptoJujuWatchlist(html){
 if(typeof html!=='string')throw Error('Site HTML not found');
 const m=html.match(/const WATCHLIST=(\[[^\r\n]*\]);/);
 if(!m)throw Error('Site WATCHLIST literal unavailable');
 const rows=JSON.parse(m[1]);
 if(!Array.isArray(rows)||rows.length===0||
   rows.some(x=>typeof x?.symbol!=='string'||!/^[A-Z0-9]{2,40}$/.test(x.symbol)))
   throw Error('Invalid site WATCHLIST');
 const symbols=[...new Set(rows.map(x=>x.symbol))];
 return {total:rows.length,unique:symbols.length,duplicates:rows.length-symbols.length,
  symbols,sha256:sha(m[1])};
}
export function chooseResearch50(watchlist,metadata){
 if(!Array.isArray(watchlist?.symbols)||!Array.isArray(metadata))throw Error('No verified input');
 const site=new Set(watchlist.symbols),live=new Map();
 for(const x of metadata){
  if(!x||typeof x.symbol!=='string'||x.symbolStatus!=='OPEN')continue;
  const p=Number(x.quotePrecision);
  if(!Number.isInteger(p)||p<0||p>12)continue;
  if(live.has(x.symbol))throw Error('Duplicate exchange metadata symbol');
  live.set(x.symbol,{symbol:x.symbol,quotePrecision:p,launchTime:x.launchTime??null});
 }
 const admitted=[],used=new Set(),groups=[],unavailable=[];
 for(const g of GROUPS){
  let count=0;
  for(const symbol of [...g.names,...g.reserve]){
   if(count===g.quota)break;
   if(!site.has(symbol)||!live.has(symbol)){
    unavailable.push({symbol,reason:!site.has(symbol)?'NOT_IN_WATCHLIST':'NO_OPEN_BITUNIX_CONTRACT'});continue;
   }
   if(used.has(symbol))continue;
   admitted.push({...live.get(symbol),group:g.id,
    contractStatus:'OPEN_METADATA_ONLY',historyStatus:'NOT_TESTED',
    liquidityStatus:'NOT_TESTED',source:'Bitunix USDT perpetual',
    underlyingSpotOrEquityParityVerified:false});
   used.add(symbol);count++;
  }
  groups.push({group:g.id,quota:g.quota,selected:count,shortfall:g.quota-count});
 }
 return {protocol:'CJ_50_MARKET_RESEARCH_ADMISSION_V1',target:50,
  status:admitted.length===50?'TARGET_50_OPEN_CONTRACTS_FOUND':'PARTIAL_NOT_50',
  selectedCount:admitted.length,siteCount:watchlist.total,
  siteUniqueCount:watchlist.unique,siteDuplicates:watchlist.duplicates,
  siteSha256:watchlist.sha256,activeContractCount:live.size,
  groups,admitted,unavailable,forexStatus:'NO_DIRECT_FOREX_PAIR_IN_SITE_WATCHLIST',
  historyValidated:false,backtestsPerformed:false,tradeOrdersPlaced:false,
  warnings:[
   'Watchlist membership and OPEN contract metadata do not validate historical OHLC, funding, spreads or liquidity.',
   'Metal/energy-linked contracts and tokenized gold are not identical to spot physical assets.',
   'Equity ticker-linked perpetual contracts are not directly owned exchange-listed shares.',
   'Forex spot pairs are absent from the present CryptoJuju watchlist; an independently verified feed is required.',
   'Do not test meme coins with BTC spread/slippage assumptions; no automated promotion or trading.'
  ]};
}
export async function fetchOpenContractMetadata(fetchImpl=globalThis.fetch){
 if(typeof fetchImpl!=='function')throw Error('Missing public fetch');
 const url='https://fapi.bitunix.com/api/v1/futures/market/trading_pairs';
 const r=await fetchImpl(url,{method:'GET',cache:'no-store',credentials:'omit',
  signal:AbortSignal.timeout(18000)});
 if(!r?.ok)throw Error('Bitunix public metadata HTTP '+r?.status);
 const j=await r.json();
 if(!['0','200'].includes(String(j?.code))||!Array.isArray(j?.data))
  throw Error('Invalid Bitunix public metadata response');
 return j.data;
}
export function renderAdmissionReport(r){
 if(r?.protocol!=='CJ_50_MARKET_RESEARCH_ADMISSION_V1')throw Error('Invalid report');
 return ['# CryptoJuju — sélection diversifiée de 50 marchés','',
 'Source : watchlist réelle du site + contrats OPEN Bitunix (lecture seule).',
 'Symboles proposés : **'+r.selectedCount+' / 50**. Historique : **NON TESTÉ**.',
 'Watchlist : '+r.siteCount+' entrées, '+r.siteUniqueCount+' symboles distincts.',
 '',
 '| Groupe | Cible | Disponible | Manquant |','|---|---:|---:|---:|',
 ...r.groups.map(x=>'| '+x.group+' | '+x.quota+' | '+x.selected+' | '+x.shortfall+' |'),
 '','| Symbole | Famille | Contrat actif | Historique | Liquidité |',
 '|---|---|---|---|---|',
 ...r.admitted.map(x=>'| '+x.symbol+' | '+x.group+' | OPEN | NON TESTÉ | NON TESTÉ |'),
 '','## Réserves',
 ...r.warnings.map(x=>'- '+x),
 '','Ce contrôle ne fait aucun backtest, ne passe aucun ordre et ne déploie rien.'
 ].join('\n')+'\n';
}
