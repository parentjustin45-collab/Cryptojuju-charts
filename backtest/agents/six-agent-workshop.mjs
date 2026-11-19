/*
 * CryptoJuju — six-role research workshop, V0.
 * Safe deterministic coordinator. NOT a language-model agent or trading bot.
 * All six responsibilities are accounted for in each cycle.
 */
import {classifyHistory} from '../quality-gate.mjs';
import {VERIFIED_INTERVALS} from './research-batch.mjs';
import {runFixedHoldout} from './fixed-holdout.mjs';

export const SIX_AGENT_ROLES=Object.freeze([
  {id:'bitunix-data',title:'Intégrité des données Bitunix'},
  {id:'backtests',title:'Backtests historiques'},
  {id:'diagnostics',title:'Diagnostics et anomalies'},
  {id:'corrections',title:'Préparation des corrections'},
  {id:'validation',title:'Validation et non-régression'},
  {id:'coordination',title:'Coordination et rapports'}
]);

const record=(id,status,details={})=>({id,status,details});
const finite=x=>typeof x==='number' && Number.isFinite(x);
const safeList=(x)=>Array.isArray(x)?x:[];

function auditData(input) {
  const market=input?.market,window=input?.historyWindow,candles=input?.candles;
  if (!market || market.exchange!=='Bitunix' || market.priceType!=='LAST_PRICE'
      || !/^[A-Z0-9_]{3,40}$/.test(market.symbol??'')
      || !Object.hasOwn(VERIFIED_INTERVALS,market.timeframe)
      || !window || window.intervalMs!==VERIFIED_INTERVALS[market.timeframe])
    return record('bitunix-data','BLOCKED',{reason:'Unsupported or non-verified market/timeframe'});
  try {
    const audit=classifyHistory(candles,window);
    return record('bitunix-data',audit.status==='READY' && audit.quality.outOfRange===0?'PASS':'BLOCKED',{
      status:audit.status,quality:audit.quality,
      examples:{invalid:audit.issues.slice(0,3),missing:audit.missing.slice(0,3),duplicates:audit.quality.duplicates}
    });
  } catch (err) {
    return record('bitunix-data','BLOCKED',{reason:String(err?.message??err)});
  }
}

function executeBacktests(input,data) {
  if (data.status!=='PASS')
    return record('backtests','BLOCKED',{reason:'Data quality gate failed'});
  try {
    const result=runFixedHoldout(input);
    return record('backtests','PASS',{result});
  } catch (err) {
    return record('backtests','BLOCKED',{reason:String(err?.message??err)});
  }
}

function diagnose(data,backtests) {
  const findings=[];
  if (data.status!=='PASS') {
    findings.push({code:'SOURCE_DATA',severity:'BLOCKING',explanation:'Unverified OHLC/market prevents backtesting'});
  }
  if (backtests.status!=='PASS') {
    findings.push({code:'BACKTEST_BLOCKED',severity:'BLOCKING',explanation:backtests.details.reason??'Unknown backtest failure'});
  }
  if (backtests.status==='PASS') {
    const res=backtests.details.result;
    for(const [id,s] of Object.entries(res.holdout)){
      if(s.indicatorParity!=='VERIFIED')
        findings.push({code:'PARITY_UNVERIFIED',severity:'REVIEW',strategy:id});
      if(s.tradeCount<5)
        findings.push({code:'LOW_HOLDOUT_SAMPLE',severity:'REVIEW',strategy:id,count:s.tradeCount});
      if(s.returnPct<0)
        findings.push({code:'NEGATIVE_HOLDOUT_RETURN',severity:'REVIEW',strategy:id,returnPct:s.returnPct});
      if(s.maxDrawdownPct>=20)
        findings.push({code:'DRAWDOWN_REVIEW',severity:'REVIEW',strategy:id,maxDrawdownPct:s.maxDrawdownPct});
      const training=res.training[id];
      if(training && training.returnPct>0 && s.returnPct<0)
        findings.push({code:'TRAIN_HOLDOUT_DISAGREEMENT',severity:'REVIEW',strategy:id});
    }
  }
  return record('diagnostics','PASS',{findings});
}

