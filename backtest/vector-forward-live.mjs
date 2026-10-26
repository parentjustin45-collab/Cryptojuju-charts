/* TEST-only Bitunix connector — no credentials or exchange orders.
 * Runs in a visible browser tab, at MOST one refresh attempt per 15 min.
 * It does NOT schedule browser/background tasks or change the locked model.
 */
import {runForwardPaper,FORWARD_LOCK} from './vector-forward-browser-engine.mjs';
import {makeCryptoJujuFetchPage} from './cryptojuju-adapter.mjs';
import {createBitunixFreshnessLedger,dueForRefresh,REFRESH_INTERVAL_MS}
 from './vector-forward-refresh-policy.mjs';
let pending=false,lastAttempt=0,lastSuccess=0;
const button=document.querySelector('#refreshBitunix');
const status=document.querySelector('#autoState');
const setText=t=>{if(status)status.textContent=t;};
const localized=ms=>new Date(ms).toLocaleString('fr-CA',{timeZone:'America/Toronto'});
const diagnostics=d=>d.markets.filter(m=>m.state!=='FRESH_CLOSED_55')
 .map(m=>m.symbol+': '+(m.lagHours===null?'aucune chandelle valide':
  m.lagHours+' h de retard')+', '+m.lastClosedContinuousBars+
  ' bougies clôturées continues').join(' · ');
export async function refreshVectorDashboard({nowMs=Date.now(),fetchPage}={}){
 if(pending)return {status:'ALREADY_RUNNING'};
 pending=true;
 lastAttempt=Date.now();
 if(button)button.disabled=true;
 setText('Contrôle des chandelles Bitunix clôturées · lecture seule…');
 try{
  const ledger=createBitunixFreshnessLedger();
  const source=fetchPage??makeCryptoJujuFetchPage();
  const checkedFetch=async args=>{
   const rows=await source(args);
   // Bitunix may return a boundary candle twice across contiguous pages;
   // apply the engine's exact [startTime,endTime) filter before checking.
   const inside=rows.filter(b=>Number(b?.time)>=args.startTime&&Number(b?.time)<args.endTime);
   ledger.acceptPage(args,inside);
   return rows;
  };
  const result=await runForwardPaper({nowMs,fetchPage:checkedFetch});
  if(result.status==='ERROR')throw Error(
   result.results.filter(r=>r.status==='DATA_OR_AUDIT_ERROR')
    .map(r=>r.symbol+': '+r.error).join(' · '));
  if(result.protocol!==FORWARD_LOCK.protocol)throw Error('Protocole incompatible.');
  const fresh=ledger.inspect(nowMs);
  if(!fresh.ok)throw Error('Flux récent incomplet, résultat non actualisé : '+diagnostics(fresh));
  if(typeof globalThis.CJForwardDashboard?.load!=='function')
   throw Error('Interface de visualisation indisponible.');
  globalThis.CJForwardDashboard.load(result,{origin:'bitunix'});
  lastSuccess=Date.now();
  const quarantined=result.results
   .filter(r=>Number(r.feed?.excluded)>0)
   .map(r=>r.symbol+': '+r.feed.excluded+' bougies anciennes écartées');
  setText('Synchronisation Bitunix vérifiée : '+localized(lastSuccess)+
   ' · dernières bougies 1H clôturées et continues (55+) sur BTC, ETH et SOL'+
   (quarantined.length?' · quarantaine : '+quarantined.join('; '):'')+
   ' · nouveau contrôle aux 15 min si cette page reste visible.');
  return result;
 }catch(error){
  const message=String(error?.message??error);
  setText('⚠ Actualisation refusée : '+message+
   (lastSuccess?' · dernière réussite : '+localized(lastSuccess):
    ' · aucun résultat frais confirmé')+
   '. Réessayer après la clôture suivante.');
  return {status:'ERROR',error:message};
 }finally{
  pending=false;
  if(button)button.disabled=false;
 }
}
function maybeRefresh(){
 if(dueForRefresh({nowMs:Date.now(),lastAttemptMs:lastAttempt,
   hidden:document.hidden,pending}))void refreshVectorDashboard();
}
if(button){
 button.addEventListener('click',()=>void refreshVectorDashboard());
 document.addEventListener('visibilitychange',maybeRefresh);
 // Mobile browsers can suspend intervals; visibilitychange resynchronizes
 // only when 15 minutes have elapsed. This is NOT background automation.
 setInterval(maybeRefresh,REFRESH_INTERVAL_MS);
 maybeRefresh();
}
