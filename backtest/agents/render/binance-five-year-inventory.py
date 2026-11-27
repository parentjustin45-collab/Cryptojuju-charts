"""Public Binance USD-M inventory. No account, database, or trading.
Inventory is not a claim of candle continuity. Boundary archives verified by SHA.
"""
import csv,datetime as dt,hashlib,io,json,re,time,urllib.parse,urllib.request,zipfile,xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
UTC=dt.timezone.utc
START=dt.datetime(2021,11,24,tzinfo=UTC)
END=dt.datetime(2026,11,24,tzinfo=UTC)
SYMBOLS=['BTCUSDT','ETHUSDT','SOLUSDT','HYPEUSDT','1000PEPEUSDT']
FRAMES={'15m':900000,'30m':1800000,'1h':3600000,'4h':14400000,'1d':86400000}
BUCKET='https://s3-ap-northeast-1.amazonaws.com/data.binance.vision'
BASE='https://data.binance.vision/'
def get(url,limit=16*1024*1024):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'CryptoJuju-research/1.0'}),timeout=25) as resp:
                result=resp.read(limit+1)
                if len(result)>limit:raise ValueError('response too large')
                return result
        except Exception:
            if attempt==2:raise
            time.sleep(attempt+1)
def list_objects(prefix):
    token=None;out={}
    for _ in range(10):
        q={'list-type':'2','prefix':prefix,'max-keys':'1000'}
        if token:q['continuation-token']=token
        xml=ET.fromstring(get(BUCKET+'?'+urllib.parse.urlencode(q)))
        ns={'s':'http://s3.amazonaws.com/doc/2006-03-01/'}
        if not xml.tag.endswith('ListBucketResult'):raise ValueError('not bucket listing')
        for el in xml.findall('s:Contents',ns):
            k=el.findtext('s:Key',namespaces=ns)
            if not k.startswith(prefix) or k in out:raise ValueError('bad listing key')
            out[k]=int(el.findtext('s:Size',namespaces=ns))
        if xml.findtext('s:IsTruncated',namespaces=ns)=='false':return out
        nxt=xml.findtext('s:NextContinuationToken',namespaces=ns)
        if not nxt or nxt==token:raise ValueError('bad pagination')
        token=nxt
    raise ValueError('listing limit')
def months():
    d=START.replace(day=1)
    while d<END.replace(day=1):
        yield d.strftime('%Y-%m')
        d=d.replace(year=d.year+int(d.month==12),month=d.month%12+1)
def daily():
    d=END.replace(day=1)
    while d<END:
        yield d.strftime('%Y-%m-%d')
        d+=dt.timedelta(days=1)
def verified_sample(key,step):
    name=key.rsplit('/',1)[1]
    check=get(BASE+key+'.CHECKSUM',4096).decode().strip().split()
    if len(check)<2 or check[1].lstrip('*')!=name:raise ValueError('checksum filename')
    raw=get(BASE+key);sha=hashlib.sha256(raw).hexdigest()
    if sha!=check[0].lower():raise ValueError('checksum mismatch')
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        items=z.infolist()
        if len(items)!=1 or items[0].filename!=name[:-4]+'.csv' or items[0].file_size>32*1024*1024:raise ValueError('bad zip entry')
        rows=[]
        with z.open(items[0]) as f:
            for i,r in enumerate(csv.reader(io.TextIOWrapper(f,encoding='utf-8-sig'))):
                if i==0 and r[0] in ('open_time','Open time','openTime'):continue
                if len(r)!=12:raise ValueError('csv width')
                t=int(r[0]);o,h,l,c,v=map(float,r[1:6])
                import math
                if not all(map(math.isfinite,[o,h,l,c,v])) or t%step or int(r[6])!=t+step-1 or min(o,l,c)<=0 or h<max(o,c) or l>min(o,c) or v<0:raise ValueError('invalid OHLC')
                if rows and t!=rows[-1]+step:raise ValueError('sample gap')
                rows.append(t)
        if not rows:raise ValueError('empty sample')
    return dict(key=key,sha256=sha,zipBytes=len(raw),firstMs=rows[0],lastMs=rows[-1],bars=len(rows))
def inspect(task):
    symbol,tf=task;step=FRAMES[tf]
    mpre=f'data/futures/um/monthly/klines/{symbol}/{tf}/'
    dpre=f'data/futures/um/daily/klines/{symbol}/{tf}/'
    try:
        ml=list_objects(mpre)
        # Filter the S3 prefix itself to November 2026, not the entire daily archive.
        dl=list_objects(dpre+f'{symbol}-{tf}-2026-11-')
        planned=[(m,mpre+f'{symbol}-{tf}-{m}.zip',ml) for m in months()]+[(d,dpre+f'{symbol}-{tf}-{d}.zip',dl) for d in daily()]
        available=[dict(period=p,key=k,zipBytes=listing[k],checksumBytes=listing[k+'.CHECKSUM']) for p,k,listing in planned if k in listing and k+'.CHECKSUM' in listing]
        missing=[p for p,k,listing in planned if k not in listing or k+'.CHECKSUM' not in listing]
        if not available:raise ValueError('no archive pairs')
        first=available[0]['period'];internal=[p for p in missing if p>=first]
        samples=[verified_sample(k,step) for k in dict.fromkeys([available[0]['key'],available[-1]['key']])]
        start_ms=max(int(START.timestamp()*1000),samples[0]['firstMs'])
        end_ms=int(END.timestamp()*1000)
        last_ms=samples[-1]['lastMs']
        if last_ms!=end_ms-step:internal.append('TAIL_SAMPLE_NOT_AT_END')
        if start_ms%step or start_ms>=end_ms:raise ValueError('invalid scope')
        result=dict(status='INVENTORY_READY' if not internal else 'INVENTORY_GAPS',symbol=symbol,timeframe=tf,firstAvailableMs=start_ms,endMs=end_ms,targetBars=(end_ms-start_ms)//step,archiveCount=len(available),zipBytes=sum(x['zipBytes'] for x in available),leadingMissing=[p for p in missing if p<first],internalMissing=internal,samples=samples,available=available)
    except Exception as e:
        result=dict(status='BLOCKED',symbol=symbol,timeframe=tf,reason=str(e)[:250])
    print('CJ_BINANCE_INVENTORY '+json.dumps({k:v for k,v in result.items() if k not in ('available','leadingMissing')}),flush=True)
    return result
if __name__=='__main__':
    with ThreadPoolExecutor(max_workers=3) as pool:
        results=list(pool.map(inspect,[(s,t) for s in SYMBOLS for t in FRAMES]))
    folder=Path('binance-inventory');folder.mkdir(exist_ok=True)
    for s in SYMBOLS:
        (folder/(s+'.json')).write_text(json.dumps([r for r in results if r['symbol']==s],indent=2))
    ready=[r for r in results if r['status']=='INVENTORY_READY']
    print('CJ_BINANCE_INVENTORY_SUMMARY '+json.dumps(dict(ready=len(ready),expected=25,targetBars=sum(x['targetBars'] for x in ready),archives=sum(x['archiveCount'] for x in ready),zipBytes=sum(x['zipBytes'] for x in ready),scope='object inventory and boundary samples only')),flush=True)
    if len(ready)!=25:raise SystemExit(1)
