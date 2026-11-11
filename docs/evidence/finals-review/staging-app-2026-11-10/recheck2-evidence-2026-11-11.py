"""Independent public-file evidence checks; no helper import or execution."""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

root = Path('docs/evidence/finals-staging-app')
out = Path(__file__).parent
records = []
def sha(b): return hashlib.sha256(b).hexdigest()
def read(p):
    p = Path(p)
    name = p.resolve().relative_to(Path.cwd().resolve()).as_posix()
    if not (name.startswith('docs/evidence/') or name.startswith('deployment/finals/staging-app/')):
        raise ValueError('Outside public review scope')
    b = p.read_bytes()
    a = p.read_bytes()
    records.append({'path':name, 'sha256':sha(b), 'sha256_after':sha(a), 'stable':b==a})
    return b
def js(p): return json.loads(read(p))
def terminal(d):
    raw = {n:read(d / (n+'.json')) for n in ('result','inventory','finalization','observed-exit')}
    r, i, f, e = [json.loads(raw[n]) for n in ('result','inventory','finalization','observed-exit')]
    checks = {
        'result_hash': f['result_sha256']==sha(raw['result']),
        'inventory_hash': f['inventory_sha256']==sha(raw['inventory']),
        'finalization_hash': e['finalization_sha256']==sha(raw['finalization']),
        'terminal_flags': r.get('requires_terminal_finalization_and_observed_exit') is True and f.get('phase')=='TERMINAL' and f.get('all_validation_completed') is True,
        'outcome_and_exit':r['outcome']==f['outcome'] and e['exit_code']==f['exit_code']==(0 if r['outcome']=='passed' else 1),
        'inventory_result_entry':any(x['path']=='result.json' and x['sha256']==sha(raw['result']) for x in i['files']),
    }
    return {'path':d.as_posix(), 'consistent':all(checks.values()), 'checks':checks, 'hashes':{n:sha(b) for n,b in raw.items()},
        'outcome':r['outcome'], 'observed_exit':e['exit_code'], 'failed_stage':r.get('failed_stage'), 'safe_failure':r.get('safe_failure'),
        'http_count':len(r.get('http',[])), 'all_http_expected':all(x['status']==x['expected'] for x in r.get('http',[])),
        'browser':r.get('browser',[]), 'capture_contexts':r.get('browser_response_capture',{}).get('contexts',[]),
        'app_pool_tls':r.get('app_pool_tls'), 'startup':r.get('startup'), 'startup_pre_cleanup':r.get('startup_pre_cleanup'),
        'sessions':r.get('sessions'), 'cleanup':r.get('cleanup'), 'response_hygiene':r.get('response_hygiene'),
        'proxy':r.get('observation_proxy'), 'client_assets':len(r.get('client_asset_inventory',[]))}

result = {'kind':'independent static public evidence review; no application, DB, network or browser execution', 'observed_at':datetime.now(timezone.utc).isoformat()}
result['historical_terminals'] = [terminal(root / n / 'actual') for n in ('finalization-2026-11-10T15-16Z','completion-2026-11-11T01-15Z')]
offline=js(root/'finalization-2026-11-10T15-16Z/offline-check-2.json')
result['offline_protocol']=offline
startup=js(root/'finalization-2026-11-10T15-16Z/startup-only-1.json')
result['startup_only']={k:v for k,v in startup.items() if k not in ('source_files','inventory','configuration')}
result['focused_completion']=js(root/'completion-2026-11-11T01-15Z/completion-check-2.json')
preflight=js(root/'completion-2026-11-11T01-15Z/preflight-1.json')
result['preflight']={k:v for k,v in preflight.items() if k not in ('diagnostics','source_files')}
snapshot=js(out/'recheck2-fingerprints-2026-11-11.json')
result['source_still_matches_snapshot']=[{'path':x['path'],'snapshot_sha256':x['sha256'],'current_sha256':sha(read(x['path']))} for x in snapshot['files']]
book=js(root/'completion-resume-2026-11-11T01-27Z/bookkeeping-changes.json')
result['bookkeeping_source_checks']=[{'path':x['path'],'expected':x['after_sha256'],'actual':sha(read(x['path']))} for x in book['changes']]
binding=js(root/'completion-2026-11-11T01-15Z/continuation-source-binding.json')
result['completion_binding_sources']=[{'path':x['path'],'historical':x['sha256'],'current':sha(read(x['path']))} for x in binding['source_files']]
result['original_report_unchanged']=sha(read(out/'report.md'))=='0161e39980d84b22c24a3acde1d5f8febcf4abb8412253bd458c8886b2249a88'
# One bounded final receipt-directory observation, not a watch or poll loop.
resume=root/'completion-resume-2026-11-11T01-27Z'
result['resume_observation_at']=datetime.now(timezone.utc).isoformat()
result['resume_files']=sorted(p.relative_to(resume).as_posix() for p in resume.rglob('*') if p.is_file())
actual=resume/'actual'
if all((actual/(n+'.json')).is_file() for n in ('result','inventory','finalization','observed-exit')):
    result['resumed_terminal']=terminal(actual)
else:
    result['resumed_terminal']={'complete':False,'acceptance':'pending final writer receipts','files_present': sorted(p.name for p in actual.iterdir() if p.is_file()) if actual.is_dir() else []}
result['fingerprints']=records
target=out/'recheck2-evidence-2026-11-11.json'
with target.open('x',encoding='utf-8') as f:
    json.dump(result,f,indent=2)
    f.write('\n')
print(json.dumps({'evidence':target.as_posix(),'stable_reads':all(x['stable'] for x in records),'historical_terminal_consistency':[t['consistent'] for t in result['historical_terminals']], 'source_drift':any(x['snapshot_sha256']!=x['current_sha256'] for x in result['source_still_matches_snapshot']), 'original_report_unchanged':result['original_report_unchanged'], 'resumed_terminal':result['resumed_terminal']},indent=2))
