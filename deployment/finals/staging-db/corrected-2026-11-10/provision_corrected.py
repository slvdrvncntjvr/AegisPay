"""Separately authorized corrected Free request: at most one POST, never retries.

Local preflight is the default. --execute-corrected-once performs fresh bounded
schema/account/inventory reads and the single exact minimal request if all pass.
Prior artifacts and the original exhausted receipt remain byte-identical.
"""
from pathlib import Path
import argparse
import ast
import datetime as dt
from decimal import Decimal, ROUND_HALF_EVEN
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
BASE = HERE.parent
OUT = ROOT / 'docs/evidence/finals-staging-db/corrected-2026-11-10'
MANIFEST = json.loads((HERE / 'manifest.json').read_text(encoding='utf-8'))
RECEIPT = OUT / 'attempt-receipt.json'
SECRET_FILE = ROOT / '.env.staging.local'
EXPECTED = {'name': 'aegispay-finals-staging', 'plan': 'free', 'version': '17', 'region': 'singapore'}
KNOWN_SECRETS = []
KNOWN_IDS = []
DISPATCHED = False
sys.path.insert(0, str(BASE))
import provision as prior
from future_error_classifier import classify_error

# Only pure identity/configuration projections and the schema resolver are reused;
# the prior run/request/main/receipt/credential-store code is never called.
prior.KNOWN_SECRETS = KNOWN_SECRETS
prior.KNOWN_IDS = KNOWN_IDS


class Stop(Exception):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


OPENER = urllib.request.build_opener(NoRedirect)


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def redact(value):
    return value[:6] + '…' + value[-4:] if isinstance(value, str) else None


def write_public(path, value, exclusive=True):
    text = json.dumps(value, indent=2, ensure_ascii=False) + '\n'
    if any(v and v in text for v in KNOWN_SECRETS + KNOWN_IDS):
        raise Stop('ARTIFACT_HYGIENE_GUARD')
    # Writable descriptor, exclusive creation, flush and fsync all precede close.
    with path.open('x' if exclusive else 'w', encoding='utf-8') as target:
        target.write(text)
        target.flush()
        os.fsync(target.fileno())


def preserve_prior():
    baseline = json.loads((OUT / 'preserved-artifacts.json').read_text(encoding='utf-8'))
    for item in baseline['files']:
        if hashlib.sha256((ROOT / item['path']).read_bytes()).hexdigest() != item['sha256']:
            raise Stop('PRIOR_ARTIFACT_CHANGED')
    return len(baseline['files'])


def check_request(payload, owner_id):
    if not isinstance(owner_id, str) or not owner_id.startswith('tea-') or digest(owner_id) != MANIFEST['selected_workspace_id_sha256']:
        raise Stop('WORKSPACE_IDENTITY_MISMATCH')
    if payload != {**EXPECTED, 'ownerId': owner_id}:
        raise Stop('REQUEST_NOT_EXACT_MINIMAL_FREE_BODY')


def same_provider_timestamp(left, right):
    # POST may serialize nanoseconds while persisted GET rounds to microseconds.
    # Accept only equality at the less precise supplied fractional representation;
    # never replace a provider time with wall-clock time or a computed expiration.
    if left == right:
        return True
    pattern = r'^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)\.(\d{1,9})Z$'
    a = re.fullmatch(pattern, left) if isinstance(left, str) else None
    b = re.fullmatch(pattern, right) if isinstance(right, str) else None
    if not a or not b or a[1] != b[1]:
        return False
    quantum = Decimal(1).scaleb(-min(len(a[2]), len(b[2])))
    return Decimal('0.' + a[2]).quantize(quantum, rounding=ROUND_HALF_EVEN) == Decimal('0.' + b[2]).quantize(quantum, rounding=ROUND_HALF_EVEN)


