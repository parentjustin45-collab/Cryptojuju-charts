/*
 * DEV long-term research orchestration. For each 25-pair cohort, only replay
 * when ALL 730 days are actually covered without gaps and SHA reread checks
 * pass. Result is immutable gzip research evidence, no trading or promotion.
 * OFF by default on Render, capacity guarded and one pair per tick.
 */
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {FIVE_CASES} from './five-by-five.mjs';
import {historicalTargetFor,expectedHistoricalBars} from './historical-period.mjs';
import {replayCompletePeriodFromPostgres}
  from './historical-multiyear-replay.mjs';
import {readBitunixContractPrecision} from '../bitunix-contract-precision.mjs';

const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
const VERSION='CJ_FIVE_INDICATOR_TWO_YEAR_REPLAY_V1_20261124';
export async function initializeMultiYearReplay(db){
  await db.query("CREATE TABLE IF NOT EXISTS cj_multiyear_replay_reports ("+
    "symbol text NOT NULL,timeframe text NOT NULL,"+
    "period_start_ms bigint NOT NULL,period_end_ms bigint NOT NULL,"+
    "engine_version text NOT NULL,source_sequence_sha256 char(64) NOT NULL,"+
    "report_sha256 char(64) NOT NULL,report_gzip bytea NOT NULL,"+
    "raw_bytes bigint NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),"+
    "PRIMARY KEY(symbol,timeframe,period_start_ms,period_end_ms,engine_version))");
}
export async function runEligibleMultiYearReplay(db,{maxPairs=1,
  precisionReader=readBitunixContractPrecision,
  replay=replayCompletePeriodFromPostgres,
  memoryBudgetBytes=400*1024*1024}={}){
  if(!Number.isInteger(maxPairs)||maxPairs<1||maxPairs>2)
    throw Error('MULTIYEAR_REPLAY_LIMIT_OUT_OF_BOUNDS');
  await initializeMultiYearReplay(db);
  const report={
    protocol:'CJ_FIVE_INDICATOR_TWO_YEAR_REPLAY_SCHEDULER_V1',
    target:'2024-11-24_to_2026-11-24_UTC_or_verified_listing_adjusted',completed:[],
    awaitingHistoricalCoverage:[],noOrders:true
  };
  let processed=0;
  const prioritized=[...FIVE_CASES].sort((a,b)=>
    ['1d','4h','1h','30m','15m'].indexOf(a.timeframe)-
    ['1d','4h','1h','30m','15m'].indexOf(b.timeframe));
  for(const {symbol,timeframe} of prioritized){
    if(processed>=maxPairs)break;
    const target=historicalTargetFor(symbol,timeframe);
    const expected=expectedHistoricalBars({timeframe,
      startMs:target.startMs,endMs:target.endMs});
    const q=await db.query('SELECT count(*)::int AS bars,min(open_ms)::bigint AS first,'+
      'max(open_ms)::bigint AS last FROM cj_historical_candles '+
      'WHERE symbol=$1 AND timeframe=$2 AND open_ms>=$3 AND open_ms<$4',
      [symbol,timeframe,target.startMs,target.endMs]);
    const row=q.rows[0]??{},have=Number(row.bars),step=
      (target.endMs-target.startMs)/expected;
    if(have!==expected||Number(row.first)!==target.startMs||
      Number(row.last)!==target.endMs-step){
      report.awaitingHistoricalCoverage.push({symbol,timeframe,
        existingBars:have,expectedBars:expected,coverageKind:target.coverageKind,startMs:target.startMs,endMs:target.endMs});
      continue;
    }
    const exists=await db.query("SELECT source_sequence_sha256 FROM cj_multiyear_replay_reports "+
      "WHERE symbol=$1 AND timeframe=$2 AND period_start_ms=$3 AND period_end_ms=$4 "+
      "AND engine_version=$5 LIMIT 1",[symbol,timeframe,
        target.startMs,target.endMs,VERSION]);
    if(exists.rowCount){
      report.alreadyArchived=(report.alreadyArchived??0)+1;
      continue;
    }
    if(process.memoryUsage().rss>memoryBudgetBytes){
      report.paused='MEMORY_BUDGET_EXCEEDED_BEFORE_REPLAY';
      break;
    }
    const metadata=await precisionReader({symbols:[symbol]});
    const contract=metadata.contracts?.find(x=>x.symbol===symbol&&
      x.source==='BITUNIX_PUBLIC_TRADING_PAIRS'&&
      x.stepStatus==='RESEARCH_PRICE_PRECISION_NOT_TV_MINTICK'&&
      Number.isInteger(x.quotePrecision)&&x.priceStep===10**(-x.quotePrecision));
    if(!contract)throw Error('VERIFIED_BITUNIX_PRICE_PRECISION_MISSING');
    const research=await replay(db,{symbol,timeframe,priceStep:contract.priceStep});
    if(research.closedCandles!==expected||
      research.status!==(target.coverageKind==='FULL_TWO_YEAR'?'TWO_YEAR_CAUSAL_RESEARCH_COMPLETE_NOT_PERFORMANCE_CERTIFIED':'LISTING_ADJUSTED_CAUSAL_RESEARCH_COMPLETE_NOT_PERFORMANCE_CERTIFIED')||
      research.startTime!==target.startMs||research.endTime!==target.endMs||
      research.marketOrdersPlaced!==0)
      throw Error('HISTORICAL_FIVE_INDICATOR_REPLAY_NOT_COMPLETE');
    const raw=Buffer.from(JSON.stringify(research));
    if(raw.length>16*1024*1024)throw Error('HISTORICAL_REPLAY_REPORT_EXCEEDS_SIZE_LIMIT');
    const gzip=gzipSync(raw,{level:6});
    const client=await db.connect();
    try{
      await client.query('BEGIN');
      const size=await client.query('SELECT pg_database_size(current_database())::bigint AS bytes');
      if(Number(size.rows[0]?.bytes)>=1073741824*.70)
        throw Error('HISTORICAL_REPLAY_DATABASE_CAPACITY_GUARD');
      const stored=await client.query('INSERT INTO cj_multiyear_replay_reports ('+
        'symbol,timeframe,period_start_ms,period_end_ms,engine_version,'+
        'source_sequence_sha256,report_sha256,report_gzip,raw_bytes) '+
        'VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) '+
        'ON CONFLICT DO NOTHING RETURNING report_sha256',
        [symbol,timeframe,target.startMs,target.endMs,
          VERSION,research.sourceSequenceSha256,hash(raw),gzip,raw.length]);
      await client.query('COMMIT');
      report.completed.push({symbol,timeframe,status:stored.rowCount?
        'REPLAY_PERSISTED':'ALREADY_REPLAYED_CONCURRENTLY',
        closedBars:research.closedCandles,coverageKind:target.coverageKind,startMs:target.startMs,endMs:target.endMs,
        sourceSequenceSha256:research.sourceSequenceSha256,
        reportSha256:hash(raw),compressedBytes:gzip.length});
      processed++;
    }catch(err){try{await client.query('ROLLBACK');}catch{}throw err;}
    finally{client.release();}
  }
  report.status=report.completed.some(x=>x.status==='REPLAY_PERSISTED')
    ?'MULTIYEAR_HISTORICAL_INDICATOR_REPLAY_ARCHIVED':
    'AWAITING_COMPLETE_HISTORICAL_COHORT';
  return report;
}
