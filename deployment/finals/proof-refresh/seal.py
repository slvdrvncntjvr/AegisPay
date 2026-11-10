"""Seal precisely the CLI dry-run upload and check its local import closure."""
from pathlib import Path
import json,hashlib,re,datetime
ROOT=Path(__file__).resolve().parents[3]; OUT=ROOT/'docs/evidence/finals-proof-deployment'
manifest=json.loads((OUT/'source-closure-manifest.json').read_text()); stage=Path(manifest['stage'])
dry=json.loads((OUT/'deploy-dry.json').read_text())
allowed={f['path']:f for f in manifest['files']}
allowed['apps/web/next-env.d.ts']={'provenance':'Next16.4.5 generated declaration during isolated production build'}
files=[];imports=[];unresolved=[]
for f in dry['files']:
    name=f['path']; assert name in allowed, 'Unexpected upload path: '+name
    data=(stage/name).read_bytes(); sha=hashlib.sha256(data).hexdigest()
    if 'sha256' in allowed[name]: assert sha==allowed[name]['sha256'], 'Changed staged source: '+name
    files.append({'path':name,'sha256':sha,'bytes':len(data),'provenance':allowed[name]['provenance']})
    if name.endswith(('.ts','.tsx')):
        for dep in re.findall(r'(?:from\s+|import\s*)[\"\x27]([^\"\x27]+)[\"\x27]',data.decode()):
            if not dep.startswith('.'): imports.append({'from':name,'to':dep,'kind':'package'});continue
            target=(stage/name).parent/dep
            found=next((p for p in [target,target.with_suffix('.ts'),target.with_suffix('.tsx'),target/'index.ts',target/'index.tsx',target.with_suffix('.css')] if p.is_file()),None)
            if not found:unresolved.append({'from':name,'to':dep})
            else:imports.append({'from':name,'to':found.relative_to(stage).as_posix(),'kind':'local'})
checks=[{'path':f['path'],'matches':hashlib.sha256((ROOT/f['path']).read_bytes()).hexdigest()==f['sha256']} for f in json.loads((ROOT/'docs/evidence/finals-ui/source-manifest.json').read_text())['files']]
assert all(f['matches'] for f in checks)
assert not unresolved
report={'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':files,'fileCount':len(files),'bytes':sum(f['bytes'] for f in files),'imports':imports,'unresolved':unresolved,'acceptedSourceChecks':checks,'localBuildId':(stage/'apps/web/.next/BUILD_ID').read_text().strip(),'node':'24.22.1','next':'16.4.5','pnpm':'12.18.0'}
(OUT/'upload-manifest.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'files':len(files),'bytes':report['bytes'],'unresolved':len(unresolved),'acceptedMismatches':sum(not f['matches'] for f in checks)}))
