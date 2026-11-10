"""Offline diagnosis checks. Reads no private environment or credentials."""
from pathlib import Path
import ast
import datetime as dt
import hashlib
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
OUT = ROOT / 'docs/evidence/finals-staging-db/diagnosis-2026-11-10'
ORIGINALS = OUT / 'preserved-artifacts.json'
NEW_FILES = [HERE / name for name in [
    'future-minimal-request-2026-11-10.json', 'future_error_classifier.py',
    'test_future_error_classifier.py', 'diagnose-readonly-2026-11-10.py',
    'check-diagnosis-2026-11-10.py',
]]


def main():
    prior = json.loads(ORIGINALS.read_text(encoding='utf-8'))
    preservation = [{'path': item['path'], 'sha256_matches': hashlib.sha256((ROOT / item['path']).read_bytes()).hexdigest() == item['sha256']} for item in prior['files']]
    files = NEW_FILES + sorted(p for p in OUT.glob('*') if p.is_file() and p.name != 'checks.json')
    raw_id = re.compile(r'\b(?:usr|tea|dpg|srv)-[a-z0-9]{10,}(?:-[a-z0-9]+)?\b')
    dsn = re.compile(r'postgres(?:ql)?://[^\s\"\']+:[^\s\"\']+@')
    credential = re.compile(r'\brnd_[A-Za-z0-9]{12,}\b|\bAIza[A-Za-z0-9_-]{20,}\b|\bS[A-Z2-7]{55}\b')
    hits = {'full_Render_IDs': 0, 'database_DSNs': 0, 'credential_patterns': 0}
    links = []
    inventory = []
    for path in files:
        data = path.read_bytes()
        text = data.decode('utf-8')
        hits['full_Render_IDs'] += len(raw_id.findall(text))
        hits['database_DSNs'] += len(dsn.findall(text))
        hits['credential_patterns'] += len(credential.findall(text))
        if path.suffix == '.py':
            ast.parse(text)
        if path.suffix == '.md':
            for target in re.findall(r'\]\(([^)]+)\)', text):
                if '://' not in target and not target.startswith('#'):
                    resolved = (path.parent / target.split('#')[0]).resolve()
                    # This invocation creates its own result file after validation.
                    if resolved != OUT / 'checks.json' and not resolved.is_file():
                        links.append({'source': path.relative_to(ROOT).as_posix(), 'target': target})
        inventory.append({'path': path.relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(data).hexdigest()})
    commands = [
        ['python', '-B', 'deployment/finals/staging-db/test_future_error_classifier.py'],
        ['python', '-B', 'tools/check-docs.py'],
        ['python', '-B', 'fmd/tools/check-implementation-plan.py', 'docs/implementation-plan.md', '--strict'],
    ]
    checks = []
    for command in commands:
        result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=60)
        checks.append({'command': command, 'exit_code': result.returncode, 'output': (result.stdout + result.stderr).strip()})
    proposal = json.loads((HERE / 'future-minimal-request-2026-11-10.json').read_text(encoding='utf-8'))
    proposal_check = proposal.get('attempts_authorized_in_diagnosis_dispatch') == 0 and proposal.get('request_without_ownerId') == {'name': 'aegispay-finals-staging', 'plan': 'free', 'version': '17', 'region': 'singapore'}
    passed = proposal_check and all(v['sha256_matches'] for v in preservation) and not any(hits.values()) and not links and all(v['exit_code'] == 0 for v in checks)
    report = {'observed_at_utc': dt.datetime.now(dt.timezone.utc).isoformat(), 'scope': 'read-only-diagnosis validation; no cloud mutation, credential/env read, DB, app or worker', 'outcome': 'passed' if passed else 'failed', 'preserved_originals_count': len(preservation), 'preservation': preservation, 'minimal_Free_only_unexecuted_proposal_valid': proposal_check, 'new_artifact_pattern_scan': hits, 'known_secret_value_scan': 'not run: private environment/credential access prohibited in this follow-up', 'missing_local_links': links, 'checks': checks, 'new_artifacts': inventory}
    (OUT / 'checks.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'outcome': report['outcome'], 'preserved_originals': len(preservation), 'pattern_matches': hits, 'missing_links': len(links)}))
    return 0 if passed else 1


if __name__ == '__main__':
    raise SystemExit(main())
