import test from 'node:test';
import assert from 'node:assert/strict';
import {renderBitunixDataCenterHtml} from './bitunix-data-center-view.mjs';

const rows=['BTCUSDT','ETHUSDT','SOLUSDT'].flatMap(symbol=>
 ['15m','1h','4h'].map(timeframe=>({symbol,timeframe,status:'DATA_READY_FOR_RESEARCH_ONLY',
  acceptedBars:480,requestedBars:480,corrections:1})));
const make=(v={})=>({protocol:'CRYPTOJUJU_REAL_BITUNIX_DATA_INGEST_V1',
 status:'PASS_PUBLIC_BITUNIX_DATA_WINDOWS',passed:9,
 finishedAtUtc:'2026-11-19T14:00:00Z',checks:rows,...v});
test('real data report displays only verified Bitunix REST snapshot scope',()=>{
 const html=renderBitunixDataCenterHtml(make());
 assert.match(html,/Bitunix · Centre de données/);
 assert.match(html,/4 320/);
 assert.match(html,/9 \/ 9/);
 assert.match(html,/Aucune comparaison indépendante exhaustive/);
 assert.match(html,/pas un flux en continu/);
 assert.match(html,/NON VALIDÉS/);
});
test('blocked windows remain visibly blocked',()=>{
 const checks=rows.map(x=>({...x}));
 checks[1]={...checks[1],status:'BLOCKED',acceptedBars:0,corrections:0};
 const html=renderBitunixDataCenterHtml(make({status:'BLOCKED_OR_PARTIAL',passed:8,checks}));
 assert.match(html,/BLOQUÉ/);
 assert.match(html,/8 \/ 9/);
});
test('unverified source and scripts are rejected or escaped',()=>{
 assert.throws(()=>renderBitunixDataCenterHtml(make({status:'PROFIT_GUARANTEED'})),/Unknown/);
 assert.throws(()=>renderBitunixDataCenterHtml(make({checks:rows.slice(1)})),/Unknown/);
 const html=renderBitunixDataCenterHtml(make({finishedAtUtc:'<script>alert(1)</script>'}));
 assert.doesNotMatch(html,/<script>/);
 assert.match(html,/&lt;script&gt;/);
});
