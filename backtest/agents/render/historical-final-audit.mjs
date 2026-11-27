/* Final audit, 2026-11-27. Read-only independent reread of production data.
 * The receipt baseline is the 25 REPLAY_PERSISTED events from Render logs.
 * Run from the internal Render network with DATABASE_URL already set.
 * No orders, DB writes, migrations, external connections or deployment.
 */
import pg from 'pg';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {loadHistoricalPeriod,historicalTargetFor,expectedHistoricalBars} from './historical-period.mjs';
import {FIVE_CASES} from './five-by-five.mjs';

const BASELINE = [
  {
    "symbol": "BTCUSDT",
    "timeframe": "1d",
    "closedBars": 730,
    "sourceSequenceSha256": "3390353fb7d2c1521078f7a81018d98741e10e2339775304627a904628514cfb",
    "reportSha256": "a62da5cc4d6efd36053bd05701fd616e1167ca17115fbc2b1e2b8ded06beb620",
    "compressedBytes": 4799
  },
  {
    "symbol": "ETHUSDT",
    "timeframe": "1d",
    "closedBars": 730,
    "sourceSequenceSha256": "374a191312466e47969a6d23c3b82317df4a4b4851c9b24aff3f481acc5cb43d",
    "reportSha256": "43b109501bbaa633e4c9fffa67b7855e58befe488e15f224ba95832253e71f47",
    "compressedBytes": 4864
  },
  {
    "symbol": "SOLUSDT",
    "timeframe": "1d",
    "closedBars": 730,
    "sourceSequenceSha256": "500fbca5fae1e0e16385cec45797ce9e369a32c7e24341248feaa7f4d4f4503e",
    "reportSha256": "2c067b4be79ceb7ecb48a0516e65cb93adbc31920392775eb6d2ee44a6eef1b9",
    "compressedBytes": 4682
  },
  {
    "symbol": "HYPEUSDT",
    "timeframe": "1d",
    "closedBars": 603,
    "sourceSequenceSha256": "ddc234922445601a87fa870ad7d56753ae8fe8f08622c023ef32196246aa5b84",
    "reportSha256": "a0272da6eb1c7405cdb251a711eb7ed6d84ab3392857c140eff61eb9a52f5ef1",
    "compressedBytes": 4505
  },
  {
    "symbol": "1000PEPEUSDT",
    "timeframe": "1d",
    "closedBars": 730,
    "sourceSequenceSha256": "7f3b4b2945a5603df58c1113524879633960eb3cb87fe1ba07b5420ba40866c8",
    "reportSha256": "1c5049c0da4a9a6ee7fb9fab8cf2bc61ec780b7d0eccc14d814c724570b77846",
    "compressedBytes": 4855
  },
  {
    "symbol": "BTCUSDT",
    "timeframe": "4h",
    "closedBars": 4380,
    "sourceSequenceSha256": "af5ed64478fe960440ace7ba3d182c318d408f66c5b23e7675114a55eb620402",
    "reportSha256": "ac1960cdc28c60745389b6cbe3e3ea8d4e5a0ee6688cfa51e70b0184f5611c04",
    "compressedBytes": 16069
  },
  {
    "symbol": "ETHUSDT",
    "timeframe": "4h",
    "closedBars": 4380,
    "sourceSequenceSha256": "db9e0007f6cb9e2160bfb6e7f80028a65f6245424a42837ce1f75c5c00900476",
    "reportSha256": "c5b8c1a564cedd617ee8779b929868d176847a0945f346ec491fd1b64bf2c5c5",
    "compressedBytes": 15851
  },
  {
    "symbol": "SOLUSDT",
    "timeframe": "4h",
    "closedBars": 4380,
    "sourceSequenceSha256": "114b332c6a600ce09849c590e20c6d97fdd196b1874b33676d354af83d9c35c9",
    "reportSha256": "241222b63489c0a234cd11cbb0854ab0314085aab061e7ed8365dc7686a8706f",
    "compressedBytes": 15733
  },
  {
    "symbol": "HYPEUSDT",
    "timeframe": "4h",
    "closedBars": 3637,
    "sourceSequenceSha256": "14096141dde0acadf1d0baec2c16266094c6dc1f1eb6df1c2e4b6ef1ba888805",
    "reportSha256": "4d8daa2e88bfc297568ea68b7ce10aa77157a30717bd987fa13baa51dfb78594",
    "compressedBytes": 13313
  },
  {
    "symbol": "1000PEPEUSDT",
    "timeframe": "4h",
    "closedBars": 4380,
    "sourceSequenceSha256": "4eca585a0b0ff34c0ad2e2ac30c634102f4d80cf4ff45fc260489950b1d86d2e",
    "reportSha256": "455aba254baa3aa9543057f76eee761f5ceb8155e50122708224238c2b17554c",
    "compressedBytes": 15087
  },
  {
    "symbol": "HYPEUSDT",
    "timeframe": "1h",
    "closedBars": 14557,
    "sourceSequenceSha256": "0a1a934d853f50f015007d2cccdd6e37ef58783712fa36db797bab22334de2bb",
    "reportSha256": "ee1be497eeb448b8e4811bbd9931711b7f3b4523e478eaf4af846380e1c705a8",
    "compressedBytes": 42397
  },
  {
    "symbol": "BTCUSDT",
    "timeframe": "1h",
    "closedBars": 17520,
    "sourceSequenceSha256": "3ea831ea746015f415736a315e6dd41899ce4a46374a0b86f7108b85bdaddbba",
    "reportSha256": "c04778e00c9539bf0095ae3a914840ecb31780dc2fd49843fdc10ae36149cacc",
    "compressedBytes": 51658
  },
  {
    "symbol": "ETHUSDT",
    "timeframe": "1h",
    "closedBars": 17520,
    "sourceSequenceSha256": "6c30b7a31c368b4df04e3cedb11054d23ad66add6da6e2d862708e7db7722379",
    "reportSha256": "782e5680214232840cfecb6e619673eaa52f8ae222b76274647a6b74858f056f",
    "compressedBytes": 50395
  },
  {
    "symbol": "SOLUSDT",
    "timeframe": "1h",
    "closedBars": 17520,
    "sourceSequenceSha256": "4cd5b209f23f5483903e3835f3b743435ce2337a12b4b95ea280ba55857e8158",
    "reportSha256": "c680b42c4690460abee8afd48fac255842d4a1bc56b4e2b419b0b673ef1b4082",
    "compressedBytes": 50193
  },
  {
    "symbol": "1000PEPEUSDT",
    "timeframe": "1h",
    "closedBars": 17520,
    "sourceSequenceSha256": "2c2bf1a44709a41ea107d6a45f4f7b4ff9c94624b8530c40f0c442bc9b36bd05",
    "reportSha256": "3162da2a0eb922539e072a1a73ec2cfca7ae01d22591fc766cfc5a72f1a964b4",
    "compressedBytes": 48912
  },
  {
    "symbol": "HYPEUSDT",
    "timeframe": "30m",
    "closedBars": 29117,
    "sourceSequenceSha256": "d9366bb771536ec2f33faf79a53d967603e03f880f1e40bfdfefc27c288accb2",
    "reportSha256": "f8f43e0017db8869a6f1510e3f7f08d6bb573f250449a836becc78f94cc198d1",
    "compressedBytes": 80712
  },
  {
    "symbol": "BTCUSDT",
    "timeframe": "30m",
    "closedBars": 35040,
    "sourceSequenceSha256": "1a7494c8d66c02f3fb0234545f9ee0077881a7c145a4f387a7b14d820e04d846",
    "reportSha256": "8a59f5ae326a4ab67f1989fc14257c4e4006db7a55869ec0e01312138b47e6b6",
    "compressedBytes": 96182
  },
  {
    "symbol": "ETHUSDT",
    "timeframe": "30m",
    "closedBars": 35040,
    "sourceSequenceSha256": "470b12d047336e7a8641e11876e642c4bc614a233df62373369e656fac732507",
    "reportSha256": "50521de877e88d21768ee98d8a3f6860e7eccaab987268ddcb9ce1e493897495",
    "compressedBytes": 95448
  },
  {
    "symbol": "SOLUSDT",
    "timeframe": "30m",
    "closedBars": 35040,
    "sourceSequenceSha256": "6f10d1366c6d5c7530e30d78f82f27286376b503505739152f48225a78aced5f",
    "reportSha256": "b872a0266423cad30dc2f85df67d48885e8e308ae00fe6db28dbec76eeb7aab3",
    "compressedBytes": 94005
  },
  {
    "symbol": "1000PEPEUSDT",
    "timeframe": "30m",
    "closedBars": 35040,
    "sourceSequenceSha256": "3d22ee996894189b7d507d1b483753bbdddf435885a4323d954be64e699333c9",
    "reportSha256": "81c54ac8daf3215acd14a1992d32aa16070f661073da6401a2441e87ca1f77b7",
    "compressedBytes": 92337
  },
  {
    "symbol": "HYPEUSDT",
    "timeframe": "15m",
    "closedBars": 58237,
    "sourceSequenceSha256": "9ef46ecadf2f0bbd9e4c5e703f97860e93d5371db3689895ab3f93cdbd4b4517",
    "reportSha256": "38ee12b814d90bb50850c10979b4e955143a760cc0fcbf00685d0996a4264aae",
    "compressedBytes": 152063
  },
  {
    "symbol": "BTCUSDT",
    "timeframe": "15m",
    "closedBars": 70080,
    "sourceSequenceSha256": "0211b5127cc55833ef415af952fc231c79fd7a4f88ee901f7289ca12cfc7dcae",
    "reportSha256": "70cb2c4accc80c06731b896d295f04bd8fb86cd22aa2222fdd53c1110a5d95ba",
    "compressedBytes": 183222
  },
  {
    "symbol": "ETHUSDT",
    "timeframe": "15m",
    "closedBars": 70080,
    "sourceSequenceSha256": "f025e64bc4d2feb26a956a25273826b284e1b6780068e105bf78541d10a530f5",
    "reportSha256": "576f59eca30f35b2ae2c1777bfd8f2211124072bd05e8ef87b8979b6c3bf9ff6",
    "compressedBytes": 182639
  },
  {
    "symbol": "SOLUSDT",
    "timeframe": "15m",
    "closedBars": 70080,
    "sourceSequenceSha256": "08c018aa55a57c11248152c45188aaa81b080ef78281365176f822d63d29ff9c",
    "reportSha256": "26bb131cb3717c3f891cb35ba8cbfde0a0764309747d9e9a3c58020a35b8c146",
    "compressedBytes": 178213
  },
  {
    "symbol": "1000PEPEUSDT",
    "timeframe": "15m",
    "closedBars": 70080,
    "sourceSequenceSha256": "333500ba5075521e9cb3a213b169bb1b769fa14113d10831d2e2f6ba718199bf",
    "reportSha256": "ab7fb9e16d0eb3f2b148a18cda0d92f0c027f71d7153302e6d85beca2137fd19",
    "compressedBytes": 176263
  }
];
const VERSION='CJ_FIVE_INDICATOR_TWO_YEAR_REPLAY_V1_20261124';
const CHANNELS=['vector','momentum','speed','cipher','frank_cross','frank_divergence'];
const hash=b=>createHash('sha256').update(b).digest('hex');
const insist=(v,reason)=>{if(!v)throw Error(reason);};
const log=o=>console.log('CJ_FINAL_LIBRARY_AUDIT '+JSON.stringify(o));

