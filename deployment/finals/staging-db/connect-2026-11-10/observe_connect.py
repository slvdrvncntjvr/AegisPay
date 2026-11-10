"""Bounded GET-only observation and strict minimal SQL on the existing staging DB.

Default preflight is local only. --observe-connect-once consumes a new durable
read permit; no creation/mutation/retry/reset path exists. Prior history is frozen.
"""
from pathlib import Path
import argparse
import ast
import datetime as dt
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
BASE = HERE.parent
ROOT = HERE.parents[3]
OUT = ROOT / 'docs/evidence/finals-staging-db/connect-2026-11-10'
SECRET_FILE = ROOT / '.env.staging.local'
SECRET_TEMP = OUT / '.env.staging.local.pending'
PROBE_TEMP = OUT / 'atomic-acl-probe.pending'
PROBE_FINAL = OUT / 'atomic-acl-probe.txt'
PERMIT = OUT / 'observation-permit.json'
MANIFEST = json.loads((HERE / 'manifest.json').read_text(encoding='utf-8'))
KNOWN_SECRETS = []
KNOWN_IDS = []
sys.path.insert(0, str(BASE / 'corrected-2026-11-10'))
import provision_corrected as corrected
sys.path.insert(0, str(BASE))
from future_error_classifier import classify_error


class Stop(Exception):
    pass


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def sha(value):
    return hashlib.sha256(value.encode()).hexdigest()


def redact(value):
    return value[:6] + '…' + value[-4:] if isinstance(value, str) else None


def save(path, value):
    text = json.dumps(value, indent=2, ensure_ascii=False) + '\n'
    if any(v and v in text for v in KNOWN_SECRETS + KNOWN_IDS):
        raise Stop('PUBLIC_ARTIFACT_HYGIENE_GUARD')
    with path.open('x', encoding='utf-8') as target:
        target.write(text)
        target.flush()
        os.fsync(target.fileno())


def preserved_count():
    baseline = json.loads((OUT / 'preserved-artifacts.json').read_text(encoding='utf-8'))
    for item in baseline['files']:
        if hashlib.sha256((ROOT / item['path']).read_bytes()).hexdigest() != item['sha256']:
            raise Stop('PRESERVED_HISTORY_CHANGED')
    return len(baseline['files'])


def creation_provenance():
    receipt = json.loads((ROOT / MANIFEST['preserved_creation_receipt']).read_text(encoding='utf-8'))
    assessment = json.loads((ROOT / MANIFEST['preserved_creation_assessment']).read_text(encoding='utf-8'))
    actual = json.loads((ROOT / MANIFEST['preserved_creation_assessment']).with_name(assessment['source_observation']).read_text(encoding='utf-8'))
    posts = [v for v in actual['requests'] if v['method'] == 'POST']
    if receipt.get('authorization_dispatch') != 'ctx_e6d7791811dd' or receipt.get('workspace_id_sha256') != MANIFEST['workspace_id_sha256'] or assessment.get('created_resource_identity_sha256') != MANIFEST['database_id_sha256'] or len(posts) != 1 or posts[0].get('http_status') != 201:
        raise Stop('IMMUTABLE_CREATION_PROVENANCE_MISMATCH')
    for key in ['createdAt', 'expiresAt']:
        if not corrected.same_provider_timestamp(assessment['database'][key], MANIFEST['expected_' + key]):
            raise Stop('CREATION_PROVENANCE_LIFECYCLE_MISMATCH')
    return {'immutable_HTTP201_receipt_and_assessment_matched': True, 'creation_dispatch': receipt['authorization_dispatch']}


