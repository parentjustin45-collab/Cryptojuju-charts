/*
 * CryptoJuju 5×5 CJ Cipher WaveTrend research on the SAME verified 25
 * closed Bitunix source windows as Vector, Momentum and SPEED.
 * Original 3×960 1H pilot retained unchanged for historical comparisons.
 * Next-open simulations, no live orders or automated tuning.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {FIVE_CASES,FIVE_CRYPTO_SYMBOLS} from './render/five-by-five.mjs';
import {requireVerifiedInput} from './run-render-indicator-pilot.mjs';
import {readBitunixContractPrecision} from './bitunix-contract-precision.mjs';
import {buildCjCipherComparison,CIPHER_COMPARISON_LOCK} from './cj-cipher-comparison.mjs';
import {runFixedHoldout} from './fixed-holdout.mjs';

const friction=Object.freeze({
  base:{initialCapital:1000,allocation:1,feeRate:.0006,slippageRate:.0005},
  stress:{initialCapital:1000,allocation:1,feeRate:.001,slippageRate:.002}
});
export async function researchCipherFiveByFive(dataFolder,outputFolder,{
  read=readFile,write=writeFile,contracts=null
}={}){
  await mkdir(outputFolder,{recursive:true});
  const marketContracts=contracts??(await readBitunixContractPrecision({symbols:FIVE_CRYPTO_SYMBOLS})).contracts;
  const report={
    protocol:'CJ_CIPHER_25_PROVENANCED_BITUNIX_RESEARCH_V1',
    cohort:'FIVE_BY_FIVE',expectedCases:25,source:'Bitunix LAST_PRICE',
    barsPerCase:480,strategies:CIPHER_COMPARISON_LOCK.strategyIds,
    generatedAtUtc:new Date().toISOString(),
    costs:friction,readOnly:true,autoPromotion:false,tradingEnabled:false,
    PineParity:'NOT_VERIFIED',historicalIndependentHoldout:false,cases:[]
  };
  for(const {symbol,timeframe} of FIVE_CASES){
    const label=symbol+'-'+timeframe;
    try{
      const source=JSON.parse(await read(join(dataFolder,label+'.json'),'utf8'));
      const readback=JSON.parse(await read(join(dataFolder,label+'-repeatability.json'),'utf8'));
      const bars=requireVerifiedInput(source,readback,{symbol,timeframe});
      const contract=marketContracts.find(x=>x.symbol===symbol&&
        x.source==='BITUNIX_PUBLIC_TRADING_PAIRS'&&
        x.stepStatus==='RESEARCH_PRICE_PRECISION_NOT_TV_MINTICK'&&
        Number.isInteger(x.quotePrecision)&&x.priceStep===10**(-x.quotePrecision));
      if(!contract)throw Error('VERIFIED_BITUNIX_CONTRACT_PRECISION_MISSING');
      const comparison=buildCjCipherComparison(bars,{priceStep:contract.priceStep});
      const splitAt=source.historyWindow.startTime+
        Math.floor(bars.length*.7)*source.historyWindow.intervalMs;
      const portfolios={};
      for(const [scenario,costs] of Object.entries(friction)){
        portfolios[scenario]=runFixedHoldout({
          market:source.market,historyWindow:source.historyWindow,
          candles:bars,holdoutStartTime:splitAt,costs,
          experiments:CIPHER_COMPARISON_LOCK.strategyIds.map(id=>({
            id,signalTimeConvention:'confirmation-bar-open',
            indicatorParity:'UNVERIFIED',signals:comparison.signals[id]
          }))
        });
      }
      const detail={protocol:report.protocol,symbol,timeframe,
        sourceRawSha256:source.provenance.rawSha256,
        sourceDerivedSha256:source.provenance.derivedSha256,
        window:source.historyWindow,readbackStatus:readback.status,
        confirmedBars:bars.length,priceStep:contract.priceStep,
        comparison,portfolios,autoPromotion:false,tradingEnabled:false};
      await write(join(outputFolder,label+'-cipher-mtf-detail.json'),
        JSON.stringify(detail)+'\n');
      report.cases.push({symbol,timeframe,status:'VALIDATED_RESEARCH_ONLY',
        bars:bars.length,sourceSha256:source.provenance.rawSha256,
        counts:comparison.signalCounts,splitAt,
        portfolioSummary:Object.fromEntries(Object.entries(portfolios).map(([k,v])=>
          [k,Object.fromEntries(CIPHER_COMPARISON_LOCK.strategyIds.map(id=>
            [id,{trainingTrades:v.training[id]?.tradeCount,
              holdoutTrades:v.holdout[id]?.tradeCount,
              holdoutReturnPct:v.holdout[id]?.returnPct,
              holdoutDrawdownPct:v.holdout[id]?.maxDrawdownPct}]))]))});
    }catch(err){
      report.cases.push({symbol,timeframe,status:'BLOCKED',
        reason:String(err?.message??err).slice(0,200)});
    }
  }
  report.validated=report.cases.filter(c=>c.status==='VALIDATED_RESEARCH_ONLY').length;
  report.blocked=25-report.validated;
  report.status=report.blocked===0?'CIPHER_25_MARKETS_MTF_PILOT_COMPLETE':
    'BLOCKED_OR_PARTIAL_CIPHER_25';
  await write(join(outputFolder,'cj-cipher-pilot-summary.json'),JSON.stringify(report,null,2)+'\n');
  await write(join(outputFolder,'cj-cipher-pilot-summary.md'),
    '# CryptoJuju — Cipher 5 × 5\n\nSource Bitunix fermée et double lecture. 480 chandelles par configuration.\n\n'+
    '| Marché | UT | Statut | Cipher longs | Cipher shorts |\n|---|---|---|---:|---:|\n'+
    report.cases.map(x=>'| '+x.symbol+' | '+x.timeframe+' | '+x.status+' | '+(x.counts?.cipherLong??'—')+' | '+(x.counts?.cipherShort??'—')+' |').join('\n')+
    '\n\nPortfolios fictifs de recherche seulement; aucune validation TradingView, aucun trading réel.\n');
  return report;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
  if(!process.argv[2]||!process.argv[3])throw Error('Specify data and archive output folders');
  const r=await researchCipherFiveByFive(resolve(process.argv[2]),resolve(process.argv[3]));
  console.log('CJ_CIPHER_FIVE_BY_FIVE '+JSON.stringify({
    status:r.status,passed:r.validated,blocked:r.blocked,cohort:r.cohort}));
  if(r.blocked)process.exitCode=2;
}
