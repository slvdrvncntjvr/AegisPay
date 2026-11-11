"""Independent bounded repair receipt/closure join; no Git or product execution."""
import hashlib,json,re
from datetime import datetime,timezone
from pathlib import Path

out=Path(__file__).parent
base=Path('deployment/finals/preview')
ev=Path('docs/evidence/finals-preview/repair-2026-11-11')
cache={};fingerprints=[];checks=[]
def sha(v):return hashlib.sha256(v).hexdigest()
def read(p):
    p=Path(p)
    name=p.resolve().relative_to(Path.cwd().resolve()).as_posix()
    if any(x.startswith('.env') or x in ('.fmd-work','custody','private','secrets') for x in Path(name).parts):raise ValueError('Private path excluded')
    if name not in cache:
        b=p.read_bytes();a=p.read_bytes();cache[name]=b
        fingerprints.append({'path':name,'sha256':sha(b),'sha256_after':sha(a),'stable':a==b,'bytes':len(b)})
    return cache[name]
def js(p):return json.loads(read(p))
def check(n,v):checks.append({'check':n,'passed':bool(v)})
def lf(b,p):return b.replace(b'\r\n',b'\n') if Path(p).suffix in ('.mjs','.cjs','.ts','.tsx','.json','.md','.yaml','.yml','.css','.txt','.sql') or Path(p).name=='.node-version' else b

manifest=js(base/'source-closure.json')
reg=js(ev/'regression-4.json')
seal=js(ev/'seal.json')
final=js(ev/'final-checks.json')
syntax=js(ev/'checks-before-seal.json')
protocol=js(ev/'protocol-browser.json')
packet=js(ev/'final-packet.json')
preserved=js(ev/'preserved-baseline.json')
report=read(ev/'report.md')
old=js(out/'static-join.json')
snapshot=js(out/'repair-fingerprints.json')
check('new exact closure hash',sha(read(base/'source-closure.json'))=='29c2bb753fbf73b9fde3eb8a78ce8495d8fd2899c72ef53ea42ba52b4ece201f'==seal['new_source_closure_sha256'])
check('canonical application closure',sha(json.dumps(manifest['application_files'],separators=(',',':')).encode())==manifest['application_sha256']==seal['application_git_lf_sha256']=='724b45046b27aed73a4d671b9cfe6fa30ede9d75a7b1411c65e3353e6b5e1a55')
oldmap={x['path']:x['manifest_sha256'] for x in old['closure'] if x['group'] in ('application_files','runtime_files')}
check('72 plus 2 accepted inventories preserved',len(manifest['application_files'])==72 and len(manifest['runtime_files'])==2 and len(oldmap)==74 and {x['path']:x['sha256'] for x in manifest['application_files']+manifest['runtime_files']}==oldmap)
source_rows=[]
for group in ('application_files','runtime_files','helper_files'):
    for f in manifest[group]:
        b=read(f['path'])
        matches=sha(b)==f['sha256'] or sha(lf(b,f['path']))==f['sha256']
        source_rows.append({'group':group,'path':f['path'],'manifest_sha256':f['sha256'],'raw_sha256':sha(b),'lf_sha256':sha(lf(b,f['path'])),'matches':matches})
