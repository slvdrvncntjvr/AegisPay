"""Exact anonymous-origin checks, including explicit public RSC response."""
from pathlib import Path
import urllib.request,urllib.error,json,datetime
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'docs/evidence/finals-proof-deployment'
base='https://aegispay-live.vercel.app'; rows=[]
for name,url,headers,expected in [
('root',base+'/',{},200),('health',base+'/api/health',{},200),
('rsc',base+'/?_rsc=proof-refresh-verification',{'RSC':'1'},200),
('app',base+'/app',{},404),('login',base+'/login',{},404),
('purchase',base+'/api/v1/runs',{},404),('catalog',base+'/api/v1/catalog',{},404),
('state',base+'/api/v1/state',{},404),('report',base+'/api/demo/quick-signal/demo-parser',{},404),
]:
    req=urllib.request.Request(url,headers=headers)
    try:r=urllib.request.urlopen(req,timeout=30)
    except urllib.error.HTTPError as e:r=e
    with r:
        data=r.read();row={'url':url,'status':r.status,'finalUrl':r.url,'contentType':r.headers.get('content-type'),'cacheControl':r.headers.get('cache-control'),'bytes':len(data),'expected':expected}
    (OUT/'production'/(name+'-anonymous.bin')).write_bytes(data);rows.append(row)
    assert row['status']==expected
    if name=='rsc':assert 'text/x-component' in row['contentType']
    if name=='health':assert json.loads(data)=={'status':'ok','network':'testnet'}
report={'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'anonymous':True,'headersContainCredentials':False,'checks':rows,'passed':True}
(OUT/'anonymous-origin-checks.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