function prepareCorrections(diagnostics) {
  const plan=new Map();
  for(const f of safeList(diagnostics.details.findings)) {
    if(f.code==='SOURCE_DATA')
      plan.set('DATA_PROVENANCE','Review raw Bitunix candles, preserve source values and verify provenance; do not synthesize OHLC');
    else if(f.code==='BACKTEST_BLOCKED')
      plan.set('CAUSALITY','Investigate confirmation timestamp, history window and signal contract before changing strategy code');
    else if(f.code==='PARITY_UNVERIFIED')
      plan.set('PINE_PARITY','Compare indicator outputs against independent TradingView samples before any accuracy claim');
    else if(f.code==='LOW_HOLDOUT_SAMPLE')
      plan.set('MORE_SAMPLES','Collect additional disjoint validation windows before ranking strategies');
    else if(f.code==='NEGATIVE_HOLDOUT_RETURN'||f.code==='TRAIN_HOLDOUT_DISAGREEMENT')
      plan.set('REVIEW_CONFLUENCE','Review false signals and costs; propose changes for human review, never optimize on holdout');
    else if(f.code==='DRAWDOWN_REVIEW')
      plan.set('REVIEW_RISK','Compare exits and risk settings on separate unseen windows; no live trading');
  }
  return record('corrections','PROPOSALS_ONLY',{
    proposals:[...plan].map(([code,description])=>({code,description})),
    writesToRepository:false,requiresHumanApproval:true
  });
}

function validateWorkshop(data,backtests,diagnostics,corrections){
  if (data.status!=='PASS'||backtests.status!=='PASS')
    return record('validation','BLOCKED',{reason:'No runnable data/experiment; do not declare success'});
  const result=backtests.details.result;
  const reports=Object.values(result.training).concat(Object.values(result.holdout));
  const checks={
    resultCount:Object.keys(result.training).length,
    twoPhases:Object.keys(result.training).length>0
      && Object.keys(result.training).length===Object.keys(result.holdout).length,
    finiteMetrics:reports.every(x=>[x.returnPct,x.netProfit,x.maxDrawdownPct,x.finalCapital].every(finite)),
    nextOpenTrading:result.status==='RESEARCH_ONLY',
    noAutomaticWrites:corrections.details.writesToRepository===false,
    noRealOrders:true
  };
  return record('validation',Object.values(checks).every(Boolean)?'PASS_RESEARCH_ONLY':'BLOCKED',{checks});
}

function coordinate(input,stages){
  const blocked=stages.some(s=>s.status==='BLOCKED');
  const complete=stages.length===5;
  const result={
    status:blocked?'BLOCKED':complete?'RESEARCH_READY':'INCOMPLETE',
    summary:blocked?'A required data/backtest/validation gate failed; no strategy success declared':
      'Six deterministic role checks completed, without orders or automatic code changes',
    market:input?.market?{exchange:input.market.exchange,symbol:input.market.symbol,timeframe:input.market.timeframe}:null,
    agents:[...stages,record('coordination','PASS',{
      reportingOnly:true,
      noAutomaticTrades:true,
      noMainChanges:true
    })],
    disclaimer:'Research orchestration only, not six autonomous LLM agents; no deployment, account access or trading.'
  };
  return result;
}

export function runSixAgentWorkshop(input={}) {
  const data=auditData(input);
  const backtests=executeBacktests(input,data);
  const diagnostics=diagnose(data,backtests);
  const corrections=prepareCorrections(diagnostics);
  const validation=validateWorkshop(data,backtests,diagnostics,corrections);
  return coordinate(input,[data,backtests,diagnostics,corrections,validation]);
}

export function formatWorkshopMarkdown(report) {
  const rows=report.agents.map(a=>`| ${a.id} | ${a.status} |`).join('\n');
  const findings=report.agents.find(a=>a.id==='diagnostics')?.details.findings??[];
  const lines=[
    '# CryptoJuju — Rapport des six rôles',
    '',
    `Statut : **${report.status}**`,
    '',
    '| Rôle | État |','|---|---|',rows,
    '',
    '## Diagnostics',
    ...(findings.length?findings.map(f=>`- ${f.code} : ${f.strategy??f.explanation??'à vérifier'}`):['- Aucune anomalie diagnostiquée sur ce lot.']),
    '',
    '> Tests de recherche uniquement. Aucune transaction ni modification de main.',
    ''
  ];
  return lines.join('\n');
}
