"""Bounded, unauthenticated reads of immutable official source; no Gas calls.

Run from repo root: python docs/evidence/finals-provider/panel-investigation-2026-11-10/inspect-panel.py
Writes only to this investigation directory. Screenshot originals are copied byte-for-byte.
"""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import shutil
import urllib.request

ROOT = Path(__file__).resolve().parent
COMMIT = 'c63b3308ad69d2c5a919f94052571a38a2188121'
FILES = [
    'apps/web/features/projects/gas-activity.tsx',
    'apps/web/features/projects/project-gas.tsx',
    'packages/backend/convex/gas/queries.ts',
    'packages/backend/convex/gas/submit.ts',
    'apps/web/core/api/gas-route-handlers.ts',
    'packages/ui/src/components/ui/sheet.tsx',
    'packages/ui/package.json',
    'apps/web/features/projects/gas-ui.ts',
    'packages/backend/convex/gas/execution.ts',
    'packages/backend/convex/gas/authorization.ts',
    'packages/backend/convex/gas/projections.ts',
    'packages/backend/convex/gas/settlement.ts',
]
IMAGES = [
    ('dashboard.png', 'orca-paste-1794295244274-1e372992-faec-44d0-af74-43c86ff2c187.png'),
    ('activity.png', 'orca-paste-1794295269106-814e1d7a-ca6e-4eab-9fa3-dd0ef7f946ee.png'),
    ('detail-unavailable.png', 'orca-paste-1794295299526-f3447f5e-9cdd-44af-8430-2ab4b1b1d836.png'),
    ('flash-detail.png', 'orca-paste-1794295442774-c2fcb651-10b8-42f8-a83b-1a3b939d9053.png'),
]


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def fetch(paths):
    records = []
    for path in paths:
        url = f'https://raw.githubusercontent.com/Velo-Ecosystem-Collection/Velo/{COMMIT}/{path}'
        request = urllib.request.Request(url, headers={'User-Agent': 'AegisPay-readonly-panel-research'})
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = response.read(300001)
            status = response.status
        if len(raw) > 300000:
            raise ValueError('Public source exceeds bounded read')
        target = ROOT / 'source' / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
        records.append({'path': path, 'url': url, 'http_status': status,
                        'bytes': len(raw), 'sha256': digest(raw),
                        'line_count': len(raw.decode('utf-8').splitlines())})
    return records


if __name__ == '__main__':
    source_records = fetch(FILES)
    images = []
    for name, filename in IMAGES:
        original = Path('C:/Users/Vincent/AppData/Local/Temp') / filename
        target = ROOT / 'screenshots' / name
        target.parent.mkdir(exist_ok=True)
        shutil.copyfile(original, target)
        raw = target.read_bytes()
        assert digest(raw) == digest(original.read_bytes())
        images.append({'copy': str(target.relative_to(ROOT)).replace('\\', '/'),
                       'original_path': str(original), 'sha256': digest(raw), 'bytes': len(raw),
                       'provenance': 'Voluntarily supplied by user; unmodified byte-for-byte copy; capture timestamp not independently verified'})
    report = {'observed_at_utc': datetime.now(timezone.utc).isoformat(),
              'public_source_commit': COMMIT, 'deployed_version_verified': False,
              'provider_gas_calls': 0, 'authenticated_http_requests': 0,
              'source_files': source_records, 'screenshots': images}
    (ROOT / 'provenance.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'source_files': len(source_records), 'unmodified_screenshot_copies': len(images),
                      'provider_gas_calls': 0}))
