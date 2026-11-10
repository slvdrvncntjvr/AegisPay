"""Offline hygiene/permissions/preservation audit, never network or SQL."""
import datetime as dt
import hashlib
import json
import re
import subprocess
import urllib.parse
import ast
from observe_connect import ROOT, BASE, HERE, OUT, SECRET_FILE, SECRET_TEMP, corrected, acl_verify, preserved_count


def main():
    key = corrected.read_provider_key()
    private = corrected.prior.env_values(SECRET_FILE)
    url = private.get('DATABASE_URL', '')
    parsed = urllib.parse.urlsplit(url)
    known = [key, url, urllib.parse.unquote(parsed.password or '')]
    if not all(known) or parsed.query != 'sslmode=verify-full':
        raise RuntimeError('PRIVATE_CONFIGURATION_INCOMPLETE')
    for field in ['RENDER_STAGING_POSTGRES_ID', 'RENDER_STAGING_OWNER_ID']:
        if private.get(field):
            known.append(private[field])
    known += [json.dumps(v) for v in known]
    preserved = preserved_count()
    files = sorted(p for base in [HERE, OUT] for p in base.glob('*') if p.is_file() and p.name != 'checks.json' and not p.name.startswith('.env'))
    raw_id = re.compile(r'\b(?:usr|tea|dpg|srv)-[a-z0-9]{10,}(?:-[a-z0-9]+)?\b')
    raw_dsn = re.compile(r'postgres(?:ql)?://[^\s\"\']+:[^\s\"\']+@')
    hits = {'known_credential_or_full_resource_ID_value_matches': 0, 'raw_Render_ID_matches': 0, 'raw_DSN_matches': 0}
    missing, inventory = [], []
    for path in files:
        data = path.read_bytes()
        text = data.decode('utf-8')
        hits['known_credential_or_full_resource_ID_value_matches'] += sum(int(v in text) for v in known)
        hits['raw_Render_ID_matches'] += len(raw_id.findall(text))
        hits['raw_DSN_matches'] += len(raw_dsn.findall(text))
        if path.suffix == '.py':
            ast.parse(text)
        if path.suffix == '.md':
            for link in re.findall(r'\]\(([^)]+)\)', text):
                if '://' not in link and not link.startswith('#'):
                    target = (path.parent / link.split('#')[0]).resolve()
                    if target != OUT / 'checks.json' and not target.is_file():
                        missing.append({'source': path.relative_to(ROOT).as_posix(), 'target': link})
        # Public artifacts only. No secret-file content or credential digest is recorded.
        inventory.append({'path': path.relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(data).hexdigest()})
    checks = []
    for command in [
        ['python', '-B', 'deployment/finals/staging-db/connect-2026-11-10/test_guards.py'],
        ['node', '--check', 'deployment/finals/staging-db/verify-connectivity.mjs'],
        ['python', '-B', 'tools/check-docs.py'],
        ['python', '-B', 'fmd/tools/check-implementation-plan.py', 'docs/implementation-plan.md', '--strict'],
    ]:
        result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=60)
        output = (result.stdout + result.stderr).strip()
        if any(v in output for v in known) or raw_id.search(output) or raw_dsn.search(output):
            raise RuntimeError('CHILD_OUTPUT_HYGIENE_GUARD')
        checks.append({'command': command, 'exit_code': result.returncode, 'output': output})
    actual = json.loads((OUT / 'observation-20261110T120740197816Z.json').read_text(encoding='utf-8'))
    ignored = subprocess.run(['git', 'check-ignore', '--quiet', '.env.staging.local'], cwd=ROOT, capture_output=True, timeout=10).returncode == 0
    permission = acl_verify(SECRET_FILE)
    facts = {'provider_mutations': actual['provider_mutations'], 'direct_status_GETs': actual['direct_status_GETs'], 'connection_info_GETs': actual['connection_info_GETs'], 'provider_status': actual['direct_status_database']['status'], 'strict_SQL_processes': actual['SQL_connection_processes_started'], 'SQL_statements': actual['connectivity']['sql_statements'], 'actual_safe_code': actual['safe_code'], 'actual_prerequisite_passed': False, 'private_env_exists_ignored': SECRET_FILE.is_file() and ignored, 'private_temp_absent': not SECRET_TEMP.exists(), 'private_DACL': permission}
    passed = preserved == 38 and not any(hits.values()) and not missing and all(v['exit_code'] == 0 for v in checks) and ignored and not SECRET_TEMP.exists() and facts['provider_mutations'] == 0 and facts['direct_status_GETs'] == 1 and facts['connection_info_GETs'] == 1 and facts['strict_SQL_processes'] == 1 and facts['SQL_statements'] == 0 and facts['actual_safe_code'] == 'STAGING_CONNECTIVITY_FAILED'
    report = {'at_utc': dt.datetime.now(dt.timezone.utc).isoformat(), 'audit_outcome': 'passed' if passed else 'failed', 'scope': 'offline audit only; successful hygiene does not change actual failed SQL/TLS prerequisite', 'prior_history_byte_identical_files': preserved, 'hygiene': hits, 'known_values_memory_only': True, 'credential_values_or_fingerprints_saved': False, 'missing_local_links': missing, 'actual_operation_facts': facts, 'checks': checks, 'public_artifact_inventory': inventory}
    text = json.dumps(report, indent=2) + '\n'
    if any(v in text for v in known) or raw_id.search(text) or raw_dsn.search(text):
        raise RuntimeError('FINAL_HYGIENE_GUARD')
    (OUT / 'checks.json').write_text(text, encoding='utf-8')
    print(json.dumps({'audit_outcome': report['audit_outcome'], 'preserved_prior_files': preserved, 'hygiene_matches': hits, 'missing_links': len(missing), 'actual_prerequisite_passed': False, 'safe_code': facts['actual_safe_code']}))
    return 0 if passed else 1


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception as error:
        print(json.dumps({'audit_outcome': 'failed', 'safe_code': 'OFFLINE_AUDIT_GUARD_FAILED', 'exception_type_only': type(error).__name__}))
        raise SystemExit(2)
