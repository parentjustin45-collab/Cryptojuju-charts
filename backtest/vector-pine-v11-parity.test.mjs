/* Independent Pine v6 semantics translation for the EXACT supplied V1.1 source.
   This verifies numerical/signal parity under known syminfo.mintick and confirmed bars.
   It does not execute a TradingView Pine runtime or guarantee broker-feed parity.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {vectorAIT} from './vector-ait-v1.mjs';

const original=readFileSync(new URL('./references/CJ_Vector_AIT_V1_1_original.pine',import.meta.url),'utf8');
const required=[
 '//@version=6','indicator("CryptoJuju Vector Always In Trade V1.1"',
 'math.max(high - low, syminfo.mintick)','ta.atr(atrLength)',
 'ta.sma(safeVolume, volumeLength)','ta.sma(volumeSpread, spreadLength)',
 'minimumConfirmations = input.int(4','confirmAtClose = input.bool(true',
 'bool candleConfirmed = not confirmAtClose or barstate.isconfirmed',
 'tradeDirection == 0','tradeDirection == -1 and bullishVector',
 'tradeDirection == 1 and bearishVector',
 '((entryPrice - close) / entryPrice) * 100.0',
 '((close - entryPrice) / entryPrice) * 100.0',
 'alertcondition(longSignal','alertcondition(shortSignal'
];
const avg=(arr,n)=>arr.length<n?null:arr.slice(-n).reduce((sum,x)=>sum+x,0)/n;
function independentPineTranslation(candles,{mintick,
 volumeLength=20,spreadLength=20,atrLength=14,volumeMultiplier=1.5,
 spreadMultiplier=1.5,atrMultiplier=.8,minimumBodyRatio=.6,
 minimumCloseStrength=.7,minimumConfirmations=4}={}){
 if(!Number.isFinite(mintick)||mintick<=0)throw Error('Known Pine mintick required');
 const trs=[],volumes=[],volSpreads=[],observations=[];
 let pineATR=null,tradeDirection=0,entryPrice=null;
 for(let i=0;i<candles.length;i++){
  const bar=candles[i],range=Math.max(bar.high-bar.low,mintick);
  const previous=i?candles[i-1].close:null;
  const tr=previous===null?bar.high-bar.low:
   Math.max(bar.high-bar.low,Math.abs(bar.high-previous),Math.abs(bar.low-previous));
  trs.push(tr);
  if(i===atrLength-1)pineATR=avg(trs,atrLength);
  if(i>=atrLength)pineATR=(pineATR*(atrLength-1)+tr)/atrLength;
  const v=bar.volume??0;
  volumes.push(v);volSpreads.push(v*range);
  const avgV=avg(volumes,volumeLength),avgS=avg(volSpreads,spreadLength);
  const relV=avgV!==null&&avgV>0?v/avgV:0;
  const relS=avgS!==null&&avgS>0?v*range/avgS:0;
  const common=[
   relV>=volumeMultiplier,relS>=spreadMultiplier,
   Math.abs(bar.close-bar.open)/range>=minimumBodyRatio,
   pineATR!==null&&range>=pineATR*atrMultiplier
  ].reduce((count,x)=>count+Number(x),0);
  // Pine's default confirmAtClose=true: all inputs here are completed OHLC.
  const bull=bar.close>bar.open&&common+
   Number((bar.close-bar.low)/range>=minimumCloseStrength)>=minimumConfirmations;
  const bear=bar.close<bar.open&&common+
   Number((bar.high-bar.close)/range>=minimumCloseStrength)>=minimumConfirmations;
  let signal=null,exit=null,closedTradeReturnPct=null;
  if(tradeDirection===0){
   if(bull){tradeDirection=1;entryPrice=bar.close;signal='long';}
   else if(bear){tradeDirection=-1;entryPrice=bar.close;signal='short';}
  }else if(tradeDirection===-1&&bull){
   if(entryPrice!==null&&entryPrice>0)closedTradeReturnPct=
    (entryPrice-bar.close)/entryPrice*100;
   signal='long';exit='short';tradeDirection=1;entryPrice=bar.close;
  }else if(tradeDirection===1&&bear){
   if(entryPrice!==null&&entryPrice>0)closedTradeReturnPct=
    (bar.close-entryPrice)/entryPrice*100;
   signal='short';exit='long';tradeDirection=-1;entryPrice=bar.close;
  }
  observations.push({time:bar.time,bullishVector:bull,bearishVector:bear,
   signal,exit,direction:tradeDirection,closedTradeReturnPct});
 }
 return observations;
}
function pseudoBars(seed=2026,n=650,scale=100){
 let x=seed>>>0,price=scale;
 const next=()=>((x=(Math.imul(x,1664525)+1013904223)>>>0)/4294967296);
 return Array.from({length:n},(_,i)=>{
  const open=price;
  const close=Math.max(scale*.15,open+(next()-.5)*scale*.025);
  const high=Math.max(open,close)+next()*scale*.009;
  const low=Math.max(scale*.02,Math.min(open,close)-next()*scale*.009);
  const volume=i%27===0?25000:70+next()*150;
  price=close;
  return {time:Date.UTC(2025,0,1)+i*3600000,open,high,low,close,volume};
 });
}
function compareFields(actual,expected){
 assert.equal(actual.length,expected.length);
 for(let i=0;i<actual.length;i++){
  const a=actual[i],b=expected[i];
  for(const key of ['time','bullishVector','bearishVector','signal','exit','direction'])
   assert.equal(a[key],b[key],key+' at bar '+i);
  if(b.closedTradeReturnPct===null)assert.equal(a.closedTradeReturnPct,null);
  else assert.ok(Math.abs(a.closedTradeReturnPct-b.closedTradeReturnPct)<1e-10,
   'Pine close-to-close return at bar '+i);
 }
}
test('Provided Pine V1.1 is preserved verbatim and includes its essential formulas and alerts',()=>{
 assert.ok(original.startsWith('//@version=6'));
 for(const clause of required)assert.ok(original.includes(clause),'Reference Pine missing '+clause);
 assert.equal((original.match(/alertcondition\(/g)||[]).length,4);
});
test('Independent Pine translation agrees with backtest V1.1 for BTC-like, ETH-like, SOL-like closed candles',()=>{
 for(const [seed,scale,tick] of [[1500,85000,.1],[2400,2500,.01],[3600,120,.001]]){
  const bars=pseudoBars(seed,850,scale);
  const pine=independentPineTranslation(bars,{mintick:tick});
  const js=vectorAIT(bars,{minTick:tick});
  compareFields(js,pine);
  assert.ok(pine.some(x=>x.signal==='long'));
  assert.ok(pine.some(x=>x.signal==='short'));
 }
});
test('Known minTick is an explicit instrument input, never guessed or substituted with Number.EPSILON',()=>{
 const tick=.00000001,rows=pseudoBars(991,400,.000002);
 for(let i=20;i<rows.length;i+=13)rows[i]={
  ...rows[i],open:rows[i-1].close,high:rows[i-1].close,
  low:rows[i-1].close,close:rows[i-1].close
 };
 compareFields(vectorAIT(rows,{minTick:tick}),
  independentPineTranslation(rows,{mintick:tick}));
 assert.throws(()=>independentPineTranslation(rows),/Known Pine mintick/);
});
test('Pine custom detector inputs are replicated without changing default strategy parameters',()=>{
 const bars=pseudoBars(702,550,100);
 const input={volumeLength:12,spreadLength:15,atrLength:9,volumeMultiplier:1.25,
  spreadMultiplier:1.2,atrMultiplier:.65,minimumBodyRatio:.5,
  minimumCloseStrength:.6,minimumConfirmations:3};
 compareFields(vectorAIT(bars,{...input,minTick:.01}),
  independentPineTranslation(bars,{...input,mintick:.01}));
});
test('Vector is always-in-position on reversals and Pine chart percent has no fees or stops',()=>{
 const bars=Array.from({length:55},(_,i)=>({
  time:i*3600000,open:100,close:100,high:101,low:99,volume:100
 }));
 bars[30]={...bars[30],open:100,high:110,low:99,close:109,volume:10000};
 bars[40]={...bars[40],open:109,high:110,low:98,close:99,volume:10000};
 const p=independentPineTranslation(bars,{mintick:.01});
 compareFields(vectorAIT(bars,{minTick:.01}),p);
 assert.equal(p[30].signal,'long');
 assert.equal(p[30].exit,null);
 assert.equal(p[40].signal,'short');
 assert.equal(p[40].exit,'long');
 assert.ok(Math.abs(p[40].closedTradeReturnPct-(99-109)/109*100)<1e-10);
});
test('Confirmed-only backtest excludes final forming candle: feed last closed bars only',()=>{
 const bars=pseudoBars(888,500,100);
 const observed=vectorAIT(bars.slice(0,-1),{minTick:.01});
 const full=vectorAIT(bars,{minTick:.01});
 compareFields(observed,independentPineTranslation(bars.slice(0,-1),{mintick:.01}));
 assert.deepEqual(observed,full.slice(0,-1));
});
