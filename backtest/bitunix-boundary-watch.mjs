/* DEV ONLY — Observe one real Bitunix BTCUSDT 1H candle boundary.
 * Read-only. No credentials, orders, synthetic OHLC or changes to public main.
 * GitHub Actions runs this before the next top-of-hour and captures actual
 * WS messages + direct REST snapshot 100s after the boundary.
 */
const H=3_600_000;
const report={source:'official Bitunix public Futures feed',symbol:'BTCUSDT',interval:'1h',
  channel:'market_kline_60min',startedUtc:new Date().toISOString(),
  safeguards:'read-only; no synthetic candles'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const utc=ms=>new Date(ms).toISOString();
let target=(Math.floor(Date.now()/H)+1)*H;
if(target-Date.now()<30_000)target+=H;
report.targetBoundaryUtc=utc(target);
const lead=30_000,follow=105_000;
const maxWait=target-lead-Date.now();
if(maxWait>3_600_000)throw Error('Target beyond 60min safety window');
while(Date.now()<target-lead){await sleep(Math.min(45_000,target-lead-Date.now()));}
report.connectedAtUtc=null;
report.ws={all:0,market:0,frames:[],errors:[],firstMarketAfterBoundaryMs:null,
  firstNewBucketAfterBoundaryMs:null,lastPreviousBucketAfterBoundaryMs:null};
const ws=new WebSocket('wss://fapi.bitunix.com/public/');
const ms=t=>t>1e12?t:t>1e9?t*1000:null;
let lastPayloadAt=0;
let gotClose=false;
ws.addEventListener('open',()=>{
 report.connectedAtUtc=utc(Date.now());
 ws.send(JSON.stringify({op:'subscribe',args:[{symbol:'BTCUSDT',ch:'market_kline_60min'}]}));
});
ws.addEventListener('error',()=>report.ws.errors.push({at:utc(Date.now()),error:'WebSocket error'}));
ws.addEventListener('close',e=>{gotClose=true;report.ws.closeCode=e.code});
ws.addEventListener('message',ev=>{
 report.ws.all++;
 const arrival=Date.now();
 let m;try{m=JSON.parse(String(ev.data))}catch{return}
 if(m.ch!=='market_kline_60min'||m.symbol!=='BTCUSDT')return;
 const items=Array.isArray(m.data)?m.data:[m.data];
 for(const k of items){
  if(!k||k.c===undefined&&k.close===undefined)continue;
  report.ws.market++;lastPayloadAt=arrival;
  const raw=Number(k.time??k.ts??k.t??m.ts);
  const timestamp=ms(raw),bucket=timestamp===null?null:Math.floor(timestamp/H)*H;
  if(arrival>=target&&report.ws.firstMarketAfterBoundaryMs===null)
   report.ws.firstMarketAfterBoundaryMs=arrival-target;
  if(arrival>=target&&bucket>=target&&report.ws.firstNewBucketAfterBoundaryMs===null)
   report.ws.firstNewBucketAfterBoundaryMs=arrival-target;
  if(arrival>=target&&bucket<target&&report.ws.lastPreviousBucketAfterBoundaryMs===null)
   report.ws.lastPreviousBucketAfterBoundaryMs=arrival-target;
  if(report.ws.frames.length<150)report.ws.frames.push({arrivalUtc:utc(arrival),deltaMs:arrival-target,
    bucketUtc:bucket===null?null:utc(bucket),timestampMs:timestamp,
    open:k.o??k.open,high:k.h??k.high,low:k.l??k.low,close:k.c??k.close});
 }
});
while(Date.now()<target+follow){await sleep(Math.min(2000,target+follow-Date.now()));}
try{ws.close()}catch{}
report.ws.totalMarket=report.ws.market;
report.ws.lastPayloadUtc=lastPayloadAt?utc(lastPayloadAt):null;
report.ws.closed=gotClose;
const params=new URLSearchParams({symbol:'BTCUSDT',interval:'1h',
 endTime:String(target+H),limit:'6',type:'LAST_PRICE'});
try{
 const response=await fetch('https://fapi.bitunix.com/api/v1/futures/market/kline?'+params,
  {signal:AbortSignal.timeout(12000)});
 const j=await response.json(),rows=j?.data?.list??j?.data??[];
 report.rest={http:response.status,code:j?.code,
  candles:Array.isArray(rows)?rows.map(k=>({timeUtc:utc(Number(k.time??k.ts)),open:k.open,high:k.high,low:k.low,close:k.close})).slice(0,6):[]};
}catch(e){report.rest={error:String(e?.message??e)}}
report.conclusion=report.ws.firstNewBucketAfterBoundaryMs===null?'NO_WS_NEW_BAR_OBSERVED':
 report.ws.firstNewBucketAfterBoundaryMs>10_000?'DELAYED_OVER_10_SECONDS':'NEW_BAR_WITHIN_10_SECONDS';
report.finishedUtc=utc(Date.now());
console.log(JSON.stringify(report,null,2));
if(report.ws.firstNewBucketAfterBoundaryMs===null||report.ws.firstNewBucketAfterBoundaryMs>10000)process.exitCode=1;
