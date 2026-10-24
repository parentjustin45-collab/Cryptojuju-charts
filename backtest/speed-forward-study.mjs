/* Event-study of SPEED V3 closed candle colors. No trading or lookahead at signal time. */
import {classifySpeedCandleV3} from './speed-candle-v3.mjs';
const directions={bullHigh:1,bullMid:1,bearHigh:-1,bearMid:-1};
export function studySpeedForwardReturns(candles,{horizons=[3,5,10],warmup=20,minTick=Number.EPSILON}={}){
 if(!Array.isArray(candles)||!Number.isInteger(warmup)||warmup<20||!Array.isArray(horizons)||!horizons.length||horizons.some(n=>!Number.isSafeInteger(n)||n<1))throw Error('Invalid event study settings');
 const classes=classifySpeedCandleV3(candles,{minTick});
 const out={};
 for(const key of Object.keys(directions))out[key]=Object.fromEntries(horizons.map(n=>[n,{events:0,wins:0,losses:0,flat:0,sumSignedPct:0,meanSignedPct:null,winRatePct:null}]));
 for(let i=warmup-1;i<candles.length;i++){
  const key=classes[i].color;
  if(!Object.hasOwn(directions,key))continue;
  const entry=Number(candles[i].close);
  for(const n of horizons){
   if(i+n>=candles.length)continue; // never score across segment boundaries
   const exit=Number(candles[i+n].close);
   const signedPct=(exit/entry-1)*100*directions[key];
   const x=out[key][n];x.events++;x.sumSignedPct+=signedPct;
   if(signedPct>0)x.wins++;else if(signedPct<0)x.losses++;else x.flat++;
  }
 }
 for(const key of Object.keys(out))for(const n of horizons){
  const x=out[key][n];x.meanSignedPct=x.events?x.sumSignedPct/x.events:null;
  x.winRatePct=x.events?100*x.wins/x.events:null;
 }
 return {horizons,byClassification:out,definition:'Signed close-to-close change from closed signal candle to close N candles later; positive means movement in signal direction. No execution simulation, fees, or stop loss. No forward bars across quarantined segments.'};
}
