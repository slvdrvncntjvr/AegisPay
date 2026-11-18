"""Scan exact TASK-034 publish inputs against known private values without emitting them."""
from pathlib import Path
import json
import os
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/evidence/product-presentation-2026-11-18'
secrets = []
for path in ROOT.glob('.env*.local'):
    for line in path.read_text(encoding='utf-8-sig').splitlines():
        m = re.match(r'\s*([A-Z_0-9]+)\s*=\s*(.*)', line)
        if m and re.search(r'SECRET|TOKEN|PASSWORD|DATABASE_URL|API_KEY|SIGNING_KEY|ENCRYPTION_KEY', m[1]):
            value = m[2].strip().strip('"\'')
            if len(value) >= 16:
                secrets.append(value.encode())
auth = Path(os.environ['APPDATA']) / 'com.vercel.cli/Data/auth.json'
if auth.is_file():
    secrets += [v.encode() for v in json.loads(auth.read_text(encoding='utf-8')).values() if isinstance(v, str) and len(v) >= 16]
mode = sys.argv[1]
if mode == '--git':
    names = sorted(set(subprocess.check_output(['git', 'diff', '6494881', '--name-only'], cwd=ROOT, text=True).splitlines() + subprocess.check_output(['git', 'ls-files', '--others', '--exclude-standard'], cwd=ROOT, text=True).splitlines()))
    paths = [ROOT / n for n in names]
    for name in names:
        assert name == 'README.md' or name.startswith(('apps/web/src/', 'tests/e2e/', 'scripts/check-presentation', 'scripts/presentation-', 'docs/')), name
        if name.startswith('docs/evidence/'):
            assert name.startswith('docs/evidence/product-presentation-2026-11-18/'), name
elif mode == '--proof':
    stage = ROOT / '.fmd-work/presentation-proof-20261118'
    paths = [stage / row['path'] for row in json.loads((OUT / 'publish-proof-upload.json').read_text(encoding='utf-8'))['files']]
    paths += list((stage / 'apps/web/.next/static').rglob('*'))
else:
    raise SystemExit('Use --git or --proof')
hits = []
count = 0
for path in paths:
    if not path.is_file():
        continue
    data = path.read_bytes()
    count += 1
    matches = sum(value in data for value in secrets)
    patterns = len(re.findall(rb'(?<![A-Z2-7])S[A-Z2-7]{55}(?![A-Z2-7])', data))
    if matches or patterns:
        hits.append({'path': path.relative_to(ROOT).as_posix(), 'knownCredentialMatches': matches, 'secretKeyPatterns': patterns})
result = {'status': 'passed' if not hits else 'failed', 'scope': mode, 'filesScanned': count, 'knownCredentialMatches': sum(h['knownCredentialMatches'] for h in hits), 'hits': hits}
(OUT / ('publish-scan-'+mode[2:]+'.json')).write_text(json.dumps(result, indent=2)+'\n', encoding='utf-8')
print(json.dumps(result))
sys.exit(bool(hits))