export function validateReport(row,source,receipt,target){
  const gzip=row.report_gzip;
  insist(Buffer.isBuffer(gzip)&&gzip.length===receipt.compressedBytes,'COMPRESSED_SIZE_MISMATCH');
  const raw=gunzipSync(gzip,{maxOutputLength:16*1024*1024});
  insist(raw.length===Number(row.raw_bytes),'REPORT_BYTE_COUNT_MISMATCH');
  insist(hash(raw)===String(row.report_sha256).trim()&&hash(raw)===receipt.reportSha256,'REPORT_SHA256_MISMATCH');
  const p=JSON.parse(raw.toString('utf8'));
  insist(String(row.source_sequence_sha256).trim()===source.sequenceSha256&&
    p.sourceSequenceSha256===source.sequenceSha256&&source.sequenceSha256===receipt.sourceSequenceSha256,'SOURCE_SEQUENCE_MISMATCH');
  insist(p.protocol==='CJ_CONTINUOUS_TWO_YEAR_FIVE_INDICATOR_REPLAY_V1'&&
    p.symbol===receipt.symbol&&p.timeframe===receipt.timeframe&&
    p.startTime===target.startMs&&p.endTime===target.endMs&&p.coverageKind===target.coverageKind&&
    p.closedCandles===receipt.closedBars,'REPORT_IDENTITY_OR_COVERAGE_MISMATCH');
  insist(p.noLookaheadTestsPassed===true&&p.causalPrefixChecks>=3&&p.marketOrdersPlaced===0&&
    p.trainingOptimizationPerformed===false&&p.feesAndSlippageIncluded===false&&p.profitCertification===false,'REPORT_RESEARCH_SAFETY_FLAGS');
  insist(p.holdoutStartTime===source.candles[Math.floor(source.candles.length*.7)].time,'HOLDOUT_BOUNDARY_MISMATCH');
  insist(Object.keys(p.indicators??{}).sort().join(',')===[...CHANNELS].sort().join(','),'INDICATOR_CHANNELS_MISSING');
  let signals=0;
  for(const k of CHANNELS){
    const v=p.indicators[k];
    insist(Array.isArray(v.signals)&&v.signalCount===v.signals.length,'SIGNAL_COUNT_MISMATCH_'+k);
    let prior=-Infinity;
    for(const e of v.signals){
      insist(Number.isSafeInteger(e.time)&&e.time>=target.startMs&&e.time<target.endMs&&
        (e.time-target.startMs)%source.historyWindow.intervalMs===0&&e.time>=prior&&
        ['long','short'].includes(e.side),'INVALID_SIGNAL_'+k);
      prior=e.time;
    }
    for(const phase of ['training','holdout']){
      const stats=v.trainHoldout?.[phase];
      insist(Number.isSafeInteger(stats?.events)&&stats.events>=0,'INVALID_PHASE_'+k);
      for(const h of [1,4,12]){
        const m=stats.horizons?.[h];
        insist(Number.isSafeInteger(m?.samples)&&m.samples>=0&&m.samples<=stats.events,'INVALID_HORIZON_'+k);
        for(const field of ['meanDirectionReturnPct','meanFavorableExcursionPct','meanAdverseExcursionPct','positivePct'])
          insist(m.samples?Number.isFinite(m[field]):m[field]===null,'INVALID_METRIC_'+k);
      }
    }
    signals+=v.signalCount;
  }
  return {signals,causalPrefixChecks:p.causalPrefixChecks,analysisCount:5};
}

