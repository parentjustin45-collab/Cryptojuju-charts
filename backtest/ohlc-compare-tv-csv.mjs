/* Optional TradingView export comparison for CryptoJuju OHLC parity.
 * Does NOT scrape TradingView or pretend to know the CSV's exchange.
 * Verify BTCUSDT / BITUNIX Futures / matching timeframe in TradingView UI
 * before exporting. Time must include a timezone (or Unix epoch).
 */
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {STEP_MS,normalizeCandles,compareCandleSets} from './ohlc-parity-core.mjs';
function parseCSV(input){
 if(typeof input!=='string'||input.length>20_000_000)throw Error('CSV too large or invalid');
 const rows=[],current=[];let part='',quoted=false;
 for(let i=0;i<input.length;i++){
  const c=input[i];
  if(quoted){
   if(c==='"'&&input[i+1]==='"'){part+='"';i++}
   else if(c==='"')quoted=false;
   else part+=c;
  }else if(c==='"'&&part==='')quoted=true;
  else if(c===','){current.push(part);part=''}
  else if(c==='\n'||c==='\r'){
   if(c==='\r'&&input[i+1]==='\n')i++;
   current.push(part);part='';
   if(current.some(x=>x.trim()))rows.push([...current]);
   current.length=0;
  }else part+=c;
 }
 if(quoted)throw Error('Unclosed CSV field');
 current.push(part);if(current.some(x=>x.trim()))rows.push([...current]);
 if(rows.length<2)throw Error('CSV needs headers and data');
 const header=rows.shift().map((v,i)=>(i===0?v.replace(/^\uFEFF/,''):v).trim().toLowerCase());
 const unique=new Set(header);if(unique.size!==header.length)throw Error('Duplicate header names');
 for(const row of rows)if(row.length!==header.length)throw Error('Ragged CSV row');
 return {header,rows};
}
function timestamp(value){
 const s=String(value).trim();
 if(/^\d{10}$/.test(s))return Number(s)*1000;
 if(/^\d{13}$/.test(s))return Number(s);
 if(!/^\d{4}-\d\d-\d\d[T ]\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:?\d\d)$/.test(s))
  throw Error('TradingView timestamp requires UTC/offset or Unix epoch: '+s);
 const n=Date.parse(s.replace(' ','T'));
 if(!Number.isSafeInteger(n))throw Error('Invalid timestamp '+s);
 return n;
}
function parseTradingView(text){
 const {header,rows}=parseCSV(text),indexes={};
 for(const h of ['time','open','high','low','close']){
  const i=header.indexOf(h);
  if(i<0)throw Error('Missing TradingView column: '+h);
  indexes[h]=i;
 }
 return rows.map(row=>{
  const x={time:timestamp(row[indexes.time])};
  for(const h of ['open','high','low','close']){
   if(row[indexes[h]].trim()===''||!Number.isFinite(Number(row[indexes[h]])))
    throw Error('Missing/invalid TradingView '+h);
   x[h]=Number(row[indexes[h]]);
  }
  x.volume=0;
  return x;
 });
}
export function compareTVExport({tvCSV,parityCSV,tf='15m',minimumOverlap=12}={}){
 if(!STEP_MS[tf])throw Error('Unsupported timeframe');
 if(!Number.isSafeInteger(minimumOverlap)||minimumOverlap<1)throw Error('Invalid minimum overlap');
 const tv=parseTradingView(tvCSV);
 const {header,rows}=parseCSV(parityCSV);
 const get=h=>{const i=header.indexOf(h.toLowerCase());if(i<0)throw Error('Reference CSV missing '+h);return i};
 const iTf=get('interval'),iTime=get('epochMs');
 const priceFields=['rightOpen','rightHigh','rightLow','rightClose'].map(get);
 const ref=rows.filter(r=>r[iTf]===tf).map(row=>({
  time:timestamp(row[iTime]),
  open:Number(row[priceFields[0]]),high:Number(row[priceFields[1]]),
  low:Number(row[priceFields[2]]),close:Number(row[priceFields[3]]),volume:0
 }));
 if(!ref.length)throw Error('Reference does not contain timeframe '+tf);
 ref.sort((a,b)=>a.time-b.time);
 const step=STEP_MS[tf];
 const window={startTime:ref[0].time,endTime:ref.at(-1).time+step,intervalMs:step,
  expected:ref.length};
 if(window.expected>150||window.expected<minimumOverlap)
  throw Error('Insufficient reference candles');
 const a=normalizeCandles(tv,window,'tradingview_csv');
 const b=normalizeCandles(ref,window,'bitunix_direct_reference');
 const res=compareCandleSets(a,b,window);
 const overlapping=[...a.bars.keys()].filter(t=>b.bars.has(t));
 return {symbol:'BTCUSDT',tf,sourceAssurance:'CSV exchange and market TYPE not independently verified',
  referenceWindow:{startUTC:new Date(window.startTime).toISOString(),
   endExclusiveUTC:new Date(window.endTime).toISOString(),expected:window.expected},
  overlapping:overlapping.length,minimumOverlap,
  status:overlapping.length<minimumOverlap?'INSUFFICIENT_OVERLAP':res.status,
  comparator:res,referenceQuality:b.quality,tradingViewQuality:a.quality,
  warning:'Export from BITUNIX BTCUSDT LINEAR FUTURES, same TF; CSV does not certify its own exchange'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const args=process.argv.slice(2);
 const get=flag=>{const i=args.indexOf(flag);return i<0?null:args[i+1]};
 const csv=get('--csv'),reference=get('--reference'),tf=get('--tf')||'15m';
 if(!csv||!reference)throw Error('Usage: node backtest/ohlc-compare-tv-csv.mjs --csv export.csv --reference cj-ohlc-parity-BTCUSDT.csv --tf 15m');
 const out=compareTVExport({tvCSV:await readFile(csv,'utf8'),parityCSV:await readFile(reference,'utf8'),tf});
 console.log(JSON.stringify(out,null,2));
 if(out.status!=='MATCH')process.exitCode=1;
}