def acl_verify(path):
    if path.resolve() not in [v.resolve() for v in [SECRET_FILE, SECRET_TEMP, PROBE_TEMP, PROBE_FINAL]]:
        raise Stop('ACL_VERIFICATION_TARGET_INVALID')
    if os.name != 'nt':
        if path.stat().st_mode & 0o777 != 0o600:
            raise Stop('PRIVATE_MODE_NOT_0600')
        return '0600 verified'
    pwsh = shutil.which('pwsh')
    if not pwsh:
        raise Stop('ACL_VERIFIER_RUNTIME_MISSING')
    script = r'''$ErrorActionPreference='Stop'
$check=Get-Acl -LiteralPath $env:AEGISPAY_STAGING_ACL_TARGET
$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User
$system=[System.Security.Principal.SecurityIdentifier]::new('S-1-5-18')
$rules=@($check.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier]))
if(-not $check.AreAccessRulesProtected -or $rules.Count -ne 2) { exit 2 }
foreach($r in $rules) {
 if($r.IsInherited -or $r.AccessControlType -ne 'Allow' -or $r.FileSystemRights -ne 'FullControl' -or $r.IdentityReference.Value -notin @($sid.Value,$system.Value)) { exit 3 }
}
'''
    result = subprocess.run([pwsh, '-NoProfile', '-NonInteractive', '-Command', script], cwd=ROOT, env={**os.environ, 'AEGISPAY_STAGING_ACL_TARGET': str(path)}, capture_output=True, timeout=15, creationflags=subprocess.CREATE_NO_WINDOW)
    if result.returncode:
        raise Stop('PROTECTED_CURRENT_USER_SYSTEM_DACL_NOT_VERIFIED')
    return 'protected current-user/SYSTEM FullControl only; no inherited grants; read back'


def restrict_new_file(path):
    if path.resolve() not in [SECRET_TEMP.resolve(), PROBE_TEMP.resolve()]:
        raise Stop('PRIVATE_TEMPORARY_TARGET_INVALID')
    fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    os.close(fd)
    if os.name == 'nt':
        pwsh = shutil.which('pwsh')
        if not pwsh:
            raise Stop('ACL_VERIFIER_RUNTIME_MISSING')
        result = subprocess.run([pwsh, '-NoProfile', '-NonInteractive', '-Command', '[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value'], cwd=ROOT, capture_output=True, text=True, timeout=10, creationflags=subprocess.CREATE_NO_WINDOW)
        sid = result.stdout.strip()
        if result.returncode or not re.fullmatch(r'S-1-5-[0-9-]+', sid):
            raise Stop('ACL_CURRENT_PRINCIPAL_UNAVAILABLE')
        result = subprocess.run(['icacls', str(path), '/inheritance:r', '/grant:r', '*' + sid + ':(F)', '*S-1-5-18:(F)'], cwd=ROOT, capture_output=True, timeout=15, creationflags=subprocess.CREATE_NO_WINDOW)
        if result.returncode:
            raise Stop('RESTRICTIVE_DACL_SETUP_FAILED')
    else:
        os.chmod(path, 0o600)
    return acl_verify(path)


def atomic_publish(source, destination):
    if (source.resolve(), destination.resolve()) not in [(SECRET_TEMP.resolve(), SECRET_FILE.resolve()), (PROBE_TEMP.resolve(), PROBE_FINAL.resolve())]:
        raise Stop('ATOMIC_PUBLICATION_TARGET_INVALID')
    try:
        # Hardlink publication is atomic and exclusive: it never replaces a destination.
        # Both paths are on the same local volume and retain the protected file DACL.
        os.link(source, destination)
    except FileExistsError:
        raise Stop('ATOMIC_DESTINATION_EXISTS_NO_OVERWRITE')
    except OSError:
        raise Stop('ATOMIC_PUBLICATION_FAILED_NO_OVERWRITE')
    acl_verify(destination)
    source.unlink()


