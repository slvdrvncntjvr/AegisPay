"""One-attempt guarded Free Render PostgreSQL staging prerequisite.

Default is read-only. Auth comes ONLY from RENDER_API_KEY in .env.deploy.local.
Never log raw provider responses, exception strings, URLs, passwords, or headers.
No application code is imported. Only the exact new resource may receive two SQL reads.
"""
from pathlib import Path
import argparse
import datetime as dt
import hashlib
import json
import os
import re
import subprocess
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
OUT = ROOT / 'docs/evidence/finals-staging-db'
SECRET_FILE = ROOT / '.env.staging.local'
ATTEMPT = OUT / 'create-attempt.json'
MANIFEST = json.loads((HERE / 'request-manifest.json').read_text(encoding='utf-8'))
LIMIT = MANIFEST['guards']['api_response_bytes_maximum']
NAME = 'aegispay-finals-staging'
KNOWN_SECRETS = []
KNOWN_IDS = []


class Stop(Exception):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


OPENER = urllib.request.build_opener(NoRedirect)


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def redact(value):
    return str(value)[:6] + '…' + str(value)[-4:] if value else None


def save_public(path, value, exclusive=False):
    encoded = json.dumps(value, indent=2, ensure_ascii=False) + '\n'
    if any(secret and secret in encoded for secret in KNOWN_SECRETS + KNOWN_IDS):
        raise Stop('ARTIFACT_SECRET_OR_ID_MATCH')
    with path.open('x' if exclusive else 'w', encoding='utf-8') as target:
        target.write(encoded)


def env_values(path):
    values = {}
    if path.is_file():
        for line in path.read_text(encoding='utf-8-sig').splitlines():
            match = re.match(r'^([A-Za-z_][A-Za-z0-9_]*)=(.*)$', line)
            if match:
                v = match[2].strip()
                if v.startswith('"'):
                    try:
                        v = json.loads(v)
                    except (ValueError, TypeError):
                        raise Stop('INVALID_PRIVATE_ENV_FORMAT')
                elif v.startswith("'") and v.endswith("'"):
                    v = v[1:-1]
                values[match[1]] = v
    return values


def safe_provider_error(data):
    # Error messages remain in memory. Persist only this fixed classification, never message/code contents.
    words = json.dumps(data).lower()
    if re.search(r'credit.?card|payment.method|billing|verify.*(account|identity)|verification', words):
        return 'PROVIDER_BILLING_OR_VERIFICATION_REQUIRED'
    if re.search(r'capacity|not.available|unavailable.*region|region.*unavailable', words):
        return 'PROVIDER_FREE_CAPACITY_UNAVAILABLE'
    if re.search(r'free.*(limit|already|one)|only.one.*free|quota', words):
        return 'PROVIDER_FREE_QUOTA_REJECTED'
    if re.search(r'disksizegb|disk.size|storage', words):
        return 'PROVIDER_STORAGE_CONFIGURATION_REJECTED'
    if re.search(r'postgres.*version|version.*(invalid|support)|unsupported.version', words):
        return 'PROVIDER_POSTGRES_VERSION_REJECTED'
    if re.search(r'permission|forbidden|not.authorized', words):
        return 'PROVIDER_PERMISSION_REJECTED'
    return 'PROVIDER_REQUEST_REJECTED'