def apply_restrictive_permissions(path):
    if path.resolve() not in [SECRET_FILE.resolve(), (OUT / 'private-acl-probe.txt').resolve()]:
        raise Stop('ACL_TARGET_OUTSIDE_ALLOWED_EXACT_FILES')
    if os.name == 'nt':
        pwsh = shutil.which('pwsh')
        if not pwsh:
            raise Stop('READ_ONLY_ACL_VERIFIER_RUNTIME_UNAVAILABLE')
        identity = subprocess.run([pwsh, '-NoProfile', '-NonInteractive', '-Command', '[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value'], cwd=ROOT, capture_output=True, text=True, timeout=10, creationflags=subprocess.CREATE_NO_WINDOW)
        sid = identity.stdout.strip()
        if identity.returncode or not re.fullmatch(r'S-1-5-[0-9-]+', sid):
            raise Stop('CURRENT_ACL_PRINCIPAL_NOT_VERIFIED')
        # DACL-only native operation avoids requesting owner/SACL privileges.
        # The file is invocation-created and has no unrelated explicit grants.
        result = subprocess.run(['icacls', str(path), '/inheritance:r', '/grant:r', '*' + sid + ':(F)', '*S-1-5-18:(F)'], cwd=ROOT, capture_output=True, timeout=20, creationflags=subprocess.CREATE_NO_WINDOW)
        if result.returncode:
            raise Stop('NATIVE_RESTRICTIVE_DACL_SETUP_FAILED')
        script = r'''$ErrorActionPreference='Stop'
$path=$env:AEGISPAY_ACL_VERIFY_TARGET
$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User
$system=[System.Security.Principal.SecurityIdentifier]::new('S-1-5-18')
$check=Get-Acl -LiteralPath $path
$rules=@($check.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier]))
if(-not $check.AreAccessRulesProtected -or $rules.Count -ne 2) { exit 2 }
foreach($r in $rules) {
 if($r.IsInherited -or $r.AccessControlType -ne 'Allow' -or $r.FileSystemRights -ne 'FullControl' -or $r.IdentityReference.Value -notin @($sid.Value,$system.Value)) { exit 3 }
}
'''
        result = subprocess.run([pwsh, '-NoProfile', '-NonInteractive', '-Command', script], cwd=ROOT, env={**os.environ, 'AEGISPAY_ACL_VERIFY_TARGET': str(path)}, capture_output=True, timeout=20, creationflags=subprocess.CREATE_NO_WINDOW)
        if result.returncode != 0:
            raise Stop('RESTRICTIVE_DACL_READBACK_FAILED')
    else:
        os.chmod(path, 0o600)
        if path.stat().st_mode & 0o777 != 0o600:
            raise Stop('PRIVATE_FILE_MODE_FAILED')
    return 'native DACL current-user and SYSTEM only; protected/no inherited grants; independently read back' if os.name == 'nt' else '0600 verified'