def local_preflight():
    if PERMIT.exists():
        raise Stop('OBSERVATION_PERMIT_ALREADY_CONSUMED_NO_RETRY')
    if SECRET_FILE.exists() or SECRET_TEMP.exists():
        raise Stop('STAGING_ENV_OR_TEMP_EXISTS_NO_OVERWRITE')
    if os.environ.get('NODE_TLS_REJECT_UNAUTHORIZED') == '0':
        raise Stop('UNSAFE_TLS_ENVIRONMENT')
    for path in [SECRET_FILE, SECRET_TEMP]:
        result = subprocess.run(['git', 'check-ignore', '--quiet', str(path.relative_to(ROOT))], cwd=ROOT, capture_output=True, timeout=10)
        if result.returncode:
            raise Stop('PRIVATE_STAGING_PATH_NOT_GIT_IGNORED')
    for path in HERE.glob('*.py'):
        ast.parse(path.read_text(encoding='utf-8'))
    result = subprocess.run(['node', '--check', str(BASE / 'verify-connectivity.mjs')], cwd=ROOT, capture_output=True, timeout=10)
    pg = subprocess.run(['node', '--input-type=module', '-e', "import pg from 'pg'; import p from 'pg/package.json' with {type:'json'}; if(typeof pg.Client!=='function'||p.version!=='8.23.1')process.exit(1)"], cwd=ROOT, capture_output=True, timeout=10)
    if result.returncode or pg.returncode:
        raise Stop('EXISTING_TLS_HELPER_OR_PINNED_PG_UNAVAILABLE')
    if not PROBE_FINAL.exists():
        restrict_new_file(PROBE_TEMP)
        with PROBE_TEMP.open('w', encoding='utf-8') as target:
            target.write('NON_SECRET_ATOMIC_DACL_PROBE\n')
            target.flush()
            os.fsync(target.fileno())
        atomic_publish(PROBE_TEMP, PROBE_FINAL)
    if PROBE_FINAL.read_text(encoding='utf-8') != 'NON_SECRET_ATOMIC_DACL_PROBE\n':
        raise Stop('ATOMIC_PROBE_CONTENT_MISMATCH')
    return {'prior_artifacts_byte_identical': preserved_count(), 'creation_provenance': creation_provenance(), 'private_destination_and_temp_absent_ignored': True, 'atomic_exclusive_publication_fsync_readback': 'passed using nonsecret probe', 'DACL': acl_verify(PROBE_FINAL), 'existing_TLS_helper_syntax': 'passed', 'installed_pg_version': '8.23.1'}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class ReadTransport:
    def __init__(self, key, report):
        self.key, self.report = key, report
        self.allowed = {'/users': 'caller', '/owners?limit=20': 'workspace-discovery'}
        self.opener = urllib.request.build_opener(NoRedirect)
        self.status_count = self.connection_info_count = 0

    def get(self, path):
        label = self.allowed.get(path)
        if not label:
            raise Stop('READ_TARGET_NOT_EXPLICITLY_ALLOWED')
        if label == 'exact-resource-status':
            if self.status_count:
                raise Stop('DIRECT_STATUS_GET_LIMIT_ALREADY_CONSUMED')
            self.status_count += 1
            self.report['direct_status_GETs'] = self.status_count
        if label == 'exact-resource-connection-info':
            if self.connection_info_count:
                raise Stop('CONNECTION_INFO_GET_LIMIT_ALREADY_CONSUMED')
            self.connection_info_count += 1
            self.report['connection_info_GETs'] = self.connection_info_count
        meta = {'operation': label, 'method': 'GET', 'at_utc': now(), 'timeout_seconds': 20, 'body_limit_bytes': 524288}
        self.report['requests'].append(meta)
        req = urllib.request.Request('https://api.render.com/v1' + path, headers={'User-Agent': 'AegisPay-single-owned-resource-TLS-check', 'Accept': 'application/json', 'Authorization': 'Bearer ' + self.key}, method='GET')
        try:
            response = self.opener.open(req, timeout=20)
        except urllib.error.HTTPError as error:
            response = error
        except Exception:
            raise Stop('BOUNDED_PROVIDER_GET_FAILED_NO_RETRY')
        try:
            status = response.code
            raw = response.read(524289)
            meta.update({'http_status': status, 'response_bytes': len(raw)})
        except Exception:
            raise Stop('PROVIDER_RESPONSE_READ_FAILED_NO_RETRY')
        finally:
            response.close()
        if len(raw) > 524288:
            raise Stop('PROVIDER_RESPONSE_BODY_LIMIT')
        if status != 200:
            meta['safe_error_classification'] = classify_error(status, raw)
            raise Stop(meta['safe_error_classification']['classification_code'])
        try:
            return json.loads(raw)
        except (ValueError, UnicodeDecodeError):
            raise Stop('PROVIDER_RESPONSE_NOT_JSON')


