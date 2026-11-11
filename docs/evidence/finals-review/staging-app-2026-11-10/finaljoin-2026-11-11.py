"""Bounded public receipt join and fingerprints; executes no application helper."""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

workspace=Path.cwd().resolve()
out=Path(__file__).parent
base=Path('docs/evidence/finals-staging-app/completion-resume-2026-11-11T01-27Z')
cache={}
fingerprints=[]
checks=[]
def sha(v): return hashlib.sha256(v).hexdigest()
def read(p):
    p=Path(p)
    name=p.resolve().relative_to(workspace).as_posix()
    if not (name.startswith('docs/evidence/') or name.startswith('deployment/finals/staging-app/')):
        raise ValueError('Outside authorized public receipt/inventory scope: '+name)
    if any(x.startswith('.env') or x in ('.fmd-work','custody','private','secrets') for x in Path(name).parts):
        raise ValueError('Private path excluded')
    if name not in cache:
        b=p.read_bytes()
        a=p.read_bytes()
        cache[name]=b
        fingerprints.append({'path':name,'bytes':len(b),'sha256':sha(b),'sha256_after':sha(a),'stable':b==a})
    return cache[name]
def js(p): return json.loads(read(p))
def check(name,v): checks.append({'check':name,'passed':bool(v)})
def inventory(label,entries,result_path=None):
    rows=[]
    for x in entries:
        p=result_path if result_path is not None and x['path']=='result.json' else Path(x['path'])
        b=read(p)
        rows.append({'path':str(p).replace('\\','/'),'hash_matches':sha(b)==x['sha256'],'bytes_match':'bytes' not in x or len(b)==x['bytes']})
    check(label,all(x['hash_matches'] and x['bytes_match'] for x in rows))
    return {'entries':len(rows),'all_match':all(x['hash_matches'] and x['bytes_match'] for x in rows),'mismatches':[x for x in rows if not x['hash_matches'] or not x['bytes_match']]}

r=js(base/'actual/result.json')
i=js(base/'actual/inventory.json')
f=js(base/'actual/finalization.json')
e=js(base/'actual/observed-exit.json')
a=js(base/'final-terminal-audit.json')
p=js(base/'final-packet.json')
c=js(base/'checks.json')
report=read(base/'report.md').decode('utf-8-sig')
binding=js(base/'continuation-source-binding.json')
marker=js(base/'continuation-execution.json')
baseline=js(base/'preserved-baseline.json')
check('expected actual result hash',sha(read(base/'actual/result.json'))=='02205d2c1bce707fb21db584a48dcd7d0485f62cf5b256d7642a30fa1071fec4')
check('expected finalization hash',sha(read(base/'actual/finalization.json'))=='f320e1807480505142764f6b43b909b81a2b534718ea15b0e81d4d2bc63d9e6f')
check('terminal result/inventory/finalization hashes',f['result_sha256']==sha(read(base/'actual/result.json')) and f['inventory_sha256']==sha(read(base/'actual/inventory.json')) and e['finalization_sha256']==sha(read(base/'actual/finalization.json')))
check('terminal flags outcome and external observed exit',r['requires_terminal_finalization_and_observed_exit'] is True and f['phase']=='TERMINAL' and f['all_validation_completed'] is True and r['outcome']==f['outcome']=='passed' and f['exit_code']==e['exit_code']==0 and 'external' in e['source'])
check('inventory binds result entry',any(x['path']=='result.json' and x['sha256']==sha(read(base/'actual/result.json')) for x in i['files']))
inventories={
    'actual':inventory('actual terminal inventory matches current public files',i['files'],base/'actual/result.json'),
    'final_audit':inventory('final audit public inventory matches',a['inventory']),
    'final_packet':inventory('final packet inventory matches',p['inventory']),
    'historical':inventory('135 historical public files match preserved baseline',baseline['public_files']),
}
prior=js(out/'recheck2-evidence-2026-11-11.json')
drift=js(out/'recheck2-drift-2026-11-11.json')
expected={x['path']:x['current'] for x in prior['completion_binding_sources']}
expected[drift['path']]=drift['sha256']
check('all ten helper binding hashes equal prior reviewed versions',len(binding['source_files'])==10 and all(expected.get(x['path'])==x['sha256'] for x in binding['source_files']))
check('binding execution and result agree',marker['source_files']==binding['source_files']==r['capture_preflight']['current_source_binding'] and marker['dispatch']==r['continuation']['dispatch']=='ctx_95b52e773108' and r['continuation']['source_binding_sha256']==sha(read(base/'continuation-source-binding.json')))
check('all ten bound helper current fingerprints match',all(sha(read(x['path']))==x['sha256'] for x in binding['source_files']))
check('preflight reused by exact receipt hash',r['capture_preflight']['reused'] is True and sha(read(r['capture_preflight']['path']))==r['capture_preflight']['sha256']==binding['capture_preflight']['sha256'])
check('writer report and checks bound',c['report_sha256']==sha(read(base/'report.md')) and c['actual_result_sha256']==sha(read(base/'actual/result.json')))
check('checks and packet report observed actual exit zero',c['actual_exit']==c['terminal_audit_exit']==c['current_precheck_exit']==p['actual_observed_exit']==0 and p['outcome']=='passed' and p['terminal_accepted'] is True)
matrix={(v,k) for v in ('desktop','mobile') for k in ('owner','merchant')}
check('exact four successful role/viewport flows',len(r['browser'])==4 and {(x['viewport'],x['role']) for x in r['browser']}==matrix and all(all(x[k] is True for k in ('real_login','real_database_state','reload_session_persisted','logout_revoked_previous_cookie','http_only_same_site_cookie','private_storage_clean','no_horizontal_overflow','no_forbidden_financial_requests','no_external_network_requests','reverse_observation_proxy')) and x['page_errors']==0 and x['route_mocks'] is False and x['native_browser_cache_qualified'] is False and x['traces_screenshots_video_storage_exports'] is False for x in r['browser']))
check('41 HTTP checks expected and all 37 API results no-store',len(r['http'])==41 and all(x['status']==x['expected'] for x in r['http']) and sum(x['no_store'] is True for x in r['http'])==37)
check('four previous-browser-cookie denials present',all(any(x['label']==v+' '+k+' previous browser cookie revoked' and x['status']==401 for x in r['http']) for v,k in matrix))
build=js('docs/evidence/finals-staging-app/build-inventory.json')
build_map={x['path'].replace('\\','/'):x for x in build['files']}
asset_checks=[]
for asset in r['client_asset_inventory']:
    match=build_map.get('apps/web/.next/static/'+asset['path'].removeprefix('/_next/static/'))
    asset_checks.append(match is not None and match['sha256']==asset['sha256'] and match['bytes']==asset['bytes'])
