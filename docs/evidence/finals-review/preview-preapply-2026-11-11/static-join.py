"""Bounded source/schema/evidence comparisons only; no prepared helper execution."""
import hashlib
import json
import os
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

base=Path('deployment/finals/preview')
ev=Path('docs/evidence/finals-preview/preparation-2026-11-11')
out=Path(__file__).parent
records=[]
def sha(v):return hashlib.sha256(v).hexdigest()
def read(p):
    p=Path(p)
    if p.is_absolute() or any(x.startswith('.env') or x in ('.fmd-work','custody','private','secrets') for x in p.parts):raise ValueError('Private path excluded')
    b=p.read_bytes();a=p.read_bytes()
    records.append({'path':p.as_posix(),'sha256':sha(b),'sha256_after':sha(a),'stable':a==b})
    return b
def js(p):return json.loads(read(p))
def git(*args):
    r=subprocess.run(['git',*args],capture_output=True,check=True)
    return r.stdout

manifest=js(base/'source-closure.json')
head=git('rev-parse','HEAD').decode().strip()
closure=[]
for group in ('application_files','runtime_files','helper_files'):
    for f in manifest[group]:
        b=read(f['path'])
        committed=git('show',head+':'+f['path'])
        row={'group':group,'path':f['path'],'manifest_sha256':f['sha256'],'disk_sha256':sha(b),'lf_sha256':sha(b.replace(b'\r\n',b'\n')),'head_git_blob_sha256':sha(committed),'head_matches':sha(committed)==f['git_blob_sha256'],'disk_lf_matches':sha(b.replace(b'\r\n',b'\n'))==f['sha256']}
        if group!='helper_files':row['accepted_git_blob_matches']=sha(git('show',manifest['accepted_commit']+':'+f['path']))==f['git_blob_sha256']
        closure.append(row)
schema=js(ev/'official-schema.json')
request=js(base/'request-template.json')
web=schema['operations']['create']['request']['properties']['serviceDetails']['oneOf'][1]
schema_checks={'create_fields_exist':set(request)<=set(schema['operations']['create']['request']['properties']), 'web_fields_exist':set(request['serviceDetails'])<=set(web['properties']), 'free_in_web_plan_enum':request['serviceDetails']['plan'] in web['properties']['plan']['enum'], 'runtime_enum':request['serviceDetails']['runtime'] in web['properties']['runtime']['enum'], 'region_enum':request['serviceDetails']['region'] in web['properties']['region']['enum'], 'autodeploy_enum':request['autoDeployTrigger'] in schema['operations']['create']['request']['properties']['autoDeployTrigger']['enum'], 'outbound_type_and_ips_documented':schema['outbound_ips']['required']==['type','ips']}
publics=[ev/n for n in ('report.md','provider-readonly.json','api-response-review.json','offline-check-5.json','final-validation-2.json','final-packet.json')]
public_bytes=[read(p) for p in publics]
packet=json.loads(public_bytes[-1])
packet_matches=[]
for f in packet['inventory']:
    b=read(f['path'])
    packet_matches.append({'path':f['path'],'matches':sha(b)==f['sha256'] and len(b)==f['bytes']})
prior=js('docs/evidence/finals-staging-app/completion-resume-2026-11-11T01-27Z/actual/result.json')
core=Path('node_modules/.pnpm/playwright-core@1.65.0/node_modules/playwright-core')
browsers=js(core/'browsers.json')
core_bytes=read(core/'lib/coreBundle.js')
core_lines=core_bytes.decode().splitlines()
shell=next(x for x in browsers['browsers'] if x['name']=='chromium-headless-shell')
cache=Path(os.environ.get('LOCALAPPDATA','C:/Users/Vincent/AppData/Local'))/'ms-playwright'
expected=cache/('chromium_headless_shell-'+shell['revision'])/'chrome-headless-shell-win64/chrome-headless-shell.exe'
dependency={
    'playwright_test_version':js('node_modules/@playwright/test/package.json')['version'],
    'headless_shell_revision':shell['revision'],'headless_shell_version':shell['browserVersion'],
    'default_registry_override_set':bool(os.environ.get('PLAYWRIGHT_BROWSERS_PATH')),
    'expected_default_executable':expected.as_posix(),'expected_executable_exists':expected.is_file(),
    'existing_rehearsal_chromium_exists':(cache/'chromium-1248/chrome-win64/chrome.exe').is_file(),
    'body_api_selected_lines':{str(n):core_lines[n-1] for n in [14884,14885,14886,14887,14896,38189,38190,38194,38195,38196,38199,38200,38202,38212,45216]},
}
parser=read('node_modules/.pnpm/pg-connection-string@2.14.1/node_modules/pg-connection-string/index.js')
dependency['pg_parser_hash_matches_saved_offline_receipt']=sha(parser)==json.loads(public_bytes[3])['installed_pg']['parser_source_sha256']
# Public patterns only: no private exact values are loaded for comparison.
patterns={
    'raw_credential_dsn':rb'postgres(?:ql)?://[^\s\"\x27]+:[^\s\"\x27]+@',
    'stellar_secret_seed':rb'\bS[A-Z2-7]{55}\b',
    'full_provider_id':rb'\b(?:dpg|usr|tea|srv)-[a-z0-9]{10,}(?:-[a-z0-9]+)?\b',
    'literal_session_cookie':rb'aegispay_session=[A-Za-z0-9_-]{43}(?:;|\s|\")',
}
scan_files=list(base.iterdir())+publics+[ev/'official-schema.json']
pattern_counts={k:0 for k in patterns}
for p in scan_files:
    b=read(p)
    for name,pattern in patterns.items():pattern_counts[name]+=len(re.findall(pattern,b))
result={
    'kind':'independent static review only; no network/DB/provider/browser/app/build/tooling tests',
    'observed_at':datetime.now(timezone.utc).isoformat(),'head':head,
    'manifest_sha256':sha(read(base/'source-closure.json')),
    'manifest_committed_LF_hash_matches':sha(git('show',head+':deployment/finals/preview/source-closure.json'))==sha(read(base/'source-closure.json').replace(b'\r\n',b'\n')),
    'canonical_application_closure_matches':sha(json.dumps(manifest['application_files'],separators=(',',':')).encode())==manifest['application_sha256'],
    'same_application_paths_as_accepted_rehearsal':sorted(x['path'] for x in manifest['application_files'])==sorted(x['path'] for x in prior['source']['files']),
    'closure':closure,'schema_checks':schema_checks,
    'preparation_packet_inventory':{'entries':len(packet_matches),'all_match':all(x['matches'] for x in packet_matches),'mismatches':[x for x in packet_matches if not x['matches']]},
    'dependency_evidence':dependency,'public_pattern_counts':pattern_counts,'public_pattern_file_count':len(scan_files),'fingerprints':records,
}
with (out/'static-join.json').open('x',encoding='utf-8') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps({'head':head,'all_source_closure_entries_match':all(x['head_matches'] and x['disk_lf_matches'] and x.get('accepted_git_blob_matches',True) for x in closure),'manifest_LF_match':result['manifest_committed_LF_hash_matches'],'application_closure_match':result['canonical_application_closure_matches'],'paths_match':result['same_application_paths_as_accepted_rehearsal'],'schema_checks':schema_checks,'packet':result['preparation_packet_inventory'],'dependency':{k:v for k,v in dependency.items() if k!='body_api_selected_lines'},'public_patterns':pattern_counts,'stable_reads':all(x['stable'] for x in records)},indent=2))
