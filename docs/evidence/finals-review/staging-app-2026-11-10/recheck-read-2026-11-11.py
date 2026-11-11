"""Static recheck reader; preserves all original review artifacts."""
import hashlib
import json
import sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
manifest = Path(__file__).with_name('recheck-fingerprints-2026-11-11.json')
records = json.loads(manifest.read_text()) if manifest.exists() else []
def compact(value):
    if isinstance(value, dict):
        return {k: ({'omitted_array_count': len(v)} if k in ('diagnostics','inventory','files','public_files','public_inventory','application_source_files','build_files') and isinstance(v,list) else {'count':len(v),'all_statuses_expected':all(x.get('status')==x.get('expected') for x in v)} if k=='http' and isinstance(v,list) else compact(v)) for k,v in value.items()}
    return [compact(v) for v in value] if isinstance(value,list) else value
for arg in sys.argv[1:]:
    name, _, span = arg.partition('::')
    path = Path(name)
    if any(p.startswith('.env') or p.lower() in ('private','secrets','custody','.fmd-work') for p in path.parts):
        raise ValueError('Excluded path')
    before = path.read_bytes()
    lines = before.decode('utf-8-sig').splitlines()
    print('FILE',name,'SHA256',hashlib.sha256(before).hexdigest())
    if span == 'json':
        print(json.dumps(compact(json.loads(before)),indent=2))
    else:
        start,end = map(int,span.split('-')) if span else (1,len(lines))
        for n in range(max(1,start), min(end,len(lines))+1):
            print(f'{n}: {lines[n-1]}')
    after = path.read_bytes()
    records.append({'path':name,'sha256_before':hashlib.sha256(before).hexdigest(),'sha256_after':hashlib.sha256(after).hexdigest(),'stable':before==after,'selection':span or 'all'})
    manifest.write_text(json.dumps(records,indent=2)+'\n')
    print('READ_STABLE',before==after)
