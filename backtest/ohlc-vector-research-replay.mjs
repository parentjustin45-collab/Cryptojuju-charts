/* BTCUSDT Bitunix real 7d research replay: closed bars, dev only.
 * Explicit OHLC derivation with provenance; research only, not a trading signal,
 * not independent TradingView parity and not forward-tested profitability.
 */
import {writeFile} from 'node:fs/promises';
import {makeBitunixFetchPage} from './bitunix-adapter.mjs';
import {STEP_MS} from './ohlc-parity-core.mjs';
import {normalizeBitunixOpenEnvelope} from './ohlc-bitunix-open-envelope.mjs';
import {classifyHistory} from './quality-gate.mjs';
import {vectorAIT} from './vector-ait-v1.mjs';
import {runBacktest} from './engine.mjs';
const symbol='BTCUSDT',now=Date.now(),iso=t=>new Date(t).toISOString();
const count={'15m':672,'1h':168,'4h':42};
const page=makeBitunixFetchPage({
 fetchImpl:(url,opts)=>fetch(url,{...opts,signal:AbortSignal.timeout(18000)})
});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function data(tf,window){
 const rows=[];
 for(let t=window.startTime;t<window.endTime;t+=170*window.intervalMs){
  let done=false,err;
  const e=Math.min(window.endTime,t+170*window.intervalMs);
  for(let tryNo=0;tryNo<2;tryNo++){
   try{rows.push(...await page({symbol,interval:tf,startTime:t,endTime:e,limit:200}));done=true;break}
   catch(ex){err=ex;if(tryNo===0)await sleep(500)}
  }
  if(!done)throw err;
 }
 return rows;
}
const report={version:'CJ_VECTOR_V11_REAL_DERIVED_OHLC_7D_V1',startedUTC:iso(now),
 branch:'dev/v1.26.0',symbol,source:'Bitunix LAST_PRICE REST',
 tradingViewIndependent:'NOT_CHECKED_FOR_ALL_CANDLES',execution:'NEXT_BAR_OPEN_SIMULATED',
 capitalUSDT:1000,leverage:1,feeRate:0.0006,slippageRate:0.0002,
 researchOnly:true,frames:[],status:'PENDING'};
for(const [tf,n] of Object.entries(count)){
 const step=STEP_MS[tf],current=Math.floor(now/step)*step;
 const window={startTime:current-step-n*step,endTime:current-step,intervalMs:step};
 const frame={tf,expected:n,fromUTC:iso(window.startTime),toExclusiveUTC:iso(window.endTime)};
 report.frames.push(frame);
 try{
  const raw=await data(tf,window),rawQuality=classifyHistory(raw,window);
  const candidate=normalizeBitunixOpenEnvelope(raw,window);
  const quality=classifyHistory(candidate.candles,window);
  frame.rawQuality=rawQuality.quality;
  frame.rawStrictAllowed=rawQuality.canBacktest;
  frame.derivedQuality=quality.quality;
  frame.derivedStrictAllowed=quality.canBacktest;
  frame.derivedCorrections=candidate.changes.length;
  frame.unreconciled=candidate.issues.length;
  if(candidate.status==='BLOCKED'||!quality.canBacktest)
   throw Error('Derived candidate failed strict quality gate');
  const v=vectorAIT(candidate.candles);
  const signals=v.filter(x=>x.signal).map(x=>({time:x.time,side:x.signal}));
  const bt=runBacktest(raw,signals,{
   historyWindow:window,sourceExchange:'Bitunix',bitunixOpenEnvelopeResearch:true,
   initialCapital:1000,feeRate:report.feeRate,
   slippageRate:report.slippageRate,allocation:1
  });
  if(bt.assumptions.derivedOhlcResearch?.correctedBars!==frame.derivedCorrections)
   throw Error('Backtest engine correction provenance mismatch');
  frame.status='RESEARCH_REPLAY_OK';
  frame.vectorSignals={total:signals.length,long:signals.filter(x=>x.side==='long').length,
   short:signals.filter(x=>x.side==='short').length,
   samples:signals.slice(0,15).map(x=>({utc:iso(x.time),side:x.side}))};
  frame.backtest={tradeCount:bt.tradeCount,winRate:bt.winRate,returnPct:bt.returnPct,
   maxDrawdownPct:bt.maxDrawdownPct,finalCapitalUSDT:bt.finalCapital,
   assumptions:bt.assumptions,
   warning:'7d in-sample RESEARCH ONLY; no prediction, no portfolio strategy validation. Never interpret as guaranteed profits.'};
 }catch(e){frame.status='BLOCKED_OR_ERROR';frame.error=String(e?.stack??e)}
 console.log('FRAME '+JSON.stringify({tf,status:frame.status,rawQuality:frame.rawQuality,
  derivedCorrections:frame.derivedCorrections,derivedAllowed:frame.derivedStrictAllowed,
  signals:frame.vectorSignals,backtest:frame.backtest,error:frame.error}).slice(0,15000));
}
report.status=report.frames.every(x=>x.status==='RESEARCH_REPLAY_OK')?
 'RESEARCH_REPLAY_COMPLETED':'INCOMPLETE';
report.completedUTC=iso(Date.now());
await writeFile('cj-vector-ohlc-7d-replay.json',JSON.stringify(report,null,2)+'\n');
console.log('SUMMARY '+JSON.stringify({status:report.status,frames:report.frames.map(x=>({
 tf:x.tf,status:x.status,rawInvalid:x.rawQuality?.invalid??null,
 derivedCorrections:x.derivedCorrections,signals:x.vectorSignals?.total,
 trades:x.backtest?.tradeCount,error:x.error}))}));
if(report.status!=='RESEARCH_REPLAY_COMPLETED')process.exitCode=2;
