import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const ROOT=path.resolve(import.meta.dirname,'..');
const out=path.join(ROOT,'watch-preview-dist');
test('A sandbox-ready Render static bundle contains only the five app files and robots exclusion',()=>{
 execFileSync('bash',['scripts/build-watch-preview.sh'],{cwd:ROOT,stdio:'pipe'});
 const files=fs.readdirSync(out,{recursive:true,withFileTypes:true})
  .filter(x=>x.isFile()).map(x=>path.relative(out,path.join(x.parentPath,x.name))).sort();
 assert.deepEqual(files,[
  'backtest/vector-ait-v1.mjs',
  'backtest/vector-v14-hysteresis.mjs',
  'backtest/vector-watch-browser.mjs',
  'backtest/vector-watch-shadow.mjs',
  'index.html','robots.txt'
 ].sort());
 const html=fs.readFileSync(path.join(out,'index.html'),'utf8');
 assert.match(html,/<input type="checkbox" data-x="watchstate">/);
 assert.match(html,/import\('\.\/backtest\/vector-watch-browser\.mjs'\)/);
 const script=fs.readFileSync(path.join(out,'backtest/vector-watch-browser.mjs'),'utf8');
 assert.match(script,/visibleByDefault:false/);
 assert.match(script,/tradingSignal:false/);
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
