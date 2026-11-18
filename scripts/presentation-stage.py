"""Fresh TASK-034 proof-only packet; copies explicit public files, never prior guard receipts."""
from pathlib import Path
import datetime
import hashlib
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
STAGE = ROOT / '.fmd-work/presentation-proof-20261118'
OUT = ROOT / 'docs/evidence/product-presentation-2026-11-18'
FILES = [
    'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc', '.node-version', 'tsconfig.json',
    'apps/web/package.json', 'apps/server/package.json', 'packages/agent/package.json', 'packages/shared/package.json',
    'apps/web/next.config.ts', 'apps/web/tsconfig.json', 'apps/web/vercel.json',
    'apps/web/src/app/page.tsx', 'apps/web/src/app/console.tsx', 'apps/web/src/app/globals.css', 'apps/web/src/app/layout.tsx',
    'apps/web/src/components/visual.tsx', 'apps/web/src/lib/public-proof.ts', 'packages/shared/src/index.ts',
    'apps/web/public/icon.svg', 'apps/web/public/fonts/bricolage-grotesque.woff2',
    'apps/web/public/fonts/OFL-Bricolage-Grotesque.txt', 'apps/web/public/fonts/README.txt',
]
GENERATED = {
    'apps/web/src/app/api/health/route.ts': "import { healthSchema } from '@aegispay/shared';\nexport const runtime = 'nodejs';\nexport const dynamic = 'force-dynamic';\n// Public proof liveness only; no backend or payment readiness assertion.\nexport function GET() { return Response.json(healthSchema.parse({ status: 'ok', network: 'testnet' }), { headers: { 'Cache-Control': 'no-store' } }); }\n",
    '.vercelignore': 'node_modules\n**/node_modules\n**/.next\n.git\n.env*\n**/.env*\n.vercel\n',
    '.gitignore': 'node_modules/\n.next/\n.vercel/\n.env*\n',
}


def sha(data):
    return hashlib.sha256(data).hexdigest()


if sys.argv[1:] == ['--prepare']:
    assert not STAGE.exists(), 'Fresh namespace already exists; observe it rather than overwrite'
    rows = []
    for name in FILES + list(GENERATED):
        data = (ROOT / name).read_bytes() if name in FILES else GENERATED[name].encode()
        assert not re.search(rb'(?<![A-Z2-7])S[A-Z2-7]{55}(?![A-Z2-7])', data)
        target = STAGE / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        rows.append({'path': name, 'bytes': len(data), 'sha256': sha(data), 'provenance': 'canonical source' if name in FILES else 'public staging literal in scripts/presentation-stage.py'})
    receipt = {'observedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'stage': str(STAGE), 'files': rows,
               'omitted': ['login', 'authenticated API', 'worker', 'model implementation', 'server domain', 'fixtures', 'environment files', 'provider config', 'Git history']}
    (OUT / 'publish-proof-source.json').write_text(json.dumps(receipt, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({'status': 'prepared', 'files': len(rows), 'stage': str(STAGE)}))
elif sys.argv[1:] == ['--seal']:
    manifest = json.loads((OUT / 'publish-proof-source.json').read_text(encoding='utf-8'))
    allowed = {f['path']: f for f in manifest['files']}
    allowed['apps/web/next-env.d.ts'] = {'provenance': 'Next generated declaration'}
    dry = json.loads((OUT / 'publish-proof-dry.json').read_text(encoding='utf-8'))
    rows = []
    for file in dry['files']:
        name = file['path']
        assert name in allowed, 'Unexpected upload file: '+name
        data = (STAGE / name).read_bytes()
        if 'sha256' in allowed[name]:
            assert sha(data) == allowed[name]['sha256'], 'Staged file changed: '+name
        if name in FILES:
            assert data == (ROOT / name).read_bytes(), 'Canonical source changed: '+name
        rows.append({'path': name, 'bytes': len(data), 'sha256': sha(data), 'provenance': allowed[name]['provenance']})
    result = {'observedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'status': 'passed', 'files': rows,
              'filesCount': len(rows), 'bytes': sum(r['bytes'] for r in rows), 'node': '24.22.1', 'pnpm': '12.18.0', 'next': '16.4.5'}
    (OUT / 'publish-proof-upload.json').write_text(json.dumps(result, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({'status': 'passed', 'files': len(rows), 'bytes': result['bytes']}))
else:
    raise SystemExit('Use --prepare or --seal')
