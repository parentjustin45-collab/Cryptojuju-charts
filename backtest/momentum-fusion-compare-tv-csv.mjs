/**
 * Compare the exact TradingView PARITY PROBE CSV to the JS Momentum Fusion
 * original formula on the SAME EXPORTED OHLC and timestamps.
 * No orders, strategy optimisation, network, guessed market-data source,
 * implicit timezone, or backdated divergences.
 */
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {calculateMomentumFusion} from './momentum-fusion-v1.mjs';

export const TV_PARITY_PROTOCOL=Object.freeze({
 id:'momentum-fusion-tv-parity-export-v1',
 reference:'backtest/momentum-fusion-tv-parity-probe.pine',
 minCsvBars:200,
 warmupBars:150,
 minNumericChecks:100,
 absoluteTolerance:0.0002,
 relativeTolerance:0.000001,
 missingColumnPolicy:'BLOCK_ALL_PARITY_CLAIMS',
 timezonePolicy:'REQUIRE_OFFSET_OR_UNIX_EPOCH'
});
function parseCSV(input){
 if(typeof input!=='string'||input.length>10_000_000)
  throw Error('Expected a TradingView CSV text under 10MB');
 const records=[],line=[];let field='',quoted=false;
 for(let i=0;i<input.length;i++){
  const c=input[i];
  if(quoted){
   if(c==='"'&&input[i+1]==='"'){field+='"';i++;}
   else if(c==='"')quoted=false;
   else field+=c;
  }else if(c==='"'&&field==='')quoted=true;
  else if(c===','){line.push(field);field='';}
  else if(c==='\n'||c==='\r'){
   if(c==='\r'&&input[i+1]==='\n')i++;
   line.push(field);field='';
   if(line.some(x=>x.trim()))records.push([...line]);
   line.length=0;
  }else field+=c;
 }
 if(quoted)throw Error('Unterminated quoted CSV field');
 line.push(field);
 if(line.some(x=>x.trim()))records.push([...line]);
 if(records.length<2)throw Error('CSV missing header or OHLC rows');
 const headers=records.shift().map((x,i)=>i===0?x.replace(/^\uFEFF/,'').trim():x.trim());
 if(headers.length<5)throw Error('CSV missing OHLC headers');
 for(const row of records)if(row.length!==headers.length)
  throw Error('CSV row has different column count (truncated or malformed)');
 return {headers,records};
}
function indexFor(headers,label,exact=false){
 const names=headers.map(h=>h.trim().toLowerCase());
 const needle=label.toLowerCase();
 if(exact){
  const hits=names.flatMap((x,i)=>x===needle?[i]:[]);
  if(hits.length!==1)throw Error('CSV requires exactly one "'+label+'" column');
  return hits[0];
 }
 const hits=names.flatMap((x,i)=>
  (x===needle||x.endsWith(':'+needle)||x.endsWith('.'+needle)||
   x.endsWith(' - '+needle)||x.endsWith(' '+needle))?[i]:[]);
 if(hits.length!==1)throw Error('Missing/ambiguous TradingView probe column "'+label+'"');
 return hits[0];
}
function epochMs(value){
 const s=String(value).trim();
 if(/^\d{10}$/.test(s))return Number(s)*1000;
 if(/^\d{13}$/.test(s))return Number(s);
 // Explicit offset or UTC indicator prevents device-local time ambiguity.
 if(!/^\d{4}-\d\d-\d\d[T ]\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:?\d\d)$/.test(s))
  throw Error('Timestamp without explicit timezone or Unix epoch: '+s.slice(0,38));
 const n=Date.parse(s.replace(' ','T'));
 if(!Number.isFinite(n))throw Error('Invalid UTC timestamp '+s);
 return n;
}
const float=(v,label)=>{
 if(v===undefined)throw Error('Missing '+label);
 if(v.trim()===''||v.trim().toLowerCase()==='na')return null;
 const x=Number(v);
 if(!Number.isFinite(x))throw Error('Non numeric TradingView '+label+': '+v);
 return x;
};
const NUMERIC=[
 ['composite','Composite original'],
 ['rsi','CHECK RSI14'],
 ['stochRsi','CHECK StochRSI14 SMA3'],
 ['momRaw','CHECK Momentum10'],
 ['momentumRank','CHECK PercentRank100'],
 ['emaFast','CHECK EMA21'],
 ['emaSlow','CHECK EMA55']
];
const FLAGS=[
 ['bullSignal','CHECK BullSignal 1/0'],
 ['bearSignal','CHECK BearSignal 1/0'],
 ['pivotLowConfirmed','CHECK PivotLow confirmed NOW'],
 ['pivotHighConfirmed','CHECK PivotHigh confirmed NOW']
];
export function compareTradingViewCsv(csv,{minBars=TV_PARITY_PROTOCOL.minCsvBars,
 warmupBars=TV_PARITY_PROTOCOL.warmupBars}={}){
 const {headers,records}=parseCSV(csv);
 if(!Number.isSafeInteger(minBars)||!Number.isSafeInteger(warmupBars)||
    minBars<1||warmupBars<0)throw Error('Invalid parity thresholds');
 const fields=Object.fromEntries(['time','open','high','low','close'].map(k=>
  [k,indexFor(headers,k,true)]));
 const indexes={};
 for(const [k,label] of [...NUMERIC,...FLAGS])indexes[k]=indexFor(headers,label);
 if(records.length<minBars)
  throw Error('Insufficient same-source chart history ('+records.length+
   ' bars; need '+minBars+' or more). Scroll TradingView left and export again.');
 const times=[],candles=[],tv=[];
 for(const row of records){
  const time=epochMs(row[fields.time]);
  if(times.length&&time<=times.at(-1))
   throw Error('Timestamps must be strictly increasing and unique');
  times.push(time);
  const bar={time};
  for(const k of ['open','high','low','close']){
   const v=float(row[fields[k]],k);
   if(v===null)throw Error('Missing OHLC price: '+k+' at '+time);
   bar[k]=v;
  }
  bar.volume=0;
  if(bar.open<=0||bar.close<=0||bar.low<=0||
   bar.high<Math.max(bar.open,bar.close)||bar.low>Math.min(bar.open,bar.close))
   throw Error('TradingView OHLC incoherent at '+new Date(time).toISOString());
  candles.push(bar);
  tv.push(Object.fromEntries([...NUMERIC,...FLAGS].map(([k])=>
   [k,float(row[indexes[k]],k)])));
 }
 const js=calculateMomentumFusion(candles);
 const tally=Object.fromEntries([...NUMERIC,...FLAGS].map(([k])=>
  [k,{compared:0,match:0,mismatch:0,missingReference:0,missingJs:0,
   largestAbsDeviation:0,examples:[]}]));
 let compared=0,issues=0;
 const asFloat=(result,i,key)=>{
  if(key==='momRaw')return i>=10?candles[i].close-candles[i-10].close:null;
  return result[i][key];
 };
 const tolerance=(a,b)=>TV_PARITY_PROTOCOL.absoluteTolerance+
  TV_PARITY_PROTOCOL.relativeTolerance*Math.max(Math.abs(a),Math.abs(b));
 for(let i=warmupBars;i<js.length;i++){
  for(const [key] of [...NUMERIC,...FLAGS]){
   const ref=tv[i][key],computed=asFloat(js,i,key),stats=tally[key];
   const real=typeof computed==='boolean'?Number(computed):computed;
   // Reference may leave early NA; do not score missing as a "match".
   if(ref===null&&real===null){stats.missingReference++;stats.missingJs++;continue;}
   if(ref===null){stats.missingReference++;stats.mismatch++;issues++;continue;}
   if(real===null||!Number.isFinite(real)){stats.missingJs++;issues++;stats.mismatch++;continue;}
   const deviation=Math.abs(real-ref);
   const match=FLAGS.some(x=>x[0]===key)?deviation===0:
    deviation<=tolerance(real,ref);
   stats.compared++;compared++;stats.largestAbsDeviation=Math.max(stats.largestAbsDeviation,deviation);
   if(match)stats.match++;
   else{
    issues++;stats.mismatch++;
    if(stats.examples.length<5)stats.examples.push({
     utc:new Date(times[i]).toISOString(),reference:ref,cryptojuju:real,
     absoluteError:deviation
    });
   }
  }
 }
 const noNumeric=NUMERIC.some(([k])=>tally[k].compared===0);
 const insufficient=compared<TV_PARITY_PROTOCOL.minNumericChecks;
 const success=!issues&&!noNumeric&&!insufficient;
 return {
  protocol:TV_PARITY_PROTOCOL.id,
  verdict:success?'MATCHED_CSV_WITHIN_TOLERANCE':
   noNumeric||insufficient?'INCONCLUSIVE_INCOMPLETE_REFERENCE':'MISMATCH',
  bars:records.length,warmupBars,
  eligibleBars:Math.max(0,records.length-warmupBars),
  utcFirst:new Date(times[0]).toISOString(),
  utcLast:new Date(times.at(-1)).toISOString(),
  comparedValues:compared,mismatchedValues:issues,byField:tally,
  nonVerified:['Same OHLC were extracted from this TradingView CSV; this does NOT verify Bitunix exchange data parity.',
   'Timeframe and TradingView symbol are NOT supplied in the CSV; independently record exact symbol/exchange/timeframe.',
   'Original divergence conditions must still be verified on same source if pivot tie behavior is disputed.',
   'Historical warmup may differ if TradingView initially loaded more bars before exported first candle.',
   'No future trading performance, no orders, no production deployment.']
 };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const filepath=process.argv[2];
 if(!filepath)throw Error('Usage: node backtest/momentum-fusion-compare-tv-csv.mjs TradingView_chart.csv');
 const data=compareTradingViewCsv(fs.readFileSync(filepath,'utf8'));
 console.log(JSON.stringify(data,null,2));
 if(data.verdict!=='MATCHED_CSV_WITHIN_TOLERANCE')process.exitCode=1;
}
