/* CryptoJuju UI adapter for non-tradable Vector WATCH.
 * All indicator logic comes directly from the tested research modules.
 * Do not mutate OHLC, generate chart markers, or send Bitunix orders.
 */
import {applyVectorWatch} from './vector-watch-shadow.mjs';
export const WATCH_UI_LOCK=Object.freeze({
 id:'cj-vector-watch-badge-dev-v1',
 minimumClosedBars:55,
 maxStaleBars:2,
 status:['possible','confirmed_idle','neutral','insufficient','stale'],
 neverAnOrder:true,
 visibleByDefault:false
});
const intervalSeconds=Object.freeze({'1m':60,'5m':300,'15m':900,'30m':1800,'1h':3600,'2h':7200,'4h':14400,'6h':21600,'12h':43200,'1d':86400,'1w':604800});
const fail=(status,label)=>({status,label,confirmedDirection:null,watchDirection:null,ageBars:null,
  sourceTime:null,tradingSignal:false,source:'Vector V1.4 expérimental'});
/* Strict contiguous closed OHLC suffix, same principle as Bitunix audit.
 * A malformed candle breaks history; it is NEVER repaired/interpolated and
 * older candles before it cannot be joined to the newer suffix.
 * This prevents a single malformed OLD candle from killing the whole badge.
 */
function cleanClosed(data,step,nowSeconds){
 if(!Array.isArray(data)||!Number.isFinite(nowSeconds))return [];
 const closed=data.filter(b=>{
  const time=Number(b?.time);
  return Number.isSafeInteger(time)&&time>0&&time+step<=nowSeconds
 }).sort((a,b)=>Number(a.time)-Number(b.time));
 const suffix=[];
 for(let i=closed.length-1;i>=0;i--){
  const b=closed[i],time=Number(b.time),o=Number(b.open),
   h=Number(b.high),l=Number(b.low),c=Number(b.close),v=Number(b.volume);
  const valid=[o,h,l,c,v].every(Number.isFinite)&&
   o>0&&c>0&&l>0&&h>=l&&
   h>=Math.max(o,c)&&l<=Math.min(o,c)&&v>=0;
  if(!valid)break;
  if(suffix.length&&suffix[0].time-time!==step)break;
  suffix.unshift({time,open:o,high:h,low:l,close:c,volume:v});
 }
 return suffix;
}
export function readVectorWatchState(data,timeframe,nowSeconds=Math.floor(Date.now()/1000)){
 const step=intervalSeconds[timeframe];
 if(!step)return fail('insufficient','WATCH · unité de temps non prise en charge');
 const bars=cleanClosed(data,step,nowSeconds);
 if(bars.length<WATCH_UI_LOCK.minimumClosedBars)
  return fail('insufficient','WATCH · historique continu insuffisant');
 const last=bars.at(-1);
 if(nowSeconds-(last.time+step)>step*WATCH_UI_LOCK.maxStaleBars)
  return fail('stale','WATCH · historique non à jour');
 try{
  const research=applyVectorWatch(bars);
  if(!research.unchangedConfirmed)throw Error('V1.4 signal parity failed');
  const dir=research.rows.at(-1).direction;
  const confirmedDirection=dir===1?'LONG':dir===-1?'SHORT':null;
  const active=research.alerts.at(-1);
  if(active?.resolution==='censored_end'&&
     research.rows.length-1-active.index<3&&confirmedDirection){
   const watchDirection=active.side.toUpperCase(),ageBars=research.rows.length-1-active.index;
   return {status:'possible',label:'Retournement possible '+watchDirection+
    ' · '+(ageBars===0?'nouveau':ageBars+' bougie'+(ageBars>1?'s':'')),
    confirmedDirection,watchDirection,ageBars,
    sourceTime:active.time,tradingSignal:false,
    source:'Vector V1.4 expérimental'};
  }
  return {status:dir===0?'neutral':'confirmed_idle',
   label:confirmedDirection?'WATCH · '+confirmedDirection+' maintenu · aucune alerte active':
    'WATCH · tendance non établie',
   confirmedDirection,watchDirection:null,ageBars:null,sourceTime:null,
   tradingSignal:false,source:'Vector V1.4 expérimental'};
 }catch(e){
  return fail('insufficient','WATCH · données ou historique non utilisables');
 }
}
