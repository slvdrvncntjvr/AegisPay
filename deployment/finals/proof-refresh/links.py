"""Anonymous read-only destinations and unchanged submitted PDF comparison."""
from pathlib import Path
import urllib.request,urllib.error,json,hashlib,datetime,concurrent.futures
ROOT=Path(__file__).resolve().parents[3]; OUT=ROOT/'docs/evidence/finals-proof-deployment'
targets=[
'https://github.com/slvdrvncntjvr/AegisPay',
'https://github.com/slvdrvncntjvr/AegisPay/blob/main/docs/submission/AegisPay-pitch-draft.pdf',
'https://raw.githubusercontent.com/slvdrvncntjvr/AegisPay/main/docs/submission/AegisPay-pitch-draft.pdf',
'https://drive.google.com/drive/folders/1hqwzOaG_qU9axjcLIjBUb1YeMWdOFq72?usp=sharing',
'https://github.com/slvdrvncntjvr/AegisPay/blob/main/docs/evidence/testnet/spike-c080d947-714b-43cf-92d0-ad9ed7c01439-1794064999769.json',
'https://stellar.expert/explorer/testnet/tx/6e898ad830e866f0831577849361739cea7ad03cfbfcee9febf0fc057633d381',
'https://stellar.expert/explorer/testnet/tx/1d39c3e3d7f400475aa2686f173a943346c5870635731fbd62fa41f1f912fa7a',
'https://stellar.expert/explorer/testnet/tx/94cea8bb561576ab71d4419571b92bd2fe7d8eada1273ff16960a716160c9a18',
]
def check(url):
    try:
        req=urllib.request.Request(url,headers={'User-Agent':'AegisPay-public-proof-delivery-check'})
        with urllib.request.urlopen(req,timeout=30) as r:
            data=r.read(); row={'url':url,'status':r.status,'finalUrl':r.url,'bytes':len(data)}
            if 'raw.githubusercontent' in url:
                row['remotePdfSha256']=hashlib.sha256(data).hexdigest(); row['localPdfSha256']=hashlib.sha256((ROOT/'docs/submission/AegisPay-pitch-draft.pdf').read_bytes()).hexdigest();row['pdfBytesMatch']=row['remotePdfSha256']==row['localPdfSha256']
            return row
    except urllib.error.HTTPError as e:return {'url':url,'status':e.code}
    except Exception as e:return {'url':url,'errorType':type(e).__name__}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:rows=list(pool.map(check,targets))
report={'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'destinations':rows,'limit':'HTTP destination checks are not fresh transaction verification, actual video playback or submission eligibility.'}
(OUT/'external-links.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
