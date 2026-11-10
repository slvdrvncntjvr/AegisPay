"""Run the exact cached CLI with secure existing config and sanitized diagnostics."""
from pathlib import Path
import os,json,re,subprocess,sys
sys.stdout.reconfigure(encoding='utf-8',errors='replace')
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'docs/evidence/finals-proof-deployment'
STAGE=ROOT/'.fmd-work/proof-refresh-ctx77fd54'
CLI='C:/Users/Vincent/AppData/Local/npm-cache/_npx/29d463b7a51d914c/node_modules/vercel/dist/vc.js'
secrets=[]
auth=Path(os.environ['APPDATA'])/'com.vercel.cli/Data/auth.json'
if auth.exists():
    for value in json.loads(auth.read_text()).values():
        if isinstance(value,str) and len(value)>12:secrets.append(value)
for p in ROOT.glob('.env*.local'):
    for line in p.read_text(encoding='utf-8-sig').splitlines():
        m=re.match(r'\s*([A-Z_]+)\s*=\s*(.*)',line)
        if m and re.search('SECRET|TOKEN|PASSWORD|DATABASE_URL|API_KEY',m[1]):
            v=m[2].strip().strip('\"\'')
            if len(v)>=8:secrets.append(v)
cmd=['node',CLI]+sys.argv[2:]
process=subprocess.Popen(cmd,cwd=STAGE,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8',errors='replace')
with (OUT/sys.argv[1]).open('w',encoding='utf-8') as log:
    for line in process.stdout:
        for value in secrets:line=line.replace(value,'[REDACTED]')
        line=re.sub(r'([?&]x-vercel-protection-bypass=)[^&\s]+',r'\1[REDACTED]',line)
        print(line,end='',flush=True);log.write(line);log.flush()
sys.exit(process.wait())
