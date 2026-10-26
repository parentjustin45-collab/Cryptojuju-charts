/* Render TEST ONLY — self-contained browser data from frozen research math. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,s)=>{const full=path.join(root,p);
 fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,s);};
const SHA='0d8c4bbf4cf98420fd71a061f35d0e00b1b1b821';
const COMMIT='744da2b93772f3c5dfdb8876ffcc5784058819d9';
const original=read('backtest/vector-forward-v11-v14.mjs');
const hash=createHash('sha1')
 .update('blob '+Buffer.byteLength(original)+'\0').update(original).digest('hex');
if(hash!==SHA)throw Error('Locked Vector engine has changed; build forbidden');
let engine=original;
const nodeImport="import {pathToFileURL} from 'node:url';\n";
if(!engine.includes(nodeImport))throw Error('Node import not found');
engine=engine.replace(nodeImport,'');
const cli=/if\(process\.argv\[1\]&&import\.meta\.url===pathToFileURL\(process\.argv\[1\]\)\.href\)\{[\s\S]*\}\s*$/;
if(!cli.test(engine))throw Error('Node CLI block changed');
engine=engine.replace(cli,'');
for(const [from,to] of [
 ['process.env.GITHUB_REF_NAME??null',"'dev/v1.26.0 (browser)'"],
 ['process.env.GITHUB_SHA??null',"'"+COMMIT+"'"],
 ['process.env.GITHUB_RUN_ID??null','null']
]){
 if(!engine.includes(from))throw Error('Missing expected Node metadata: '+from);
 engine=engine.replace(from,to);
}
if(engine.includes("node:url")||engine.includes("process."))
 throw Error('Node API in dashboard engine');
write('watch-preview-dist/backtest/vector-forward-browser-engine.mjs',engine);
let dashboard=read('dashboard-dist/vector-forward-dashboard.html');
const anchor='<button class="control secondary" type="button" id="export" disabled>Exporter le résumé CSV</button>';
if(!dashboard.includes(anchor))throw Error('Dashboard controls changed');
dashboard=dashboard.replace(anchor,
 '<button class="control" type="button" id="refreshBitunix">Actualiser Bitunix</button>\n      '+anchor);
const meta='<p class="small" id="meta">';
if(!dashboard.includes(meta))throw Error('Dashboard status changed');
dashboard=dashboard.replace(meta,
 '<p id="autoState" role="status" aria-live="polite" class="small">Connexion Bitunix en attente.</p>\n    '+meta);
const notice="Ce tableau ne lit pas directement le marché et n'invente aucune transaction. Il affiche uniquement les observations présentes dans un rapport GitHub Actions que tu importes.";
if(!dashboard.includes(notice))throw Error('Old dashboard notice changed');
dashboard=dashboard.replace(notice,
 'Ce tableau lit les chandelles Bitunix publiques et recalcule le protocole verrouillé dans le navigateur. Actualisation toutes les 15 minutes seulement pendant que la page est ouverte; les rapports GitHub peuvent toujours être importés.');
dashboard=dashboard.replace('</body>',
 '<script type="module" src="./backtest/vector-forward-live.mjs"></script>\n</body>');
if((dashboard.match(/id="refreshBitunix"/g)||[]).length!==1)
 throw Error('Invalid refresh button count');
write('watch-preview-dist/vector-dashboard.html',dashboard);
console.log('Read-only browser dashboard built with immutable research engine '+SHA);
