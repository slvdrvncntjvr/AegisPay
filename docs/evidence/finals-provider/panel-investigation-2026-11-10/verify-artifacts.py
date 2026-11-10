"""Offline artifact hygiene and documentation gates only; no app or network calls."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import os
import re
import subprocess

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[3]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


provenance = json.loads((ROOT / 'provenance.json').read_text(encoding='utf-8'))
prior = json.loads((ROOT.parent / 'primary-source-index.json').read_text(encoding='utf-8'))
prior_files = {item['path']: item for item in prior['files']}
failures = []
source_matches = []
for item in provenance['source_files']:
    target = ROOT / 'source' / item['path']
    if sha(target) != item['sha256']:
        failures.append(f'Source hash mismatch: {item["path"]}')
    if item['path'] in prior_files:
        same = item['sha256'] == prior_files[item['path']]['sha256']
        source_matches.append({'path': item['path'], 'matches_prior_index': same})
        if not same:
            failures.append(f'Prior source hash mismatch: {item["path"]}')
for item in provenance['screenshots']:
    target = ROOT / item['copy']
    if sha(target) != item['sha256'] or sha(Path(item['original_path'])) != item['sha256']:
        failures.append(f'Screenshot hash/copy mismatch: {item["copy"]}')

links = []
for path in ROOT.glob('*.md'):
    for target in re.findall(r'\]\(([^)]+)\)', path.read_text(encoding='utf-8')):
        if '://' in target or target.startswith('#'):
            continue
        exists = (path.parent / target.split('#', 1)[0]).exists()
        links.append({'from': path.name, 'target': target, 'exists': exists})
        if not exists:
            failures.append(f'Missing local link: {path.name} -> {target}')

# Pattern scan is deliberately not a claim to have compared against actual secret values.
markers = re.compile(r'(?<![A-Z2-7])S[A-Z2-7]{55}(?![A-Z2-7])|AIza[A-Za-z0-9_-]{35}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----')
scanned = 0
for path in ROOT.rglob('*'):
    if path.is_file() and path.suffix not in {'.png', '.pyc'} and path.name != 'verification.json':
        scanned += 1
        if markers.search(path.read_text(encoding='utf-8')):
            failures.append(f'Possible private-value marker: {path.relative_to(ROOT)}')

commands = [
    ['python', 'tools/check-docs.py'],
    ['python', 'fmd/tools/check-implementation-plan.py', 'docs/implementation-plan.md', '--strict'],
]
gates = []
for command in commands:
    result = subprocess.run(command, cwd=REPO, text=True, encoding='utf-8', errors='replace',
                            capture_output=True, env={**os.environ, 'PYTHONIOENCODING': 'utf-8'})
    gates.append({'command': ' '.join(command), 'exit_code': result.returncode,
                  'stdout': result.stdout.strip(), 'stderr': result.stderr.strip()})
    if result.returncode:
        failures.append(f'Document gate failed: {" ".join(command)}')

inputs = ['AGENTS.md', 'docs/index.md', 'docs/implementation-plan.md', 'docs/DECISION-LEDGER.md',
          'docs/evidence/finals-provider/diagnosis.md', 'docs/evidence/finals-provider/primary-source-index.json',
          'docs/evidence/finals-provider/operator-request.md',
          'docs/evidence/finals-payment/actual-single-status-detail-1794290430016.json',
          'docs/evidence/finals-payment/actual-testnet-unresolved-checkpoint.json']
report = {
    'observed_at_utc': datetime.now(timezone.utc).isoformat(),
    'classification': 'document-and-artifact-hygiene-only',
    'screenshot_hashes_and_original_copy_equality': len(provenance['screenshots']),
    'source_hashes_checked': len(provenance['source_files']),
    'prior_source_index_matches': source_matches, 'local_markdown_links': links,
    'private_value_marker_scan': {'text_files_checked': scanned, 'actual_secret_values_read': False,
                                  'limitation': 'Pattern scan plus visual screenshot inspection; not exhaustive DLP'},
    'input_provenance': [{'path': path, 'sha256': sha(REPO / path)} for path in inputs],
    'documentation_checks': gates,
    'provider_gas_calls': 0, 'db_or_ledger_queries': 0, 'financial_handoffs': 0,
    'payment_resolved': False, 'application_test_claim': False,
    'failures': failures,
}
(ROOT / 'verification.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'sources': len(provenance['source_files']), 'screenshots': len(provenance['screenshots']),
                  'previous_index_matches': len(source_matches),
                  'documentation_exit_codes': [gate['exit_code'] for gate in gates], 'failures': failures}))
raise SystemExit(1 if failures else 0)
