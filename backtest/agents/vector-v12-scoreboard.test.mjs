import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeVectorV12Comparison,renderVectorV12ScoreboardMarkdown}
 from './vector-v12-scoreboard.mjs';
const ids=['baseline_v11','follow_close_1','break_extreme_2'];
const row=(count,ret,draw)=>({signalCount:count+1,tradeCount:count,
 returnPct:ret,maxDrawdownPct:draw});
const report={
 protocol:'CJ_VECTOR_V12_BITUNIX_ISOLATED_COMPARISON_V1',
 status:'CANDIDATES_EVALUATED_RESEARCH_ONLY',
 market:{symbol:'BTCUSDT',timeframe:'15m'},
 baselineReproduced:true,promotedVariant:null,sourceRawSha256:'sha',closedBars:480,
 checks:{noAutomaticSelection:true,noRealTrades:true,independentTradingViewParity:false},
 modes:ids.map(mode=>({mode})),
 results:{
 training:{baseline_v11:row(20,5,8),follow_close_1:row(11,8,4),break_extreme_2:row(9,-1,3)},
 holdout:{baseline_v11:row(7,-3,12),follow_close_1:row(5,1,6),break_extreme_2:row(1,3,2)}
 }
};
test('compares returns, drawdowns and sample counts without claiming a best version',()=>{
 const result=summarizeVectorV12Comparison(report);
 assert.equal(result.variants.length,3);
 assert.equal(result.promotionAuthorized,false);
 assert.equal(result.independentTradingViewParity,false);
 const follow=result.variants[1];
 assert.equal(follow.holdoutReturnDifferencePp,4);
 assert.equal(follow.holdoutDrawdownDifferencePp,-6);
 assert.equal(follow.sampleStatus,'INSUFFICIENT_HOLDOUT_TRADES');
 assert.equal(follow.promotionAuthorized,false);
});
test('even with adequate trade counts, no automatic promotion is authorized',()=>{
 const sufficient=structuredClone(report);
 for(const id of ids)sufficient.results.holdout[id].tradeCount=25;
 const result=summarizeVectorV12Comparison(sufficient);
 assert.equal(result.variants[1].sampleStatus,'DESCRIPTIVE_ONLY');
 assert.equal(result.variants[1].promotionAuthorized,false);
 assert.equal(result.promotionAuthorized,false);
});
test('refuses blocked/promoted/incompatible experiments',()=>{
 assert.throws(()=>summarizeVectorV12Comparison({...report,status:'BLOCKED'}),/Unverified/);
 assert.throws(()=>summarizeVectorV12Comparison({...report,promotedVariant:'follow_close_1'}),/Unverified/);
 assert.throws(()=>summarizeVectorV12Comparison({...report,modes:[report.modes[0]]}),/Unverified/);
 const invalid=structuredClone(report);
 invalid.results.holdout.baseline_v11.returnPct=NaN;
 assert.throws(()=>summarizeVectorV12Comparison(invalid),/Invalid/);
});
test('a nine-case Markdown artifact explicitly marks insufficient evidence',()=>{
 const one=summarizeVectorV12Comparison(report);
 const all=['BTCUSDT','ETHUSDT','SOLUSDT'].flatMap(symbol=>
  ['15m','1h','4h'].map(timeframe=>({...one,symbol,timeframe})));
 const md=renderVectorV12ScoreboardMarkdown(all);
 assert.match(md,/Bitunix seulement/);
 assert.match(md,/aucun test TradingView/);
 assert.match(md,/INSUFFICIENT_HOLDOUT_TRADES/);
 assert.match(md,/follow_close_1/);
 assert.match(md,/DESCRIPTIVE/);
});
