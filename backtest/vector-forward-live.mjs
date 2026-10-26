/* Read-only client-side connector. Runs only while dashboard page is open.
 * Research engine is a browser-safe copy of the locked V1.1/V1.4 paper program;
 * no API credentials or external GitHub artifact tokens.
 */
import {runForwardPaper, FORWARD_LOCK} from './vector-forward-browser-engine.mjs';
const REFRESH_MS=15*60*1000;
let pending=false, lastRun=0;
const button=document.querySelector('#refreshBitunix');
const status=document.querySelector('#autoState');
const setText=t=>{if(status)status.textContent=t;};
export async function refreshVectorDashboard({nowMs=Date.now(),fetchPage}={}){
 if(pending)return {status:'ALREADY_RUNNING'};
 pending=true;
 if(button)button.disabled=true;
 setText('Lecture Bitunix en cours · aucune transaction réelle…');
 try{
  const result=await runForwardPaper({nowMs,...(fetchPage?{fetchPage}:{})});
  if(result.status==='ERROR')throw Error(
   result.results.filter(x=>x.status==='DATA_OR_AUDIT_ERROR')
     .map(x=>x.symbol+': '+x.error).join(' · '));
  if(result.protocol!==FORWARD_LOCK.protocol)throw Error('Protocole incompatible.');
  if(typeof globalThis.CJForwardDashboard?.load!=='function')
   throw Error('Interface de visualisation indisponible.');
  globalThis.CJForwardDashboard.load(result,{origin:'bitunix'});
  lastRun=Date.now();
  setText('Bitunix vérifié · '+new Date(nowMs).toLocaleString('fr-CA')+
   ' · actualisation aux 15 min pendant que cette page reste ouverte');
  return result;
 }catch(error){
  const message=String(error?.message??error);
  setText('Lecture Bitunix non disponible : '+message+
   ' · dernier rapport conservé, vérifie son horodatage.');
  return {status:'ERROR',error:message};
 }finally{
  pending=false;
  if(button)button.disabled=false;
 }
}
if(button){
 button.addEventListener('click',()=>void refreshVectorDashboard());
 // A hidden/background mobile tab can freeze timers. On reopening, refresh
 // if 15 minutes elapsed; this does NOT schedule background or phone alarms.
 document.addEventListener('visibilitychange',()=>{
  if(!document.hidden&&Date.now()-lastRun>=REFRESH_MS)
   void refreshVectorDashboard();
 });
 setInterval(()=>{
  if(!document.hidden&&Date.now()-lastRun>=REFRESH_MS)
   void refreshVectorDashboard();
 },REFRESH_MS);
 void refreshVectorDashboard();
}
