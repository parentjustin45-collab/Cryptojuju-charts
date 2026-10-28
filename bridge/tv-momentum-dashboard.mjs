/* Owner-only CryptoJuju / TradingView observations dashboard.
   Basic auth is HTTPS-only and independent of webhook-only submission token.
   All data are server-rendered; no public JSON reader, no client-side secrets. */
import crypto from 'node:crypto';

const DASH_PATH='/private/tradingview';
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const headers={'content-type':'text/html; charset=utf-8','cache-control':'no-store',
 'referrer-policy':'no-referrer','x-content-type-options':'nosniff',
 'x-frame-options':'DENY',
 'content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"};
const frame=body=>'<!doctype html><html lang="fr-CA"><head><meta charset="utf-8">'+
 '<meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<title>CryptoJuju — TradingView privé</title><style>'+
 'body{background:#07180f;color:#f0f8f0;font:16px system-ui,sans-serif;margin:0}'+
 'main{max-width:1050px;padding:24px 16px 80px;margin:auto}'+
 'h1{font-size:clamp(26px,5vw,38px)}h2{font-size:19px}'+
 '.sub{color:#a6b9ab}.warn{border-left:4px solid #e1b65d;background:#292c1e;padding:16px;margin:18px 0}'+
 '.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px;margin:22px 0}'+
 '.card,.panel{background:#10261a;border:1px solid #31513c;border-radius:14px;padding:17px}'+
 '.card small{display:block;color:#a7c2ad}.card strong{display:block;font-size:29px;margin:8px 0}'+
 '.table{overflow-x:auto}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #2b4434;text-align:left;padding:12px 9px;font-size:13px}'+
 'th{color:#b2d7bc}td{overflow-wrap:anywhere}a{color:#baf5ad}.tag{color:#b6f4af;font-weight:bold}'+
 '</style></head><body><main>'+body+'</main></body></html>';
const time=t=>{
 if(!Number.isFinite(Number(t))||Number(t)<=0)return '—';
 return new Date(Number(t)).toLocaleString('fr-CA',{timeZone:'America/Toronto',
  year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'})+' (Québec)';
};
function secureAuth(header,password){
 if(typeof header!=='string'||!header.startsWith('Basic ')||header.length>512)return false;
 let parsed;
 try{parsed=Buffer.from(header.slice(6),'base64').toString('utf8');}catch{return false;}
 const target='owner:'+password;
 const digest=x=>crypto.createHash('sha256').update(x).digest();
 return crypto.timingSafeEqual(digest(parsed),digest(target));
}
export function renderTradingViewPrivateDashboard(snapshot){
 const rows=Array.isArray(snapshot?.observations)?snapshot.observations:[],
  total=Number(snapshot?.total??0),groups=new Map();
 for(const item of rows){
  const a=item.payload??item;
  if(!a||typeof a!=='object')continue;
  const key=String(a.symbol)+'|'+String(a.timeframe);
  const x=groups.get(key)??{symbol:a.symbol,tf:a.timeframe,receivedInWindow:0,
   lastOpen:0,latest:null};
  x.receivedInWindow++;
  if(Number(a.barOpenMs)>x.lastOpen){x.lastOpen=Number(a.barOpenMs);x.latest=a;}
  groups.set(key,x);
 }
 const last=Math.max(0,...rows.map(x=>Number((x.payload??x).barOpenMs??0)));
 const metrics='<div class="grid">'+
  '<div class="card"><small>Total enregistré</small><strong>'+safe(total)+'</strong></div>'+
  '<div class="card"><small>Marchés vus (échantillon)</small><strong>'+groups.size+'</strong></div>'+
  '<div class="card"><small>Dernière chandelle reçue</small><strong style="font-size:16px">'+safe(time(last))+'</strong></div></div>';
 const markets=[...groups.values()].sort((a,b)=>b.lastOpen-a.lastOpen).map(g=>{
  const a=g.latest,v=a?.values??{};
  return '<tr><td>'+safe(g.symbol)+'</td><td>'+safe(g.tf)+'m</td><td>'+
    safe(g.receivedInWindow)+'</td><td>'+safe(
    Number.isFinite(v.composite)?Number(v.composite).toFixed(2):'—')+'</td><td>'+
    safe(time(g.lastOpen))+'</td><td>Collecte / parité à confirmer</td></tr>';
 }).join('');
 const recent=rows.slice(0,15).map(x=>{
  const a=x.payload??x,v=a.values??{},price=a.ohlc?.close;
  return '<tr><td>'+safe(time(a.barCloseMs))+'</td><td>'+safe(a.symbol)+' · '+
   safe(a.timeframe)+'m</td><td>'+safe(Number.isFinite(price)?price:'—')+'</td><td>'+
   safe(Number.isFinite(v.composite)?Number(v.composite).toFixed(2):'—')+'</td><td>'+
   safe(v.bullSignal?'LONG':v.bearSignal?'SHORT':v.pivotLowConfirmed?'Pivot bas':v.pivotHighConfirmed?'Pivot haut':'—')+'</td></tr>';
 }).join('');
 return frame('<div class="tag">CRYPTOJUJU · DEV · PRIVÉ</div>'+
  '<h1>TradingView · Momentum Fusion</h1><p class="sub">Observations reçues de TradingView, comparaison Pine / JavaScript à venir. Aucun ordre réel.</p>'+
  '<p><a href="/private/tradingview">Actualiser le tableau</a></p>'+metrics+
  (total===0?'<div class="warn"><strong>Aucune chandelle reçue pour le moment.</strong> Le serveur peut être prêt, mais cela ne confirme pas qu’une alerte TradingView est créée et livrée.</div>':
  '<div class="warn">Les comptages ci-dessous ne prouvent pas une série continue ni la parité Pine/JavaScript. Un contrôle complet exige au moins 200 clôtures consécutives par marché.</div>')+
  '<div class="panel"><h2>Marchés et dernières valeurs</h2><div class="table"><table><thead><tr><th>Marché</th><th>UT</th><th>Dans le relevé*</th><th>Composite</th><th>Dernière bougie</th><th>État</th></tr></thead><tbody>'+
  (markets||'<tr><td colspan="6">En attente de TradingView</td></tr>')+
  '</tbody></table></div></div>'+
  '<div class="panel" style="margin-top:16px"><h2>Dernières observations</h2><div class="table"><table><thead><tr><th>Clôture</th><th>Marché</th><th>Prix</th><th>Composite</th><th>Signal</th></tr></thead><tbody>'+
  (recent||'<tr><td colspan="5">Aucune observation</td></tr>')+
  '</tbody></table></div></div>'+
  '<p class="sub">*L’affichage liste au maximum les 1000 dernières observations. Pour le nombre global, utiliser le total enregistré. Prototype gratuit Render, sans garantie 24 h/24; base de test expirant le 26 novembre 2026.</p>');
}
export function createPrivateDashboardHandler({password,store}={}){
 const enabled=typeof password==='string'&&password.length>=32&&
  store&&typeof store.dashboardSnapshot==='function';
 return async(req,res)=>{
  const path=String(req.url??'').split('?')[0];
  if(path!==DASH_PATH)return false;
  if(req.method!=='GET'){res.writeHead(405,headers);res.end('');return true;}
  if(!enabled){res.writeHead(404,headers);res.end(frame('<h1>Indisponible</h1>'));return true;}
  if(!secureAuth(req.headers.authorization,password)){
   res.writeHead(401,{...headers,'www-authenticate':'Basic realm="CryptoJuju TradingView privé", charset="UTF-8"'});
   res.end(frame('<h1>Accès privé</h1><p>Authentification requise.</p>'));return true;
  }
  try{
   const snapshot=await store.dashboardSnapshot();
   res.writeHead(200,headers);
   res.end(renderTradingViewPrivateDashboard(snapshot));
  }catch{
   res.writeHead(503,headers);
   res.end(frame('<h1>Base temporairement indisponible</h1>'));
  }
  return true;
 };
}
