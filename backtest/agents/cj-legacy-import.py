#!/usr/bin/env python3
"""Recover 13 expiring Actions archives and import their exact SHA256-deduped
contents via OIDC into the private CryptoJuju Postgres. No local credentials.
Idempotent: verifies the pre-reviewed 2026-11-24 408/491 manifest before POST.
"""
import base64, gzip, hashlib, json, os, pathlib, subprocess, tempfile, urllib.request, time

REPO='parentjustin45-collab/Cryptojuju-charts'
ENDPOINT='https://cryptojuju-api.onrender.com/api/internal/legacy-import'
DATASET='CJ-HISTORICAL-DEDUP-V1-20261124'
REF_SHA='ab76d0f162c8f836b9d21586e594a457b6b9667b10548be3eccf3f8cdd2a7a3b'
OBJECT_SHA='d8578e4e2c084d5908e708760426a680bde6655d457832d3f20a248a42d4d889'
# GitHub run, artifact name, artifact id, original file alias, expiration.
ARTIFACTS=[
(44570395075,'cj-BITUNIX-DAILY-1D-VECTOR-RESEARCH',14553812202,'CJ-BTC-Daily-1D.zip','2026-11-26T16:49:32Z'),
(44576292892,'cj-FIVE-MARKET-DAILY-1H-VECTOR-RESEARCH',14555524207,'CJ-Five-Market-Daily-1H.zip','2026-11-26T17:21:55Z'),
(44579356831,'cj-VECTOR-DAILY-OLDER-1H-NONOVERLAP-RESEARCH',14556179411,'CJ-Vector-Older-1H.zip','2026-11-26T17:39:03Z'),
(44586140019,'cj-BTC-DAILY-MTF-VECTOR-RESEARCH',14560354562,'CJ-BTC-Daily-MTF.zip','2026-11-26T18:17:13Z'),
(44587414229,'cj-FIVE-MARKET-DAILY-15M-1H-4H-VECTOR-RESEARCH',14561024011,'CJ-FIVE-MTF-19Nov.zip','2026-11-26T18:25:00Z'),
(44629325163,'cj-SIX-RECOVERED-SIGNALS-EXACT-SOURCE-REPLAY',14580018592,'CJ-Six-signals.zip','2026-11-26T22:31:01Z'),
(44664591781,'cj-CIPHER-WT-V1-INITIAL-RESEARCH',14597356667,'CJ-Cipher-1h.zip','2026-11-27T02:59:34Z'),
(44664591820,'cj-MOMENTUM-VECTOR-1H-INTEGRATED-RESEARCH',14597676036,'CJ-Momentum-Vector-1h.zip','2026-11-27T02:59:34Z'),
(44664591778,'cj-CIPHER-CONFIRM1-FIXED-ARCHIVE-ATR',14597870776,'CJ-Cipher-Confirm1.zip','2027-02-18T02:59:20Z'),
(44664591762,'cj-VECTOR-1H-INTEGRATED-ATR-RECOVERY-RESEARCH',14597905685,'CJ-Vector-1h.zip','2026-11-27T02:59:38Z'),
(44906431777,'cj-FIVE-MARKET-DAILY-15M-1H-4H-VECTOR-RESEARCH',14707958267,'CJ-5-market-Daily-MTF.zip','2026-11-28T12:58:13Z'),
(44958734682,'cj-BITUNIX-REAL-DATA-AND-VECTOR-V11-RESEARCH',14727729006,'CJ-Bitunix-Real-Data.zip','2026-11-28T22:50:18Z'),
(44958734760,'cj-FIVE-MARKET-DAILY-15M-1H-4H-VECTOR-RESEARCH',14728821271,'CJ-Failed-5-market.zip','2026-11-28T22:50:36Z'),
]
sha=lambda b:hashlib.sha256(b).hexdigest()

def oidc():
    url=os.environ['ACTIONS_ID_TOKEN_REQUEST_URL']
    url+=('&' if '?' in url else '?')+'audience=cryptojuju-legacy-import-v1'
    req=urllib.request.Request(url,headers={'Authorization':'Bearer '+os.environ['ACTIONS_ID_TOKEN_REQUEST_TOKEN']})
    with urllib.request.urlopen(req,timeout=12) as r: return json.load(r)['value']

