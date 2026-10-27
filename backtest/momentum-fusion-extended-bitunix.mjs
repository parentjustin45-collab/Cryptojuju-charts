/* Read-only Momentum Fusion source-parity prerequisite.
 * Longer untouched Bitunix OHLC history for ETH 1H + SOL 30M,
 * not an optimization, not a trading study, and not TradingView parity.
 */
import {pathToFileURL} from 'node:url';
import {makeCryptoJujuFetchPage} from './cryptojuju-adapter.mjs';
import {planCleanBacktestWindows} from './quarantine.mjs';
import {calculateMomentumFusion} from './momentum-fusion-v1.mjs';
const H=3600000;
export const EXTENDED_LOCK=Object.freeze({
 id:'momentum-fusion-bitunix-longer-history-locked-2026-10-27-v1',
 symbols:[{symbol:'ETHUSDT',tf:'1h',step:H},
  {symbol:'SOLUSDT',tf:'30m',step:H/2}],
 barsRequested:2016,minContinuous:135,pageSize:180,
 minimumWarmup:110,
 source:'Bitunix public last-price futures OHLC, CryptoJuju read-only proxy',
 caveat:'Data quality exploration only; DOES NOT validate original Pine against TradingView.'
});
export function summarizeExtendedWindows(windows,{
 symbol,tf,step,expectedLastCloseOpen=null}={}){
 const eligible=windows.eligibleWindows;
 let events={bull:0,bear:0,regBull:0,regBear:0,hiddenBull:0,hiddenBear:0};
 let computed=0,firstValue=null,lastValue=null;
 const segments=[];
 for(const w of eligible){
  const o=calculateMomentumFusion(w.candles);
  const count={bull:0,bear:0,regBull:0,regBear:0,hiddenBull:0,hiddenBear:0};
  for(const s of o){
   if(Number.isFinite(s.composite)){
    computed++;
    if(firstValue===null)firstValue=s.time;
    lastValue=s.time;
   }
   count.bull+=Number(s.bullSignal);count.bear+=Number(s.bearSignal);
   for(const d of s.divergences){
    if(d.confirmationTime!==s.time||
       d.confirmationIndex-d.pivotIndex!==5)
     throw Error('Backdated or invalid divergence');
    count[d.type]++;
   }
  }
  for(const k of Object.keys(count))events[k]+=count[k];
  segments.push({first:w.startTime,last:w.endTime-step,bars:w.bars,
   computed:o.filter(s=>Number.isFinite(s.composite)).length,count});
 }
 const expected=expectedLastCloseOpen;
 const latestSegment=eligible.findLast(w=>w.endTime-step===expected);
 const lastRead=latestSegment?
  calculateMomentumFusion(latestSegment.candles).at(-1):null;
 return {
  symbol,tf,status:eligible.length?'ANALYZED':'BLOCKED',
  data:{expected:windows.quality.expected,
   valid:windows.quality.valid,invalid:windows.quality.invalid,
   missing:windows.quality.missing,duplicates:windows.quality.duplicates,
   eligibleSegments:eligible.length,
   longestContinuous:Math.max(0,...windows.segments.map(s=>s.bars)),
   latestContinuous:latestSegment?.bars??0,
   barsExcludedFromQualifyingSegments:windows.excludedBars,
   actualComputed:computed,firstValue,lastValue},
  latestValidComposite:lastRead?.composite??null,
  latestValidTime:lastRead?.time??null,
  counts:events,segments,
  warning:'Only historical counts. Missing/corrupt bars break continuity; all new segments warm up independently.'
 };
}
export async function extendedBitunixAudit({
 fetchPage=makeCryptoJujuFetchPage(),
 nowMs=Date.now(),markets=EXTENDED_LOCK.symbols}={}){
 const results=[];
 for(const m of markets){
  const end=Math.floor(nowMs/m.step)*m.step,
   start=end-EXTENDED_LOCK.barsRequested*m.step;
  try{
   const rows=[];
   for(let t=start;t<end;t+=EXTENDED_LOCK.pageSize*m.step){
    const until=Math.min(end,t+EXTENDED_LOCK.pageSize*m.step);
    const chunk=await fetchPage({symbol:m.symbol,interval:m.tf,
     startTime:t,endTime:until,limit:200});
    rows.push(...chunk.filter(b=>Number(b.time)>=t&&Number(b.time)<until));
   }
   const clean=planCleanBacktestWindows(rows,{
    startTime:start,endTime:end,intervalMs:m.step
   },{minBars:EXTENDED_LOCK.minContinuous});
   results.push({...summarizeExtendedWindows(clean,{
    symbol:m.symbol,tf:m.tf,step:m.step,
    expectedLastCloseOpen:end-m.step
   }),received:rows.length,from:start,to:end,
   rawStatus:clean.status});
  }catch(err) {
   results.push({symbol:m.symbol,tf:m.tf,status:'ERROR',
    error:String(err?.message??err)});
  }
 }
 return {lock:EXTENDED_LOCK,
  generatedAt:new Date(nowMs).toISOString(),
  commit:process.env.GITHUB_SHA??null,
  runId:process.env.GITHUB_RUN_ID??null,
  status:results.some(x=>x.status==='ERROR')?'ERROR':
   results.every(x=>x.status==='ANALYZED')?'BOTH_ANALYZED':'PARTIAL_QUARANTINED',
  results};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const a=await extendedBitunixAudit();
 console.log(JSON.stringify(a,null,2));
 if(a.status==='ERROR')process.exitCode=1;
}
