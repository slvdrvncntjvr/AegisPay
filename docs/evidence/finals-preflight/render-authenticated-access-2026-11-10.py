"""Bounded GET-only account prerequisite checks; never persist raw host payloads.

Reads only RENDER_API_KEY from .env.deploy.local and existing Vercel CLI auth.
Does not retrieve DB connection details, environment values, or deployment hooks.
"""
from pathlib import Path
import datetime
import hashlib
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).parent
SCHEMA_URL = 'https://api-docs.render.com/openapi/render-public-api-1.json'
PROJECT = 'prj_87hFYLDrQpbUsSlAgoFMsTIE7aTq'


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


opener = urllib.request.build_opener(NoRedirect)
observations = []


def redact(value):
    return str(value)[:6] + '…' + str(value)[-4:] if value else None


def request(url, token=None, label=None):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != 'https' or parsed.hostname not in {
        'api.render.com', 'api.vercel.com', 'api-docs.render.com'
    } or parsed.username or parsed.password:
        raise ValueError('UNEXPECTED_API_TARGET')
    headers = {'User-Agent': 'AegisPay-readonly-access-preflight', 'Accept': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    observation = {'operation': label, 'method': 'GET'}
    try:
        with opener.open(urllib.request.Request(url, headers=headers, method='GET'), timeout=20) as response:
            raw = response.read(2 * 1024 * 1024 + 1)
            observation['http_status'] = response.status
            observation['api_rate_limit'] = {
                name: response.headers[name] for name in [
                    'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'
                ] if response.headers.get(name)
            }
        if len(raw) > 2 * 1024 * 1024:
            observation['error_type'] = 'BODY_LIMIT'
            return None, observation, None
        data = json.loads(raw)
        return data, observation, raw
    except urllib.error.HTTPError as error:
        observation['http_status'] = error.code
    except Exception as error:
        observation['error_type'] = type(error).__name__
    finally:
        observations.append(observation)
    return None, observation, None


report = {'observed_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'scope': 'read-only account prerequisites; no deployment/release acceptance',
          'write_calls': 0, 'db_connections': 0, 'gas_calls': 0}
schema, schema_result, schema_raw = request(SCHEMA_URL, label='official Render OpenAPI schema')
required_paths = ['/users', '/owners', '/owners/{ownerId}', '/owners/{ownerId}/members', '/services', '/postgres']
report['official_schema'] = {
    **schema_result, 'url': SCHEMA_URL,
    'sha256': hashlib.sha256(schema_raw).hexdigest() if schema_raw else None,
    'required_GET_paths_present': {path: bool(schema and 'get' in schema.get('paths', {}).get(path, {})) for path in required_paths},
    'quota_or_billing_GET_paths': [path for path, item in (schema or {}).get('paths', {}).items()
                                 if 'get' in item and re.search(r'billing|quota|free.*hours|pipeline.*usage', path, re.I)]}

key = None
deploy_file = ROOT / '.env.deploy.local'
if deploy_file.is_file():
    for line in deploy_file.read_text(encoding='utf-8-sig').splitlines():
        match = re.match(r'^\s*RENDER_API_KEY\s*=\s*(.*)$', line)
        if match:
            key = match[1].strip().strip('\"\'')
report['render'] = {'credential_file_exists': deploy_file.is_file(), 'RENDER_API_KEY_present': bool(key)}
if key and all(report['official_schema']['required_GET_paths_present'].values()):
    user, meta, _ = request('https://api.render.com/v1/users', key, 'Render authenticated user')
    report['render']['user'] = {**meta, 'id_redacted': redact((user or {}).get('id')),
                                'name': (user or {}).get('name')}
    if meta.get('http_status') == 200:
        owners, meta, _ = request('https://api.render.com/v1/owners?limit=20', key, 'Render accessible workspaces (limit20)')
        rows = owners if isinstance(owners, list) else []
        workspace_rows = [row.get('owner', {}) for row in rows]
        report['render']['workspaces'] = {**meta, 'count': len(workspace_rows),
            'complete_within_limit': isinstance(owners, list) and len(rows) < 20,
            'items': [{'id_redacted': redact(row.get('id')), 'name': row.get('name'), 'type': row.get('type')} for row in workspace_rows]}
        # Do not explore multiple workspaces without an intended target.
        if len(workspace_rows) == 1 and workspace_rows[0].get('id'):
            selected_id = workspace_rows[0]['id']
            report['render']['workspace_selection'] = 'only workspace returned by bounded authenticated list'
            workspace, meta, _ = request('https://api.render.com/v1/owners/' + urllib.parse.quote(selected_id), key, 'Render selected workspace')
            workspace = workspace if isinstance(workspace, dict) else {}
            report['render']['workspace'] = {**meta, 'id_redacted': redact(workspace.get('id')),
                'name': workspace.get('name'), 'type': workspace.get('type'),
                'exposed_account_fields': sorted(workspace.keys()),
                'role': workspace.get('role') if isinstance(workspace.get('role'), str) else None,
                'plan': workspace.get('plan') if isinstance(workspace.get('plan'), str) else None}
            members, meta, _ = request('https://api.render.com/v1/owners/' + urllib.parse.quote(selected_id) + '/members', key, 'Render selected workspace caller role')
            member_rows = members if isinstance(members, list) else []
            own_member = next((row for row in member_rows if isinstance(row, dict) and (
                row.get('userId') == (user or {}).get('id') or
                row.get('email') and row.get('email') == (user or {}).get('email'))), None)
            report['render']['caller_membership'] = {**meta, 'matched_authenticated_user': own_member is not None,
                'role': (own_member or {}).get('role'), 'status': (own_member or {}).get('status')}
            for kind, path, wrapper in [('services', '/services', 'service'), ('postgres', '/postgres', 'postgres')]:
                query = urllib.parse.urlencode({'ownerId': selected_id, 'limit': 100})
                data, meta, _ = request('https://api.render.com/v1' + path + '?' + query, key, 'Render selected workspace ' + kind + ' (limit100)')
                rows = data if isinstance(data, list) else []
                records = [row.get(wrapper, {}) for row in rows if isinstance(row, dict)]
                projected = []
                for record in records:
                    detail = record.get('serviceDetails') or {}
                    projected.append({'id_redacted': redact(record.get('id')), **{
                        name: record.get(name) for name in [
                            'name', 'type', 'status', 'suspended', 'createdAt', 'expiresAt', 'plan', 'region', 'version'
                        ] if name in record}, 'service_plan': detail.get('plan'), 'service_region': detail.get('region')})
                report['render'][kind] = {**meta, 'count': len(records),
                    'complete_within_limit': isinstance(data, list) and len(rows) < 100,
                    'items': projected,
                    'active_free_postgres_count': sum(record.get('plan') == 'free' and record.get('status') not in ['expired', 'deleted'] and record.get('suspended') != 'suspended' for record in records) if kind == 'postgres' else None}
        else:
            report['render']['workspace_selection'] = 'not selected: zero or multiple workspaces; no resource/account exploration'

# Exactly one Vercel API read, using existing CLI identity and the exact project.
token = None
team = None
for base in [os.environ.get('APPDATA', ''), os.environ.get('LOCALAPPDATA', '')]:
    auth_path = Path(base) / 'com.vercel.cli/Data/auth.json'
    if auth_path.is_file():
        try:
            token = token or json.loads(auth_path.read_text(encoding='utf-8')).get('token')
            config_path = auth_path.parent / 'config.json'
            if config_path.is_file():
                team = team or json.loads(config_path.read_text(encoding='utf-8')).get('currentTeam')
        except Exception:
            pass
project_path = ROOT / '.vercel/project.json'
if project_path.is_file():
    try:
        local_project = json.loads(project_path.read_text(encoding='utf-8'))
        if local_project.get('projectId') == PROJECT:
            team = local_project.get('orgId') or team
    except Exception:
        pass
report['vercel'] = {'cli_auth_present': bool(token), 'project_id_redacted': redact(PROJECT), 'API_reads': 0}
if token:
    suffix = '?' + urllib.parse.urlencode({'teamId': team}) if team else ''
    project, meta, _ = request('https://api.vercel.com/v9/projects/' + PROJECT + suffix, token, 'Vercel exact AegisPay project Git settings')
    p = project if isinstance(project, dict) else {}
    link = p.get('link') if isinstance(p.get('link'), dict) else {}
    options = p.get('gitProviderOptions') if isinstance(p.get('gitProviderOptions'), dict) else {}
    report['vercel'].update({**meta, 'API_reads': 1, 'project_name': p.get('name'),
        'git_link_field_present': 'link' in p, 'git_link_is_null': p.get('link') is None,
        'git_link': {name: link.get(name) for name in ['type', 'org', 'repo', 'productionBranch', 'sourceless']},
        'git_provider_options_field_present': 'gitProviderOptions' in p,
        'git_provider_options': {name: options.get(name) for name in [
            'createDeployments', 'disableRepositoryDispatchEvents', 'gitCommitStatus', 'requireVerifiedCommits'] if name in options},
        'production_branch_top_level_present': 'productionBranch' in p,
        'production_branch_top_level': p.get('productionBranch'),
        'ignore_build_step_configured': bool(p.get('commandForIgnoringBuildStep')),
        'auto_assign_custom_domains': p.get('autoAssignCustomDomains'),
        'git_deployment_enabled_field_present': 'gitDeploymentEnabled' in p,
        'git_deployment_enabled': p.get('gitDeploymentEnabled') if isinstance(p.get('gitDeploymentEnabled'), bool) else None,
        'rootDirectory': p.get('rootDirectory'), 'nodeVersion': p.get('nodeVersion'),
        'sourceFilesOutsideRootDirectory': p.get('sourceFilesOutsideRootDirectory')})

report['requests'] = observations
target = OUT / 'authenticated-host-access-2026-11-10.json'
with target.open('x', encoding='utf-8') as output:
    output.write(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
print(json.dumps(report, indent=2, ensure_ascii=False))
