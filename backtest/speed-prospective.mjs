// Pre-registered prospective research. No tuning, no trading orders, no main writes.
import {makeCryptoJujuFetchPage} from './cryptojuju-adapter.mjs';
import {planCleanBacktestWindows} from './quarantine.mjs';
import {compareSpeedExits} from './speed-exit-comparison.mjs';
const locked=Object.freeze({startTime:Date.parse('2026-10-26T00:00:00Z'),interval:'1h',intervalMs:3600000,symbols:['SOLUSDT','ETHUSDT'],entry:'mid',side:'both',mode:'hybrid',capital:100,allocation:0.5,fee:0.0006,slippage:0.0005,stopPercent:1.5,targetPercent:3,maxBars:120,minBars:22});
const endTime=Math.floor(Date.now()/locked.intervalMs)*locked.intervalMs;
const fetchPage=makeCryptoJujuFetchPage();
const audit={runId:process.env.GITHUB_RUN_ID??null,runAttempt:process.env.GITHUB_RUN_ATTEMPT??null,commit:process.env.GITHUB_SHA??null,branch:process.env.GITHUB_REF_NAME??null,source:'CryptoJuju Bitunix proxy',dataPolicy:'closed candles; quarantine invalid/missing bars; no cross-gap trades',execution:'next-bar-open research simulation',generatedAt:new Date().toISOString()};
const output={schemaVersion:1,audit,protocol:'speed-mid-hybrid-prospective-v1',locked,asOf:new Date().toISOString(),endTime,results:[],warning:'Pre-registered forward observation, not live trading. Capital resets for every clean window. Early observations are not statistically conclusive.'};
if(endTime<=locked.startTime){console.log(JSON.stringify({...output,status:'NOT_STARTED'}));process.exit(0)}
for(const symbol of locked.symbols){
 try{
  const rows=[];
  for(let start=locked.startTime;start<endTime;start+=180*locked.intervalMs){
   const end=Math.min(endTime,start+180*locked.intervalMs);
   const page=await fetchPage({symbol,interval:locked.interval,startTime:start,endTime:end,limit:200});
   rows.push(...page.filter(c=>Number(c.time)>=start&&Number(c.time)<end));
  }
  const plan=planCleanBacktestWindows(rows,{startTime:locked.startTime,endTime,intervalMs:locked.intervalMs},{minBars:locked.minBars});
  const windows=plan.eligibleWindows.map(w=>({startTime:w.startTime,endTime:w.endTime,bars:w.bars,metrics:compareSpeedExits(w.candles,{entry:locked.entry,side:locked.side,mode:locked.mode,capital:locked.capital,allocation:locked.allocation,fee:locked.fee,slippage:locked.slippage,stopPercent:locked.stopPercent,targetPercent:locked.targetPercent,maxBars:locked.maxBars})}));
  const tradeCount=windows.reduce((n,w)=>n+w.metrics.tradeCount,0);
  const totalEligibleBars=windows.reduce((n,w)=>n+w.bars,0);
  output.results.push({symbol,status:plan.status,receivedRows:rows.length,excludedBars:plan.excludedBars,eligibleWindows:windows.length,totalEligibleBars,tradeCount,meanWindowReturnPct:windows.length?windows.reduce((n,w)=>n+w.metrics.returnPercent,0)/windows.length:null,windows});
 }catch(e){output.results.push({symbol,status:'ERROR',error:String(e.message??e)})}
}
output.status=output.results.some(r=>r.status==='ERROR')?'PARTIAL_ERROR':output.results.some(r=>r.eligibleWindows>0)?'OBSERVED':'INSUFFICIENT_HISTORY';
console.log(JSON.stringify(output));
if(output.results.every(r=>r.status==='ERROR'))process.exitCode=1;
