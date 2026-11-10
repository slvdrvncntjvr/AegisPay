"""Fetch a bounded public Velo source set, never authenticated project data.

Only provenance, file hashes, and fixed semantic line references are persisted.
Source bodies stay in memory; this script sends no Gas requests.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import datetime
import hashlib
import json
import re
import urllib.request

COMMIT = 'c63b3308ad69d2c5a919f94052571a38a2188121'
REPO = 'https://raw.githubusercontent.com/Velo-Ecosystem-Collection/Velo/'
FILES = [
    'apps/web/core/api/gas-route-handlers.ts',
    'packages/backend/convex/gas/submit.ts',
    'packages/backend/convex/gas/public_api.ts',
    'packages/backend/convex/gas/public_api_internal.ts',
    'packages/backend/convex/gas/queries.ts',
    'packages/backend/convex/gas/authorization.ts',
    'packages/backend/convex/gas/execution.ts',
    'packages/backend/convex/gas/execution_action.ts',
    'packages/backend/convex/gas/reconciliation.ts',
    'packages/backend/convex/gas/reconciliation_action.ts',
    'apps/web/features/projects/project-gas.tsx',
    'apps/web/features/projects/gas-activity.tsx',
    'docs/velo-gas-station.md',
]
PATTERN = re.compile(r'409|handoff_unavailable|reservation_expired|claimed|submission_unknown|export (?:const|async function|function)|getStatus|listRecent|useQuery|query\(|requireProject|owner|reconcil', re.I)


def fetch(path):
    url = REPO + COMMIT + '/' + path
    try:
        request = urllib.request.Request(url, headers={'User-Agent': 'AegisPay-readonly-provider-research'})
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = response.read(300000)
            status = response.status
        source = raw.decode('utf-8')
        lines = source.splitlines()
        references = [{'line': i + 1, 'source': line.strip()} for i, line in enumerate(lines) if PATTERN.search(line)]
        return {'path': path, 'url': url, 'http_status': status, 'sha256': hashlib.sha256(raw).hexdigest(),
                'line_count': len(lines), 'semantic_references': references}
    except Exception as error:
        return {'path': path, 'url': url, 'error_type': type(error).__name__}


with ThreadPoolExecutor(max_workers=4) as executor:
    files = list(executor.map(fetch, FILES))
report = {'observed_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'public_source_commit': COMMIT, 'deployed_server_commit_verified': False,
          'gas_api_calls': 0, 'files': files}
target = Path(__file__).parent / 'primary-source-index.json'
target.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'public_source_commit': COMMIT,
                  'files': [{'path': f['path'], 'http_status': f.get('http_status'),
                             'error_type': f.get('error_type')} for f in files],
                  'gas_api_calls': 0}, indent=2))
