"""Read-only, allowlisted preflight; never emit credential values or raw provider bodies."""
from pathlib import Path
import json, os, re, urllib.request, urllib.error, datetime, subprocess

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).parent
def env_file(path):
    result = {}
    if path.exists():
        for line in path.read_text(encoding='utf-8-sig').splitlines():
            match = re.match(r'^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$', line)
            if match:
                result[match[1]] = match[2].strip().strip('\"\'')
    return result
def redact(value):
    return str(value)[:5] + '…' + str(value)[-4:] if value else None
def request(url, token=None):
    try:
        headers = {'User-Agent': 'AegisPay-finals-readonly-preflight'}
        if token: headers['Authorization'] = 'Bearer ' + token
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=25) as response:
            raw = response.read()
            try: data = json.loads(raw)
            except (ValueError, UnicodeDecodeError): data = None
            return response.status, data
    except urllib.error.HTTPError as e: return e.code, None
    except Exception as e: return type(e).__name__, None

report = {'observed_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat()}
expected = env_file(ROOT / '.env.example')
report['env_files'] = {}
allenv = dict(os.environ)
public_safe = {'STELLAR_NETWORK', 'NOIR_DEVICE_REGISTRY_ID', 'NOIR_AGENT_REGISTRY_ID', 'NOIR_PAYMENT_ESCROW_ID', 'NOIR_XLM_SAC_ID', 'DEMO_OWNER_PUBLIC_KEY', 'DEMO_AGENT_PUBLIC_KEY', 'DEMO_MERCHANT_PUBLIC_KEY', 'AGENT_MODEL'}
for name in ['.env.integration.local', '.env.deploy.local', '.env.worker.local', '.env.spike.local', 'apps/web/.env.local', 'apps/web/.env.production.local']:
    values = env_file(ROOT / name)
    allenv.update(values)
    entry = {'exists': (ROOT / name).exists(), 'presence': {key: bool(value) for key,value in sorted(values.items())}}
    entry['missing_or_empty_catalog_names'] = [key for key in expected if not values.get(key)]
    entry['safe_public_values'] = {key:value for key,value in values.items() if key in public_safe}
    if 'AEGISPAY_POSTGRES_PROJECT' in values:
        entry['db_project_redacted'] = redact(values['AEGISPAY_POSTGRES_PROJECT'])
        entry['db_port'] = int(values['AEGISPAY_POSTGRES_PORT']) if values.get('AEGISPAY_POSTGRES_PORT', '').isdigit() else None
        entry['database_names'] = {key: values.get(key, '').rsplit('/',1)[-1].split('?')[0] for key in ['DATABASE_URL','TEST_DATABASE_URL']}
    report['env_files'][name] = entry
report['process_host_key_presence'] = {key:bool(os.environ.get(key)) for key in ['VERCEL_TOKEN','RENDER_API_KEY','RENDER_API_TOKEN','GEMINI_API_KEY','DATABASE_URL']}

auth_paths = [Path(os.environ.get('APPDATA','')) / 'com.vercel.cli/Data/auth.json', Path(os.environ.get('LOCALAPPDATA','')) / 'com.vercel.cli/Data/auth.json']
token = os.environ.get('VERCEL_TOKEN')
config = {}
for path in auth_paths:
    if path.exists():
        try:
            auth = json.loads(path.read_text(encoding='utf-8'))
            token = token or auth.get('token')
            cfg = path.parent/'config.json'
            if cfg.exists(): config = json.loads(cfg.read_text(encoding='utf-8'))
        except Exception: pass
report['vercel'] = {'auth_token_present':bool(token), 'config_key_names': sorted(config)}
team = config.get('currentTeam')
suffix = '?teamId=' + team if team else ''
if token:
    status, user = request('https://api.vercel.com/v2/user', token)
    report['vercel']['identity'] = {'http_status':status, 'username': (user or {}).get('user',{}).get('username')}
    status, project = request('https://api.vercel.com/v9/projects/prj_87hFYLDrQpbUsSlAgoFMsTIE7aTq'+suffix, token)
    p = project or {}
    report['vercel']['project'] = {'http_status':status, 'id_redacted':redact(p.get('id')), **{key:p.get(key) for key in ['name','framework','rootDirectory','nodeVersion','sourceFilesOutsideRootDirectory','installCommand','buildCommand','outputDirectory','autoExposeSystemEnvs']}}
    report['vercel']['git_link'] = {key:p.get('link',{}).get(key) for key in ['type','org','repo','productionBranch']}
    if p.get('accountId'):
        suffix = '?teamId=' + p['accountId']
    status, envs = request('https://api.vercel.com/v10/projects/prj_87hFYLDrQpbUsSlAgoFMsTIE7aTq/env'+suffix, token)
    report['vercel']['environment'] = {'http_status':status,'keys':[{'name':e.get('key'),'target':e.get('target'),'type':e.get('type')} for e in (envs or {}).get('envs',[])]}
    status, alias = request('https://api.vercel.com/v4/aliases/aegispay-live.vercel.app'+suffix, token)
    a = alias or {}; dep = a.get('deployment') or {}
    report['vercel']['alias'] = {'http_status':status,'alias':a.get('alias'),'deployment_id_redacted':redact(dep.get('id')), 'deployment_hostname':dep.get('url')}
    if dep.get('id'):
        status, deployment = request('https://api.vercel.com/v13/deployments/'+dep['id']+suffix, token)
        d = deployment or {}
        report['vercel']['deployment'] = {'http_status':status, **{key:d.get(key) for key in ['name','readyState','target','createdAt','url','source','version','nodeVersion']},'git_commit':d.get('meta',{}).get('githubCommitSha'),'project_settings':{key:d.get('projectSettings',{}).get(key) for key in ['rootDirectory','framework','nodeVersion','buildCommand','installCommand','sourceFilesOutsideRootDirectory']}}
        status, tree = request('https://api.vercel.com/v6/deployments/'+dep['id']+'/files'+suffix, token)
        paths=[]
        def walk(nodes, base=''):
            for node in nodes if isinstance(nodes,list) else []:
                path = base + str(node.get('name',''))
                if node.get('type') == 'directory': walk(node.get('children',[]), path+'/')
                else: paths.append(path)
        walk(tree)
        report['vercel']['source_packaging'] = {'http_status':status,'file_paths':paths, 'count':len(paths)}

report['render'] = {'cli_on_path':False,'known_config_exists':{name:(Path.home()/name).exists() for name in ['.render/cli.yaml','.render/cli.yml','.config/render/cli.yaml','.config/render/cli.yml']},'credential_name_presence':{name:bool(allenv.get(name)) for name in ['RENDER_API_KEY','RENDER_API_TOKEN']}}
for path in ['/', '/api/health', '/app', '/api/auth/session', '/api/state', '/api/runs']:
    status, data = request('https://aegispay-live.vercel.app'+path)
    report.setdefault('public_http',[]).append({'path':path,'http_status':status,'safe_health':data if path == '/api/health' and isinstance(data,dict) and set(data)<= {'status','network'} else None})
status,_=request('https://github.com/slvdrvncntjvr/AegisPay')
report['anonymous_github_status']=status
status,_=request('https://raw.githubusercontent.com/slvdrvncntjvr/AegisPay/main/docs/submission/AegisPay-pitch-draft.pdf')
report['submitted_pdf_http_status']=status
(OUT/'observations.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
print(json.dumps(report,indent=2,ensure_ascii=False))
