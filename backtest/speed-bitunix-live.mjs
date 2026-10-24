/* Read-only live Bitunix SPEED V3 experiment. No main/prod changes.
   Compare signal groups on isolated clean continuous windows only. */
import {makeCryptoJujuFetchPage} from './cryptojuju-adapter.mjs';
import {planCleanBacktestWindows} from './quarantine.mjs';
import {classifySpeedCandleV3} from './speed-candle-v3.mjs';
import {speedClassificationsToColorEvents,speedColorScenarios} from './speed-color-scenarios.mjs';
import {runBacktest} from './engine.mjs';
import {studySpeedForwardReturns} from './speed-forward-study.mjs';
import {studySpeedStructureReversals} from './speed-structure-reversal.mjs';
import {compareSpeedMidToOrdinary} from './speed-matched-baseline.mjs';
import {studySpeedByPeriod} from './speed-period-stability.mjs';
import {compareSpeedMatchedFeatures} from './speed-feature-matched.mjs';
import {compareSpeedHighContinuation} from './speed-high-continuation.mjs';
import {studySpeedConfirmations} from './speed-confirmation-sequences.mjs';
const periods={ '15m':900000,'30m':1800000,'1h':3600000,'4h':14400000 };
const symbols=['BTCUSDT','ETHUSDT','SOLUSDT'];
const days=Number(process.env.SPEED_HISTORY_DAYS ?? 60), minBars=22;
if(!Number.isSafeInteger(days)||days<1||days>90)throw Error('SPEED_HISTORY_DAYS must be an integer from 1 to 90');
const fetchPage=makeCryptoJujuFetchPage();
async function run(symbol,interval){
 const intervalMs=periods[interval],endTime=Math.floor(Date.now()/intervalMs)*intervalMs,startTime=endTime-days*86400000;
 const rows=[],pageBars=180;
 for(let start=startTime;start<endTime;start+=pageBars*intervalMs){
  const end=Math.min(endTime,start+pageBars*intervalMs);
  const page=await fetchPage({symbol,interval,startTime:start,endTime:end,limit:200});
  rows.push(...page.filter(r=>Number(r.time)>=start&&Number(r.time)<end));
 }
 const plan=planCleanBacktestWindows(rows,{startTime,endTime,intervalMs},{minBars});
 const stability=studySpeedByPeriod(plan.eligibleWindows,{intervalMs,periodDays:15});
 const featureMatched=Object.fromEntries(['bull','bear'].map(d=>[d,{signals:0,matched:0,unmatched:0,byHorizon:Object.fromEntries([3,5,10].map(h=>[h,{pairs:0,speedBreaks:0,controlBreaks:0}]))}]));
 for(const w of plan.eligibleWindows){
  const matched=compareSpeedMatchedFeatures(w.candles);
  for(const [direction,v] of Object.entries(matched.byDirection)){
   for(const field of ['signals','matched','unmatched'])featureMatched[direction][field]+=v[field];
   for(const [h,m] of Object.entries(v.byHorizon))for(const field of ['pairs','speedBreaks','controlBreaks'])featureMatched[direction].byHorizon[h][field]+=m[field];
  }
 }
 for(const v of Object.values(featureMatched))for(const m of Object.values(v.byHorizon)){
  m.speedRatePct=m.pairs?Number((100*m.speedBreaks/m.pairs).toFixed(2)):null;
  m.controlRatePct=m.pairs?Number((100*m.controlBreaks/m.pairs).toFixed(2)):null;
  m.liftPp=m.pairs?Number((100*(m.speedBreaks-m.controlBreaks)/m.pairs).toFixed(2)):null;
 }
 const highMatched=Object.fromEntries(['bull','bear'].map(d=>[d,{signals:0,matched:0,unmatched:0,byHorizon:Object.fromEntries([3,5,10].map(h=>[h,{pairs:0,speedWins:0,controlWins:0,sumSpeedPct:0,sumControlPct:0}]))}]));
 for(const w of plan.eligibleWindows){
  const result=compareSpeedHighContinuation(w.candles);
  for(const [direction,v] of Object.entries(result.byDirection)){
   for(const field of ['signals','matched','unmatched'])highMatched[direction][field]+=v[field];
   for(const [h,m] of Object.entries(v.byHorizon)){
    const target=highMatched[direction].byHorizon[h];
    for(const field of ['pairs','speedWins','controlWins'])target[field]+=m[field];
    if(m.pairs){target.sumSpeedPct+=m.meanSpeedPct*m.pairs;target.sumControlPct+=m.meanControlPct*m.pairs;}
   }
  }
 }
 for(const v of Object.values(highMatched))for(const m of Object.values(v.byHorizon)){
  m.speedRatePct=m.pairs?Number((100*m.speedWins/m.pairs).toFixed(2)):null;
  m.controlRatePct=m.pairs?Number((100*m.controlWins/m.pairs).toFixed(2)):null;
  m.liftPp=m.pairs?Number((100*(m.speedWins-m.controlWins)/m.pairs).toFixed(2)):null;
  m.meanSpeedPct=m.pairs?Number((m.sumSpeedPct/m.pairs).toFixed(4)):null;
  m.meanControlPct=m.pairs?Number((m.sumControlPct/m.pairs).toFixed(4)):null;
 }
 const confirmations=Object.fromEntries(['bull','bear'].map(d=>[d,{mid:0,confirmed:0,unconfirmed:0,byHorizon:Object.fromEntries([3,5,10].map(h=>[h,{pairs:0,wins:0,sumSignedPct:0}]))}]));
 for(const w of plan.eligibleWindows){
  const study=studySpeedConfirmations(w.candles);
  for(const [dir,m] of Object.entries(study.byDirection)){
   const dest=confirmations[dir];
   for(const field of ['mid','confirmed','unconfirmed'])dest[field]+=m[field];
   for(const [h,v] of Object.entries(m.byHorizon)){
    for(const field of ['pairs','wins'])dest.byHorizon[h][field]+=v[field];
    dest.byHorizon[h].sumSignedPct+=v.sumSignedPct;
   }
  }
 }
 for(const v of Object.values(confirmations)){
  v.confirmationRatePct=v.mid?Number((100*v.confirmed/v.mid).toFixed(2)):null;
  for(const m of Object.values(v.byHorizon)){
   m.winRatePct=m.pairs?Number((100*m.wins/m.pairs).toFixed(2)):null;
   m.meanSignedPct=m.pairs?Number((m.sumSignedPct/m.pairs).toFixed(4)):null;
  }
 }
 const groups=['green','red','blue','pink','directional','earlyReversal','combined'];
 const summary=Object.fromEntries(groups.map(k=>[k,{trades:0,wins:0,netPnl:0,signals:0,segments:0,maxDrawdownPct:0}]));
 const counts={green:0,red:0,blue:0,pink:0};
 const forward=Object.fromEntries(['bullHigh','bullMid','bearHigh','bearMid'].map(k=>[k,Object.fromEntries([3,5,10].map(h=>[h,{events:0,wins:0,losses:0,flat:0,sumSignedPct:0}]))]));
 const structure=Object.fromEntries(['bullMid','bearMid'].map(k=>[k,Object.fromEntries([3,5,10].map(h=>[h,{eligible:0,confirmed:0,unconfirmed:0}]))]));
 const baseline=Object.fromEntries(['bull','bear'].map(d=>[d,Object.fromEntries([3,5,10].map(h=>[h,{speed:{n:0,breaks:0},ordinary:{n:0,breaks:0}}]))]));
 for(const w of plan.eligibleWindows){
  const comparison=compareSpeedMidToOrdinary(w.candles);
  for(const [direction,hs] of Object.entries(comparison.byDirection))for(const [h,cohorts] of Object.entries(hs))for(const group of ['speed','ordinary'])for(const field of ['n','breaks'])baseline[direction][h][group][field]+=cohorts[group][field];
  const sr=studySpeedStructureReversals(w.candles);
  for(const [color,hs] of Object.entries(sr.byColor))for(const [h,m] of Object.entries(hs))for(const field of ['eligible','confirmed','unconfirmed'])structure[color][h][field]+=m[field];
  const study=studySpeedForwardReturns(w.candles);
  for(const [color,horizons] of Object.entries(study.byClassification))for(const [h,metrics] of Object.entries(horizons))for(const field of ['events','wins','losses','flat','sumSignedPct'])forward[color][h][field]+=metrics[field];
  const events=speedClassificationsToColorEvents(classifySpeedCandleV3(w.candles).slice(19));
  for(const e of events)counts[e.color]++;
  const scenarios=speedColorScenarios(events);
  for(const k of groups){
   const selected=['green','red','blue','pink'].includes(k)?scenarios.combined.filter(e=>e.color===k):scenarios[k];
   const signals=selected.map(({time,side})=>({time,side}));
   const result=runBacktest(w.candles,signals,{initialCapital:100,feeRate:0.0006,historyWindow:{startTime:w.startTime,endTime:w.endTime,intervalMs}});
   const s=summary[k];s.signals+=signals.length;s.trades+=result.tradeCount;s.wins+=result.trades.filter(t=>t.pnl>0).length;s.netPnl+=result.netProfit;s.segments++;s.maxDrawdownPct=Math.max(s.maxDrawdownPct,result.maxDrawdownPct);
  }
 }
 for(const s of Object.values(summary))s.winRatePct=s.trades?Number((100*s.wins/s.trades).toFixed(2)):null;
 for(const hs of Object.values(baseline))for(const x of Object.values(hs)){
  for(const group of ['speed','ordinary'])x[group].ratePct=x[group].n?Number((100*x[group].breaks/x[group].n).toFixed(2)):null;
  x.liftPp=x.speed.n&&x.ordinary.n?Number((x.speed.ratePct-x.ordinary.ratePct).toFixed(2)):null;
 }
 for(const hs of Object.values(structure))for(const v of Object.values(hs))v.ratePct=v.eligible?Number((100*v.confirmed/v.eligible).toFixed(2)):null;
 for(const horizons of Object.values(forward))for(const metrics of Object.values(horizons)){
  metrics.winRatePct=metrics.events?Number((100*metrics.wins/metrics.events).toFixed(2)):null;
  metrics.meanSignedPct=metrics.events?Number((metrics.sumSignedPct/metrics.events).toFixed(4)):null;
 }
 return {symbol,interval,periodDays:days,status:plan.status,expectedBars:(endTime-startTime)/intervalMs,receivedRows:rows.length,coveragePct:Number((100*(1-plan.excludedBars/((endTime-startTime)/intervalMs))).toFixed(2)),excludedBars:plan.excludedBars,cleanWindows:plan.eligibleWindows.length,counts,forwardStudy:forward,structureReversals:structure,matchedBaseline:baseline,periodStability:stability,featureMatched,highMatched,confirmations,scenarios:summary,warning:'Experimental. Each color is tested as an independent position strategy (not a direct event success metric). Segment capital resets to $100. netPnl is a sum of independent segment PnL, not a compounded return. No cross-gap trades; missing/invalid bars quarantined.'};
}
const output=[];
for(const symbol of symbols)for(const interval of Object.keys(periods)){
 try{const r=await run(symbol,interval);output.push(r);console.log(JSON.stringify(r));}
 catch(e){const r={symbol,interval,status:'ERROR',error:String(e.message??e)};output.push(r);console.error(JSON.stringify(r));}
}
console.log('SPEED_BITUNIX_REPORT='+JSON.stringify(output));
if(output.every(x=>x.status==='ERROR'||x.cleanWindows===0))process.exitCode=1;
