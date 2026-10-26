import {analyzeForwardReport,fmtCount,fmtPercent,SYMBOLS,MODES,MIN_CLOSED}
 from './vector-forward-dashboard-data.mjs';
const $=id=>document.getElementById(id);
let model=null;
const ele=(tag,className,text)=>{
 const node=document.createElement(tag);
 if(className)node.className=className;
 if(text!==undefined)node.textContent=String(text);
 return node;
};
function metricPair(label,value){
 const p=ele('div','pair');
 p.append(ele('span',null,label),ele('strong',null,value));
 return p;
}
function modePanel(row){
 const panel=ele('div','mode');
 panel.append(ele('h3',null,row.mode),metricPair('Clôturées',fmtCount(row.closed)+' / '+MIN_CLOSED));
 const track=ele('div','track');track.setAttribute('role','progressbar');
 track.setAttribute('aria-label',row.symbol+' '+row.mode+' : avancement des trades clôturés');
 track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax',String(MIN_CLOSED));
 track.setAttribute('aria-valuenow',String(Math.min(MIN_CLOSED,row.closed)));
 const fill=ele('div','fill');fill.style.width=String(row.progress)+'%';
 track.append(fill);panel.append(track);
 panel.append(metricPair('Gagnants',row.closed?fmtPercent(row.winRate):'—'),
  metricPair('Net moyen / trade',fmtPercent(row.netMean)),
  metricPair('Net médian / trade',fmtPercent(row.netMedian)),
  metricPair('Positions en attente',fmtCount(row.pending)),
  metricPair('Censurées',fmtCount(row.censored)));
 const tag=ele('span','tag',row.sufficient?'Seuil d’observation atteint':'Échantillon insuffisant');
 panel.append(tag);return panel;
}
function render(){
 for(const [id,value] of Object.entries({
  totalClosed:model?fmtCount(model.totals.closed):'—',
  totalPending:model?fmtCount(model.totals.pending):'—',
  totalCensored:model?fmtCount(model.totals.censored):'—',
  totalReady:model?fmtCount(model.totals.sufficient)+' / 6':'—'}))$(id).textContent=value;
 const wrap=$('marketCards');wrap.replaceChildren();
 for(const symbol of SYMBOLS){
  const panel=ele('article','panel'),head=ele('div','symbolTitle');
  head.append(ele('h2',null,symbol));
  const row=model?.rows.find(r=>r.symbol===symbol);
  head.append(ele('span','tag',row?.status??'En attente'));
  panel.append(head);
  const grid=ele('div','marketGrid');
  for(const mode of MODES){
   const item=model?.rows.find(r=>r.symbol===symbol&&r.mode===mode);
   if(item)grid.append(modePanel(item));
   else grid.append(ele('div','mode',mode+' · aucun résultat'));
  }
  panel.append(grid);
  if(row)panel.append(ele('p','small','Source qualité : '+row.feed+' · '+fmtCount(row.excluded)+' bougies exclues'));
  wrap.append(panel);
 }
 const body=$('trades');body.replaceChildren();
 const filtered=(model?.trades??[])
  .filter(t=>$('marketFilter').value==='ALL'||t.symbol===$('marketFilter').value)
  .sort((a,b)=>b.signalTime-a.signalTime).slice(0,150);
 if(!filtered.length){
  const tr=ele('tr'),td=ele('td',null,'Aucune transaction à afficher pour ce filtre.');
  td.colSpan=7;tr.append(td);body.append(tr);return;
 }
 const date=x=>Number.isSafeInteger(x)?new Intl.DateTimeFormat('fr-CA',{
  dateStyle:'short',timeStyle:'short',timeZone:'UTC'}).format(new Date(x)):'—';
 for(const t of filtered){
  const tr=ele('tr');for(const value of [
   t.symbol,t.mode,t.side==='long'?'LONG':t.side==='short'?'SHORT':'—',
   date(t.signalTime),t.status,t.reason??'—',
   t.status==='closed'?fmtPercent(t.netPct):'—']){
    tr.append(ele('td',null,value));
   }
  body.append(tr);
 }
}
/* Both the optional Bitunix connector and JSON-import path reuse the same
 * strict report validator, so neither can manufacture a gain. */
globalThis.CJForwardDashboard={
 load(report,{origin='local'}={}){
  const candidate=analyzeForwardReport(report);
  model=candidate;
  $('feedback').className='good';
  $('feedback').textContent='Rapport vérifié : '+model.status+
   ' · '+model.totals.closed+' transactions clôturées.';
  $('meta').textContent='Observation UTC : '+model.asOf+
   ' · Moteur : '+(origin==='bitunix'?'Bitunix public, calcul dans le navigateur':'rapport GitHub importé')+
   ' · '+(model.commit?'Commit : '+model.commit:'Code de recherche verrouillé');
  $('export').disabled=false;render();
 },
};

async function importFile(file){
 if(!file)return;
 try{
  if(file.size>10*1024*1024)throw new Error('Le fichier dépasse 10 Mo.');
  const input=JSON.parse(await file.text());
  model=analyzeForwardReport(input);
  $('feedback').className='good';
  $('feedback').textContent='Rapport vérifié : '+model.status+' · '+model.totals.closed+' transactions clôturées.';
  $('meta').textContent='Observation UTC : '+model.asOf+' · Commit du modèle : '+(model.commit??'non fourni')+' · Import local seulement.';
  $('export').disabled=false;
 }catch(e){
  model=null;$('feedback').className='failure';
  $('feedback').textContent='Import refusé : '+String(e?.message??e);
  $('meta').textContent='Les résultats précédents ont été effacés; aucun chiffre non vérifié n’est affiché.';
  $('export').disabled=true;
 }
 render();
}
$('reportInput').addEventListener('change',event=>importFile(event.target.files?.[0]));
$('marketFilter').addEventListener('change',render);
$('clear').addEventListener('click',()=>{
 model=null;$('reportInput').value='';$('marketFilter').value='ALL';
 $('feedback').className='';
 $('feedback').textContent='Aucun rapport chargé.';
 $('meta').textContent='Import local uniquement. Le fichier ne quitte pas cet appareil.';
 $('export').disabled=true;render();
});
$('export').addEventListener('click',()=>{
 if(!model)return;
 const cols=['symbol','mode','status','closed','wins','pending','censored','winRate','netMean','netMedian','netSum','sufficient'];
 const escape=x=>{
  const s=x==null?'':String(x);
  return /[,"\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;
 };
 const csv=[cols.join(','),...model.rows.map(r=>cols.map(k=>escape(r[k])).join(','))].join('\r\n');
 const file=new Blob([csv],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(file);const a=ele('a');
 a.href=url;a.download='cryptojuju-vector-forward-summary.csv';
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
render();
