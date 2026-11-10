"""Memory-only exact-secret comparisons; report counts and safe paths only."""
from pathlib import Path
import json,os,re,sys,urllib.request
ROOT=Path(__file__).resolve().parents[3]
values=[]
for env in ROOT.glob('.env*.local'):
    for line in env.read_text(encoding='utf-8-sig').splitlines():
        m=re.match(r'\s*([A-Z_]+)\s*=\s*(.*)',line)
        if m and re.search(r'SECRET|TOKEN|KEY|PASSWORD|DATABASE_URL',m[1]) and not re.search('PUBLIC_KEY|RESOURCE_KEY',m[1]):
            v=m[2].strip().strip('\"\'')
            if len(v)>=8:values.append(v.encode())
for key,value in os.environ.items():
    if re.search(r'SECRET|TOKEN|PASSWORD|DATABASE_URL|API_KEY',key) and len(value)>=8:values.append(value.encode())
auth=Path(os.environ['APPDATA'])/'com.vercel.cli/Data/auth.json'
if auth.exists():
    t=json.loads(auth.read_text()).get('token')
    if t:
        values.append(t.encode())
        cfg=json.loads((auth.parent/'config.json').read_text())
        req=urllib.request.Request('https://api.vercel.com/v9/projects/prj_87hFYLDrQpbUsSlAgoFMsTIE7aTq?teamId='+cfg['currentTeam'],headers={'Authorization':'Bearer '+t})
        with urllib.request.urlopen(req,timeout=30) as response:
            for key in (json.load(response).get('protectionBypass') or {}):values.append(key.encode())
markers=[b'AEGIS_PRIVATE_QUICKSIGNAL_V1',b'AEGIS_PRIVATE_DEEPTRACE_V1',b'signedAgentXdr',b'signed_agent_xdr',b'encryptedEnvelope',b'signedEnvelopeXdr']
base=Path(sys.argv[1]).resolve(); paths=[]; hits=[]; count=0
for p in base.rglob('*'):
    if not p.is_file() or any(s in p.relative_to(base).parts for s in ['node_modules','.git','.vercel']) or p.name=='lock':continue
    data=p.read_bytes(); count+=1
    secret=sum(v in data for v in values); marker=sum(v in data for v in markers)
    # Stellar secret StrKeys and serialized transaction envelope fields.
    pattern=len(re.findall(rb'(?<![A-Z2-7])S[A-Z2-7]{55}(?![A-Z2-7])|(?:signedXdr|signedTransactionXdr|envelopeXdr)\s*["\x27]?\s*:',data))
    if secret or marker or pattern:hits.append({'path':str(p.relative_to(base)),'secretMatches':secret,'privateMarkers':marker,'signedOrKeyPatterns':pattern})
report={'base':str(base),'filesScanned':count,'knownValueCount':len(set(values)),'matches':hits,'matchCount':len(hits)}
(ROOT/'docs/evidence/finals-proof-deployment'/sys.argv[2]).write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report));sys.exit(bool(hits))
