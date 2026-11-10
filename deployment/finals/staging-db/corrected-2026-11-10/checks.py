"""Offline corrected-operation evidence audit; no provider/SQL/app/worker calls."""
from pathlib import Path
import ast
import datetime as dt
import hashlib
import json
import re
import subprocess
from provision_corrected import ROOT, HERE, OUT, read_provider_key


def main():
    # The sole credential is held in memory and never written or printed.
    key = read_provider_key()
    baseline = json.loads((OUT / 'preserved-artifacts.json').read_text(encoding='utf-8'))
    preserved = [{'path': v['path'], 'sha256_matches': hashlib.sha256((ROOT / v['path']).read_bytes()).hexdigest() == v['sha256']} for v in baseline['files']]
    files = sorted(p for base in [HERE, OUT] for p in base.glob('*') if p.is_file() and p.name != 'checks.json')
    id_pattern = re.compile(r'\b(?:usr|tea|dpg|srv)-[a-z0-9]{10,}(?:-[a-z0-9]+)?\b')
    dsn_pattern = re.compile(r'postgres(?:ql)?://[^\s\"\']+:[^\s\"\']+@')
    hits = {'known_Render_key_value_matches': 0, 'full_Render_ID_matches': 0, 'raw_DSN_matches': 0}
    missing = []
    inventory = []
    for path in files:
        raw = path.read_bytes()
        text = raw.decode('utf-8')
        hits['known_Render_key_value_matches'] += int(key in text)
        hits['full_Render_ID_matches'] += len(id_pattern.findall(text))
        hits['raw_DSN_matches'] += len(dsn_pattern.findall(text))
        if path.suffix == '.py':
            ast.parse(text)
        if path.suffix == '.md':
            for link in re.findall(r'\]\(([^)]+)\)', text):
                if '://' not in link and not link.startswith('#'):
                    target = (path.parent / link.split('#')[0]).resolve()
                    if target != OUT / 'checks.json' and not target.is_file():
                        missing.append({'source': path.relative_to(ROOT).as_posix(), 'target': link})
        inventory.append({'path': path.relative_to(ROOT).as_posix(), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
    commands = [
        ['python', '-B', 'deployment/finals/staging-db/corrected-2026-11-10/test_guards.py'],
        ['python', '-B', 'deployment/finals/staging-db/test_future_error_classifier.py'],
        ['node', '--check', 'deployment/finals/staging-db/verify-connectivity.mjs'],
        ['python', '-B', 'tools/check-docs.py'],
        ['python', '-B', 'fmd/tools/check-implementation-plan.py', 'docs/implementation-plan.md', '--strict'],
    ]
    checks = []
    for command in commands:
        result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=60)
        output = (result.stdout + result.stderr).strip()
        if key in output or id_pattern.search(output) or dsn_pattern.search(output):
            raise RuntimeError('CHILD_OUTPUT_HYGIENE_GUARD')
        checks.append({'command': command, 'exit_code': result.returncode, 'output': output})
    assessment = json.loads((OUT / 'result-assessment.json').read_text(encoding='utf-8'))
    actual = json.loads((OUT / assessment['source_observation']).read_text(encoding='utf-8'))
    actual_posts = [v for v in actual['requests'] if v['method'] == 'POST']
    facts = {'corrected_POST_count': len(actual_posts), 'POST_http_status': actual_posts[0]['http_status'], 'immediate_status_reads': actual['immediate_status_reads_after_HTTP201'], 'recorded_provider_status': actual['created_database_latest']['status'], 'database_connections': actual['db_connections_attempted'], 'staging_env_created': (ROOT / '.env.staging.local').exists(), 'pending_requires_separate_observation': assessment['requires_separate_authorization_for_later_observation']}
    passed = all(v['sha256_matches'] for v in preserved) and not any(hits.values()) and not missing and all(v['exit_code'] == 0 for v in checks) and facts['corrected_POST_count'] == 1 and facts['POST_http_status'] == 201 and facts['immediate_status_reads'] == 1 and facts['recorded_provider_status'] == 'creating' and facts['database_connections'] == 0 and not facts['staging_env_created']
    report = {'at_utc': dt.datetime.now(dt.timezone.utc).isoformat(), 'outcome': 'passed' if passed else 'failed', 'scope': 'offline audit only; no fresh provider readiness, TLS, SQL or release evidence', 'preserved_prior_file_count': len(preserved), 'preservation': preserved, 'hygiene': hits, 'known_secret_scan': 'existing Render key only, memory-only; no database credentials retrieved', 'missing_local_links': missing, 'actual_operation_facts': facts, 'checks': checks, 'artifact_inventory': inventory}
    text = json.dumps(report, indent=2) + '\n'
    if key in text or id_pattern.search(text) or dsn_pattern.search(text):
        raise RuntimeError('FINAL_HYGIENE_GUARD')
    (OUT / 'checks.json').write_text(text, encoding='utf-8')
    print(json.dumps({'outcome': report['outcome'], 'preserved_prior_files': len(preserved), 'hygiene_matches': hits, 'missing_links': len(missing), 'corrected_POST_http_status': facts['POST_http_status'], 'recorded_status': facts['recorded_provider_status']}))
    return 0 if passed else 1


if __name__ == '__main__':
    main()
