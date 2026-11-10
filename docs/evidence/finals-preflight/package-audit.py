"""Inspect source closure and installed tooling without installing or building."""
from pathlib import Path
import json, re, os, subprocess, datetime, urllib.request, urllib.error, socket
ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).parent
def readenv(path):
    result={}
    if path.exists():
        for line in path.read_text(encoding='utf-8-sig').splitlines():
            m=re.match(r'^([A-Z_][A-Z0-9_]*)=(.*)$',line)
            if m: result[m[1]]=m[2].strip().strip('\"\'')
    return result
entries=list((ROOT/'apps/web/src').rglob('*.ts'))+list((ROOT/'apps/web/src').rglob('*.tsx'))
seen=set(); unresolved=[]; external=set(); edges=[]
queue=entries[:]
while queue:
    path=queue.pop()
    if path in seen: continue
    seen.add(path)
    source=path.read_text(encoding='utf-8')
    for spec in re.findall(r'(?:from\s+|import\s*\(\s*|import\s+)[\'\"]([^\'\"]+)[\'\"]',source):
        target=None
        if spec.startswith('.'):
            raw=path.parent/spec
            candidates=[raw,Path(str(raw)+'.ts'),Path(str(raw)+'.tsx'),raw/'index.ts',raw/'index.tsx']
            if raw.suffix=='.js': candidates.extend([raw.with_suffix('.ts'),raw.with_suffix('.tsx')])
            target=next((p.resolve() for p in candidates if p.is_file()),None)
            if not target: unresolved.append({'from':path.relative_to(ROOT).as_posix(),'specifier':spec})
        elif spec.startswith('@aegispay/'):
            folder=spec.split('/')[1]
            target=ROOT/'packages'/folder/'src/index.ts'
            if not target.exists(): unresolved.append({'from':path.relative_to(ROOT).as_posix(),'specifier':spec});target=None
        else: external.add(spec)
        if target:
            edges.append({'from':path.relative_to(ROOT).as_posix(),'to':target.relative_to(ROOT).as_posix()})
            queue.append(target)
report={'observed_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'kind':'conservative static import closure including types; not a Next build','web_source_closure':sorted(p.relative_to(ROOT).as_posix() for p in seen),'edges':edges,'unresolved':unresolved,'external_specifiers':sorted(external),'currently_explicitly_excluded_reachable_files':sorted(p.relative_to(ROOT).as_posix() for p in seen if p.relative_to(ROOT).as_posix() in {'src/server/integrations/model.ts','src/server/integrations/velo.ts','src/server/integrations/spike-driver.ts','src/server/integrations/spike-journal.ts','src/server/integrations/stellar-evidence.ts'})}
report['tools']={}
for path in [Path(os.environ['LOCALAPPDATA'])/'node/corepack/v1/pnpm/12.18.0',Path(os.environ['LOCALAPPDATA'])/'pnpm/.tools/pnpm/12.18.0']:
    report['tools'][str(path)]={'exists':path.exists(),'immediate_filenames':sorted(p.name for p in path.iterdir()) if path.exists() else []}
worker=readenv(ROOT/'.env.worker.local')
key=worker.get('GEMINI_API_KEY');model=worker.get('AGENT_MODEL')
report['gemini_metadata']={'key_present':bool(key),'selected_model':model,'generation_attempted':False,'quota_verified':False}
if key and model and re.fullmatch(r'[a-zA-Z0-9_.-]+',model):
    try:
        req=urllib.request.Request('https://generativelanguage.googleapis.com/v1beta/models/'+model,headers={'x-goog-api-key':key})
        with urllib.request.urlopen(req,timeout=20) as response:
            data=json.loads(response.read());report['gemini_metadata'].update({'http_status':response.status,'model_name':data.get('name'),'supported_methods':data.get('supportedGenerationMethods')})
    except urllib.error.HTTPError as e: report['gemini_metadata']['http_status']=e.code
    except Exception as e: report['gemini_metadata']['error_type']=type(e).__name__
local=readenv(ROOT/'.env.integration.local')
port=local.get('AEGISPAY_POSTGRES_PORT')
if port and port.isdigit():
    sock=socket.socket();sock.settimeout(2)
    try: report['isolated_db_port']={'port':int(port),'tcp_reachable':sock.connect_ex(('127.0.0.1',int(port)))==0}
    finally:sock.close()
(OUT/'package-audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,indent=2))