check('16 HTTP asset fingerprints match preserved build manifest',len(asset_checks)==16 and all(asset_checks))
check('actual app strict TLS1.3',len(r['app_pool_tls'])>=1 and all(all(x[k] is True for k in ('resource_matches','encrypted','authorized','hostname_verified','wrong_hostname_rejected','strict_configuration')) and x['protocol']=='TLSv1.3' and x['pool_max']==10 for x in r['app_pool_tls']))
contexts=r['browser_response_capture']['contexts']
context_rows=[]
for x in contexts:
    ev=x['completion_evidence']
    fallback=[d for d in x['diagnostics'] if d['category']=='COMPLETED_BY_MATCHED_PROXY_RESPONSE_FINISH']
    check('capture '+x['viewport']+' '+x['role'],x['browser_requests']==x['upstream_requests']==x['delivered_responses']==x['upstream_captured']==x['upstream_response_finished']==62 and x['exact_request_count_maps_match'] is True and all(x[k]==0 for k in ('canceled_before_proxy','proxy_only_requests','missing_delivered_captures','pending_captures','pending_browser_requests','pending_proxy_responses','failures')) and x['pending_categories']==[] and x['browser_cache_disabled'] is True and ev=={'cdp_loading_finished':59,'cdp_loading_failed':2,'redirect_response':0,'client_socket_cancellation':0,'matched_proxy_response_finish':1} and x['completed_by_matched_proxy_finish']==1 and len(fallback)==1 and all(d['method']=='GET' and d['status']==401 and d['path_category']=='STATE' for d in fallback))
    context_rows.append({k:v for k,v in x.items() if k!='diagnostics'})
