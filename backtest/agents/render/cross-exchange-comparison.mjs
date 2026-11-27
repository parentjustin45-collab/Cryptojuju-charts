/* Source comparison only. No data writes to Bitunix library, no trade. */
import {generateFrozen} from './prospective-validation.mjs';
import {createHash} from 'node:crypto';
export const START=Date.UTC(2026,8,1),END=Date.UTC(2026,9,1),WARMUP=160;
export const CHANNELS=['vector','momentum','speed','cipher','frank_cross','frank_divergence'];
const need=(v,m)=>{if(!v)throw Error(m)};
const sha=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function corr(a,b){if(a.length<2)return null;let n=a.length,ma=a.reduce((s,x)=>s+x,0)/n,mb=b.reduce((s,x)=>s+x,0)/n,c=0,va=0,vb=0;for(let i=0;i<n;i++){let x=a[i]-ma,y=b[i]-mb;c+=x*y;va+=x*x;vb+=y*y;}return va&&vb?c/Math.sqrt(va*vb):null;}
function quantile(a,p){const b=[...a].sort((x,y)=>x-y);return b[Math.floor((b.length-1)*p)];}
export function validateBars(bars,step,start,end){
 need(bars.length===(end-start)/step,'COUNT_MISMATCH');
 for(let i=0;i<bars.length;i++){const x=bars[i];need(x.time===start+i*step&&[x.open,x.high,x.low,x.close,x.volume].every(Number.isFinite)&&x.low>0&&x.open>0&&x.close>0&&x.volume>=0&&x.low<=Math.min(x.open,x.close)&&x.high>=Math.max(x.open,x.close),'BAD_CANDLE_'+i);}
}
export function matchEvents(a,b,step,radius){
 const bySide=new Map();for(let i=0;i<b.length;i++){let k=b[i].side+'|'+b[i].time;let x=bySide.get(k)??[];x.push(i);bySide.set(k,x);}
 const edges=[];for(let i=0;i<a.length;i++)for(let d=-radius;d<=radius;d++)for(const j of bySide.get(a[i].side+'|'+(a[i].time+d*step))??[])edges.push({i,j,d});
 edges.sort((x,y)=>Math.abs(x.d)-Math.abs(y.d)||x.i-y.i||x.j-y.j);
 const usedA=new Set(),usedB=new Set();let earlier=0,later=0,same=0,absLag=0;
 for(const e of edges){if(usedA.has(e.i)||usedB.has(e.j))continue;usedA.add(e.i);usedB.add(e.j);earlier+=Number(e.d<0);later+=Number(e.d>0);same+=Number(e.d===0);absLag+=Math.abs(e.d);}
 const matched=usedA.size;return {matched,bitunix:a.length,binance:b.length,earlier,later,same,meanAbsLag:matched?absLag/matched:null,f1:a.length+b.length?2*matched/(a.length+b.length):null};
}
function relative(rows,i){let s=0;for(let j=i-19;j<=i;j++)s+=rows[j].volume;return s>0?rows[i].volume/(s/20):null;}
export function comparePair(bit,bin,step,priceStep,{start=START,end=END,warmup=WARMUP}={}){
 const from=start-warmup*step;validateBars(bit,step,from,end);validateBars(bin,step,from,end);
 const close=[],retA=[],retB=[],volA=[],volB=[],relativeA=[],relativeB=[],fieldDiff={open:[],high:[],low:[],close:[]};let dir=0,volSumA=0,volSumB=0;
 for(let i=warmup;i<bit.length;i++){const a=bit[i],b=bin[i];for(const k of Object.keys(fieldDiff))fieldDiff[k].push(Math.abs(b[k]/a[k]-1)*10000);close.push((b.close/a.close-1)*10000);retA.push(Math.log(a.close/bit[i-1].close));retB.push(Math.log(b.close/bin[i-1].close));dir+=Number(Math.sign(a.close-a.open)===Math.sign(b.close-b.open));volA.push(a.volume);volB.push(b.volume);volSumA+=a.volume;volSumB+=b.volume;const x=relative(bit,i),y=relative(bin,i);if(x!==null&&y!==null){relativeA.push(x);relativeB.push(y);}}
 const channels={};for(const ch of CHANNELS){const get=bars=>generateFrozen(ch,'original',bars,priceStep).signals.filter(e=>e.time>=start&&e.time<end);const a=get(bit),b=get(bin);channels[ch]={exact:matchEvents(a,b,step,0),within1:matchEvents(a,b,step,1),within3:matchEvents(a,b,step,3)};}
 return {bars:close.length,priceStep,priceStepPolicy:'same Bitunix current quote precision on both feeds, not historical Binance tick',bitunixSha256:sha(bit),binanceSha256:sha(bin),ohlcAbsBps:Object.fromEntries(Object.entries(fieldDiff).map(([k,x])=>[k,{mean:x.reduce((s,v)=>s+v,0)/x.length,p95:quantile(x,.95),max:Math.max(...x)}])),meanSignedCloseBps:close.reduce((s,v)=>s+v,0)/close.length,returnCorrelation:corr(retA,retB),directionAgreement:dir/close.length,volumeCorrelation:corr(volA,volB),relativeVolumeCorrelation:corr(relativeA,relativeB),relativeVolumeSamples:relativeA.length,volumeRatio:volSumA?volSumB/volSumA:null,channels};
}
