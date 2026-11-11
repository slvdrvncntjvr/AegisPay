"""Read repaired public helpers once and retain new fingerprints only."""
import hashlib,json,sys
from datetime import datetime,timezone
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
out=Path(__file__).with_name('repair-fingerprints.json')
rows=json.loads(out.read_text()) if out.exists() else []
for name in sys.argv[1:]:
    p=Path(name)
    if p.is_absolute() or any(x.startswith('.env') or x in ('.fmd-work','custody','private','secrets') for x in p.parts):raise ValueError('Excluded path')
    b=p.read_bytes();a=p.read_bytes()
    rows.append({'path':p.as_posix(),'sha256':hashlib.sha256(b).hexdigest(),'sha256_after':hashlib.sha256(a).hexdigest(),'stable':a==b,'at':datetime.now(timezone.utc).isoformat()})
    print('FILE',name,'SHA256',rows[-1]['sha256'])
    for n,line in enumerate(b.decode('utf-8-sig').splitlines(),1):print(f'{n}: {line}')
out.write_text(json.dumps(rows,indent=2)+'\n')
