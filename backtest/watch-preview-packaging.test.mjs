import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const ROOT=path.resolve(import.meta.dirname,'..');
const out=path.join(ROOT,'watch-preview-dist');
test('The separate Render bundle contains ONLY WATCH, browser-paper dependencies and robots exclusion',()=>{
 execFileSync('bash',['scripts/build-watch-preview.sh'],{cwd:ROOT,stdio:'pipe'});
 const files=fs.readdirSync(out,{recursive:true,withFileTypes:true})
  .filter(x=>x.isFile()).map(x=>path.relative(out,path.join(x.parentPath,x.name))).sort();
 assert.deepEqual(files,[
  'backtest/vector-ait-v1.mjs',
  'backtest/vector-v14-hysteresis.mjs',
  'backtest/vector-watch-browser.mjs',
  'backtest/vector-watch-shadow.mjs',
  'backtest/cryptojuju-adapter.mjs',
  'backtest/quality-gate.mjs',
  'backtest/quarantine.mjs',
  'backtest/vector-exit-selection.mjs',
  'backtest/vector-forward-live.mjs',
  'backtest/vector-forward-browser-engine.mjs',
  'vector-dashboard.html',
  'index.html','robots.txt'
 ].sort());
 const html=fs.readFileSync(path.join(out,'index.html'),'utf8');
 assert.match(html,/<input type="checkbox" data-x="watchstate">/);
 assert.match(html,/import\('\.\/backtest\/vector-watch-browser\.mjs'\)/);
 const script=fs.readFileSync(path.join(out,'backtest/vector-watch-browser.mjs'),'utf8');
 assert.match(script,/visibleByDefault:false/);
 assert.match(script,/tradingSignal:false/);
 const dashboard=fs.readFileSync(path.join(out,'vector-dashboard.html'),'utf8');
 assert.match(dashboard,/id="refreshBitunix"/);
 assert.match(dashboard,/15 minutes/);
 assert.match(dashboard,/backtest\/vector-forward-live\.mjs/);
 const engine=fs.readFileSync(path.join(out,'backtest/vector-forward-browser-engine.mjs'),'utf8');
 assert.match(engine,/2026-10-28T00:00:00Z/);
 assert.doesNotMatch(engine,/node:url|process\./);

});
test('Browser-transformed engine has exactly the same causal results as immutable Node engine',async()=>{
 const research=await import('./vector-forward-v11-v14.mjs');
 const browser=await import('../watch-preview-dist/backtest/vector-forward-browser-engine.mjs');
 const H=3600000,START=Date.parse('2026-10-28T00:00:00Z'),from=START-70*H;
 const bars=Array.from({length:110},(_,i)=>({
  time:from+i*H,open:100,high:101,low:99,close:100,volume:100}));
 bars[78]={...bars[78],open:100,high:103,low:99.9,close:102,volume:90000};
 bars[99]={...bars[99],open:100,high:100.1,low:97.5,close:98,volume:90000};
 const options={symbol:'BTCUSDT',asOfMs:bars.at(-1).time+H};
 assert.deepEqual(browser.studyForwardWindows([{candles:bars}],options),
  research.studyForwardWindows([{candles:bars}],options));
 const provider=async({startTime,endTime})=>
  Array.from({length:(endTime-startTime)/H},(_,i)=>({
   time:startTime+i*H,open:100,high:101,low:99,close:100,volume:100}));
 const pre=await browser.runForwardPaper({nowMs:START-3*H,fetchPage:provider});
 assert.equal(pre.status,'ARMED_NOT_STARTED');
 assert.ok(pre.results.every(r=>r.audit.trades.length===0));
 assert.equal(pre.commit,'744da2b93772f3c5dfdb8876ffcc5784058819d9');
 const live=fs.readFileSync(path.join(ROOT,'backtest/vector-forward-live.mjs'),'utf8');
 assert.match(live,/15\*60\*1000/);
 assert.match(live,/document\.hidden/);
 assert.doesNotMatch(live,/POST|apiKey|apiSecret|order\/create/i);
});
test('Preview Blueprint points only to DEV, forbids automatic deployments, and names a new Render site',()=>{
 const yaml=fs.readFileSync(path.join(ROOT,'render-watch-preview.yaml'),'utf8');
 assert.match(yaml,/branch: dev\/v1\.26\.0/);
 assert.match(yaml,/autoDeployTrigger: "off"/);
 assert.match(yaml,/staticPublishPath: \.\/watch-preview-dist/);
 assert.match(yaml,/name: cryptojuju-watch-v126-test/);
 assert.ok(!yaml.includes('branch: main'));
 assert.ok(!yaml.includes('cryptojuju-api.onrender.com'));
});
