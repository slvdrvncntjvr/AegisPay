"""Local static-review reader; writes fingerprints only beside this script."""
import hashlib
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
root = Path.cwd()
manifest = Path(__file__).with_name('fingerprints.json')
records = json.loads(manifest.read_text()) if manifest.exists() else []
for arg in sys.argv[1:]:
    name, _, span = arg.partition('::')
    path = root / name
    if any(part.startswith('.env') or part.lower() in ('private', 'secrets', 'custody') for part in path.parts):
        raise ValueError('Excluded path')
    before = path.read_bytes()
    lines = before.decode('utf-8-sig').splitlines()
    start, end = (1, len(lines)) if span == 'json' or not span else map(int, span.split('-'))
    print(f'FILE {name} SHA256 {hashlib.sha256(before).hexdigest()} LINES {start}-{end}')
    if span == 'json':
        def compact(value):
            if isinstance(value, dict):
                return {k: ({'omitted_array_count': len(v)} if k in ('diagnostics', 'inventory', 'files', 'public_files') and isinstance(v, list) else compact(v)) for k, v in value.items()}
            if isinstance(value, list):
                return [compact(v) for v in value]
            return value
        print(json.dumps(compact(json.loads(before)), indent=2))
    else:
        for n in range(start, min(end, len(lines)) + 1):
            print(f'{n}: {lines[n-1]}')
    after = path.read_bytes()
    record = {'path': name, 'sha256_before': hashlib.sha256(before).hexdigest(), 'sha256_after': hashlib.sha256(after).hexdigest(), 'lines': [start, end], 'stable': before == after}
    records.append(record)
    print('READ_STABLE', record['stable'])
manifest.write_text(json.dumps(records, indent=2) + '\n')
