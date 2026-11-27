/* Read-only public Bitunix availability survey. No extrapolation from empty pages. */
import {FIVE_CASES,FIVE_CRYPTO_SYMBOLS} from './five-by-five.mjs';
import {VERIFIED_INTERVALS} from '../research-batch.mjs';
import {makeBitunixFetchPage} from '../../bitunix-adapter.mjs';
import {fetchHourlyVerifiedWindow} from '../hourly-bitunix-recovery.mjs';
const start=Date.UTC(2021,10,24),end=Date.UTC(2024,10,24);
const endpoint='https://fapi.bitunix.com/api/v1/futures/market/trading_pairs';
const request=async()=>{const u=new URL(endpoint);u.searchParams.set('symbols',FIVE_CRYPTO_SYMBOLS.join(','));const r=await fetch(u,{signal:AbortSignal.timeout(18000),cache:'no-store',credentials:'omit'});if(!r.ok)throw Error('METADATA_HTTP_'+r.status);const j=await r.json();if(!['0','200'].includes(String(j.code))||!Array.isArray(j.data))throw Error('METADATA_INVALID');return Object.fromEntries(FIVE_CRYPTO_SYMBOLS.map(s=>{const a=j.data.filter(x=>x.symbol===s);if(a.length!==1||a[0].symbolStatus!=='OPEN'||!Number.isSafeInteger(Number(a[0].launchTime))||Number(a[0].launchTime)<Date.UTC(2010,0,1)||Number(a[0].launchTime)>Date.now())throw Error('LAUNCH_METADATA_INVALID_'+s);return [s,Number(a[0].launchTime)]}));};
const a=await request(),b=await request();if(JSON.stringify(a)!==JSON.stringify(b))throw Error('LAUNCH_METADATA_UNSTABLE');
console.log('CJ_EXTENSION_METADATA '+JSON.stringify(a));
const fetchPage=makeBitunixFetchPage({fetchImpl:(url,opts)=>fetch(url,{...opts,signal:AbortSignal.timeout(18000),cache:'no-store',credentials:'omit'})});
let target=0,eligible=0,verified=0,blocked=0;
for(const {symbol,timeframe} of FIVE_CASES){
 const step=VERIFIED_INTERVALS[timeframe],launch=a[symbol],from=Math.max(start,Math.ceil(launch/step)*step+3*step),n=Math.max(0,(end-from)/step);target+=n;
 const row={symbol,timeframe,launch,startMs:from,endMs:end,targetBars:n};
 if(n===0){console.log('CJ_EXTENSION_PROBE '+JSON.stringify({...row,status:'NO_PRE_2024_LISTING_HISTORY'}));continue;}
 eligible++;
 const count=Math.min(480,n);
 if(count<4){blocked++;console.log('CJ_EXTENSION_PROBE '+JSON.stringify({...row,status:'UNSUPPORTED_SHORT_WINDOW'}));continue;}
 const results=[];
 for(const stop of new Set([from+count*step,end])){
  const z=await fetchHourlyVerifiedWindow({symbol,timeframe,closedBars:count,nowMs:Date.now(),historicalEndExclusiveMs:stop,fetchPage,retries:1});
  results.push({endMs:stop,stable:z.readback.status==='STABLE_TWO_READS',reason:z.readback.reason??null,firstReason:z.first?.reason??null,checked:z.readback.checkedDerived??0,sha:z.first?.provenance?.rawSha256??null});
 }
 const ok=results.every(x=>x.stable&&x.checked===count);verified+=Number(ok);blocked+=Number(!ok);
 console.log('CJ_EXTENSION_PROBE '+JSON.stringify({...row,status:ok?'BOUNDARY_SAMPLES_VERIFIED':'BLOCKED_BOUNDARY_PROOF',results}));
}
console.log('CJ_EXTENSION_PROBE_SUMMARY '+JSON.stringify({targetBars:target,eligible,verified,blocked,noTrading:true,scope:'boundary samples only, not complete coverage'}));
