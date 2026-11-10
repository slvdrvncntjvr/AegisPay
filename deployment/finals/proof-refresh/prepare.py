"""Reproduce the restricted public-proof upload; never copy a source directory wholesale."""
from pathlib import Path
import hashlib, json, sys, datetime, re

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'docs/evidence/finals-proof-deployment'
stage_id = sys.argv[1] if len(sys.argv)>1 else 'ctx77fd54'
assert re.fullmatch(r'[a-zA-Z0-9_-]+',stage_id), 'Invalid staging ID'
STAGE = ROOT / ('.fmd-work/proof-refresh-'+stage_id)
def sha(data): return hashlib.sha256(data).hexdigest()
accepted = json.loads((ROOT/'docs/evidence/finals-ui/source-manifest.json').read_text())
checks = [{'path': f['path'], 'matches': sha((ROOT/f['path']).read_bytes()) == f['sha256']} for f in accepted['files']]
if not all(f['matches'] for f in checks):
    print(json.dumps(checks)); sys.exit('Accepted source changed; stop for review')
if STAGE.exists(): sys.exit('Unique staging directory already exists; refuse overwrite')
allowlist = [
    'package.json','pnpm-lock.yaml','pnpm-workspace.yaml','.npmrc','.node-version','tsconfig.json',
    'apps/web/package.json','apps/server/package.json','packages/agent/package.json','packages/shared/package.json',
    'apps/web/next.config.ts','apps/web/tsconfig.json','apps/web/vercel.json',
    'apps/web/src/app/page.tsx','apps/web/src/app/console.tsx','apps/web/src/app/globals.css','apps/web/src/app/layout.tsx',
    'apps/web/src/components/visual.tsx','apps/web/src/lib/public-proof.ts','packages/shared/src/index.ts',
    'apps/web/public/icon.svg','apps/web/public/fonts/bricolage-grotesque.woff2',
    'apps/web/public/fonts/OFL-Bricolage-Grotesque.txt','apps/web/public/fonts/README.txt',
]
generated = {
    'apps/web/src/app/api/health/route.ts': "import { healthSchema } from '@aegispay/shared';\nexport const runtime = 'nodejs';\nexport const dynamic = 'force-dynamic';\n// Public-proof slice liveness only; no backend, database or payment readiness check.\nexport function GET() { return Response.json(healthSchema.parse({ status: 'ok', network: 'testnet' }), { headers: { 'Cache-Control': 'no-store' } }); }\n",
    '.vercelignore': 'node_modules\n**/node_modules\n**/.next\n.git\n.env*\n**/.env*\n.vercel\n',
    '.gitignore': 'node_modules/\n.next/\n.vercel/\n.env*\n',
}
rows=[]
for name in allowlist:
    data=(ROOT/name).read_bytes(); target=STAGE/name; target.parent.mkdir(parents=True,exist_ok=True); target.write_bytes(data)
    rows.append({'path':name,'sha256':sha(data),'bytes':len(data),'provenance':'canonical byte-for-byte '+name})
for name, content in generated.items():
    data=content.encode(); target=STAGE/name; target.parent.mkdir(parents=True,exist_ok=True); target.write_bytes(data)
    rows.append({'path':name,'sha256':sha(data),'bytes':len(data),'provenance':'staging-only literal in deployment/finals/proof-refresh/prepare.py'})
OUT.mkdir(parents=True,exist_ok=True)
report={'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'stage':str(STAGE),'acceptedSourceChecks':checks,'files':rows,'omitted':['login route','authenticated API catchall','wallet helper','all apps/server implementation','all packages/agent implementation','all root src/server implementation','all env files','all protected fixtures and journals','provider config','.git'], 'note':'Workspace manifests are preserved for frozen root installation; absent private workspace implementation is unreachable. Health proves public slice liveness only. Generated Next next-env.d.ts is build scaffold, not canonical source.'}
(OUT/'source-closure-manifest.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'stage':str(STAGE),'files':len(rows),'acceptedHashes':len(checks),'mismatches':0}))
