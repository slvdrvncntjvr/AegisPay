"""Check the observed authorization-only drift without executing product code."""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

out=Path(__file__).parent
p=Path('deployment/finals/staging-app/qualify.ts')
b=p.read_bytes()
a=p.read_bytes()
sha=lambda v:hashlib.sha256(v).hexdigest()
before=b"authorization.dispatch==='ctx_b7e5bf88bb7d'"
after=b"authorization.dispatch==='ctx_95b52e773108'"
normalized=b.replace(after,before)
expected='09a5fa6911c05f8d5e856cd7f57f46b03c720bc15e62e10284dddd77960a0b6f'
base=Path('docs/evidence/finals-staging-app/completion-resume-2026-11-11T01-27Z')
records=[]
def read(name):
    q=base/name
    v=q.read_bytes()
    records.append({'path':q.as_posix(),'sha256':sha(v)})
    return json.loads(v)
binding=read('continuation-source-binding.json')
execution=read('continuation-execution.json')
authorization=read('continuation-authorization.json')
result={
    'observed_at':datetime.now(timezone.utc).isoformat(),
    'path':p.as_posix(),'sha256':sha(b),'sha256_after':sha(a),'stable':a==b,
    'only_change_from_inspected_snapshot_is_dispatch_literal':b.count(after)==1 and sha(normalized)==expected,
    'snapshot_sha256':expected,'normalized_sha256':sha(normalized),
    'binding_qualifier_hash_matches':any(x['path']==p.as_posix() and x['sha256']==sha(b) for x in binding['source_files']),
    'execution_qualifier_hash_matches':any(x['path']==p.as_posix() and x['sha256']==sha(b) for x in execution['source_files']),
    'authorization_dispatch_matches_source':authorization['dispatch']=='ctx_95b52e773108',
    'execution_dispatch_matches_authorization':execution['dispatch']==authorization['dispatch'],
    'receipt_fingerprints':records,
}
with (out/'recheck2-drift-2026-11-11.json').open('x',encoding='utf-8') as f:
    json.dump(result,f,indent=2)
    f.write('\n')
print(json.dumps(result,indent=2))
