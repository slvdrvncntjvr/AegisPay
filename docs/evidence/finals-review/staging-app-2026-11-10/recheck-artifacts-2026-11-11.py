"""Independent static receipt comparisons; imports/runs no application helper."""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

out=Path(__file__).parent
manifest=out/'recheck-fingerprints-2026-11-11.json'
records=json.loads(manifest.read_text())
def sha(b): return hashlib.sha256(b).hexdigest()
def read(name):
    p=Path(name)
    if any(x.startswith('.env') or x in ('.fmd-work','private','custody','secrets') for x in p.parts):
        raise ValueError('Private path refused')
    b=p.read_bytes()
    a=p.read_bytes()
    records.append({'path':str(p).replace('\\','/'),'sha256_before':sha(b),'sha256_after':sha(a),'stable':b==a,'selection':'static receipt comparison'})
    return b
def terminal(directory):
    b={n:read(directory+'/'+n+'.json') for n in ('result','inventory','finalization','observed-exit')}
    r,i,f,e=[json.loads(b[n]) for n in ('result','inventory','finalization','observed-exit')]
    checks={
      'result_hash':f['result_sha256']==sha(b['result']),
      'inventory_hash':f['inventory_sha256']==sha(b['inventory']),
      'finalization_hash':e['finalization_sha256']==sha(b['finalization']),
      'outcomes':r['outcome']==f['outcome'],
      'exits':e['exit_code']==f['exit_code']==(0 if r['outcome']=='passed' else 1),
      'terminal_flags':r.get('requires_terminal_finalization_and_observed_exit') is True and f.get('phase')=='TERMINAL' and f.get('all_validation_completed') is True,
      'inventory_result_entry':any(x['path']=='result.json' and x['sha256']==sha(b['result']) for x in i['files']),
    }
    return {'path':directory,'checks':checks,'consistent':all(checks.values()),'outcome':r['outcome'],'observed_exit':e['exit_code'],'result_sha256':sha(b['result']),'http_checks':len(r.get('http',[])),'browser_cases':len(r.get('browser',[])),'app_tls_observations':len(r.get('app_pool_tls',[])),'failure':r.get('safe_failure'),'cleanup_sessions':r.get('cleanup',{}).get('sessions'),'cleanup_counts':r.get('cleanup',{}).get('final_allowlisted_counts')}

result={'kind':'static recheck; no application/DB/network/browser execution','observed_at':datetime.now(timezone.utc).isoformat()}
base='docs/evidence/finals-staging-app/'
result['historical_terminals']=[terminal(base+p+'/actual') for p in ('finalization-2026-11-10T15-16Z','completion-2026-11-11T01-15Z')]
binding=json.loads(read(base+'completion-2026-11-11T01-15Z/continuation-source-binding.json'))
result['completion_bound_source_checks']=[{'path':x['path'],'expected_sha256':x['sha256'],'observed_sha256':sha(read(x['path']))} for x in binding['source_files']]
result['original_review_report_unchanged']=sha(read(str(out/'report.md')))=='0161e39980d84b22c24a3acde1d5f8febcf4abb8412253bd458c8886b2249a88'
# One final evidence-directory snapshot, never a watch or poll loop.
result['final_evidence_directories']=[p.name for p in sorted(Path(base).iterdir()) if p.is_dir()]
result['new_resumed_terminals']=[]
known={'2026-11-10T12-35-49-545Z','2026-11-10T12-37-22-303Z','2026-11-10T12-39-15-029Z','2026-11-10T12-41-01-076Z','capture-2026-11-10T14-33Z','proxy-2026-11-10T14-43Z','continuation-2026-11-10T15-04Z','finalization-2026-11-10T15-16Z','completion-2026-11-11T01-15Z'}
for name in result['final_evidence_directories']:
    if name in known: continue
    actual=Path(base+name)/'actual'
    if actual.is_dir():
        present=all((actual/(n+'.json')).is_file() for n in ('result','inventory','finalization','observed-exit'))
        result['new_resumed_terminals'].append(terminal(str(actual)) if present else {'path':str(actual).replace('\\','/'),'terminal_complete':False,'present_files':sorted(p.name for p in actual.iterdir() if p.is_file())})
manifest.write_text(json.dumps(records,indent=2)+'\n')
(out/'recheck-artifacts-2026-11-11.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
