/* DEV ONLY — readonly exchange probe for BTCUSDT 1h.
   Checks official Bitunix WebSocket cadence and REST completed candles.
   No credentials, no trading, no market orders. */
const symbol='BTCUSDT',ch='market_kline_60min',H=3600000;
const report={generatedAtUtc:new Date().toISOString(),symbol,channel:ch};
try{
 const currentOpen=Math.floor(Date.now()/H)*H;
 const url=new URL('https://fapi.bitunix.com/api/v1/futures/market/kline');
 for(const [k,v] of Object.entries({symbol,interval:'1h',endTime:currentOpen,limit:3,type:'LAST_PRICE'}))url.searchParams.set(k,String(v));
 const r=await fetch(url,{signal:AbortSignal.timeout(8000),cache:'no-store'});
 const j=await r.json();const data=j?.data?.list??j?.data??[];
 report.rest={status:r.status,code:j?.code,count:Array.isArray(data)?data.length:0,
  samples:Array.isArray(data)?data.map(x=>({time:x.time,open:x.open,high:x.high,low:x.low,close:x.close})).slice(0,3):[]};
}catch(e){report.rest={error:String(e?.message||e)};}
report.websocket=await new Promise(resolve=>{
 const stats={messages:0,marketUpdates:0,firstMarketDelayMs:null,lastReceiveGapMs:null,maxReceiveGapMs:0,
  exchangeTimestampLagMs:null,firstReceiveUtc:null,lastReceiveUtc:null,errors:[],samples:[]};
 let ws,last=null,started=Date.now(),settled=false;
 const finish=()=>{
  if(settled)return;settled=true;
  clearTimeout(timeout);
  try{ws?.close()}catch(_){}
  resolve(stats);
 };
 const timeout=setTimeout(finish,13000);
 try{
  ws=new WebSocket('wss://fapi.bitunix.com/public/');
  ws.addEventListener('open',()=>{
   started=Date.now();
   ws.send(JSON.stringify({op:'subscribe',args:[{symbol,ch}]}));
  });
  ws.addEventListener('message',ev=>{
   stats.messages++;
   const received=Date.now();let msg;
   try{msg=JSON.parse(String(ev.data))}catch{return;}
   if(msg.ch!==ch||msg.symbol!==symbol||!msg.data?.c)return;
   stats.marketUpdates++;
   stats.firstMarketDelayMs??=received-started;
   stats.firstReceiveUtc??=new Date(received).toISOString();
   stats.lastReceiveUtc=new Date(received).toISOString();
   if(last!==null){stats.lastReceiveGapMs=received-last;stats.maxReceiveGapMs=Math.max(stats.maxReceiveGapMs,received-last);}
   last=received;
   const exchangeTs=Number(msg.ts);
   if(Number.isFinite(exchangeTs))stats.exchangeTimestampLagMs=received-exchangeTs;
   if(stats.samples.length<3)stats.samples.push({ts:msg.ts,c:msg.data.c,o:msg.data.o,h:msg.data.h,l:msg.data.l});
  });
  ws.addEventListener('error',()=>stats.errors.push('WebSocket error'));
  ws.addEventListener('close',ev=>{stats.closeCode=ev.code;if(!settled)finish()});
 }catch(e){stats.errors.push(String(e?.message||e));finish();}
});
console.log(JSON.stringify(report,null,2));
if(report.rest?.status!==200||report.websocket.marketUpdates===0)process.exitCode=1;
