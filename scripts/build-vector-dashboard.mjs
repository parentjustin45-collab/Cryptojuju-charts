/* Build one self-contained offline HTML. Never touches backend or main. */
import fs from 'node:fs';
import path from 'node:path';
const read=x=>fs.readFileSync(new URL(x,import.meta.url),'utf8');
let html=read('../backtest/vector-forward-dashboard.html');
let data=read('../backtest/vector-forward-dashboard-data.mjs');
let ui=read('../backtest/vector-forward-dashboard-ui.mjs');
data=data.replace(/^export /gm,'');
ui=ui.replace(/^import \{[\s\S]*?\}\s*from '\.\/vector-forward-dashboard-data\.mjs';\s*/m,'');
const tag='<script type="module" src="./vector-forward-dashboard-ui.mjs"></script>';
if(ui.startsWith('import ')||data.includes("export const")||!html.includes(tag))
 throw Error('Unexpected source module structure: dashboard build blocked');
html=html.replace(tag,"<script>\n'use strict';\n"+data+"\n"+ui+"\n</script>");
if(/<script\b[^>]*src=/i.test(html))throw Error('Unexpected remote dashboard script');
const out=path.resolve('dashboard-dist/vector-forward-dashboard.html');
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,html);
console.log('Self-contained, offline Vector dashboard ready: '+out);
