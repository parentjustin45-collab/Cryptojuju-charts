/*
 * GitHub Actions end-to-end DRY RUN for the six-role workshop.
 * All OHLC and signals are synthetic fixtures, NOT actual Bitunix evidence.
 * No external network, keys, trading, scheduling or cloud account usage.
 */
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';

const intervalMs=900000;
const opens=[100,103,104,101,99,102,105,104,100,101,98];
const candles=opens.map((open,i)=>({
  time:i*intervalMs,open,high:open+2,low:open-2,close:open+1,volume:5+i
}));
const syntheticInput={
  fixtureKind:'SYNTHETIC_CI_ONLY_NOT_BITUNIX',
  market:{exchange:'Bitunix',priceType:'LAST_PRICE',symbol:'BTCUSDT',timeframe:'15m'},
  historyWindow:{startTime:0,endTime:candles.length*intervalMs,intervalMs},
  candles,holdoutStartTime:6*intervalMs,
  costs:{initialCapital:1000,feeRate:0.0006,slippageRate:0.0005,allocation:1},
  experiments:[{
    id:'synthetic_example_not_real_strategy',
    signalTimeConvention:'confirmation-bar-open',
    signals:[
      {time:intervalMs,side:'long'},{time:3*intervalMs,side:'flat'},
      {time:7*intervalMs,side:'short'},{time:9*intervalMs,side:'flat'}
    ]
  }]
};

const root=process.env.RUNNER_TEMP?
  resolve(process.env.RUNNER_TEMP,'cj-workshop-synthetic-smoke'):
  await mkdtemp(join(tmpdir(),'cj-workshop-synthetic-'));
const reportPath=join(root,'report');
await mkdir(reportPath,{recursive:true});
const fixturePath=join(root,'synthetic-input.json');
await writeFile(fixturePath,JSON.stringify(syntheticInput,null,2)+'\n');
const cli=resolve('backtest/agents/run-workshop.mjs');
const exec=(input,output)=>spawnSync(process.execPath,[cli,input,output],{
  encoding:'utf8',maxBuffer:2_000_000,timeout:15000
});

const ok=exec(fixturePath,reportPath);
if(ok.status!==0)throw Error('Synthetic E2E CLI failed: '+ok.stderr+'\n'+ok.stdout);
const report=JSON.parse(await readFile(join(reportPath,'report.json'),'utf8'));
const markdown=await readFile(join(reportPath,'report.md'),'utf8');
assert.equal(report.status,'RESEARCH_READY');
assert.equal(report.agents.length,6);
assert.deepEqual(report.agents.map(a=>a.id),[
  'bitunix-data','backtests','diagnostics','corrections','validation','coordination'
]);
assert.equal(report.agents[3].details.writesToRepository,false);
assert.equal(report.agents[4].status,'PASS_RESEARCH_ONLY');
assert.match(markdown,/RESEARCH_READY/);

const faultyPath=join(root,'synthetic-broken-input.json');
await writeFile(faultyPath,JSON.stringify({
  ...syntheticInput,candles:candles.filter(c=>c.time!==4*intervalMs)
}));
const badDir=join(root,'expected-blocked');
const bad=exec(faultyPath,badDir);
assert.equal(bad.status,1,'Missing candles must fail the CLI');
const failedReport=JSON.parse(await readFile(join(badDir,'report.json'),'utf8'));
assert.equal(failedReport.status,'BLOCKED');
assert.equal(failedReport.agents[0].status,'BLOCKED');
assert.equal(failedReport.agents[1].status,'BLOCKED');
assert.equal(failedReport.agents[4].status,'BLOCKED');

const manifest={
  kind:'SYNTHETIC_CI_SMOKE_NOT_REAL_MARKET_DATA',
  generatedUtc:new Date().toISOString(),
  gitCommit:process.env.GITHUB_SHA??null,
  checks:{sixRolesExecuted:true,reportJsonProduced:true,reportMarkdownProduced:true,
          missingCandleBlocksExecution:true,automaticRepositoryWrites:false,
          realBitunixDataUsed:false,realIndicatorsUsed:false},
  outcome:'PASS',
  warning:'This validates only orchestration, report generation and failure behavior with fabricated fixtures. It is not an actual Bitunix historical backtest or proof of profitability.'
};
await writeFile(join(reportPath,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await writeFile(join(reportPath,'README.txt'),
  'SYNTHETIC CI FIXTURE ONLY — no real Bitunix OHLC or indicator signals.\n'+
  'Results are not financial performance evidence.\n');
console.log(JSON.stringify({status:'PASS_SYNTHETIC_ONLY',roles:6,checks:manifest.checks,reportDirectory:reportPath}));
