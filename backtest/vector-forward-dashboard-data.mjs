/**
 * Locked Vector shadow-paper results reader, no trading and no live data calls.
 * Does not compute returns, backfill trades, or infer unobserved future outcomes.
 */
export const PROTOCOL = 'cj-vector-v11-v14-forward-paper-btc-eth-sol-1h-v1';
export const START_UTC = '2026-10-28T00:00:00Z';
export const SYMBOLS = Object.freeze(['BTCUSDT','ETHUSDT','SOLUSDT']);
export const MODES = Object.freeze(['V1.1','V1.4']);
export const MIN_CLOSED = 30;
const states = new Set(['closed','open_pending','censored_gap','not_fillable']);
const finite = x => typeof x === 'number' && Number.isFinite(x);
const safeNum = x => finite(x) ? x : null;
const int = x => Number.isSafeInteger(x) && x >= 0 ? x : 0;
const fmt = x => safeNum(x) === null ? '—' : new Intl.NumberFormat('fr-CA',{
 minimumFractionDigits:2,maximumFractionDigits:2}).format(x);
export const fmtPercent = x => safeNum(x)===null ? '—' : fmt(x)+' %';
export const fmtCount = x => new Intl.NumberFormat('fr-CA').format(int(x));
export function analyzeForwardReport(report){
 if(!report || typeof report!=='object' || Array.isArray(report))
  throw new Error('Fichier JSON invalide.');
 if(report.protocol!==PROTOCOL)
  throw new Error('Protocole incompatible. Importe vector-forward-paper.json.');
 if(report.lock?.earliestSignalTime!==START_UTC)
  throw new Error('Date de départ modifiée : analyse refusée.');
 if(JSON.stringify(report.lock.instrument)!==JSON.stringify(SYMBOLS) ||
    JSON.stringify(report.lock.evaluationModes)!==JSON.stringify(MODES))
  throw new Error('Marchés ou versions différents du protocole verrouillé.');
 if(!['ARMED_NOT_STARTED','PROSPECTIVE_COLLECTING','ERROR'].includes(report.status))
  throw new Error('Statut de collecte inconnu.');
 const sourceTime=Date.parse(report.generatedAtUtc);
 if(!Number.isFinite(sourceTime))
  throw new Error('Horodatage de collecte absent.');
 if(!Array.isArray(report.results))
  throw new Error('Résultats Bitunix absents.');
 const indexed=new Map();
 for(const item of report.results){
  if(!item || !SYMBOLS.includes(item.symbol) || indexed.has(item.symbol))
   throw new Error('Marché manquant, inattendu ou répété.');
  indexed.set(item.symbol,item);
 }
 if(indexed.size!==SYMBOLS.length)
  throw new Error('Les trois marchés BTC/ETH/SOL ne sont pas présents.');
 const rows=[],trades=[];
 for(const symbol of SYMBOLS){
  const item=indexed.get(symbol);
  const modes=item.audit?.byMode ?? {};
  const sampleTrades=item.audit?.trades??[];
  if(!Array.isArray(sampleTrades))throw new Error('Journal des transactions invalide pour '+symbol);
  for(const trade of sampleTrades){
   if(!trade || !MODES.includes(trade.mode) || trade.symbol!==symbol ||
      !states.has(trade.status))
    throw new Error('Transaction ou état inconnu pour '+symbol);
   if(!Number.isSafeInteger(trade.signalTime) || trade.signalTime<Date.parse(START_UTC))
    throw new Error('Une transaction contient un signal antérieur au 28 octobre.');
   if(trade.status==='closed' && !finite(trade.netPct))
    throw new Error('Transaction clôturée sans résultat net vérifiable.');
   if(trade.status!=='closed' && trade.netPct!==null)
    throw new Error('Transaction incomplète avec résultat inventé.');
   trades.push({...trade});
  }
  for(const mode of MODES){
   const v=modes[mode]??{};
   const count=int(v.closed),wins=int(v.winning),pending=int(v.pending),
    censored=int(v.censoredGap),signals=int(v.signalCount);
   if(wins>count)throw new Error('Nombre de transactions gagnantes impossible.');
   const row={
    symbol,mode,status:item.status||'SOURCE_INDISPONIBLE',
    feed:item.feed?.quality??'INCONNU',
    received:int(item.feed?.received),excluded:int(item.feed?.excluded),
    signals,closed:count,wins,pending,censored,
    notFillable:int(v.notFillable),stop:int(v.stop),take:int(v.take),timeout:int(v.timeout),
    netMean:safeNum(v.meanNetPct),netMedian:safeNum(v.medianNetPct),
    netSum:safeNum(v.netPctSum),
    winRate:count>0 ? 100*wins/count : null,
    progress:Math.min(100,100*count/MIN_CLOSED),
    sufficient:count>=MIN_CLOSED
   };
   if(count===0 && [row.netMean,row.netMedian].some(x=>x!==null))
    throw new Error('Résultat moyen présent sans transaction clôturée.');
   if(report.status==='ARMED_NOT_STARTED' && (signals>0||count>0||pending>0))
    throw new Error('Transactions attribuées avant le démarrage prospectif.');
   rows.push(row);
  }
 }
 return {
  title:'Vector V1.1 / V1.4',
  asOf:report.generatedAtUtc,protocol:PROTOCOL,
  start:START_UTC,status:report.status,
  commit:typeof report.commit==='string'?report.commit:null,
  runId:typeof report.runId==='string'?report.runId:null,
  source:report.source||'Bitunix Futures 1H',
  rows,trades,
  totals:{closed:rows.reduce((s,r)=>s+r.closed,0),
   pending:rows.reduce((s,r)=>s+r.pending,0),
   censored:rows.reduce((s,r)=>s+r.censored,0),
   sufficient:rows.filter(r=>r.sufficient).length,
   errors:report.results.filter(r=>r.status==='DATA_OR_AUDIT_ERROR').length},
  warnings:[
   'Résultats d’un fichier importé, pas un tableau branché en temps réel.',
   'Aucun signal avant le 28 octobre 2026 à 00 h UTC.',
   'Les positions en attente ou censurées n’ont aucun gain comptabilisé.',
   'Les rendements moyens sont calculés par transaction et ne mesurent pas un portefeuille composé.',
   'Simulation seulement : aucun ordre Bitunix, aucun conseil financier.'
  ]
 };
}
