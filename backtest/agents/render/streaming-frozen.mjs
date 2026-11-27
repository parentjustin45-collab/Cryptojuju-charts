/* Frozen seven candidates, incremental state only. No tuning or promotion. */
import {createHash} from 'node:crypto';
import {createStreamingReplay} from './streaming-originals.mjs';
import {VARIANTS,PROTOCOL} from './prospective-validation.mjs';
export const VERSION='CJ_STREAM_FROZEN_V1_20261127';
export const KEYS=VARIANTS.map(([c,v])=>c+'|'+v);
const valid=x=>typeof x==='number'&&Number.isFinite(x);
const need=(x,m)=>{if(!x)throw Error(m)};
const push=(a,x,n)=>{a.push(x);if(a.length>n)a.shift();};
const ev=(time,side,tag)=>({time,side,tag});
const digest=()=>createHash('sha256');
export function createFrozenStream({priceStep,intervalMs}){
 const original=createStreamingReplay({priceStep,intervalMs,includeTrace:true});
 const hashes=Object.fromEntries(KEYS.map(k=>[k,digest()])),counts=Object.fromEntries(KEYS.map(k=>[k,0]));
 let i=0,dir=0,prevWT=null,prevGap=null,sealed=false;
 const gaps=[],piv=[],lows=[],highs=[];
 const speed=[{last:-Infinity,side:null,volume:0},{last:-Infinity,side:null,volume:0}];
 const cipher=[0,1].map(()=>({last:-Infinity,side:null,active:false,pending:[],tested:0,confirmed:0}));
 let frankPending=[],frankTested=0,frankConfirmed=0;
 function consume(b){
  need(!sealed,'FINISHED');const x=original.consume(b),out=Object.fromEntries(KEYS.map(k=>[k,[]]));
  for(const [ch,events] of Object.entries(x.events))out[ch+'|original']=events;
  const emit=(key,side,tag)=>out[key].push(ev(b.time,side,tag));
  const s=Math.sign(b.close-b.open),t=x.trace,strength=s===1?t.bullStrength:t.bearStrength;
  const selective=s!==0&&t.common+Number(strength>=.7)===3&&t.rangeAtr!==null&&t.rangeAtr>=.8&&strength>=.7&&(t.volumeRatio>=1.5||t.spreadRatio>=1.5);
  if(s&&s!==dir&&(selective||(s===1?x.vector.bullishVector:x.vector.bearishVector))){dir=s;emit('vector|v3',s===1?'long':'short','vector_v11');}
  const m=x.momentum;push(gaps,m.emaFast-m.emaSlow,3);
  const compress=s=>gaps.length===3&&gaps.every(valid)&&s*gaps[2]<=0&&s*gaps[2]>s*gaps[1]&&s*gaps[1]>s*gaps[0];
  if(t.mup&&(m.emaFast>m.emaSlow||compress(1)))emit('momentum|v2','long','momentum_fusion');
  else if(t.mdn&&(m.emaFast<m.emaSlow||compress(-1)))emit('momentum|v2','short','momentum_fusion');
  if(x.speed.color){const side=x.speed.color.startsWith('bull')?'long':'short';
   for(const [j,z] of speed.entries()){if(side===z.side&&i-z.last<=1&&!(j===1&&x.speed.volumePercent>=z.volume+25))continue;emit('speed|v'+(j+2),side,x.speed.color);z.last=i;z.side=side;z.volume=x.speed.volumePercent;}
  }
  const wt=x.cipher.wt1,g=x.cipher.wt2===null?null:wt-x.cipher.wt2,signal=x.events.cipher[0]?.side??null;
  for(const [j,z] of cipher.entries()){
   for(const p of z.pending)if(signal===p.side)p.hit=true;
   const due=z.pending.filter(p=>i-p.i===2);for(const p of due){z.tested++;z.confirmed+=Number(p.hit);}
   z.pending=z.pending.filter(p=>i-p.i<2);
   const key='cipher|v'+(j+2);
   if(signal){if(!(z.active&&signal===z.side&&i-z.last<=2))emit(key,signal,'cj_cipher_wt');z.active=false;continue;}
   if(!valid(g)||!valid(prevGap))continue;
   const side=g<0?'long':g>0?'short':null,sign=side==='long'?1:-1;
   if(side&&Math.abs(g)<=(j===0?3:2)&&(j===0||Math.abs(g)<=.5*Math.abs(prevGap))&&sign*g>sign*prevGap&&sign*(wt-prevWT)>0&&!(z.active&&z.side===side&&i-z.last<=2)){
    emit(key,side,'cipher_prealert');z.pending.push({i,side,hit:false});z.last=i;z.side=side;z.active=true;
   }
  }
  prevWT=wt;prevGap=g;
  for(const p of frankPending){frankTested++;frankConfirmed+=Number(x.events.frank_divergence.some(e=>e.tag===p));}
  frankPending=[];
  push(piv,{...b,osc:x.frank.oscillator},5);
  const isPivot=(j,s)=>{const field=s===1?'low':'high';return piv.slice(j-2).every((p,k)=>k===2||s*p[field]>s*piv[j][field]);};
  if(i>=3){
   // Confirm the older pivot first, then evaluate the one-right-bar warning.
   if(piv.length===5)for(const [sign,h] of [[1,lows],[-1,highs]])if(isPivot(2,sign)){const p=piv[2];push(h,{price:sign===1?p.low:p.high,osc:p.osc},10);}
   const j=piv.length-2,p=piv[j];
   for(const [sign,h] of [[1,lows],[-1,highs]]){
    if(!isPivot(j,sign)||!valid(p.osc))continue;
    const price=sign===1?p.low:p.high;let type=null;
    for(const q of h.slice(-2)){if(!valid(q.osc))continue;if(sign*price<sign*q.price&&sign*p.osc>sign*q.osc){type=sign===1?'R+':'R-';break;}if(sign*price>sign*q.price&&sign*p.osc<sign*q.osc){type=sign===1?'H+':'H-';break;}}
    if(type&&sign*(b.close-p.close)>0&&sign*(b.close-b.open)>0){emit('frank_divergence|v3',sign===1?'long':'short','prealert_'+type);frankPending.push(type);}
   }
  }
  for(const key of KEYS)for(const e of out[key]){counts[key]++;hashes[key].update(JSON.stringify(e)+'\n');}
  i++;return out;
 }
 return {consume,consumePage(bars,onRow){for(const b of bars)onRow?.(consume(b),b);},finish(){
  need(!sealed&&i>0,'EMPTY_OR_FINISHED');sealed=true;original.finish();
  return {version:VERSION,bars:i,counts,eventSha256:Object.fromEntries(KEYS.map(k=>[k,hashes[k].digest('hex')])),warningStats:{'cipher|v2':{tested:cipher[0].tested,confirmed:cipher[0].confirmed,unresolved:cipher[0].pending.length},'cipher|v3':{tested:cipher[1].tested,confirmed:cipher[1].confirmed,unresolved:cipher[1].pending.length},'frank_divergence|v3':{tested:frankTested,confirmed:frankConfirmed,unresolved:frankPending.length}},noTrading:true};
 }};
}
// Streaming reproduction of the frozen isolated-account simulator. Last bar's
// events are held until next open; count even after insolvency as batch does.
export function createTradeStream({startIndex,cost,maxHoldingBars=PROTOCOL.maxHoldingBars}){
 need(Number.isInteger(startIndex)&&startIndex>=1&&Number.isInteger(maxHoldingBars)&&maxHoldingBars>=1&&cost&&valid(cost.feeBps)&&cost.feeBps>=0&&valid(cost.slippageBps)&&cost.slippageBps>=0&&cost.slippageBps<10000,'BAD_SIM_CONFIG');
 const fee=cost.feeBps/10000,slip=cost.slippageBps/10000;
 let i=0,last=null,pending=[],cash=1,peak=1,drawdown=0,pos=null,trades=0,wins=0,grossSum=0,netSum=0,fees=0,slippage=0,insolvent=false,ignored=0,reverse=0,timeExits=0,conflicts=0,eligibleEvents=0,sealed=false;
 const sides={long:{trades:0,wins:0,netSum:0},short:{trades:0,wins:0,netSum:0}};
 const fill=(p,s)=>p*(1+s*slip);
 function pnl(p,mid){const out=fill(mid,-p.side),gross=p.side*(mid-p.mid)/p.mid,executed=p.side*(out-p.entry)/p.entry,net=executed-fee*(1+out/p.entry);return {gross,net,feeCost:fee*(1+out/p.entry),slipCost:gross-executed};}
 function mark(v){peak=Math.max(peak,v);drawdown=Math.max(drawdown,peak>0?(peak-v)/peak:1);}
 function close(mid,reason){const x=pnl(pos,mid),s=sides[pos.side===1?'long':'short'];trades++;s.trades++;wins+=Number(x.net>0);s.wins+=Number(x.net>0);s.netSum+=x.net;grossSum+=x.gross;netSum+=x.net;fees+=pos.capital*x.feeCost;slippage+=pos.capital*x.slipCost;cash=pos.capital*(1+x.net);mark(Math.max(0,cash));pos=null;if(reason==='reverse')reverse++;else timeExits++;if(cash<=0){cash=0;insolvent=true;}}
 return {consume(b,events){
  need(!sealed&&valid(b.open)&&b.open>0&&valid(b.close)&&b.close>0&&Number.isSafeInteger(b.time)&&(!last||b.time>last.time)&&events.every(e=>e.time===b.time&&['long','short'].includes(e.side)),'BAD_SIM_INPUT');
  let d;
  if(i-1>=startIndex){eligibleEvents+=pending.length;for(const e of pending){const s=e.side==='long'?1:-1;d=d===undefined?s:d===s?s:0;}}
  if(i>=startIndex&&!insolvent){
   if(d===0)conflicts++;
   if(pos){if(d&&d!==pos.side)close(b.open,'reverse');else if(i-pos.index>=maxHoldingBars)close(b.open,'time');else if(d===pos.side)ignored++;}
   if(!pos&&d&&!insolvent)pos={side:d,index:i,mid:b.open,entry:fill(b.open,d),capital:cash};
   if(pos){const marked=pos.capital*(1+pnl(pos,b.close).net);mark(Math.max(0,marked));if(marked<=0){insolvent=true;cash=0;pos=null;}}else mark(cash);
  }
  pending=events;last=b;i++;
 },finish(){need(!sealed&&i>startIndex,'BAD_EVAL_BOUNDARY');sealed=true;const markedEquity=pos?Math.max(0,pos.capital*(1+pnl(pos,last.close).net)):cash;
 return {cost:cost.id,eligibleEvents,conflicts,ignored,reversals:reverse,timeExits,trades,wins,meanGrossBps:trades?grossSum/trades*10000:null,meanNetBps:trades?netSum/trades*10000:null,realizedReturnPct:100*(cash-1),markedReturnPct:100*(markedEquity-1),maxCloseDrawdownPct:100*drawdown,feesFractionOfInitial:fees,slippageFractionOfInitial:slippage,openAtEnd:!!pos,insolvent,sides,sampleStatus:trades>=PROTOCOL.minClosedTrades?'MIN_SAMPLE_MET':'INSUFFICIENT_TRADES'};
 }};
}
export function createFrozenEvaluation({priceStep,intervalMs,startIndex}){
 const engine=createFrozenStream({priceStep,intervalMs}),sims=Object.fromEntries(KEYS.map(k=>[k,PROTOCOL.costs.map(cost=>createTradeStream({startIndex,cost}))]));
 return {consume(b){const e=engine.consume(b);for(const k of KEYS)for(const s of sims[k])s.consume(b,e[k]);return e;},finish(){return {...engine.finish(),simulations:Object.fromEntries(KEYS.map(k=>[k,sims[k].map(s=>s.finish())]))};}};
}
