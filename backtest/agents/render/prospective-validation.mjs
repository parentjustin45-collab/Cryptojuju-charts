/* Prospective protocol V1. Frozen research only. No orders, no tuning. */
import {generate as v2} from './historical-targeted-experiments.mjs';
import {generate as v3} from './historical-targeted-v3-experiments.mjs';
export const PROTOCOL=Object.freeze({
 id:'CJ_PROSPECTIVE_VALIDATION_V1_20261127',
 startMs:Date.UTC(2026,10,28),checkpointMs:Date.UTC(2026,11,28),endMs:Date.UTC(2027,1,26),
 warmupBars:480,maxHoldingBars:12,minClosedTrades:30,
 costs:[{id:'zero',feeBps:0,slippageBps:0},{id:'base',feeBps:5,slippageBps:2.5},{id:'stress',feeBps:10,slippageBps:5}],
 candidates:[['vector','v3'],['momentum','v2'],['speed','v2'],['speed','v3'],['cipher','v2'],['cipher','v3'],['frank_divergence','v3']],
 baselineChannels:['vector','momentum','speed','cipher','frank_cross','frank_divergence'],
 sourcePin:'be19897265943f23e38bffe6f46fbbe770dc4624',
 limitations:'Independent isolated 1x notional per market/channel, no real fills, funding, spread observations, liquidation model or shared portfolio.'
});
export const VARIANTS=Object.freeze([...PROTOCOL.baselineChannels.map(ch=>[ch,'original']),...PROTOCOL.candidates]);
const assert=(v,m)=>{if(!v)throw Error(m)};
const valid=x=>typeof x==='number'&&Number.isFinite(x);
export function generateFrozen(ch,version,bars,priceStep){
 assert(VARIANTS.some(x=>x[0]===ch&&x[1]===version),'UNREGISTERED_VARIANT');
 return (version==='v3'?v3:v2)(ch,bars,priceStep,version!=='original');
}
// Each event is timestamped at the open of its confirmation bar; only act at next open.
// Starting flat at evaluation boundary. Ignore same-side repeats. Opposite signal exits
// and reverses at next open. Time exit at open after 12 complete held bars.
// No new entry if last signal has no next open. Unfinished trades marked separately.
export function simulate(bars,signals,{startIndex,cost,maxHoldingBars=PROTOCOL.maxHoldingBars}){
 assert(Number.isInteger(startIndex)&&startIndex>=1&&startIndex<bars.length,'BAD_EVAL_BOUNDARY');
 assert(Number.isInteger(maxHoldingBars)&&maxHoldingBars>=1,'BAD_HORIZON');
 assert(cost&&valid(cost.feeBps)&&cost.feeBps>=0&&valid(cost.slippageBps)&&cost.slippageBps>=0&&cost.slippageBps<10000,'BAD_COST');
 const idx=new Map(),directions=new Map();
 for(let i=0;i<bars.length;i++){
  const b=bars[i];assert(valid(b.open)&&b.open>0&&valid(b.close)&&b.close>0&&Number.isSafeInteger(b.time)&&(!i||b.time>bars[i-1].time),'BAD_BAR');idx.set(b.time,i);
 }
 let conflicts=0,eligibleEvents=0;
 for(const e of signals){
  const i=idx.get(e.time);assert(Number.isInteger(i)&&['long','short'].includes(e.side),'BAD_SIGNAL');
  if(i<startIndex||i>=bars.length-1)continue;
  eligibleEvents++;const s=e.side==='long'?1:-1;
  const prior=directions.get(i);directions.set(i,prior===undefined?s:prior===s?s:0);
 }
 const fee=cost.feeBps/10000,slip=cost.slippageBps/10000;
 let cash=1,peak=1,drawdown=0,pos=null,trades=0,wins=0,grossSum=0,netSum=0,fees=0,slippage=0,insolvent=false,ignored=0,reverse=0,timeExits=0;
 const sides={long:{trades:0,wins:0,netSum:0},short:{trades:0,wins:0,netSum:0}};
 const fill=(p,s)=>p*(1+s*slip);
 function pnl(p,mid){
  const out=fill(mid,-p.side),gross=p.side*(mid-p.mid)/p.mid,
   executed=p.side*(out-p.entry)/p.entry,
   net=executed-fee*(1+out/p.entry);
  return {gross,net,feeCost:fee*(1+out/p.entry),slipCost:gross-executed};
 }
 function mark(v){peak=Math.max(peak,v);drawdown=Math.max(drawdown,peak>0?(peak-v)/peak:1);}
 function close(mid,reason){
  const x=pnl(pos,mid),s=sides[pos.side===1?'long':'short'];trades++;s.trades++;wins+=Number(x.net>0);s.wins+=Number(x.net>0);s.netSum+=x.net;grossSum+=x.gross;netSum+=x.net;
  fees+=pos.capital*x.feeCost;slippage+=pos.capital*x.slipCost;
  cash=pos.capital*(1+x.net);mark(Math.max(0,cash));pos=null;
  if(reason==='reverse')reverse++;else timeExits++;
  if(cash<=0){cash=0;insolvent=true;}
 }
 for(let i=startIndex;i<bars.length&&!insolvent;i++){
  const d=directions.get(i-1);if(d===0)conflicts++;
  if(pos){
   if(d&&d!==pos.side)close(bars[i].open,'reverse');
   else if(i-pos.index>=maxHoldingBars)close(bars[i].open,'time');
   else if(d===pos.side)ignored++;
  }
  if(!pos&&d&&!insolvent){pos={side:d,index:i,mid:bars[i].open,entry:fill(bars[i].open,d),capital:cash};}
  if(pos){
   const marked=pos.capital*(1+pnl(pos,bars[i].close).net);
   mark(Math.max(0,marked));
   if(marked<=0){insolvent=true;cash=0;pos=null;}
  }else mark(cash);
 }
 const markedEquity=pos?Math.max(0,pos.capital*(1+pnl(pos,bars.at(-1).close).net)):cash;
 return {cost:cost.id,eligibleEvents,conflicts,ignored,reversals:reverse,timeExits,trades,wins,meanGrossBps:trades?grossSum/trades*10000:null,meanNetBps:trades?netSum/trades*10000:null,
  realizedReturnPct:100*(cash-1),markedReturnPct:100*(markedEquity-1),maxCloseDrawdownPct:100*drawdown,
  feesFractionOfInitial:fees,slippageFractionOfInitial:slippage,openAtEnd:!!pos,insolvent,sides,
  sampleStatus:trades>=PROTOCOL.minClosedTrades?'MIN_SAMPLE_MET':'INSUFFICIENT_TRADES'};
}
export function evaluateFrozen(bars,priceStep,startIndex){
 const result=[];
 for(const [channel,version] of VARIANTS){
  const generated=generateFrozen(channel,version,bars,priceStep);
  const cut=startIndex+Math.floor((bars.length-startIndex)/2);
  const prefix=generateFrozen(channel,version,bars.slice(0,cut),priceStep);
  assert(JSON.stringify(prefix.signals)===JSON.stringify(generated.signals.filter(x=>x.time<=bars[cut-1].time)),'PREFIX_MISMATCH_'+channel+'_'+version);
  result.push({channel,version,prefixChecks:1,results:PROTOCOL.costs.map(cost=>simulate(bars,generated.signals,{startIndex,cost}))});
 }
 return result;
}
