/* Read-only Bitunix diagnostics: classify rejected candles without hiding gaps. */
import {makeBitunixFetchPage} from './bitunix-adapter.mjs';
const step=900000;
const endTime=Math.floor((Date.now()-step)/step)*step;
const startTime=endTime-48*3600000;
const fetchPage=makeBitunixFetchPage();
try{
 const rows=await fetchPage({symbol:'BTCUSDT',interval:'15m',startTime,endTime,limit:200});
 const reasons={outsideRequestedWindow:0,invalidPriceOrVolume:0,nonFinite:0,misalignedTime:0};
 const samples=[];
 for(const c of rows){
  const t=Number(c.time),o=Number(c.open),h=Number(c.high),l=Number(c.low),cl=Number(c.close),v=Number(c.volume??0);
  const reason=![t,o,h,l,cl,v].every(Number.isFinite)?'nonFinite':t<startTime||t>=endTime?'outsideRequestedWindow':t%step?'misalignedTime':o<=0||l<=0||h<Math.max(o,cl)||l>Math.min(o,cl)||v<0?'invalidPriceOrVolume':null;
  if(reason){reasons[reason]++;if(samples.length<12)samples.push({utc:Number.isFinite(t)?new Date(t).toISOString():String(c.time),reason,open:c.open,high:c.high,low:c.low,close:c.close,volume:c.volume});}
 }
 console.log(JSON.stringify({requested:{startTime,endTime},rows:rows.length,reasons,samples},null,2));
}catch(e){console.error(e.message);process.exitCode=1}
