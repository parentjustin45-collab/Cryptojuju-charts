/*
 * Frank Test v2.2 — research-only closed-bar JS port of frankCalc() in
 * CryptoJuju Charts index.html, dev/v1.26.0, lines 1041-1075.
 * It is NOT a TradingView/Pine parity claim or an implementation of distinct
 * Strict/Aggressive Pine presets. Divergences appear ONLY at right pivot
 * confirmation (2 bars later), never backdated to the pivot bar.
 * No background agent, orders or promotions.
 */
const finite=x=>typeof x==='number'&&Number.isFinite(x);
export function traceFrank(candles){
  if(!Array.isArray(candles)||candles.length<30)throw Error('FRANK_NEEDS_CLOSED_HISTORY');
  let previous=-Infinity;
  for(const c of candles){
    if(!Number.isSafeInteger(c?.time)||c.time<=previous||
      ![c.open,c.high,c.low,c.close,c.volume].map(Number).every(Number.isFinite)||
      c.open<=0||c.low<=0||c.close<=0||c.high<Math.max(c.open,c.close)||
      c.low>Math.min(c.open,c.close)||c.volume<0)
      throw Error('FRANK_INVALID_CLOSED_OHLC');
    previous=c.time;
  }
  const n=candles.length,close=candles.map(x=>x.close);
  function rsiArr(len){
    const out=new Array(n).fill(NaN);
    if(n<=len)return out;
    let g=0,l=0;
    for(let i=1;i<=len;i++){
      const d=close[i]-close[i-1];g+=Math.max(d,0);l+=Math.max(-d,0);
    }
    g/=len;l/=len;out[len]=l===0?100:100-100/(1+g/l);
    for(let i=len+1;i<n;i++){
      const d=close[i]-close[i-1];
      g=(g*(len-1)+Math.max(d,0))/len;
      l=(l*(len-1)+Math.max(-d,0))/len;
      out[i]=l===0?100:100-100/(1+g/l);
    }
    return out;
  }
  function smaA(a,len){
    const out=new Array(n).fill(NaN),q=[];let sum=0;
    for(let i=0;i<n;i++){
      const v=a[i];q.push(v);
      if(finite(v))sum+=v;
      if(q.length>len){const z=q.shift();if(finite(z))sum-=z;}
      if(q.length===len&&q.every(finite))out[i]=sum/len;
    }
    return out;
  }
  function emaA(a,len){
    const out=new Array(n).fill(NaN),k=2/(len+1);let v=NaN;
    for(let i=0;i<n;i++){
      if(!finite(a[i]))continue;
      v=finite(v)?a[i]*k+v*(1-k):a[i];
      out[i]=v;
    }
    return out;
  }
  const rsi=rsiArr(10),st=new Array(n).fill(NaN);
  for(let i=0;i<n;i++){
    if(i>=9&&finite(rsi[i])){
      const a=rsi.slice(i-9,i+1).filter(finite);
      if(a.length===10){
        const lo=Math.min(...a),hi=Math.max(...a);
        st[i]=hi===lo?50:100*(rsi[i]-lo)/(hi-lo);
      }
    }
  }
  const k=smaA(st,2),d=smaA(k,2),mom=new Array(n).fill(NaN);
  for(let i=6;i<n;i++)
    mom[i]=close[i-6]===0?0:100*(close[i]-close[i-6])/close[i-6];
  const raw=new Array(n).fill(NaN);
  for(let i=0;i<n;i++)if([rsi[i],k[i],d[i],mom[i]].every(finite))
    raw[i]=(rsi[i]+k[i]+d[i])/3+mom[i];
  const trend=emaA(raw,2),slow=emaA(trend,12),
    ef=emaA(close,8),es=emaA(close,21);
  const buy=[],sell=[];
  for(let i=1;i<n;i++){
    if(!finite(trend[i])||!finite(trend[i-1]))continue;
    const buyRaw=(trend[i]>22&&trend[i-1]<=22)||
      (trend[i]<18&&trend[i]>trend[i-1]&&k[i]>k[i-1]);
    const sellRaw=(trend[i]<76&&trend[i-1]>=76)||
      (trend[i]>82&&trend[i]<trend[i-1]&&k[i]<k[i-1]);
    if(buyRaw&&ef[i]>es[i])buy.push(i);
    if(sellRaw&&ef[i]<es[i])sell.push(i);
  }
  const pivLow=i=>{
    for(let j=i-2;j<=i+2;j++)
      if(j!==i&&candles[j].low<=candles[i].low)return false;
    return true;
  };
  const pivHigh=i=>{
    for(let j=i-2;j<=i+2;j++)
      if(j!==i&&candles[j].high>=candles[i].high)return false;
    return true;
  };
  const lows=[],highs=[],divs=[];
  const confirmed=(type,p,i,va,vb)=>divs.push({
    type,pivotIndex:i,previousPivotIndex:p.i,
    pivotTime:candles[i].time,previousPivotTime:candles[p.i].time,
    confirmationIndex:i+2,confirmationTime:candles[i+2].time,
    va,vb,signalTimeConvention:'confirmed-candle-open',
    firstExecutableOpen:candles[i+3]?.time??null
  });
  for(let i=2;i<n-2;i++){
    if(pivLow(i)){
      for(let z=Math.max(0,lows.length-2);z<lows.length;z++){
        const p=lows[z];
        if(candles[i].low<p.p&&trend[i]>p.o){
          confirmed('R+',p,i,p.o,trend[i]);break;
        }
        if(candles[i].low>p.p&&trend[i]<p.o){
          confirmed('H+',p,i,p.o,trend[i]);break;
        }
      }
      lows.push({i,p:candles[i].low,o:trend[i]});if(lows.length>10)lows.shift();
    }
    if(pivHigh(i)){
      for(let z=Math.max(0,highs.length-2);z<highs.length;z++){
        const p=highs[z];
        if(candles[i].high>p.p&&trend[i]<p.o){
          confirmed('R-',p,i,p.o,trend[i]);break;
        }
        if(candles[i].high<p.p&&trend[i]>p.o){
          confirmed('H-',p,i,p.o,trend[i]);break;
        }
      }
      highs.push({i,p:candles[i].high,o:trend[i]});if(highs.length>10)highs.shift();
    }
  }
  return {protocol:'CJ_FRANK_TEST_V22_WEBAPP_RESEARCH_PORT_V1',
    priceSource:'closed Bitunix LAST_PRICE',
    trace:{rsi,st,mom,raw,ef,es},
    oscillator:trend,slow,k,d,
    histogram:trend.map((v,i)=>finite(v)&&finite(slow[i])?v-slow[i]:NaN),
    buy:buy.map(i=>({barIndex:i,confirmedAt:candles[i].time,
      firstExecutableOpen:candles[i+1]?.time??null,side:'long'})),
    sell:sell.map(i=>({barIndex:i,confirmedAt:candles[i].time,
      firstExecutableOpen:candles[i+1]?.time??null,side:'short'})),
    divergences:divs,
    independentTradingViewParity:false,strictAggressiveModesImplemented:false,
    noOrders:true,notFinancialAdvice:true};
}
