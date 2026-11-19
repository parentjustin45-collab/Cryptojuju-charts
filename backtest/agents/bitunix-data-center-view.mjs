/*
 * Static, read-only Bitunix data-center snapshot.
 * This is NOT a live dashboard, indicator validation, or autonomous execution.
 */
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const fmt=x=>Number.isSafeInteger(x)?x.toLocaleString('fr-CA'):esc(x);
export function renderBitunixDataCenterHtml(summary) {
 if(summary?.protocol!=='CRYPTOJUJU_REAL_BITUNIX_DATA_INGEST_V1' ||
   !['PASS_PUBLIC_BITUNIX_DATA_WINDOWS','BLOCKED_OR_PARTIAL'].includes(summary.status) ||
   !Array.isArray(summary.checks)||summary.checks.length!==9 ||
   summary.checks.some(x=>!['BTCUSDT','ETHUSDT','SOLUSDT'].includes(x.symbol) ||
     !['15m','1h','4h'].includes(x.timeframe) ||
     !['DATA_READY_FOR_RESEARCH_ONLY','BLOCKED'].includes(x.status)))
   throw Error('Unknown/unverified Bitunix report');
 const rows=summary.checks.map(x=>{
   const ok=x.status==='DATA_READY_FOR_RESEARCH_ONLY', label=ok?'DONNÉES ACCEPTÉES':'BLOQUÉ';
   return `<tr><td>${esc(x.symbol)}</td><td>${esc(x.timeframe)}</td>
<td>${fmt(x.acceptedBars)} / ${fmt(x.requestedBars)}</td><td>${fmt(x.corrections)}</td>
<td><span class="tag ${ok?'good':'bad'}">${label}</span></td></tr>`;
 }).join('\n');
 const corrected=summary.checks.reduce((n,x)=>n+(Number.isSafeInteger(x.corrections)?x.corrections:0),0);
 const accepted=summary.checks.reduce((n,x)=>n+(Number.isSafeInteger(x.acceptedBars)?x.acceptedBars:0),0);
 return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark">
<title>CryptoJuju — Centre de données Bitunix</title>
<style>
:root{font-family:system-ui,-apple-system,sans-serif;color:#eaf7ee;background:#08150e}
*{box-sizing:border-box}body{max-width:1024px;margin:0 auto;padding:24px 16px 60px}
h1{font-size:clamp(1.5rem,4vw,2.5rem);margin:.3em 0}h2{font-size:1.18rem;margin:0 0 12px}
p{color:#bed4c3;line-height:1.5}.eyebrow{color:#85d39e;font-size:.8rem;letter-spacing:.08em;font-weight:bold}
.notice{border:1px solid #6b5630;background:#231e12;color:#ffe3aa;border-radius:12px;padding:12px 16px;margin:14px 0}
.panel{background:#10241a;border:1px solid #274936;border-radius:16px;padding:20px;margin:20px 0}
.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.metric{padding:16px;background:#1b3425;border-radius:12px}.metric strong{font-size:1.6rem;display:block;color:#9deab4}
.metric small{color:#b5c9bb}.scroll{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:620px}
td,th{text-align:left;padding:13px 10px;border-bottom:1px solid #294637;font-size:.91rem}
th{color:#b5c9bb}.tag{border:1px solid;border-radius:8px;padding:5px 8px;white-space:nowrap;font-size:.76rem}
.good{color:#affac4;border-color:#49815a}.bad{color:#ffb3aa;border-color:#bf6861}
footer{color:#b5c9bb;font-size:.82rem;line-height:1.6}
@media(max-width:600px){.cards{grid-template-columns:1fr}td,th{font-size:.82rem}}
</style></head><body>
<header><span class="eyebrow">CRYPTOJUJU CHARTS · DATA CENTER V1</span>
<h1>Bitunix · Centre de données</h1>
<p>Contrôle REST public LAST_PRICE · ${esc(summary.finishedAtUtc)}</p>
<div class="notice">PHOTOGRAPHIE D'UN TEST RÉEL — pas un flux en continu. Aucune comparaison indépendante exhaustive avec TradingView.</div>
</header>
<section class="panel"><h2>État des historiques vérifiés</h2><div class="cards">
<div class="metric"><small>Fenêtres acceptées</small><strong>${fmt(summary.passed)} / 9</strong></div>
<div class="metric"><small>Chandelles fermées</small><strong>${fmt(accepted)}</strong></div>
<div class="metric"><small>Corrections documentées</small><strong>${fmt(corrected)}</strong></div>
</div></section>
<section class="panel"><h2>BTC / ETH / SOL — 15M / 1H / 4H</h2>
<div class="scroll"><table><thead><tr><th>Symbole</th><th>UT</th><th>Chandelles</th><th>Corrections</th><th>Validation</th></tr></thead>
<tbody>${rows}</tbody></table></div></section>
<section class="panel"><h2>Statut technique</h2>
<p>${esc(summary.status)}. La preuve détaillée (OHLC brutes, SHA-256, corrections et raisons des blocages) est conservée dans les fichiers JSON du même artefact.</p>
<p>Signaux des indicateurs : NON VALIDÉS · Backtests automatiques : NON EXÉCUTÉS · Trading : DÉSACTIVÉ</p>
</section>
<footer>Source unique : Bitunix public Futures REST. Ce rapport est figé au moment du contrôle GitHub Actions. Il ne certifie pas la disponibilité continue, la précision TradingView ni la rentabilité d'une stratégie.</footer>
</body></html>\n`;
}
