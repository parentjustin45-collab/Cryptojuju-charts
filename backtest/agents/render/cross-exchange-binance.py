"""Read official USD-M futures monthly archives and verify published SHA256."""
import csv,datetime,hashlib,io,json,sys,urllib.request,zipfile,time
from pathlib import Path
symbol=sys.argv[1]
root=Path('cross-exchange-input');root.mkdir(exist_ok=True)
start=int(datetime.datetime(2026,9,1,tzinfo=datetime.timezone.utc).timestamp()*1000)
end=int(datetime.datetime(2026,10,1,tzinfo=datetime.timezone.utc).timestamp()*1000)
intervals={'15m':900000,'30m':1800000,'1h':3600000,'4h':14400000,'1d':86400000}
def get(url):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'CryptoJuju-research/1.0'}),timeout=30) as r:
                data=r.read(16*1024*1024+1)
                if len(data)>16*1024*1024: raise ValueError('archive too big')
                return data
        except Exception:
            if attempt==2: raise
            time.sleep(1+attempt)
def months(begin):
    d=datetime.datetime.fromtimestamp(begin/1000,datetime.timezone.utc).replace(day=1,hour=0,minute=0,second=0,microsecond=0)
    while d.timestamp()*1000<end:
        yield d.strftime('%Y-%m')
        d=d.replace(year=d.year+int(d.month==12),month=d.month%12+1)
for tf,step in intervals.items():
    try:
        begin=start-160*step;rows=[];receipts=[]
        for month in months(begin):
            name=f'{symbol}-{tf}-{month}.zip'
            url=f'https://data.binance.vision/data/futures/um/monthly/klines/{symbol}/{tf}/{name}'
            check=get(url+'.CHECKSUM').decode().strip().split()
            if len(check)<2 or check[1].lstrip('*')!=name: raise ValueError('checksum filename')
            raw=get(url);sha=hashlib.sha256(raw).hexdigest()
            if sha!=check[0].lower():raise ValueError('checksum mismatch')
            with zipfile.ZipFile(io.BytesIO(raw)) as z:
                entries=z.infolist()
                if len(entries)!=1 or entries[0].filename!=name[:-4]+'.csv' or entries[0].file_size>32*1024*1024: raise ValueError('bad archive entry')
                with z.open(entries[0]) as f:
                    for i,r in enumerate(csv.reader(io.TextIOWrapper(f,encoding='utf-8-sig'))):
                        if i==0 and r[0] in ('open_time','Open time','openTime'):continue
                        if len(r)!=12:raise ValueError('bad csv width')
                        t=int(r[0]);close=int(r[6])
                        if not begin<=t<end:continue
                        if close!=t+step-1:raise ValueError('close time mismatch')
                        rows.append(dict(time=t,open=float(r[1]),high=float(r[2]),low=float(r[3]),close=float(r[4]),volume=float(r[5])))
            receipts.append(dict(url=url,sha256=sha,bytes=len(raw)))
        obj=dict(status='READY',symbol=symbol,timeframe=tf,rows=rows,receipts=receipts)
    except Exception as e:
        obj=dict(status='BLOCKED',symbol=symbol,timeframe=tf,reason=str(e)[:200])
    (root/f'{symbol}-{tf}.json').write_text(json.dumps(obj,allow_nan=False))
    print('CJ_BINANCE_ARCHIVE '+json.dumps({k:v for k,v in obj.items() if k!='rows'}),flush=True)
