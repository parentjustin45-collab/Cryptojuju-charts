import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {readCryptoJujuWatchlist,chooseResearch50,
 fetchOpenContractMetadata,renderAdmissionReport} from './market-universe-50.mjs';
const folder=resolve(process.argv[2]??'market-50-reports');
await mkdir(folder,{recursive:true});
let result;
try{
 const html=await readFile(resolve('index.html'),'utf8');
 const watch=readCryptoJujuWatchlist(html);
 const metadata=await fetchOpenContractMetadata();
 result={...chooseResearch50(watch,metadata),
  checkedAtUtc:new Date().toISOString(),gitSha:process.env.GITHUB_SHA??null,
  metadataSource:'https://fapi.bitunix.com/api/v1/futures/market/trading_pairs'};
}catch(e){
 result={protocol:'CJ_50_MARKET_RESEARCH_ADMISSION_V1',
  status:'BLOCKED_METADATA_OR_SITE_WATCHLIST',target:50,selectedCount:0,
  groups:[],admitted:[],unavailable:[],historyValidated:false,
  backtestsPerformed:false,tradeOrdersPlaced:false,
  error:String(e?.message??e),checkedAtUtc:new Date().toISOString()};
}
await writeFile(join(folder,'market-50-admission.json'),JSON.stringify(result,null,2)+'\n');
await writeFile(join(folder,'market-50-admission.md'),
 result.status==='BLOCKED_METADATA_OR_SITE_WATCHLIST'?
 '# CryptoJuju — vérification bloquée\n\n'+result.error+'\n':
 renderAdmissionReport(result));
console.log('MARKET_50 '+JSON.stringify({
 status:result.status,siteEntries:result.siteCount,
 uniqueSiteSymbols:result.siteUniqueCount,openBitunixContracts:result.activeContractCount,
 selected:result.selectedCount,groups:result.groups,problem:result.error??null
}));
if(result.status!=='TARGET_50_OPEN_CONTRACTS_FOUND')process.exitCode=2;