async function main(){
  insist(process.env.DATABASE_URL,'DATABASE_URL_REQUIRED');
  insist(BASELINE.length===25&&new Set(BASELINE.map(x=>x.symbol+'|'+x.timeframe)).size===25,'BASELINE_INVALID');
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:10000,application_name:'cj-final-library-audit-readonly'});
  let db, passed=0, bars=0, analyses=0, signals=0;
  try{
    db=await pool.connect();
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await db.query("SET LOCAL statement_timeout = '30s'");
    await db.query("SET LOCAL idle_in_transaction_session_timeout = '60s'");
    const mode=await db.query('SHOW transaction_read_only');
    insist(mode.rows[0].transaction_read_only==='on','READ_ONLY_REQUIRED');
    const total=await db.query('SELECT count(*)::int AS n FROM cj_historical_candles WHERE open_ms >= $1 AND open_ms < $2',[1732406400000,1795478400000]);
    insist(Number(total.rows[0].n)===617151,'GLOBAL_BAR_COUNT_MISMATCH');
    for(const {symbol,timeframe} of FIVE_CASES){
      const receipt=BASELINE.find(x=>x.symbol===symbol&&x.timeframe===timeframe);
      const target=historicalTargetFor(symbol,timeframe);
      insist(receipt&&expectedHistoricalBars({timeframe,...target})===receipt.closedBars,'EXPECTED_COUNT_MISMATCH');
      const source=await loadHistoricalPeriod(db,{symbol,timeframe,...target,pageSize:2000});
      insist(source.barCount===receipt.closedBars&&source.sequenceSha256===receipt.sourceSequenceSha256,'CANDLE_COUNT_OR_SEQUENCE_MISMATCH');
      const q=await db.query('SELECT source_sequence_sha256,report_sha256,report_gzip,raw_bytes FROM cj_multiyear_replay_reports WHERE symbol=$1 AND timeframe=$2 AND period_start_ms=$3 AND period_end_ms=$4 AND engine_version=$5',[symbol,timeframe,target.startMs,target.endMs,VERSION]);
      insist(q.rowCount===1,'MISSING_OR_DUPLICATE_REPORT');
      const v=validateReport(q.rows[0],source,receipt,target);
      passed++;bars+=source.barCount;analyses+=v.analysisCount;signals+=v.signals;
      log({status:'PAIR_VERIFIED',symbol,timeframe,bars:source.barCount,sourceSequenceSha256:source.sequenceSha256,reportSha256:receipt.reportSha256,...v});
    }
    insist(passed===25&&bars===617151&&analyses===125,'FINAL_TOTAL_MISMATCH');
    await db.query('ROLLBACK');
    log({status:'PASS',pairs:passed,bars,analyses,signals,readOnly:true,noTrading:true,scope:'chronology, OHLC, per-candle hashes, sequence hashes, archived report hashes and content; no profitability certification'});
  }catch(e){
    if(db)try{await db.query('ROLLBACK');}catch{}
    log({status:'FAIL',pairsPassed:passed,barsVerified:bars,reason:String(e?.message??e).slice(0,200),readOnly:true});
    process.exitCode=1;
  }finally{db?.release();await pool.end();}
}
await main();
