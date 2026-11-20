/*
 * Fixed, NON-optimized exploratory signal protocol:
 * CJ Cipher WT V1 alone, Vector V1.1 alone, and Vector gated by the
 * already-confirmed WT1-vs-WT2 direction. No Frank Test or SPEED yet.
 *
 * If an OPPOSING Vector signal is rejected, FLAT at next bar open
 * rather than secretly keeping an incorrect opposite position.
 * Same-bar confirmed values only; no trade orders.
 */
import {calculateCjCipherWaveTrend,cjCipherConfirmedCommands}
 from './cj-cipher-wavetrend-v1.mjs';
import {vectorAIT} from '../vector-ait-v1.mjs';
export const CIPHER_COMPARISON_LOCK=Object.freeze({
 model:'CJ_CIPHER_WT1_CROSS_VS_VECTOR_V11_WITH_SIMPLE_AGREEMENT_V1',
 strategyIds:['cj_cipher_wt_v1','vector_v11','vector_v11_cipher_agreement'],
 gate:'WT1>WT2 on confirmed Vector LONG, WT1<WT2 on confirmed Vector SHORT',
 rejectedOpposite:'FLAT on same confirmed signal bar, execute next OPEN',
 optimizationPerformed:false,
 portfolioModel:'NEXT_OPEN_REVERSAL_AND_FINAL_CLOSE_NO_STOP_OR_TAKE',
 tradingViewPineParity:'NOT_VERIFIED'
});
export function buildCjCipherComparison(bars,{priceStep}={}){
 if(!Array.isArray(bars)||bars.length<160||
    !Number.isFinite(priceStep)||priceStep<=0)
  throw Error('Require closed Bitunix 1H bars and a verified research price step');
 const cipher=calculateCjCipherWaveTrend(bars);
 const vector=vectorAIT(bars,{minTick:priceStep});
 if(vector.length!==bars.length)throw Error('Vector outputs do not align');
 const signals={
  cj_cipher_wt_v1:cjCipherConfirmedCommands(cipher),
  vector_v11:[],
  vector_v11_cipher_agreement:[]
 };
 let authorizedSide=null,accepted=0,rejected=0,flats=0;
 const comparisons=[];
 for(let i=0;i<bars.length-1;i++){
  const side=vector[i]?.signal,row=cipher[i];
  if(row.time!==bars[i].time)throw Error('Cipher chronology mismatch');
  if(!side)continue;
  if(!['long','short'].includes(side))throw Error('Unexpected Vector signal');
  const time=bars[i].time;
  signals.vector_v11.push({time,side});
  const agree=side==='long'?row.wt1>row.wt2:row.wt1<row.wt2;
  if(agree){
   signals.vector_v11_cipher_agreement.push({time,side});
   authorizedSide=side;
   accepted++;
  }else{
   rejected++;
   if(authorizedSide!==null&&authorizedSide!==side){
    signals.vector_v11_cipher_agreement.push({time,side:'flat'});
    authorizedSide=null;flats++;
   }
  }
  comparisons.push({time,side,wt1:row.wt1,wt2:row.wt2,
   decision:agree?'AGREE':'REJECT',
   entryOnlyAt:bars[i+1].time});
 }
 return {
  status:'RESEARCH_CAUSAL_SIGNALS_ONLY',
  lock:CIPHER_COMPARISON_LOCK,
  signals,
  signalCounts:{
    cipherLong:signals.cj_cipher_wt_v1.filter(x=>x.side==='long').length,
    cipherShort:signals.cj_cipher_wt_v1.filter(x=>x.side==='short').length,
    vectorAll:signals.vector_v11.length,
    vectorAgreement:accepted,vectorDisagreement:rejected,
    combinedFlatOnOpposedReversal:flats
  },
  comparisons,
  preview:CIPHER_COMPARISON_LOCK.strategyIds.map(id=>({
    strategy:id,first:signals[id].slice(0,10)
  })),
  ordersPlaced:false
 };
}
