/* Browser forward-study refresh policy: validates freshness of raw public
 * Bitunix candles, never repairs missing OHLC, no orders or credentials.
 * Schedule attempts are at most once per 15m while page is VISIBLE.
 */
export const REFRESH_INTERVAL_MS = 15*60*1000;
export const ONE_HOUR_MS = 60*60*1000;
export const MIN_LATEST_CLOSED_BARS=55;
export const SYMBOLS=Object.freeze(['BTCUSDT','ETHUSDT','SOLUSDT']);
export function dueForRefresh({nowMs,lastAttemptMs=0,hidden=false,pending=false}={}){
 if(hidden||pending||!Number.isFinite(nowMs)||nowMs<0)return false;
 if(!Number.isFinite(lastAttemptMs)||lastAttemptMs<=0)return true;
 return nowMs-lastAttemptMs>=REFRESH_INTERVAL_MS;
}
function valid(b){
 if(!b)return false;
 const {time}=b;const o=Number(b.open),h=Number(b.high),l=Number(b.low),
  c=Number(b.close),v=Number(b.volume);
 return Number.isSafeInteger(time)&&time>0&&time%ONE_HOUR_MS===0&&
  [o,h,l,c,v].every(Number.isFinite)&&o>0&&c>0&&l>0&&
  h>=Math.max(o,c)&&l<=Math.min(o,c)&&v>=0;
}
export function createBitunixFreshnessLedger({symbols=SYMBOLS}={}){
 const table=new Map(symbols.map(x=>[x,new Map()]));
 function acceptPage({symbol},bars){
  if(!table.has(symbol)||!Array.isArray(bars))throw Error('Bitunix page invalide');
  const set=table.get(symbol);
  for(const b of bars){
   const time=Number(b?.time);
   if(!Number.isSafeInteger(time)||time<=0||time%ONE_HOUR_MS!==0)continue;
   const found=set.get(time);
   if(found)set.set(time,{valid:false,duplicate:true});
   else set.set(time,{valid:valid(b),duplicate:false});
  }
  return bars;
 }
 function inspect(nowMs){
  if(!Number.isFinite(nowMs)||nowMs<=0)throw Error('Horodatage invalide');
  const lastClosedOpen=Math.floor(nowMs/ONE_HOUR_MS)*ONE_HOUR_MS-ONE_HOUR_MS;
  const outcome=[];
  for(const [symbol,rows] of table){
   let count=0;
   for(let t=lastClosedOpen;count<MIN_LATEST_CLOSED_BARS;t-=ONE_HOUR_MS){
    if(!rows.get(t)?.valid)break;
    count++;
   }
   let latestValid=null;
   for(const [t,r] of rows)if(r.valid&&t<=lastClosedOpen&&
       (latestValid===null||t>latestValid))latestValid=t;
   let state=count>=MIN_LATEST_CLOSED_BARS?'FRESH_CLOSED_55':'STALE_GAP_OR_INSUFFICIENT';
   outcome.push({symbol,state,lastClosedOpen,latestValidOpen:latestValid,
    lastClosedContinuousBars:count,
    lagHours:latestValid===null?null:(lastClosedOpen-latestValid)/ONE_HOUR_MS});
  }
  return {ok:outcome.every(x=>x.state==='FRESH_CLOSED_55'),
    observedAt:nowMs,expectedLastClosedOpen:lastClosedOpen,markets:outcome};
 }
 return {acceptPage,inspect};
}
