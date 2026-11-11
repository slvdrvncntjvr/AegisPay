"""Read-only public source snapshots; writes only a new reviewer manifest."""
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
out = Path(__file__).with_name('recheck2-fingerprints-2026-11-11.json')
if out.exists():
    raise SystemExit('Refusing to overwrite snapshot')
records = []
for name in sys.argv[1:]:
    p = Path(name)
    if any(x.startswith('.env') or x in ('.fmd-work', 'private', 'custody', 'secrets') for x in p.parts):
        raise ValueError('Excluded path')
    b = p.read_bytes()
    a = p.read_bytes()
    records.append({'path':name, 'sha256':hashlib.sha256(b).hexdigest(), 'sha256_after':hashlib.sha256(a).hexdigest(), 'stable':a==b})
    print('FILE', name, 'SHA256', records[-1]['sha256'])
    for n, line in enumerate(b.decode('utf-8-sig').splitlines(), 1):
        print(f'{n}: {line}')
with out.open('x', encoding='utf-8') as f:
    json.dump({'observed_at':datetime.now(timezone.utc).isoformat(), 'files':records}, f, indent=2)
    f.write('\n')