def request(path, report, token=None, method='GET', payload=None, public=False):
    if public:
        if path != MANIFEST['schema_url'] or token or method != 'GET':
            raise Stop('UNEXPECTED_PUBLIC_TARGET')
        url, limit, label = path, MANIFEST['guards']['schema_response_bytes_maximum'], 'official-schema'
    else:
        if not path.startswith('/') or '://' in path:
            raise Stop('UNEXPECTED_API_TARGET')
        clean = path.split('?')[0]
        if method == 'POST' and clean != '/postgres':
            raise Stop('UNAUTHORIZED_MUTATION')
        if method not in ['GET', 'POST']:
            raise Stop('UNAUTHORIZED_METHOD')
        url, limit = 'https://api.render.com/v1' + path, LIMIT
        label = re.sub(r'/(tea|usr|dpg)-[^/]+', '/{redactedId}', clean)
    headers = {'User-Agent': 'AegisPay-guarded-free-staging-db', 'Accept': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    body = json.dumps(payload).encode() if payload is not None else None
    if body:
        headers['Content-Type'] = 'application/json'
    meta = {'operation': label, 'method': method, 'at_utc': now(), 'response_limit_bytes': limit}
    report['requests'].append(meta)
    try:
        response = OPENER.open(urllib.request.Request(url, data=body, headers=headers, method=method), timeout=20)
    except urllib.error.HTTPError as error:
        response = error
    except Exception as error:
        meta['safe_code'] = 'NETWORK_' + type(error).__name__.upper()
        raise Stop('CREATE_OUTCOME_UNKNOWN_NO_RETRY' if method == 'POST' else 'PROVIDER_READ_NETWORK_FAILURE')
    try:
        meta['http_status'] = response.code
        raw = response.read(limit + 1)
        meta['response_bytes'] = len(raw)
        # Retain only numeric API request counters, never arbitrary response headers.
        meta['api_request_rate_counters'] = {
            k: int(response.headers[k]) for k in ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset']
            if response.headers.get(k, '').isdigit()
        }
    except Exception:
        raise Stop('CREATE_OUTCOME_UNKNOWN_NO_RETRY' if method == 'POST' else 'PROVIDER_READ_FAILED')
    finally:
        response.close()
    if len(raw) > limit:
        raise Stop('CREATE_OUTCOME_UNKNOWN_BODY_LIMIT' if method == 'POST' else 'RESPONSE_BODY_LIMIT')
    try:
        data = json.loads(raw)
    except ValueError:
        raise Stop('CREATE_OUTCOME_UNKNOWN_NON_JSON' if method == 'POST' else 'NON_JSON_RESPONSE')
    if response.code != (201 if method == 'POST' else 200):
        meta['safe_code'] = safe_provider_error(data)
        meta['provider_error_code_retained'] = False
        meta['classification_source'] = 'fixed local allowlisted classifier, not a provider error code'
        if method == 'POST':
            receipt = json.loads(ATTEMPT.read_text(encoding='utf-8'))
            receipt.update({'state': 'HTTP_error_no_retry', 'http_status': response.code, 'safe_code': meta['safe_code'], 'response_at_utc': now()})
            save_public(ATTEMPT, receipt)
        raise Stop(meta['safe_code'])
    return data, raw


def resolve(schema, value):
    while isinstance(value, dict) and '$ref' in value:
        parts = value['$ref'].split('/')[1:]
        value = schema
        for part in parts:
            value = value[part]
    return value


def schema_review(report):
    schema, raw = request(MANIFEST['schema_url'], report, public=True)
    digest = hashlib.sha256(raw).hexdigest()
    report['official_schema'] = {'url': MANIFEST['schema_url'], 'sha256': digest, 'bytes': len(raw)}
    if digest != MANIFEST['reviewed_schema_sha256']:
        raise Stop('SCHEMA_CHANGED_REVIEW_REQUIRED')
    required = {'/users': 'get', '/owners': 'get', '/owners/{ownerId}': 'get', '/owners/{ownerId}/members': 'get', '/postgres': 'post', '/postgres/{postgresId}': 'get', '/postgres/{postgresId}/connection-info': 'get'}
    for path, method in required.items():
        if method not in schema['paths'].get(path, {}):
            raise Stop('REQUIRED_SCHEMA_OPERATION_MISSING')
    body = resolve(schema, schema['paths']['/postgres']['post']['requestBody']['content']['application/json']['schema'])
    projected = {k: resolve(schema, v) for k, v in body['properties'].items() if k in MANIFEST['request_without_ownerId'] or k == 'ownerId'}
    if 'free' not in projected['plan']['enum'] or '17' not in projected['version']['enum'] or 'singapore' not in projected['region']['enum']:
        raise Stop('FREE_POSTGRES17_SINGAPORE_NOT_SUPPORTED')
    save_public(OUT / 'schema-review.json', {'at_utc': now(), 'schema_sha256': digest, 'schema_bytes': len(raw), 'required_request_fields': body['required'], 'approved_request_field_schemas': projected, 'checked_operations': required})


def check_request(payload, workspace_id):
    approved = {'name': NAME, 'plan': 'free', 'version': '17', 'region': 'singapore', 'diskSizeGB': 1, 'enableHighAvailability': False, 'enableDiskAutoscaling': False, 'connectionPool': 'none', 'readReplicas': [], 'ownerId': workspace_id}
    if payload != approved:
        raise Stop('UNAPPROVED_REQUEST_FIELDS_OR_PAID_CONFIGURATION')


def project_database(db):
    identity = db.get('id')
    if identity:
        KNOWN_IDS.append(identity)
    return {
        'id_redacted': redact(identity),
        **{k: db.get(k) for k in ['name', 'status', 'plan', 'version', 'region', 'createdAt', 'expiresAt', 'diskSizeGB', 'highAvailabilityEnabled', 'diskAutoscalingEnabled', 'connectionPool', 'suspended', 'role']},
        'owner_id_redacted': redact((db.get('owner') or {}).get('id')),
        'read_replica_count': len(db.get('readReplicas') or []),
        'ip_allow_list_rule_count': len(db.get('ipAllowList') or []),
        'external_ipv4_anywhere_rule': any(v.get('cidrBlock') == '0.0.0.0/0' for v in db.get('ipAllowList') or []),
    }


def verify_database(db, owner_id):
    if not re.fullmatch(r'dpg-[a-z0-9-]+', db.get('id', '')) or db.get('name') != NAME or (db.get('owner') or {}).get('id') != owner_id:
        raise Stop('DATABASE_CUSTODY_MISMATCH')
    if db.get('plan') != 'free' or db.get('version') != '17' or db.get('region') != 'singapore' or db.get('highAvailabilityEnabled') is not False or db.get('diskAutoscalingEnabled') is not False or db.get('connectionPool') != 'none' or db.get('readReplicas'):
        raise Stop('DATABASE_CONFIGURATION_MISMATCH_NO_MUTATION')
    if db.get('diskSizeGB') not in [None, 1]:
        raise Stop('DATABASE_STORAGE_MISMATCH')
    # Both actual timestamps are mandatory, and are never estimated from wall-clock time.
    for field in ['createdAt', 'expiresAt']:
        value = db.get(field)
        if not isinstance(value, str):
            raise Stop('ACTUAL_LIFECYCLE_TIMESTAMP_MISSING')
        try:
            dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
        except ValueError:
            raise Stop('ACTUAL_LIFECYCLE_TIMESTAMP_INVALID')


def restrict_empty_secret_file():
    # Match the existing exclusive 0600 local-secret pattern, plus enforced Windows DACL.
    ignored = subprocess.run(['git', 'check-ignore', '--quiet', '.env.staging.local'], cwd=ROOT, capture_output=True, timeout=10)
    if ignored.returncode != 0:
        raise Stop('STAGING_ENV_NOT_GIT_IGNORED')
    fd = os.open(SECRET_FILE, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    os.close(fd)
    if os.name == 'nt':
        script = r'''$ErrorActionPreference='Stop'
$path=Join-Path (Get-Location) '.env.staging.local'
$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User
$system=[System.Security.Principal.SecurityIdentifier]::new('S-1-5-18')
$acl=[System.Security.AccessControl.FileSecurity]::new()
$acl.SetOwner($sid)
$acl.SetAccessRuleProtection($true,$false)
foreach($principal in @($sid,$system)) {
  $rule=[System.Security.AccessControl.FileSystemAccessRule]::new($principal,'FullControl','Allow')
  $acl.AddAccessRule($rule)
}
Set-Acl -LiteralPath $path -AclObject $acl
$check=Get-Acl -LiteralPath $path
$rules=@($check.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier]))
if(-not $check.AreAccessRulesProtected -or $rules.Count -ne 2) { exit 2 }
foreach($r in $rules) {
  if($r.IsInherited -or $r.AccessControlType -ne 'Allow' -or $r.FileSystemRights -ne 'FullControl' -or $r.IdentityReference.Value -notin @($sid.Value,$system.Value)) { exit 3 }
}
'''
        result = subprocess.run(['powershell', '-NoProfile', '-NonInteractive', '-Command', script], cwd=ROOT, capture_output=True, timeout=20, creationflags=subprocess.CREATE_NO_WINDOW)
        if result.returncode != 0:
            raise Stop('PRIVATE_ENV_ACL_SETUP_FAILED_NO_SECRET_WRITTEN')
        return 'protected DACL: current user + SYSTEM only; no inherited rules; verified before secret write'
    os.chmod(SECRET_FILE, 0o600)
    if (SECRET_FILE.stat().st_mode & 0o777) != 0o600:
        raise Stop('PRIVATE_ENV_MODE_INVALID')
    return '0600 verified before secret write'


def store_and_connect(db, connection, report):
    external = connection.get('externalConnectionString')
    password = connection.get('password')
    if not isinstance(external, str) or not isinstance(password, str) or not password:
        raise Stop('CONNECTION_INFO_MISSING')
    for value in connection.values():
        if isinstance(value, str) and value:
            KNOWN_SECRETS.append(value)
    parsed = urllib.parse.urlsplit(external)
    if parsed.scheme not in ['postgres', 'postgresql'] or parsed.hostname != db['id'] + '.singapore-postgres.render.com' or parsed.port not in [None, 5432] or urllib.parse.unquote(parsed.path[1:]) != db['databaseName'] or urllib.parse.unquote(parsed.username or '') != db['databaseUser'] or urllib.parse.unquote(parsed.password or '') != password:
        raise Stop('CONNECTION_INFO_RESOURCE_MISMATCH')
    # Canonical strict external TLS URL for later reviewed use; node smoke uses explicit SSL fields.
    external = urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path, 'sslmode=verify-full', ''))
    KNOWN_SECRETS.append(external)
    permissions = restrict_empty_secret_file()
    values = {'DATABASE_URL': external, 'RENDER_STAGING_POSTGRES_ID': db['id'], 'RENDER_STAGING_OWNER_ID': db['owner']['id'], 'RENDER_STAGING_CREATED_AT': db['createdAt'], 'RENDER_STAGING_EXPIRES_AT': db['expiresAt']}
    text = '# Private staging prerequisite only. No migration, seed, app, or worker authorization.\n' + ''.join(k + '=' + json.dumps(v) + '\n' for k, v in values.items())
    with SECRET_FILE.open('w', encoding='utf-8') as target:
        target.write(text)
        target.flush()
        os.fsync(target.fileno())
    report['private_configuration'] = {'file': '.env.staging.local', 'git_ignored': True, 'permissions': permissions, 'provider_key_copied': False, 'external_tls_mode': 'verify-full', 'connection_url_emitted': False}
    # Credentials travel only in the child process environment, never argv/stdout/stderr/evidence.
    child_env = {k: v for k, v in os.environ.items() if not k.startswith(('PG', 'DATABASE', 'RENDER', 'AEGIS_STAGING'))}
    child_env.update({'AEGIS_STAGING_EXTERNAL_URL': external, 'AEGIS_STAGING_EXPECTED_ID': db['id'], 'AEGIS_STAGING_EXPECTED_DATABASE': db['databaseName'], 'AEGIS_STAGING_EXPECTED_USER': db['databaseUser']})
    try:
        result = subprocess.run(['node', str(HERE / 'verify-connectivity.mjs')], cwd=ROOT, env=child_env, capture_output=True, text=True, timeout=30, creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        if len(result.stdout) > 4096:
            raise Stop('CONNECTIVITY_OUTPUT_LIMIT')
        observed = json.loads(result.stdout)
        allowed = {'outcome', 'sql_statements', 'tls_required', 'certificate_validation', 'hostname_validation', 'tls_encrypted', 'tls_authorized', 'tls_protocol', 'select_one', 'server_version', 'safe_code'}
        if not isinstance(observed, dict) or set(observed) - allowed:
            raise Stop('INVALID_CONNECTIVITY_OBSERVATION')
        report['connectivity'] = observed
        report['db_connections_attempted'] = 1
        if result.returncode != 0 or observed.get('outcome') != 'passed':
            raise Stop('MINIMAL_TLS_CONNECTIVITY_FAILED')
    except (ValueError, subprocess.TimeoutExpired):
        raise Stop('CONNECTIVITY_RESULT_UNAVAILABLE_NO_RETRY')


def run(args, report):
    if os.environ.get('NODE_TLS_REJECT_UNAUTHORIZED') == '0':
        raise Stop('UNSAFE_TLS_ENVIRONMENT')
    schema_review(report)
    key = env_values(ROOT / '.env.deploy.local').get('RENDER_API_KEY')
    if not key:
        raise Stop('EXISTING_RENDER_KEY_MISSING')
    KNOWN_SECRETS.append(key)
    user, _ = request('/users', report, key)
    KNOWN_IDS.append(user['id'])
    if redact(user.get('id')) != 'usr-cu…ctog':
        raise Stop('AUTHENTICATED_USER_CHANGED')
    owners, _ = request('/owners?limit=20', report, key)
    if not isinstance(owners, list) or len(owners) != 1:
        raise Stop('SOLE_WORKSPACE_NOT_VERIFIED')
    owner = owners[0].get('owner', {})
    owner_id = owner.get('id')
    expected = MANIFEST['selected_workspace']
    if not owner_id or redact(owner_id) != expected['id_redacted'] or owner.get('name') != expected['name'] or owner.get('type') != 'team':
        raise Stop('SELECTED_WORKSPACE_CHANGED')
    KNOWN_IDS.append(owner_id)
    workspace, _ = request('/owners/' + urllib.parse.quote(owner_id), report, key)
    if workspace.get('id') != owner_id:
        raise Stop('WORKSPACE_IDENTITY_MISMATCH')
    members, _ = request('/owners/' + urllib.parse.quote(owner_id) + '/members', report, key)
    own = next((v for v in members if v.get('userId') == user.get('id') or v.get('email') and v.get('email') == user.get('email')), {})
    if own.get('role') != 'ADMIN' or own.get('status') != 'active':
        raise Stop('ACTIVE_ADMIN_NOT_VERIFIED')
    report['workspace'] = {'id_redacted': redact(owner_id), 'id_sha256': hashlib.sha256(owner_id.encode()).hexdigest(), 'name': owner['name'], 'sole_accessible_workspace': True, 'caller_role': own['role'], 'caller_status': own['status'], 'plan_billing_verification_and_remaining_free_usage': 'not exposed by supported account reads; not queried through billing'}
    rows, _ = request('/postgres?' + urllib.parse.urlencode({'ownerId': owner_id, 'limit': 100}), report, key)
    if not isinstance(rows, list) or len(rows) >= 100 or any(not isinstance(v.get('postgres'), dict) for v in rows):
        raise Stop('POSTGRES_INVENTORY_NOT_COMPLETE')
    databases = [v['postgres'] for v in rows]
    for v in databases:
        if v.get('id'):
            KNOWN_IDS.append(v['id'])
    same = [v for v in databases if v.get('name') == NAME]
    report['inventory'] = {'count': len(databases), 'limit': 100, 'complete_within_limit': True, 'exact_name_count': len(same), 'other_active_free_count': sum(v.get('plan') == 'free' and v.get('name') != NAME and v.get('status') not in ['expired', 'deleted'] for v in databases)}
    if same:
        if len(same) != 1:
            raise Stop('DUPLICATE_NAME_EXISTS_NO_CREATE')
        report['existing_exact_name'] = project_database(same[0])
        verify_database(same[0], owner_id)
        # Read-only custody check, without connection-info retrieval or SQL on an adopted DB.
        local = env_values(SECRET_FILE)
        report['existing_custody'] = {'workspace_matches': True, 'private_receipt_identity_matches': local.get('RENDER_STAGING_POSTGRES_ID') == same[0]['id'] and local.get('RENDER_STAGING_OWNER_ID') == owner_id and local.get('RENDER_STAGING_CREATED_AT') == same[0]['createdAt'], 'connection_info_requested': False, 'sql_attempted': False}
        if args.observe_created:
            receipt = json.loads(ATTEMPT.read_text(encoding='utf-8')) if ATTEMPT.is_file() else {}
            if receipt.get('state') != 'HTTP201_created' or receipt.get('id_sha256') != hashlib.sha256(same[0]['id'].encode()).hexdigest() or receipt.get('createdAt') != same[0]['createdAt'] or receipt.get('owner_id_sha256') != hashlib.sha256(owner_id.encode()).hexdigest():
                raise Stop('OWN_CREATION_RECEIPT_NOT_VERIFIED_NO_CONNECTION')
            report['existing_custody']['own_creation_receipt_verified'] = True
            current, _ = request('/postgres/' + urllib.parse.quote(same[0]['id']), report, key)
            verify_database(current, owner_id)
            if current.get('id') != same[0]['id'] or current.get('createdAt') != receipt['createdAt']:
                raise Stop('CREATED_RESOURCE_CHANGED')
            report['created_database_latest'] = project_database(current)
            if current.get('status') != 'available':
                report['outcome'] = 'created_pending_provider_readiness'
                return
            if SECRET_FILE.exists():
                raise Stop('PRIVATE_STAGING_ENV_ALREADY_EXISTS_NO_OVERWRITE')
            connection, _ = request('/postgres/' + urllib.parse.quote(current['id']) + '/connection-info', report, key)
            store_and_connect(current, connection, report)
            report['outcome'] = 'free_staging_database_verified_minimal_tls'
            return
        report['outcome'] = 'existing_exact_name_reported_no_duplicate'
        return
    if databases:
        # The approved premise is an empty workspace inventory. Do not repurpose/delete anything.
        raise Stop('POSTGRES_INVENTORY_CHANGED_NO_CREATE')
    if not args.create_free_once:
        report['outcome'] = 'read_only_prerequisites_verified'
        return
    if SECRET_FILE.exists():
        raise Stop('PRIVATE_STAGING_ENV_ALREADY_EXISTS_NO_OVERWRITE')
    previous_local_failure = None
    if ATTEMPT.exists():
        if not args.resume_proven_undispatched:
            raise Stop('CREATE_ALREADY_ATTEMPTED_NO_RETRY')
        previous = json.loads(ATTEMPT.read_text(encoding='utf-8'))
        # This narrow recovery is for the saved Windows read-only-fsync failure only.
        # It cannot authorize a second POST or recover an ambiguous dispatched request.
        proof_path = OUT / 'observation-20261110T110645159671Z.json'
        proof = json.loads(proof_path.read_text(encoding='utf-8')) if proof_path.is_file() else {}
        if previous.get('state') != 'POST_intent_persisted_before_dispatch' or previous.get('owner_id_sha256') != hashlib.sha256(owner_id.encode()).hexdigest() or previous.get('name') != NAME or proof.get('create_attempts_this_invocation') != 0 or any(v.get('method') == 'POST' for v in proof.get('requests', [])) or proof.get('exception_type_only') != 'OSError' or not (proof.get('started_at_utc', '') <= previous.get('at_utc', '') <= proof.get('finished_at_utc', '')):
            raise Stop('UNDISPATCHED_RECOVERY_NOT_PROVEN')
        previous_local_failure = {'original_intent_at_utc': previous['at_utc'], 'proof': proof_path.name, 'cause': 'Windows os.fsync on read-only descriptor errno9 before POST marker', 'POST_requests_in_proof': 0, 'repair': 'fsync writable descriptor'}
    elif args.resume_proven_undispatched:
        raise Stop('NO_UNDISPATCHED_FAILURE_TO_RESUME')
    payload = {**MANIFEST['request_without_ownerId'], 'ownerId': owner_id}
    check_request(payload, owner_id)
    attempt = {'at_utc': now(), 'name': NAME, 'owner_id_redacted': redact(owner_id), 'owner_id_sha256': hashlib.sha256(owner_id.encode()).hexdigest(), 'plan': 'free', 'region': 'singapore', 'version': '17', 'state': 'POST_intent_persisted_before_dispatch', 'retry_authorized': False}
    if previous_local_failure:
        attempt['preserved_local_pre_dispatch_failure'] = previous_local_failure
    save_public(ATTEMPT, attempt, exclusive=previous_local_failure is None)
    # Fsync the durable intent before the single financial-resource handoff.
    with ATTEMPT.open('r+b') as saved:
        os.fsync(saved.fileno())
    report['create_attempts_this_invocation'] = 1
    db, _ = request('/postgres', report, key, method='POST', payload=payload)
    report['created_database'] = project_database(db)
    verify_database(db, owner_id)
    attempt.update({'state': 'HTTP201_created', 'id_redacted': redact(db['id']), 'id_sha256': hashlib.sha256(db['id'].encode()).hexdigest(), 'createdAt': db['createdAt'], 'expiresAt': db['expiresAt']})
    save_public(ATTEMPT, attempt)
    # One immediate status read, no readiness polling/retries. Async creation remains pending.
    current, _ = request('/postgres/' + urllib.parse.quote(db['id']), report, key)
    report['created_database_latest'] = project_database(current)
    verify_database(current, owner_id)
    if current['id'] != db['id'] or current['createdAt'] != db['createdAt']:
        raise Stop('CREATED_RESOURCE_CHANGED')
    if current.get('status') != 'available':
        report['outcome'] = 'created_pending_provider_readiness'
        return
    connection, _ = request('/postgres/' + urllib.parse.quote(db['id']) + '/connection-info', report, key)
    store_and_connect(current, connection, report)
    report['outcome'] = 'free_staging_database_verified_minimal_tls'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--create-free-once', action='store_true', help='one explicitly authorized Free create; never retries POST')
    group.add_argument('--observe-created', action='store_true', help='one bounded status read of resource matched to this helper creation receipt; no create')
    parser.add_argument('--resume-proven-undispatched', action='store_true', help='requires --create-free-once and exact preserved zero-POST Windows-fsync failure proof; never retries a POST')
    args = parser.parse_args()
    if args.resume_proven_undispatched and not args.create_free_once:
        parser.error('--resume-proven-undispatched requires --create-free-once')
    OUT.mkdir(parents=True, exist_ok=True)
    report = {'started_at_utc': now(), 'scope': 'independent empty Free staging PostgreSQL prerequisite only', 'requests': [], 'create_attempts_this_invocation': 0, 'db_connections_attempted': 0, 'live_payment_rpc_model_calls': 0, 'migrations_seeds_worker_jobs': 0, 'existing_resource_mutations': 0, 'public_site_or_git_mutations': 0, 'outcome': 'not_finished'}
    try:
        run(args, report)
    except Stop as error:
        report['outcome'] = 'blocked'
        report['safe_code'] = str(error)
    except Exception as error:
        report['outcome'] = 'blocked'
        report['safe_code'] = 'LOCAL_GUARD_OR_PROCESS_FAILURE'
        report['exception_type_only'] = type(error).__name__
    report['finished_at_utc'] = now()
    # Runtime-known secret and raw-resource-ID checks happen in memory before persistence.
    report['hygiene'] = {'runtime_known_secret_and_full_resource_id_scan': 'passed_before_persist', 'raw_provider_responses_persisted': False, 'raw_exception_strings_emitted': False, 'credentials_in_argv': False}
    name = 'observation-' + dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.json'
    save_public(OUT / name, report, exclusive=True)
    print(json.dumps({'outcome': report['outcome'], 'safe_code': report.get('safe_code'), 'observation': 'docs/evidence/finals-staging-db/' + name}))
    return 0 if report['outcome'] not in ['blocked', 'created_pending_provider_readiness'] else 2


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Stop:
        print('{"outcome":"blocked","safe_code":"PUBLIC_ARTIFACT_HYGIENE_GUARD"}')
        raise SystemExit(2)
