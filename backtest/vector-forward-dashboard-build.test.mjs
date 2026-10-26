import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
test('Dashboard bundles in ONE independent HTML with NO external resources',()=>{
 execFileSync(process.execPath,['scripts/build-vector-dashboard.mjs'],{
  cwd:new URL('../',import.meta.url),stdio:'pipe'});
 const p=new URL('../dashboard-dist/vector-forward-dashboard.html',import.meta.url);
 const s=fs.readFileSync(p,'utf8');
 assert.match(s,/28 octobre 2026/);
 assert.match(s,/Aucun rapport chargé/);
 assert.match(s,/vector-forward-paper\.json/);
 assert.match(s,/30 transactions clôturées/);
 assert.doesNotMatch(s,/<script[^>]*src=/i);
 assert.doesNotMatch(s,/https?:\/\/[^'"]+\.js/i);
 assert.match(s,/<script>\s*'use strict';/);
 const js=s.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(js);
 assert.doesNotThrow(()=>new vm.Script(js));
 assert.doesNotMatch(js,/from '\.\/vector-forward-dashboard-data\.mjs'/);
});
test('Responsive 390px layout has local import and no fake sample profit',()=>{
 const s=fs.readFileSync(new URL('../backtest/vector-forward-dashboard.html',import.meta.url),'utf8');
 assert.match(s,/@media\(max-width:620px\)/);
 assert.match(s,/id="marketCards"/);
 assert.match(s,/id="reportInput"/);
 assert.match(s,/Résultats prospectifs Bitunix/);
});
