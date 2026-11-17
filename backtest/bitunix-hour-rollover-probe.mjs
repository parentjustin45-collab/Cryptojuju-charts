/* DEV ONLY: observe a REAL Bitunix BTCUSDT 1h rollover without trading.
 * Records raw candle timestamps, first new candle arrival, REST snapshots,
 * WebSocket disconnects and message gaps. Never synthesizes an OHLC bar.
 */
const H=3_600_000, symbol='BTCUSDT',ch='market_kline_60min';
const start=Date.now(), boundary=Math.ceil((start+1000)/H)*H;
const report={
 mode:'READ_ONLY',symbol,channel:ch,
 startedAtUtc:new Date(start).toISOString(),
 rolloverAtUtc:new Date(boundary).toISOString(),
 secondsUntilRollover:Math.round((boundary-start)/1000),
 websocket:{connects:0,closes:[],errors:[],totalMarketUpdates:0,preBoundaryUpdates:0,postBoundaryUpdates:0,maxMessageGapMs:0,firstNewCandleAtUtc:null,firstNewCandleDelayMs:null,firstNewCandleSource:null,seenBarTimesUtc:[],samples:[]},
 rest:[]
};
if(boundary-start>25*60_000){
 console.log(JSON.stringify({...report,status:'NOT_TESTED',reason:'Next rollover over 25 minutes away'},null,2));
 process.exit(2);
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function restSnapshot(label){
 try{
  const url=new URL('https://fapi.bitunix.com/api/v1/futures/market/kline');
  for(const [k,v] of Object.entries({symbol,interval:'1h',endTime:Date.now(),limit:3,type:'LAST_PRICE'}))url.searchParams.set(k,String(v));
  const response=await fetch(url,{signal:AbortSignal.timeout(10_000),cache:'no-store'});
  const json=await response.json();
  const data=json?.data?.list??json?.data??[];
  report.rest.push({label,checkedAtUtc:new Date().toISOString(),http:response.status,code:json.code,
   bars:Array.isArray(data)?data.map(k=>({time:k.time,open:k.open,high:k.high,low:k.low,close:k.close})).slice(0,3):[]});
 }catch(e){report.rest.push({label,error:String(e?.message??e)});}
}
let ws=null,everOpen=false,lastMarketAt=0,done=false;
const seenTimes=new Set();
function openWs(){
 if(done)return;
 try{
  ws=new WebSocket('wss://fapi.bitunix.com/public/');
  ws.addEventListener('open',()=>{
   everOpen=true;report.websocket.connects++;
   ws.send(JSON.stringify({op:'subscribe',args:[{symbol,ch}]}));
  });
  ws.addEventListener('message',event=>{
   let m;try{m=JSON.parse(String(event.data))}catch{return;}
   if(m.ch!==ch||m.symbol!==symbol)return;
   const receiveAt=Date.now();
   const ks=Array.isArray(m.data)?m.data:[m.data];
   for(const k of ks){
    if(!k||typeof k!=='object'||!(k.c??k.close))continue;
    report.websocket.totalMarketUpdates++;
    if(receiveAt<boundary)report.websocket.preBoundaryUpdates++;
    else report.websocket.postBoundaryUpdates++;
    if(lastMarketAt)report.websocket.maxMessageGapMs=Math.max(report.websocket.maxMessageGapMs,receiveAt-lastMarketAt);
    lastMarketAt=receiveAt;
    let candleTs=Number(k.time??k.ts??k.t);
    let source='candle_open_timestamp';
    if(!Number.isFinite(candleTs)||candleTs<=0){candleTs=Number(m.ts);source='exchange_event_timestamp_fallback';}
    if(Number.isFinite(candleTs)&&candleTs>0){
     if(candleTs<1e11)candleTs*=1000;
     const barOpen=Math.floor(candleTs/H)*H;
     seenTimes.add(new Date(barOpen).toISOString());
     if(receiveAt>=boundary&&barOpen===boundary&&!report.websocket.firstNewCandleAtUtc){
      report.websocket.firstNewCandleAtUtc=new Date(receiveAt).toISOString();
      report.websocket.firstNewCandleDelayMs=receiveAt-boundary;
      report.websocket.firstNewCandleSource=source;
     }
     if(report.websocket.samples.length<10 && (receiveAt>boundary-20_000||report.websocket.samples.length<3)){
      report.websocket.samples.push({receivedUtc:new Date(receiveAt).toISOString(),barOpenUtc:new Date(barOpen).toISOString(),
       candleTimestamp:k.time??k.ts??k.t??null,eventTimestamp:m.ts??null,open:k.o??k.open,close:k.c??k.close});
     }
    }
   }
  });
  ws.addEventListener('error',()=>report.websocket.errors.push({at:new Date().toISOString(),error:'WebSocket event error'}));
  ws.addEventListener('close',e=>{
   report.websocket.closes.push({at:new Date().toISOString(),code:e.code});
   if(!done)setTimeout(openWs,1500);
  });
 }catch(e){report.websocket.errors.push({at:new Date().toISOString(),error:String(e?.message??e)});if(!done)setTimeout(openWs,1500);}
}
const ping=setInterval(()=>{try{if(ws?.readyState===1)ws.send(JSON.stringify({op:'ping',ping:Math.floor(Date.now()/1000)}))}catch{}},5000);
openWs();
await sleep(Math.max(0,boundary-Date.now()+12_000));
await restSnapshot('after_plus_12_seconds');
await sleep(Math.max(0,boundary-Date.now()+98_000));
await restSnapshot('after_plus_98_seconds');
done=true;clearInterval(ping);try{ws?.close()}catch{}
report.websocket.seenBarTimesUtc=[...seenTimes].sort();
report.websocket.connectedBeforeRollover=everOpen;
report.websocket.marketGapBeforeRolloverMs=lastMarketAt?boundary-lastMarketAt:null;
report.status=report.websocket.firstNewCandleAtUtc&&report.websocket.firstNewCandleDelayMs<=90_000?'ROLLOVER_OBSERVED':'ROLLOVER_DELAY_OR_INCOMPLETE';
report.warning='This records external Bitunix, not a user's CryptoJuju browser rendering delay; dashboard confirmation remains separate.';
console.log(JSON.stringify(report,null,2));
if(report.status!=='ROLLOVER_OBSERVED')process.exitCode=1;