def acl_probe():
    probe = OUT / 'private-acl-probe.txt'
    if probe.exists():
        if probe.read_text(encoding='utf-8') not in ['', 'NON_SECRET_ACL_PROBE\n']:
            raise Stop('ACL_PROBE_CONTENT_CHANGED')
    else:
        fd = os.open(probe, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        os.close(fd)
    permissions = apply_restrictive_permissions(probe)
    if probe.stat().st_size == 0:
        with probe.open('w', encoding='utf-8') as target:
            target.write('NON_SECRET_ACL_PROBE\n')
            target.flush()
            os.fsync(target.fileno())
    return permissions


def store_and_connect(db, connection, report):
    external, password = connection.get('externalConnectionString'), connection.get('password')
    if not isinstance(external, str) or not isinstance(password, str) or not password:
        raise Stop('CONNECTION_INFO_MISSING')
    KNOWN_SECRETS.extend(v for v in connection.values() if isinstance(v, str) and v)
    parsed = urllib.parse.urlsplit(external)
    if parsed.scheme not in ['postgres', 'postgresql'] or parsed.hostname != db['id'] + '.singapore-postgres.render.com' or parsed.port not in [None, 5432] or urllib.parse.unquote(parsed.path[1:]) != db['databaseName'] or urllib.parse.unquote(parsed.username or '') != db['databaseUser'] or urllib.parse.unquote(parsed.password or '') != password:
        raise Stop('EXACT_NEW_RESOURCE_CONNECTION_IDENTITY_MISMATCH')
    external = urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path, 'sslmode=verify-full', ''))
    KNOWN_SECRETS.append(external)
    if subprocess.run(['git', 'check-ignore', '--quiet', '.env.staging.local'], cwd=ROOT, capture_output=True, timeout=10).returncode:
        raise Stop('STAGING_ENV_NOT_GIT_IGNORED')
    fd = os.open(SECRET_FILE, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    os.close(fd)
    permissions = apply_restrictive_permissions(SECRET_FILE)
    values = {'DATABASE_URL': external, 'RENDER_STAGING_POSTGRES_ID': db['id'], 'RENDER_STAGING_OWNER_ID': db['owner']['id'], 'RENDER_STAGING_CREATED_AT': db['createdAt'], 'RENDER_STAGING_EXPIRES_AT': db['expiresAt']}
    content = '# Private corrected Free staging prerequisite; no migration, seed, app or worker authorization.\n' + ''.join(k + '=' + json.dumps(v) + '\n' for k, v in values.items())
    with SECRET_FILE.open('w', encoding='utf-8') as target:
        target.write(content)
        target.flush()
        os.fsync(target.fileno())
    report['private_configuration'] = {'file': '.env.staging.local', 'exclusive_creation': True, 'git_ignored': True, 'permissions': permissions, 'permissions_verified_before_secret_write': True, 'provider_key_copied': False, 'external_TLS_mode': 'verify-full', 'credential_values_emitted': False}
    child = {k: v for k, v in os.environ.items() if not k.startswith(('PG', 'DATABASE', 'RENDER', 'AEGIS_STAGING'))}
    child.update({'AEGIS_STAGING_EXTERNAL_URL': external, 'AEGIS_STAGING_EXPECTED_ID': db['id'], 'AEGIS_STAGING_EXPECTED_DATABASE': db['databaseName'], 'AEGIS_STAGING_EXPECTED_USER': db['databaseUser']})
    report['db_connections_attempted'] = 1
    try:
        result = subprocess.run(['node', str(BASE / 'verify-connectivity.mjs')], cwd=ROOT, env=child, capture_output=True, text=True, timeout=30, creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        if len(result.stdout) > 4096:
            raise Stop('CONNECTIVITY_OUTPUT_LIMIT')
        observation = json.loads(result.stdout)
    except (ValueError, subprocess.TimeoutExpired):
        raise Stop('CONNECTIVITY_OBSERVATION_UNAVAILABLE_NO_RETRY')
    allowed = {'outcome', 'sql_statements', 'tls_required', 'certificate_validation', 'hostname_validation', 'tls_encrypted', 'tls_authorized', 'tls_protocol', 'select_one', 'server_version', 'safe_code'}
    if not isinstance(observation, dict) or set(observation) - allowed:
        raise Stop('CONNECTIVITY_OBSERVATION_NOT_ALLOWLISTED')
    report['connectivity'] = observation
    if result.returncode or observation.get('outcome') != 'passed':
        raise Stop('MINIMAL_STRICT_TLS_CONNECTIVITY_FAILED')


def local_guards():
    if RECEIPT.exists():
        raise Stop('CORRECTED_ATTEMPT_ALREADY_FENCED_NO_RETRY')
    if SECRET_FILE.exists():
        raise Stop('STAGING_ENV_ALREADY_EXISTS_NO_OVERWRITE')
    if MANIFEST['request_without_private_ownerId'] != EXPECTED or MANIFEST['maximum_POSTs'] != 1:
        raise Stop('CORRECTED_MANIFEST_CHANGED')
    if os.environ.get('NODE_TLS_REJECT_UNAUTHORIZED') == '0':
        raise Stop('UNSAFE_TLS_ENVIRONMENT')
    ignored = subprocess.run(['git', 'check-ignore', '--quiet', '.env.staging.local'], cwd=ROOT, capture_output=True, timeout=10)
    if ignored.returncode != 0:
        raise Stop('STAGING_ENV_NOT_GIT_IGNORED')
    for path in [Path(__file__), BASE / 'future_error_classifier.py', BASE / 'provision.py']:
        ast.parse(path.read_text(encoding='utf-8'))
    js = subprocess.run(['node', '--check', str(BASE / 'verify-connectivity.mjs')], cwd=ROOT, capture_output=True, timeout=10)
    pg = subprocess.run(['node', '--input-type=module', '-e', "import pg from 'pg'; import p from 'pg/package.json' with {type:'json'}; if(typeof pg.Client!=='function'||p.version!=='8.23.1')process.exit(1)"], cwd=ROOT, capture_output=True, timeout=10)
    if js.returncode or pg.returncode:
        raise Stop('LOCAL_STRICT_TLS_HELPER_OR_PINNED_PG_UNAVAILABLE')
    probe = OUT / 'writable-fsync-probe.json'
    if not probe.exists():
        write_public(probe, {'scope': 'non-secret pre-dispatch local durability probe', 'writable_flush_fsync': True})
    if json.loads(probe.read_text(encoding='utf-8')).get('writable_flush_fsync') is not True:
        raise Stop('PRE_DISPATCH_DURABILITY_PROBE_INVALID')
    return {'prior_artifacts_byte_identical': preserve_prior(), 'staging_env_absent_and_ignored': True, 'Python_syntax': 'passed', 'existing_TLS_helper_syntax': 'passed', 'installed_pg_exact_version': '8.23.1', 'writable_flush_fsync_readback': 'passed', 'secret_file_DACL_pattern_probe': acl_probe(), 'manifest_exact_minimal_Free': True}


def request(path, report, token=None, method='GET', payload=None, public=False):
    global DISPATCHED
    if public:
        if path != MANIFEST['schema_url'] or method != 'GET' or token:
            raise Stop('PUBLIC_SCHEMA_TARGET_INVALID')
        url, label, limit = path, 'official-schema', 4_000_000
    else:
        if method not in ['GET', 'POST'] or not path.startswith('/') or '://' in path or '..' in path:
            raise Stop('API_TARGET_INVALID')
        if method == 'POST':
            if path != '/postgres' or DISPATCHED or not RECEIPT.is_file():
                raise Stop('POST_NOT_AUTHORIZED_OR_ALREADY_DISPATCHED')
            check_request(payload, payload.get('ownerId'))
            DISPATCHED = True
            report['POST_attempts_this_operation'] = 1
        url = 'https://api.render.com/v1' + path
        label = re.sub(r'/(?:tea|dpg)-[^/?]+', '/{redactedId}', path.split('?')[0])
        limit = 524288
    headers = {'User-Agent': 'AegisPay-corrected-minimal-Free-once', 'Accept': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    body = json.dumps(payload).encode() if payload is not None else None
    if body is not None:
        headers['Content-Type'] = 'application/json'
    meta = {'operation': label, 'method': method, 'at_utc': now(), 'body_limit_bytes': limit}
    report['requests'].append(meta)
    try:
        response = OPENER.open(urllib.request.Request(url, data=body, headers=headers, method=method), timeout=20)
    except urllib.error.HTTPError as error:
        response = error
    except Exception:
        raise Stop('POST_OUTCOME_UNKNOWN_NO_RETRY' if method == 'POST' else 'BOUNDED_PROVIDER_READ_FAILED')
    try:
        status = response.code
        raw = response.read(limit + 1)
        meta.update({'http_status': status, 'response_bytes': len(raw), 'api_request_rate_counters': {k: int(response.headers[k]) for k in ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'] if response.headers.get(k, '').isdigit()}})
    except Exception:
        raise Stop('POST_OUTCOME_UNKNOWN_NO_RETRY' if method == 'POST' else 'BOUNDED_PROVIDER_READ_FAILED')
    finally:
        response.close()
    if len(raw) > limit:
        raise Stop('POST_OUTCOME_UNKNOWN_BODY_LIMIT_NO_RETRY' if method == 'POST' else 'READ_BODY_LIMIT')
    if status != (201 if method == 'POST' else 200):
        # Project the error while the bounded body is still in memory; never emit it.
        meta['error_classification'] = classify_error(status, raw)
        raise Stop(meta['error_classification']['classification_code'])
    try:
        value = json.loads(raw)
    except (ValueError, UnicodeDecodeError):
        raise Stop('POST_OUTCOME_UNKNOWN_NON_JSON_NO_RETRY' if method == 'POST' else 'READ_NON_JSON')
    return value, raw


def schema_review(report):
    schema, raw = request(MANIFEST['schema_url'], report, public=True)
    value = hashlib.sha256(raw).hexdigest()
    report['official_schema'] = {'sha256': value, 'bytes': len(raw)}
    if value != MANIFEST['reviewed_schema_sha256']:
        raise Stop('CURRENT_SCHEMA_CHANGED_REVIEW_REQUIRED')
    for path, method in [('/users', 'get'), ('/owners', 'get'), ('/owners/{ownerId}', 'get'), ('/owners/{ownerId}/members', 'get'), ('/postgres', 'get'), ('/postgres', 'post'), ('/postgres/{postgresId}', 'get'), ('/postgres/{postgresId}/connection-info', 'get')]:
        if method not in schema['paths'].get(path, {}):
            raise Stop('SCHEMA_OPERATION_MISSING')
    body = prior.resolve(schema, schema['paths']['/postgres']['post']['requestBody']['content']['application/json']['schema'])
    if set(body['required']) != {'name', 'ownerId', 'plan', 'version'}:
        raise Stop('SCHEMA_REQUIRED_FIELDS_CHANGED')
    for key in ['plan', 'version', 'region']:
        if EXPECTED[key] not in prior.resolve(schema, body['properties'][key]).get('enum', []):
            raise Stop('MINIMAL_FREE17_SINGAPORE_NOT_SUPPORTED')
    report['official_schema']['minimal_fields_and_enum_values_verified'] = True


def read_provider_key():
    for line in (ROOT / '.env.deploy.local').read_text(encoding='utf-8-sig').splitlines():
        match = re.match(r'^RENDER_API_KEY=(.*)$', line)
        if match:
            value = match[1].strip()
            if value.startswith('"'):
                value = json.loads(value)
            elif value.startswith("'") and value.endswith("'"):
                value = value[1:-1]
            if isinstance(value, str) and value:
                KNOWN_SECRETS.append(value)
                return value
    raise Stop('EXISTING_RENDER_KEY_MISSING')


def execute(report):
    report['local_guards'] = local_guards()
    schema_review(report)
    key = read_provider_key()
    user, _ = request('/users', report, key)
    KNOWN_IDS.append(user['id'])
    if redact(user['id']) != 'usr-cu…ctog':
        raise Stop('AUTHENTICATED_CALLER_CHANGED')
    owners, _ = request('/owners?limit=20', report, key)
    if not isinstance(owners, list) or len(owners) != 1:
        raise Stop('SOLE_WORKSPACE_NOT_VERIFIED')
    selected = owners[0].get('owner', {})
    owner_id = selected.get('id')
    if not isinstance(owner_id, str) or digest(owner_id) != MANIFEST['selected_workspace_id_sha256'] or selected.get('name') != 'My Workspace' or selected.get('type') != 'team':
        raise Stop('SELECTED_WORKSPACE_CHANGED')
    KNOWN_IDS.append(owner_id)
    owner, _ = request('/owners/' + urllib.parse.quote(owner_id), report, key)
    if owner.get('id') != owner_id:
        raise Stop('SELECTED_WORKSPACE_DETAIL_MISMATCH')
    members, _ = request('/owners/' + urllib.parse.quote(owner_id) + '/members', report, key)
    if not isinstance(members, list):
        raise Stop('MEMBERSHIP_NOT_VERIFIED')
    own = [v for v in members if v.get('userId') == user['id'] or v.get('email') and v.get('email') == user.get('email')]
    if len(own) != 1 or own[0].get('role') != 'ADMIN' or own[0].get('status') != 'active':
        raise Stop('ACTIVE_ADMIN_NOT_VERIFIED')
    report['workspace'] = {'id_redacted': redact(owner_id), 'id_sha256': digest(owner_id), 'sole_accessible': True, 'role': 'ADMIN', 'status': 'active', 'billing_verification_remaining_usage': 'not exposed; not inspected'}
    rows, _ = request('/postgres?' + urllib.parse.urlencode({'ownerId': owner_id, 'limit': 100}), report, key)
    if not isinstance(rows, list) or len(rows) >= 100 or any(not isinstance(v.get('postgres'), dict) for v in rows):
        raise Stop('INVENTORY_COMPLETENESS_NOT_VERIFIED')
    databases = [v['postgres'] for v in rows]
    report['inventory'] = {'count': len(databases), 'complete_within_limit_100': True, 'exact_name_count': sum(v.get('name') == EXPECTED['name'] for v in databases)}
    if databases:
        report['existing_resources_custody_only'] = [prior.project_database(v) for v in databases]
        raise Stop('DATABASE_EXISTS_NO_CREATE_NO_CONNECTION')
    payload = {**EXPECTED, 'ownerId': owner_id}
    check_request(payload, owner_id)
    if RECEIPT.exists() or SECRET_FILE.exists() or preserve_prior() != report['local_guards']['prior_artifacts_byte_identical']:
        raise Stop('PRE_DISPATCH_FENCE_OR_ENV_CHANGED')
    receipt = {'operation': MANIFEST['operation'], 'authorization_dispatch': MANIFEST['authorization_dispatch'], 'created_at_utc': now(), 'state': 'single_POST_ready_for_dispatch', 'maximum_POSTs': 1, 'retry_allowed': False, 'workspace_id_redacted': redact(owner_id), 'workspace_id_sha256': digest(owner_id), 'request_without_private_ownerId': EXPECTED, 'original_receipt_sha256': hashlib.sha256((ROOT / MANIFEST['original_receipt_preserved']).read_bytes()).hexdigest(), 'local_guards': report['local_guards'], 'schema_sha256': report['official_schema']['sha256']}
    write_public(RECEIPT, receipt)
    # Readback occurs before dispatch. A local failure still fences this operation.
    if json.loads(RECEIPT.read_text(encoding='utf-8')) != receipt:
        raise Stop('DURABLE_RECEIPT_READBACK_FAILED_NO_DISPATCH')
    report['durable_receipt_fsynced_and_read_back_before_dispatch'] = True
    db, _ = request('/postgres', report, key, method='POST', payload=payload)
    report['created_database'] = prior.project_database(db)
    prior.verify_database(db, owner_id)
    report['created_resource_identity_sha256'] = digest(db['id'])
    current, _ = request('/postgres/' + urllib.parse.quote(db['id']), report, key)
    report['immediate_status_reads_after_HTTP201'] = 1
    report['created_database_latest'] = prior.project_database(current)
    prior.verify_database(current, owner_id)
    if current['id'] != db['id'] or not same_provider_timestamp(current['createdAt'], db['createdAt']) or not same_provider_timestamp(current['expiresAt'], db['expiresAt']):
        raise Stop('NEW_RESOURCE_IDENTITY_OR_LIFECYCLE_CHANGED')
    if current.get('status') != 'available':
        report['outcome'] = 'created_pending_provider_readiness'
        report['later_observation_requires_separate_authorization'] = True
        return
    info, _ = request('/postgres/' + urllib.parse.quote(db['id']) + '/connection-info', report, key)
    report['connection_phase_entered_for_exact_new_resource'] = True
    store_and_connect(current, info, report)
    report['outcome'] = 'created_Free17_verified_minimal_TLS'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute-corrected-once', action='store_true')
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    report = {'operation': MANIFEST['operation'], 'started_at_utc': now(), 'requests': [], 'POST_attempts_this_operation': 0, 'db_connections_attempted': 0, 'existing_resource_mutations': 0, 'migrations_seeds_workers_models_payments': 0, 'Git_deployment_alias_or_secret_upload_actions': 0, 'outcome': 'not_finished'}
    try:
        if args.execute_corrected_once:
            execute(report)
        else:
            report['local_guards'] = local_guards()
            report['outcome'] = 'local_pre_dispatch_guards_passed_no_network'
    except (Stop, prior.Stop) as error:
        report['outcome'] = 'stopped_no_retry'
        report['safe_code'] = str(error) if re.fullmatch(r'[A-Z0-9_]+', str(error)) else 'SAFE_GUARD_STOP'
    except Exception as error:
        report['outcome'] = 'stopped_no_retry'
        report['safe_code'] = 'LOCAL_OR_PROVIDER_PROCESS_FAILURE'
        report['exception_type_only'] = type(error).__name__
    report['finished_at_utc'] = now()
    report['prior_artifacts_byte_identical_after_run'] = preserve_prior()
    report['privacy'] = {'raw_provider_responses_saved': False, 'raw_errors_or_headers_emitted': False, 'runtime_known_secret_and_full_ID_scan_before_persist': True}
    filename = 'observation-' + dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.json'
    write_public(OUT / filename, report)
    print(json.dumps({'outcome': report['outcome'], 'safe_code': report.get('safe_code'), 'observation': 'docs/evidence/finals-staging-db/corrected-2026-11-10/' + filename}))
    return 2 if report['outcome'] == 'stopped_no_retry' else 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception as error:
        print(json.dumps({'outcome': 'stopped_no_retry', 'safe_code': 'FINAL_ARTIFACT_GUARD_FAILURE', 'exception_type_only': type(error).__name__}))
        raise SystemExit(2)
