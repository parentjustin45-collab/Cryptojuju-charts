/* Read-only endpoint probe: diagnose deployed CryptoJuju API routes. */
const base='https://cryptojuju-api.onrender.com';
const paths=['/','/candles?symbol=BTCUSDT&interval=15m&limit=5','/api/bitunix/proxy?url='+encodeURIComponent('https://fapi.bitunix.com/api/v1/futures/market/kline?symbol=BTCUSDT&interval=15m&limit=5&type=LAST_PRICE')];
for(const path of paths){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetch(base+path,{signal:controller.signal,headers:{accept:'application/json'},redirect:'follow'});
  const body=(await response.text()).slice(0,350);
  console.log(JSON.stringify({path:path.split('?')[0],http:response.status,contentType:response.headers.get('content-type'),bodySample:body}));
 }catch(e){console.log(JSON.stringify({path:path.split('?')[0],error:String(e.message??e)}));}
 finally{clearTimeout(timer)}
}