check('four capture contexts match flow matrix',len(contexts)==4 and {(x['viewport'],x['role']) for x in contexts}==matrix)
proxy=r['observation_proxy']
check('306 complete upstream captures and response finishes',proxy['upstream_requests']==proxy['upstream_captured']==proxy['upstream_response_finished']==306 and all(proxy[k]==0 for k in ('upstream_canceled','pending','failures','retries','redirect_following')) and proxy['cookie_jar'] is False and proxy['response_overrides'] is False)
check('actual response and log hygiene zero',all(v==0 for k,v in r['response_hygiene'].items() if k.endswith('_matches')) and all(v==0 for v in r['app_logs']['hygiene'].values()) and r['app_logs']['raw_logs_saved'] is False)
financial=['agent_run','quote','payment_attempt','payment_evidence','entitlement','job','wallet_operation','merchant_claim','run_event','audit_event','payment_accept_key']
db=a['independent_database_audit']
check('all eleven financial/execution tables zero across final cleanup and independent DB audit',all(all(group[k]==0 for k in financial) for group in (r['final_counts'],r['cleanup']['final_allowlisted_counts'],db['counts'])))
check('16 revoked sessions and six new sessions',r['sessions']=={'created_this_invocation':6,'prior_revoked_preserved':10,'total':16,'revoked':16,'unrevoked':0} and r['cleanup']['sessions']==db['sessions']=={'total':16,'revoked':16,'unrevoked':0})
check('unchanged metadata and final counts agree',r['final_counts']==r['cleanup']['final_allowlisted_counts']==db['counts'] and all(db['counts'][k]==v for k,v in {'owner':1,'merchant':1,'agent':1,'resource':2,'schema_migration':4}.items()))
check('zero policy identity and unchanged throttle limits',db['agent']=={'status':'unprovisioned','nonce':'0','policy_stroops':'0','expiry_epoch':True,'observed_ledger_null':True} and r['throttles']=={'role_counters':[3,3],'limits_unmodified':True,'rows_preserved':True})
check('owned cleanup and pre-cleanup state retained',r['cleanup']['owned_proxy_closed'] is True and r['cleanup']['owned_next_exited'] is True and r['cleanup']['production_launch']['owned_process_exited'] is True and r['cleanup']['production_launch']['signal_code']=='SIGTERM' and r['startup_pre_cleanup']['classification']=='READY' and r['startup_pre_cleanup']['pre_cleanup_exit_code'] is None and r['startup_pre_cleanup']['pre_cleanup_signal_code'] is None and r['cleanup']['original_staging_config_unchanged'] is True and a['app_and_proxy_ports_no_listener'] is True)
check('independent final DB audit read-only strict TLS1.3',db['read_only'] is True and db['tls']=={'encrypted':True,'authorized':True,'hostname_verified':True,'protocol':'TLSv1.3','pool_max':1})
check('final audit terminal binding agrees',a['outcome']=='passed' and a['actual_staging_exit']==0 and a['actual_staging_outcome']=='passed' and a['actual_http_checks']==41 and a['actual_browser_cases']==4 and a['actual_terminal_consistency']['accepted'] is True and a['actual_terminal_consistency']['passed'] is True and a['actual_terminal_consistency']['finalization_sha256']==sha(read(base/'actual/finalization.json')))
check('preservation receipt counts 135/7/72/233',len(baseline['public_files'])==a['preserved_original_public_files']==p['historical_files_unchanged']==135 and a['custody_files_unchanged']==7 and a['source_files_unchanged']==len(a['application_source_files'])==72 and a['build_files_unchanged']==len(a['build_files'])==233)
check('application closure build identity and full verification agree',r['build']['fresh_build'] is False and r['build']['source_and_build_receipt_match'] is True and r['source']['sha256']==a['source_sha256']==r['build']['source_sha256']=='1eca1bfbfc838513ced491d53aedeb5e173400e935125f45f03694e4874acc00' and r['build']['build_id_sha256']==a['build_id_sha256']=='8377827b6c1b2e97c1ceabca1c0a1e00b8407c51ead728dfdff07100973b9a9c' and all(x['files_verified']==233 and x['inventory_sha256']==a['build_inventory_sha256']=='3e6d864cf2f90759c110bbb283cbe53d4028a6b63c199a8a03f81662c12f07b0' and x['client_fixture_matches']==0 and x['server_fixture_matches']==10 for x in (r['full_build_before'],r['full_build_after'])))
check('audit and packet hygiene receipts zero',all(v==0 for k,v in a['hygiene'].items() if k.endswith('_matches')) and all(v==0 for v in p['hygiene'].values()))
check('report explicitly limits buffered local scope',all(s in report.lower() for s in ('fully buffered','browser cache was disabled','service workers blocked','hosted egress','native-cache','held/unentitled','coordinator','no hosted-release')))
check('all bounded file reads stable',all(x['stable'] for x in fingerprints))
result={'observed_at':datetime.now(timezone.utc).isoformat(),'task':'task_27ed11d93ddc','dispatch':'ctx_9ff407a7c485','scope':'public receipt join only; no gate, tooling test, source review, application, private-file, DB, browser, network, provider or Git execution','accepted':all(x['passed'] for x in checks),'checks':checks,'inventory_comparisons':inventories,'facts':{'actual_started_at':r['started_at'],'actual_finished_at':r['finished_at'],'observed_exit':e['exit_code'],'browser_cases':r['browser'],'capture_contexts':context_rows,'http_checks':len(r['http']),'assets':len(asset_checks),'app_pool_tls':r['app_pool_tls'],'response_hygiene':r['response_hygiene'],'sessions':r['sessions'],'final_counts':r['final_counts'],'independent_database_audit':db,'preservation_counts':{'historical_public':a['preserved_original_public_files'],'custody_author_receipt_only':a['custody_files_unchanged'],'source_author_receipt_only':a['source_files_unchanged'],'build_author_receipt_only':a['build_files_unchanged']}},'fingerprints':fingerprints}
with (out/'finaljoin-fingerprints-2026-11-11.json').open('x',encoding='utf-8') as dest:
    json.dump(result,dest,indent=2)
    dest.write('\n')
print(json.dumps({'accepted':result['accepted'],'checks':len(checks),'failed_checks':[x['check'] for x in checks if not x['passed']],'inventories':inventories,'bounded_files_read':len(fingerprints)},indent=2))
