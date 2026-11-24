/*
 * Render-only read-only specialist processors for SPEED V3 and Momentum Fusion.
 * Operate solely on the same nine double-read, closed Bitunix candle windows
 * as the accepted data agent. Not a profit study, LLM or TradingView parity.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {calculateMomentumFusion} from '../momentum-fusion-v1.mjs';
import {classifySpeedCandleV3} from '../speed-candle-v3.mjs';
import {speedClassificationsToColorEvents} from '../speed-color-scenarios.mjs';
import {FIVE_CASES,isFiveByFive} from './render/five-by-five.mjs';

export const CASES=Object.freeze(['BTCUSDT','ETHUSDT','SOLUSDT']
  .flatMap(symbol=>['15m','1h','4h'].map(timeframe=>({symbol,timeframe}))));
export const VALID_STATUSES=Object.freeze({
  momentum:'MOMENTUM_FUSION_9_DOUBLE_READ_CASES_READY',
  speed:'SPEED_V3_9_DOUBLE_READ_CASES_READY'
});
export function requireVerifiedInput(source,repeat,expected){
  if(!source || source.status!=='DATA_READY_FOR_RESEARCH_ONLY' ||
     !repeat || repeat.status!=='STABLE_TWO_READS' ||
     source.market?.symbol!==expected.symbol ||
     source.market?.timeframe!==expected.timeframe ||
     source.market?.priceType!=='LAST_PRICE'||
     source.market?.exchange!=='Bitunix' ||
     source.provenance?.source!=='Bitunix public Futures REST' ||
     source.provenance?.formingBarExcluded!==true ||
     source.provenance?.priceType!=='LAST_PRICE' ||
     !/^[a-f0-9]{64}$/i.test(source.provenance?.rawSha256??'') ||
     !Array.isArray(source.acceptedCandles) ||
     source.acceptedCandles.length!==480 ||
     repeat.checkedDerived!==480 ||
     repeat.differenceCount!==0 ||
     repeat.market?.symbol!==expected.symbol ||
     repeat.market?.timeframe!==expected.timeframe ||
     repeat.market?.exchange!=='Bitunix' ||
     repeat.firstRawSha256!==source.provenance.rawSha256 ||
     !repeat.overlapRawSha256First ||
     repeat.overlapRawSha256First!==repeat.overlapRawSha256Second ||
     repeat.historyWindow?.startTime!==source.historyWindow?.startTime ||
     repeat.historyWindow?.endTime!==source.historyWindow?.endTime ||
     repeat.historyWindow?.intervalMs!==source.historyWindow?.intervalMs)
     throw Error('BITUNIX_SOURCE_AND_DOUBLE_READ_PROVENANCE_INVALID');
  const {startTime,endTime,intervalMs}=source.historyWindow;
  if(!Number.isSafeInteger(startTime)||!Number.isSafeInteger(endTime)||
     !Number.isSafeInteger(intervalMs)||intervalMs<=0 ||
     endTime-startTime!==480*intervalMs ||
     source.acceptedCandles.some((c,i)=>!Number.isSafeInteger(c.time)||
       c.time!==startTime+i*intervalMs ||
       [c.open,c.high,c.low,c.close,c.volume].some(v=>!Number.isFinite(Number(v))) ||
       Number(c.low)<=0||Number(c.low)>Math.min(Number(c.open),Number(c.close))||
       Number(c.high)<Math.max(Number(c.open),Number(c.close)) ||
       Number(c.volume)<0))
     throw Error('BITUNIX_SOURCE_CONTINUITY_OR_OHLC_INVALID');
  return source.acceptedCandles;
}
function studyMomentum(candles){
  const output=calculateMomentumFusion(candles);
  if(output.length!==480)throw Error('MOMENTUM_PARTIAL_OUTPUT');
  const valid=output.filter(c=>Number.isFinite(c.composite)).length;
  if(valid<300)throw Error('MOMENTUM_INSUFFICIENT_WARMUP');
  const cuts=[240,360,480];
  for(const cut of cuts){
    const shorter=calculateMomentumFusion(candles.slice(0,cut));
    const a=output[cut-1],b=shorter[cut-1];
    if(a.time!==b.time || a.bullSignal!==b.bullSignal ||
       a.bearSignal!==b.bearSignal ||
       JSON.stringify(a.divergences)!==JSON.stringify(b.divergences) ||
       a.composite!==b.composite)
       throw Error('MOMENTUM_POSSIBLE_REPAINT_OR_LOOKAHEAD');
  }
  const divergences={regBull:0,regBear:0,hiddenBull:0,hiddenBear:0};
  for(const x of output){
    for(const d of x.divergences){
      if(!Object.hasOwn(divergences,d.type) ||
        d.confirmationTime!==x.time ||d.confirmationIndex<=d.pivotIndex)
        throw Error('MOMENTUM_NONCAUSAL_DIVERGENCE');
      divergences[d.type]++;
    }
  }
  return {validBars:valid,longSignals:output.filter(x=>x.bullSignal).length,
    shortSignals:output.filter(x=>x.bearSignal).length,divergences,
    sampledPrefixChecks:cuts.length};
}
function studySpeed(candles){
  const output=classifySpeedCandleV3(candles);
  if(output.length!==480)throw Error('SPEED_PARTIAL_OUTPUT');
  const cuts=[240,360,480];
  for(const cut of cuts){
    const shorter=classifySpeedCandleV3(candles.slice(0,cut));
    const a=output[cut-1],b=shorter[cut-1];
    if(a.time!==b.time || a.color!==b.color ||
      a.volumePercent!==b.volumePercent ||
      a.speedPercent!==b.speedPercent)
      throw Error('SPEED_POSSIBLE_REPAINT_OR_LOOKAHEAD');
  }
  const events=speedClassificationsToColorEvents(output.slice(19));
  const colors={green:0,red:0,blue:0,pink:0};
  for(const e of events)colors[e.color]++;
  return {classifiedBars:output.length,signals:events.length,
    colors,sampledPrefixChecks:cuts.length,
    caveat:'Descriptive color counts only, not profitability or prediction.'};
}
export async function researchSpecialist(kind,folder,{read=readFile,writeDetails=null,
  cases=CASES}={}){
  if(!Object.hasOwn(VALID_STATUSES,kind))
    throw Error('Unknown specialist');
  const caseResults=[];
  for(const {symbol,timeframe} of cases){
    const id=symbol+'-'+timeframe;
    try{
      const source=JSON.parse(await read(join(folder,id+'.json'),'utf8'));
      const readback=JSON.parse(await read(join(folder,id+'-repeatability.json'),'utf8'));
      const candles=requireVerifiedInput(source,readback,{symbol,timeframe});
      const evidence=kind==='momentum'?studyMomentum(candles):studySpeed(candles);
      // Retain the *complete* per-closed-bar research outputs so future
      // diagnostics do not need to rerun an old indicator implementation.
      // The source candles are archived separately by the Bitunix agent.
      if(writeDetails){
        const bars=kind==='momentum'
          ?calculateMomentumFusion(candles):classifySpeedCandleV3(candles);
        if(bars.length!==480)throw Error('PARTIAL_PER_BAR_RESEARCH_OUTPUT');
        const details={
          protocol:'CJ_RENDER_'+kind.toUpperCase()+'_CLOSED_BAR_TIMELINE_V1',
          kind,symbol,timeframe,exchange:'Bitunix',priceType:'LAST_PRICE',
          sourceSha256:source.provenance.rawSha256,
          historyWindow:source.historyWindow,bars,
          causalOnly:true,tradingEnabled:false,autoPromotion:false
        };
        await writeDetails(join(folder,kind+'-'+id+'-detail.json'),
          JSON.stringify(details)+'\n');
      }
      caseResults.push({symbol,timeframe,status:'VALIDATED_RESEARCH_ONLY',
        sourceSha256:source.provenance.rawSha256,
        closingEndTime:source.historyWindow.endTime,evidence});
    }catch(error){
      caseResults.push({symbol,timeframe,status:'BLOCKED',code:'SOURCE_OR_RESEARCH_CHECK_FAILED'});
    }
  }
  const passed=caseResults.filter(x=>x.status==='VALIDATED_RESEARCH_ONLY').length;
  const expected=cases.length;
  const status=expected===9?VALID_STATUSES[kind]:
    (kind==='momentum'?'MOMENTUM_FUSION_':'SPEED_V3_')+expected+'_DOUBLE_READ_CASES_READY';
  return {protocol:'CJ_RENDER_'+kind.toUpperCase()+'_VALIDATED_SOURCE_V1',
    kind,status:passed===expected?status:'BLOCKED',passed,blocked:expected-passed,
    expectedCases:expected,cohort:expected===25?'FIVE_BY_FIVE':'LEGACY_3X3',
    cases:caseResults,tradingEnabled:false,autoPromotion:false,
    performanceVerified:false,liveOrders:false,
    caveat:'Local JavaScript port; no TradingView parity or indicator profitability claims.'};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
  const kind=process.argv[2],dir=resolve(process.argv[3]??'');
  const report=await researchSpecialist(kind,dir,{writeDetails:writeFile,
    cases:isFiveByFive()?FIVE_CASES:CASES});
  await writeFile(join(dir,kind+'-render-summary.json'),JSON.stringify(report,null,2)+'\n');
  console.log('CJ_RENDER_'+String(kind).toUpperCase()+' '+JSON.stringify({
    status:report.status,passed:report.passed,blocked:report.blocked}));
  if(report.blocked)process.exitCode=2;
}
