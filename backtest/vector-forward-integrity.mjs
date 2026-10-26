/* Independent interpretation of a LOCKED paper backtest report. No trading. */
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
export const REPORT_LOCK=Object.freeze({
 protocol:'cj-vector-v11-v14-forward-paper-btc-eth-sol-1h-v1',
 firstSignal:'2026-10-28T00:00:00Z',
 markets:['BTCUSDT','ETHUSDT','SOLUSDT'], modes:['V1.1','V1.4'],
 code:'744da2b93772f3c5dfdb8876ffcc5784058819d9',fee:.0006,slippage:.0005,
 risk:'fixed_1_5_3_12',closedThreshold:30
});
const START=Date.parse(REPORT_LOCK.firstSignal),H=3600000;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const near=(x,y,tol=.002)=>finite(x)&&finite(y)&&Math.abs(x-y)<=tol;
export function checkReport(d,{now=Date.now()}={}){
 const errors=[],warnings=[],rows=[];
 const err=x=>errors.push(x),warn=x=>warnings.push(x);
 if(!d||typeof d!=='object')return {status:'BLOCKED',errors:['No JSON report'],warnings,rows};
 if(d.protocol!==REPORT_LOCK.protocol||d.lock?.protocol!==REPORT_LOCK.protocol)err('Protocol mismatch');
 if(d.lock?.earliestSignalTime!==REPORT_LOCK.firstSignal||d.lock?.risk!==REPORT_LOCK.risk||
    d.lock?.feePerSide!==REPORT_LOCK.fee||d.lock?.slippagePerSide!==REPORT_LOCK.slippage||
    d.lock?.minimumClosedTradesPerMode!==REPORT_LOCK.closedThreshold||d.lock?.interval!=='1h')
   err('Frozen risk, fee, timeframe or start was altered');
 if(JSON.stringify(d.lock?.instrument)!==JSON.stringify(REPORT_LOCK.markets)||
    JSON.stringify(d.lock?.evaluationModes)!==JSON.stringify(REPORT_LOCK.modes))
   err('Market or model set modified');
 if(d.lock?.status!=='RESEARCH_SHADOW_ONLY'||!String(d.source).includes('Bitunix public 1h'))
   err('Read-only Bitunix provenance not confirmed');
 const asOf=Date.parse(d.generatedAtUtc??'');
 if(!Number.isFinite(asOf)||!Number.isFinite(now)||asOf>now+5*60000)err('Invalid/future generation time');
 if(Number.isFinite(asOf)&&now-asOf>36*H)warn('Report older than 36 hours; not a live observation');
 if(d.commit!==REPORT_LOCK.code)warn('GitHub event SHA '+d.commit+' differs from research checkout pin '+REPORT_LOCK.code+' (expected for pinned workflow; separate workflow-at-event SHA check required)');
 if(!Array.isArray(d.results)||d.results.length!==3)err('Expected exactly three markets');
 if(!['ARMED_NOT_STARTED','PROSPECTIVE_COLLECTING'].includes(d.status))err('Run is not healthy: '+d.status);
 const names=new Set();
 for(const r of d.results??[]){
  const symbol=r.symbol;
  if(!REPORT_LOCK.markets.includes(symbol)||names.has(symbol)){err('Repeated/unexpected market '+symbol);continue;}
  names.add(symbol);
  const trades=r.audit?.trades??[];
  if(!Array.isArray(trades)){err(symbol+' missing trade ledger');continue;}
  const feed=r.feed;
  if(feed){
   if(!['READY','PARTIAL_QUARANTINED'].includes(feed.quality))err(symbol+' invalid OHLC quality');
   if(feed.quality==='PARTIAL_QUARANTINED')warn(symbol+' has quarantined OHLC ('+feed.excluded+' exclusions)');
  } else if(asOf>=START)err(symbol+' missing Bitunix data after start');
  for(const mode of REPORT_LOCK.modes){
   const b=r.audit?.byMode?.[mode];
   if(!b){err(symbol+'/'+mode+' missing summary');continue;}
   const group=trades.filter(t=>t.mode===mode);
   const closed=group.filter(t=>t.status==='closed'),pending=group.filter(t=>t.status==='open_pending');
   const censored=group.filter(t=>t.status==='censored_gap'),notFilled=group.filter(t=>t.status==='not_fillable');
   const physical=group.filter(t=>finite(t.entryPrice)&&t.entryPrice>0);
   const awaiting=pending.filter(t=>t.entryPrice===null);
   const countReason=name=>closed.filter(t=>t.reason===name).length;
   const sum=closed.reduce((a,t)=>a+t.netPct,0);
   if(b.signalCount!==group.length||b.entries!==group.length-notFilled.length||
      b.closed!==closed.length||b.pending!==pending.length||
      b.censoredGap!==censored.length||b.notFillable!==notFilled.length)
     err(symbol+'/'+mode+' total counts do not reconcile');
   if(b.winning!==closed.filter(t=>t.netPct>0).length||b.stop!==countReason('stop')||
      b.take!==countReason('take')||b.timeout!==countReason('timeout'))
     err(symbol+'/'+mode+' exit counts do not reconcile');
   if(!near(b.sumNetPct,sum)||!near(b.netPctSum,sum)||
      (closed.length>0&&!near(b.meanNetPct,sum/closed.length,.0001)))
     err(symbol+'/'+mode+' realized results do not reconcile');
   if(closed.length===0&&(b.meanNetPct!==null||b.winRatePct!==null))
     err(symbol+'/'+mode+' fabricated performance with zero closed trades');
   if(b.sufficientSample!==(closed.length>=REPORT_LOCK.closedThreshold))
     err(symbol+'/'+mode+' invalid sample gate');
   if(awaiting.length)warn(symbol+'/'+mode+': raw entries count includes '+awaiting.length+' signals awaiting an open');
   rows.push({symbol,mode,signalCount:group.length,filledEntries:physical.length,
    awaitingNextOpen:awaiting.length,openPositions:pending.length-awaiting.length,
    closed:closed.length,censored:censored.length,unfillable:notFilled.length,
    meanNetPct:closed.length?Number((sum/closed.length).toFixed(3)):null,
    sufficientSample:closed.length>=REPORT_LOCK.closedThreshold,
    feedQuality:feed?.quality??'missing'});
   const keys=new Set();let exitBarrier=null;
   for(const t of group.slice().sort((a,b)=>a.signalTime-b.signalTime)){
    const key=symbol+'/'+mode+'/'+t.signalTime;
    if(keys.has(key))err(key+' duplicate signal');keys.add(key);
    if(t.symbol!==symbol||!['long','short'].includes(t.side)||
       !Number.isSafeInteger(t.signalTime)||t.signalTime%H!==0||t.signalTime<START||
       t.entryTime!==t.signalTime+H||t.signalTime+H>asOf)
      err(key+' invalid start/next-open/closed-bar');
    if(t.entryPrice!==null&&(!finite(t.entryPrice)||t.entryPrice<=0||t.entryTime+H>asOf))
      err(key+' unconfirmed candle used as fill');
    if(exitBarrier!==null&&t.entryTime<=exitBarrier)err(key+' overlapping same-model trades');
    if(t.status==='closed'){
     if(!['stop','take','timeout'].includes(t.reason)||
        !finite(t.netPct)||!finite(t.grossPct)||!finite(t.exitTime)||
        t.exitTime<t.entryTime||t.exitTime+H>asOf)err(key+' invalid completed trade');
     if(finite(t.netPct)&&finite(t.grossPct)){
      const dir=t.side==='long'?1:-1;
      const exitRatio=1+dir*t.grossPct/100;
      const theoretical=t.grossPct-100*REPORT_LOCK.fee*(1+exitRatio);
      if(!near(t.netPct,theoretical,.0001))err(key+' net/gross fee reconciliation failed');
     }
     exitBarrier=t.exitTime;
    }else if(t.status==='open_pending'||t.status==='not_fillable'||t.status==='censored_gap'){
     if(t.netPct!==null||t.exitTime!==null||t.grossPct!==undefined&&t.grossPct!==null)
      err(key+' unresolved position has fabricated profit');
    }else err(key+' unrecognized trade state');
   }
  }
 }
 for(const symbol of REPORT_LOCK.markets)if(!names.has(symbol))err('Missing '+symbol);
 if(asOf<START){
  if(d.status!=='ARMED_NOT_STARTED'||rows.some(x=>x.signalCount!==0||x.closed!==0))
   err('Pre-start result included prospective transactions');
 }
 return {status:errors.length?'BLOCKED':warnings.length?'PASS_WITH_WARNINGS':'PASS',
  generatedAtUtc:d.generatedAtUtc,checkedAtUtc:new Date(now).toISOString(),
  reportRunId:d.runId??null,lockedCodeSha:REPORT_LOCK.code,rows,warnings,errors,
  caution:'Entries are ONLY counted as filled when a positive entryPrice exists. Mean net percent is per closed paper trade, not compounded portfolio performance or a recommendation.'};
}
export function asMarkdown(r){
 let s='# CryptoJuju — Contrôle indépendant du comparatif Vector\n\n';
 s+='**État :** '+r.status+'   **Observation :** '+r.generatedAtUtc+'\n\n';
 s+='| Marché | Modèle | Signaux | Entrées simulées | Attente ouverture | Positions ouvertes | Clôturées | Censurées | Net moyen/trade |\n';
 s+='|---|---|---:|---:|---:|---:|---:|---:|---:|\n';
 for(const x of r.rows){s+='| '+x.symbol+' | '+x.mode+' | '+x.signalCount+' | '+x.filledEntries+
  ' | '+x.awaitingNextOpen+' | '+x.openPositions+' | '+x.closed+' | '+x.censored+
  ' | '+(x.meanNetPct===null?'—':x.meanNetPct+' %')+' |\n';}
 s+='\nLes rendements sont fictifs et par transaction clôturée, et ne représentent pas une courbe de capital.\n';
 if(r.warnings.length)s+='\n## Surveillance\n'+r.warnings.map(x=>'- '+x).join('\n')+'\n';
 if(r.errors.length)s+='\n## Erreurs\n'+r.errors.map(x=>'- '+x).join('\n')+'\n';
 return s;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const data=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
 const r=checkReport(data);
 console.log(asMarkdown(r));
 if(r.status==='BLOCKED')process.exitCode=1;
}