check('all 94 source runtime helper files match canonical closure',len(source_rows)==94 and all(x['matches'] for x in source_rows))
oldhelpers={x['path']:x['manifest_sha256'] for x in old['closure'] if x['group']=='helper_files'}
unchanged=['apply.mjs','build.mjs','start.mjs','common.mjs','guards.mjs','environment.json','request-template.json','network-plan.mjs','tls-observer.cjs']
check('prior reviewed apply build start and request env network guards unchanged',all(sha(lf(read(base/n),n))==oldhelpers[(base/n).as_posix()] for n in unchanged))
check('stable latest source snapshots did not drift',all(x['stable'] and sha(read(x['path']))==x['sha256'] for x in snapshot))
check('source-bound final regression',len(reg['source_files'])==5 and all(sha(lf(read(x['path']),x['path']))==x['lf_sha256'] for x in reg['source_files']))
check('16 synthetic cases passed without real integration',reg['outcome']=='passed' and len(reg['cases'])==16 and reg['real_logins']==reg['sql_statements']==reg['provider_calls']==0)
good=reg['original_responses']
check('successful original response accounting',good['requests']==good['browser_requests']==good['covered']==8 and good['exact_request_maps'] is True and good['original_entities']==4 and good['declared_empty_entities']==1 and good['non_entities']==2 and good['redirect_headers_only']==1 and good['missing_entities']==good['unfollowed_redirects']==good['pending']==good['failures']==0)
check('only original paused entity body commands in passing fixture',good['commands'].get('Fetch.getResponseBody')==5 and good['commands'].get('Fetch.continueResponse')==8 and not any(re.search('loadNetworkResource|Network.getResponseBody|fulfillRequest',n) for n in good['commands']))
check('redirect bytes are honestly unclaimed',all(x['bytes'] is None and x['body_sha256'] is None and x['redirect_followed'] is True for x in good['response_evidence'] if x['kind']=='REDIRECT_HEADERS_ONLY'))
check('cancellation and disposal fail closed',reg['cancellation']['failures']>0 and reg['cancellation']['missing_entities']>0 and reg['disposal']['failures']>0 and reg['disposal']['missing_entities']>0 and reg['disposal']['pending']==0)
check('header-first fixture identities preserved and uncertainty refused',reg['session_cleanup']=={'identified_synthetic_sessions':3,'all_identified_revoked_in_synthetic_state':True,'prior_16_revoked_sessions_untouched':True,'uncertain_commit_refused':True,'raw_tokens_exported':False})
expected_browser={'executable':'C:/Users/Vincent/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe','sha256':'7f08161bbeb2853ffe1780a9ded4985087f52efb9725d7d8207aabdd42f7cfb9','version':'156.0.8078.4','explicit_executable':True,'downloaded':False}
check('actual synthetic browser identity agrees',reg['browser']==protocol['browser']==expected_browser)
check('18 author syntax type checks observed zero',len(syntax['checks'])==18 and all(x['exit']==0 for x in syntax['checks']) and syntax['regression_exit']==0 and syntax['regression_receipt']=='regression-4.json')
check('seal receipt confirms accepted descendant run',seal['exit']==0 and seal['prepared_head']=='9710aefde3d74ef2c1189cd7599e501481c34824' and seal['accepted_application_commit']==manifest['accepted_commit']=='edbd15f955190e1b12f93a3990a24248c8ee6318' and seal['application_files']==72 and seal['runtime_files']==2 and seal['helper_files']==20)
check('final checks honestly no hosted gate',final['outcome']=='passed' and final['regression_exit']==0 and final['regression_cases']==16 and final['syntax_type_exits_all_zero'] is True and all(x['exit']==0 for x in final['checks']) and final['hosted_gate_run'] is False and final['provider_calls']==final['database_sql']==final['real_logins']==0)
inventory_rows=[]
for f in packet.get('inventory',[]):
    b=read(f['path']);inventory_rows.append({'path':f['path'],'matches':sha(b)==f['sha256'] and ('bytes' not in f or len(b)==f['bytes'])})
check('repair final packet inventory',bool(inventory_rows) and all(x['matches'] for x in inventory_rows))
# Preserved baseline is public evidence; never open its private custody entries.
public_preserved=preserved.get('preserved_artifacts',[])
preservation_rows=[]
for f in public_preserved:
    b=read(f['path']);preservation_rows.append({'path':f['path'],'matches':sha(b)==f['sha256']})
check('preserved original public artifacts',bool(preservation_rows) and all(x['matches'] for x in preservation_rows))
types=Path('node_modules/.pnpm/playwright-core@1.65.0/node_modules/playwright-core/types/protocol.d.ts')
check('installed protocol declarations match saved provenance',sha(read(types))==protocol['installed_protocol_declarations_sha256'])
patterns={'credential_dsn':rb'postgres(?:ql)?://[^\s\"\x27]+:[^\s\"\x27]+@','stellar_secret_seed':rb'\bS[A-Z2-7]{55}\b','full_provider_id':rb'\b(?:dpg|usr|tea|srv)-[a-z0-9]{10,}(?:-[a-z0-9]+)?\b','literal_session_cookie':rb'aegispay_session=[A-Za-z0-9_-]{43}(?:;|\s|\")'}
pattern_counts={k:0 for k in patterns}
public_files=[base/x for x in ('browser.mjs','original-responses.mjs','session-tracking.mjs','qualify.mjs','qualify.ts','repair-check.mjs','seal.mjs')]+list(ev.glob('*.json'))+[ev/'report.md']
for p in public_files:
    b=read(p)
    for k,v in patterns.items():pattern_counts[k]+=len(re.findall(v,b))
check('public pattern scan only',all(v==0 for v in pattern_counts.values()))
check('all bounded reads stable',all(x['stable'] for x in fingerprints))
result={'at':datetime.now(timezone.utc).isoformat(),'kind':'independent F1/F2/F3 static receipt recheck; no Git or helper/test/DB/provider/browser execution','all_comparisons_pass':all(x['passed'] for x in checks),'checks':checks,'source_closure':source_rows,'unchanged_reviewed_helpers':unchanged,'packet_inventory':inventory_rows,'preserved_public_artifacts':preservation_rows,'browser_identity_author_regression':expected_browser,'public_pattern_counts':pattern_counts,'fingerprints':fingerprints}
with (out/'repair-static-join-confirmed.json').open('x',encoding='utf-8') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps({'all_comparisons_pass':result['all_comparisons_pass'],'checks':len(checks),'failed':[x['check'] for x in checks if not x['passed']],'closure_files':len(source_rows),'packet_entries':len(inventory_rows),'preserved_public':len(preservation_rows),'patterns':pattern_counts,'fingerprinted_files':len(fingerprints)},indent=2))