def post(payload):
    data=gzip.compress(json.dumps(payload,sort_keys=True,separators=(',',':')).encode(),compresslevel=6)
    for attempt in range(3):
        token=oidc()
        req=urllib.request.Request(ENDPOINT,method='POST',data=data,headers={
            'Authorization':'Bearer '+token,'Content-Type':'application/octet-stream',
            'Accept':'application/json'})
        try:
            with urllib.request.urlopen(req,timeout=70) as response:
                answer=json.load(response)
                if answer.get('status') not in ('BATCH_VERIFIED','IMPORTED_VERIFIED'):
                    raise RuntimeError('Unexpected import receipt')
                return answer
        except Exception as e:
            if attempt==2:
                # Don't log auth token, request bodies or access tokens.
                raise RuntimeError('Import POST failed after retries: '+str(e).split('?')[0]) from None
            time.sleep(2*(attempt+1))

def main():
    if not os.environ.get('GH_TOKEN'):raise SystemExit('GH_TOKEN missing')
    refs=[];objects={}
    with tempfile.TemporaryDirectory(prefix='cj-legacy-import-') as tmp:
        for run_id,name,aid,alias,expiry in ARTIFACTS:
            folder=pathlib.Path(tmp)/str(aid)
            folder.mkdir()
            cmd=['gh','run','download',str(run_id),'--repo',REPO,
                 '--name',name,'--dir',str(folder)]
            subprocess.run(cmd,check=True,timeout=125,
                stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            seen=0
            for path in sorted(folder.rglob('*')):
                if not path.is_file():continue
                rel=path.relative_to(folder).as_posix()
                if '..' in pathlib.PurePosixPath(rel).parts:raise RuntimeError('Unsafe path')
                body=path.read_bytes();digest=sha(body)
                old=objects.setdefault(digest,body)
                if old!=body:raise RuntimeError('SHA collision or mismatch')
                refs.append({'github_artifact_id':aid,'original_path':rel,'sha256':digest,
                    'source_run_url':f'https://github.com/{REPO}/actions/runs/{run_id}',
                    'source_archive':alias,'original_github_expiry_utc':expiry})
                seen+=1
            print(f'RECOVERED id={aid} files={seen}')
    if len(refs)!=491 or len(objects)!=408 or len(ARTIFACTS)!=13:
        raise RuntimeError('Historical package size mismatch; no import performed')
    ref_lines=sorted('\t'.join([str(x['github_artifact_id']),x['original_path'],x['sha256']]) for x in refs)
    object_lines=sorted(objects)
    if sha('\n'.join(ref_lines).encode())!=REF_SHA or sha('\n'.join(object_lines).encode())!=OBJECT_SHA:
        raise RuntimeError('Historical source checksum mismatch; no import performed')
    print('SOURCE_VERIFIED exact 491 file references, 408 unique SHA256 objects, 13 archives')
    for start in range(0,len(object_lines),8):
        batch=object_lines[start:start+8]
        items=[{'sha256':k,'content_b64':base64.b64encode(objects[k]).decode('ascii')} for k in batch]
        receipt=post({'dataset':DATASET,'kind':'objects','items':items})
        print(f'OBJECTS {min(start+8,len(object_lines))}/{len(object_lines)} {receipt["status"]}')
    refs.sort(key=lambda r:(str(r['github_artifact_id']),r['original_path'],r['sha256']))
    for start in range(0,len(refs),40):
        items=refs[start:start+40]
        receipt=post({'dataset':DATASET,'kind':'references','items':items})
        print(f'REFS {min(start+40,len(refs))}/{len(refs)} {receipt["status"]}')
    result=post({'dataset':DATASET,'kind':'finalize','items':[]})
    if result['objects']!=408 or result['references']!=491:raise RuntimeError('Receipt counts invalid')
    print('CJ_LEGACY_IMPORT_CONFIRMED '+json.dumps(result,sort_keys=True))

if __name__=='__main__':main()