def verify_resource(db, owner_id):
    if not isinstance(db, dict) or not isinstance(db.get('id'), str) or sha(db['id']) != MANIFEST['database_id_sha256']:
        raise Stop('EXACT_DATABASE_IDENTITY_HASH_MISMATCH')
    KNOWN_IDS.append(db['id'])
    corrected.prior.verify_database(db, owner_id)
    for key in ['createdAt', 'expiresAt']:
        if not corrected.same_provider_timestamp(db[key], MANIFEST['expected_' + key]):
            raise Stop('EXACT_DATABASE_LIFECYCLE_MISMATCH')


def public_db(db):
    return {'id_redacted': redact(db['id']), **{k: db.get(k) for k in ['name', 'status', 'plan', 'version', 'region', 'createdAt', 'expiresAt', 'diskSizeGB', 'highAvailabilityEnabled', 'diskAutoscalingEnabled', 'connectionPool', 'suspended', 'role']}, 'owner_id_redacted': redact((db.get('owner') or {}).get('id')), 'read_replica_count': len(db.get('readReplicas') or []), 'returned_IP_rule_count': len(db.get('ipAllowList') or [])}


def private_persist_and_connect(db, info, report):
    external, password = info.get('externalConnectionString'), info.get('password')
    if not isinstance(external, str) or not isinstance(password, str) or not password:
        raise Stop('CONNECTION_INFO_FIELDS_MISSING')
    KNOWN_SECRETS.extend(v for v in info.values() if isinstance(v, str) and v)
    parsed = urllib.parse.urlsplit(external)
    if parsed.scheme not in ['postgres', 'postgresql'] or parsed.hostname != db['id'] + '.singapore-postgres.render.com' or parsed.port not in [None, 5432] or urllib.parse.unquote(parsed.path[1:]) != db['databaseName'] or urllib.parse.unquote(parsed.username or '') != db['databaseUser'] or urllib.parse.unquote(parsed.password or '') != password:
        raise Stop('CONNECTION_INFO_EXACT_RESOURCE_MISMATCH')
    external = urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path, 'sslmode=verify-full', ''))
    KNOWN_SECRETS.append(external)
    if SECRET_FILE.exists():
        raise Stop('PRIVATE_DESTINATION_EXISTS_NO_OVERWRITE')
    permissions = restrict_new_file(SECRET_TEMP)
    values = {'DATABASE_URL': external, 'RENDER_STAGING_POSTGRES_ID': db['id'], 'RENDER_STAGING_OWNER_ID': db['owner']['id'], 'RENDER_STAGING_CREATED_AT': db['createdAt'], 'RENDER_STAGING_EXPIRES_AT': db['expiresAt']}
    content = '# Private isolated Free staging prerequisite. No migration, seed, app or worker authorization.\n' + ''.join(k + '=' + json.dumps(v) + '\n' for k, v in values.items())
    with SECRET_TEMP.open('w', encoding='utf-8') as target:
        target.write(content)
        target.flush()
        os.fsync(target.fileno())
    if SECRET_TEMP.read_text(encoding='utf-8') != content:
        raise Stop('PRIVATE_FSYNC_READBACK_FAILED')
    atomic_publish(SECRET_TEMP, SECRET_FILE)
    report['private_configuration'] = {'path': '.env.staging.local', 'Git_ignored': True, 'exclusive_atomic_publication': True, 'permissions_before_secret_write': permissions, 'permissions_after_publication': acl_verify(SECRET_FILE), 'writable_flush_fsync_readback': True, 'temporary_link_removed': not SECRET_TEMP.exists(), 'provider_key_copied': False, 'external_TLS_mode': 'verify-full', 'credential_values_or_fingerprints_emitted': False}
    # Keep inherited process configuration small; no PG, database, SDK or Node injection env.
    inherited = {'PATH', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'COMSPEC', 'PATHEXT'}
    child = {k: v for k, v in os.environ.items() if k.upper() in inherited}
    child.update({'AEGIS_STAGING_EXTERNAL_URL': external, 'AEGIS_STAGING_EXPECTED_ID': db['id'], 'AEGIS_STAGING_EXPECTED_DATABASE': db['databaseName'], 'AEGIS_STAGING_EXPECTED_USER': db['databaseUser']})
    report['SQL_connection_processes_started'] = 1
    try:
        result = subprocess.run(['node', str(BASE / 'verify-connectivity.mjs')], cwd=ROOT, env=child, capture_output=True, text=True, timeout=30, creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        if len(result.stdout) > 4096:
            raise Stop('SQL_HELPER_OUTPUT_LIMIT')
        observed = json.loads(result.stdout)
    except (ValueError, subprocess.TimeoutExpired):
        raise Stop('STRICT_TLS_SQL_RESULT_UNAVAILABLE_NO_RETRY')
    allowed = {'outcome', 'sql_statements', 'tls_required', 'certificate_validation', 'hostname_validation', 'tls_encrypted', 'tls_authorized', 'tls_protocol', 'select_one', 'server_version', 'safe_code'}
    if not isinstance(observed, dict) or set(observed) - allowed:
        raise Stop('SQL_HELPER_OUTPUT_NOT_ALLOWLISTED')
    report['connectivity'] = observed
    if result.returncode or observed.get('outcome') != 'passed':
        code = observed.get('safe_code')
        raise Stop(code if isinstance(code, str) and re.fullmatch(r'[A-Z0-9_]+', code) else 'STRICT_TLS_SQL_FAILED')


def observe_once(report):
    report['preflight'] = local_preflight()
    permit = {'operation': MANIFEST['operation'], 'dispatch': MANIFEST['authorization_dispatch'], 'at_utc': now(), 'allowed_methods': ['GET'], 'maximum_direct_status_GETs': 1, 'maximum_connection_info_GETs': 1, 'maximum_SQL_connection_processes': 1, 'retry_allowed': False, 'expected_resource_identity_sha256': MANIFEST['database_id_sha256'], 'preflight': report['preflight']}
    save(PERMIT, permit)
    if json.loads(PERMIT.read_text(encoding='utf-8')) != permit:
        raise Stop('OBSERVATION_PERMIT_READBACK_FAILED')
    key = corrected.read_provider_key()
    KNOWN_SECRETS.append(key)
    transport = ReadTransport(key, report)
    user = transport.get('/users')
    KNOWN_IDS.append(user['id'])
    if redact(user['id']) != 'usr-cu…ctog':
        raise Stop('CALLER_CUSTODY_CHANGED')
    owners = transport.get('/owners?limit=20')
    if not isinstance(owners, list) or len(owners) != 1:
        raise Stop('SOLE_SELECTED_WORKSPACE_NOT_VERIFIED')
    owner = owners[0].get('owner', {})
    owner_id = owner.get('id')
    if not isinstance(owner_id, str) or sha(owner_id) != MANIFEST['workspace_id_sha256'] or owner.get('name') != 'My Workspace' or owner.get('type') != 'team':
        raise Stop('EXACT_WORKSPACE_CUSTODY_MISMATCH')
    KNOWN_IDS.append(owner_id)
    member_path = '/owners/' + urllib.parse.quote(owner_id) + '/members'
    transport.allowed[member_path] = 'caller-active-ADMIN'
    members = transport.get(member_path)
    own = [v for v in members if v.get('userId') == user['id'] or v.get('email') and v.get('email') == user.get('email')] if isinstance(members, list) else []
    if len(own) != 1 or own[0].get('role') != 'ADMIN' or own[0].get('status') != 'active':
        raise Stop('ACTIVE_ADMIN_NOT_VERIFIED')
    report['workspace'] = {'id_redacted': redact(owner_id), 'identity_matches_creation_receipt': True, 'sole_accessible': True, 'caller_role': 'ADMIN', 'caller_status': 'active'}
    inventory_path = '/postgres?' + urllib.parse.urlencode({'ownerId': owner_id, 'limit': 100})
    transport.allowed[inventory_path] = 'bounded-workspace-database-discovery'
    rows = transport.get(inventory_path)
    if not isinstance(rows, list) or len(rows) >= 100 or any(not isinstance(v.get('postgres'), dict) for v in rows):
        raise Stop('DATABASE_DISCOVERY_NOT_COMPLETE')
    candidates = [v['postgres'] for v in rows if v['postgres'].get('name') == MANIFEST['database_name']]
    report['discovery'] = {'workspace_database_count': len(rows), 'limit_100_complete': True, 'exact_name_count': len(candidates)}
    if len(candidates) != 1:
        raise Stop('EXACT_NAME_RESOURCE_NOT_UNIQUE')
    db = candidates[0]
    verify_resource(db, owner_id)
    report['discovered_database'] = public_db(db)
    path = '/postgres/' + urllib.parse.quote(db['id'])
    transport.allowed[path] = 'exact-resource-status'
    current = transport.get(path)
    verify_resource(current, owner_id)
    if current['id'] != db['id']:
        raise Stop('DIRECT_STATUS_RESOURCE_ID_CHANGED')
    report['direct_status_database'] = public_db(current)
    if current['status'] == 'creating':
        report['outcome'] = 'pending_still_creating_no_poll'
        return
    if current['status'] != 'available' or current.get('suspended') != 'not_suspended':
        raise Stop('EXACT_DATABASE_NOT_AVAILABLE_NO_CONNECTION')
    info_path = path + '/connection-info'
    transport.allowed[info_path] = 'exact-resource-connection-info'
    info = transport.get(info_path)
    private_persist_and_connect(current, info, report)
    report['outcome'] = 'minimum_staging_DB_prerequisite_passed'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--observe-connect-once', action='store_true')
    args = parser.parse_args()
    report = {'operation': MANIFEST['operation'], 'started_at_utc': now(), 'requests': [], 'provider_mutations': 0, 'direct_status_GETs': 0, 'connection_info_GETs': 0, 'SQL_connection_processes_started': 0, 'migrations_seeds_financial_DB_workers_models_payments': 0, 'Git_deploy_alias_or_secret_upload_actions': 0, 'outcome': 'not_finished'}
    try:
        if args.observe_connect_once:
            observe_once(report)
        else:
            report['preflight'] = local_preflight()
            report['outcome'] = 'local_preflight_passed_no_network'
    except (Stop, corrected.Stop, corrected.prior.Stop) as error:
        report['outcome'] = 'failed_stopped_no_retry'
        report['safe_code'] = str(error) if re.fullmatch(r'[A-Z0-9_]+', str(error)) else 'SAFE_GUARD_STOP'
    except Exception as error:
        report['outcome'] = 'failed_stopped_no_retry'
        report['safe_code'] = 'LOCAL_OR_BOUNDED_PROVIDER_PROCESS_FAILURE'
        report['exception_type_only'] = type(error).__name__
    report['finished_at_utc'] = now()
    report['prior_history_byte_identical'] = preserved_count()
    report['privacy'] = {'raw_responses_errors_headers_emitted': False, 'credential_values_or_fingerprints_emitted': False, 'runtime_known_secret_full_ID_scan_before_persist': True}
    filename = 'observation-' + dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.json'
    save(OUT / filename, report)
    print(json.dumps({'outcome': report['outcome'], 'safe_code': report.get('safe_code'), 'observation': 'docs/evidence/finals-staging-db/connect-2026-11-10/' + filename}))
    return 0 if report['outcome'] in ['local_preflight_passed_no_network', 'minimum_staging_DB_prerequisite_passed'] else 2


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception as error:
        print(json.dumps({'outcome': 'failed_stopped_no_retry', 'safe_code': 'FINAL_ARTIFACT_GUARD_FAILURE', 'exception_type_only': type(error).__name__}))
        raise SystemExit(2)
