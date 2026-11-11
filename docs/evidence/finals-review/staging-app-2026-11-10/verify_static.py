"""Read-only artifact hashing and public-pattern scan; never runs app helpers."""
import hashlib
import json
import re
from pathlib import Path

root = Path.cwd()
out = Path(__file__).parent
manifest = out / 'fingerprints.json'
records = json.loads(manifest.read_text())
def read(name):
    p = root / name
    before = p.read_bytes()
    after = p.read_bytes()
    records.append({'path': str(name).replace('\\', '/'), 'sha256_before': digest(before), 'sha256_after': digest(after), 'stable': before == after, 'purpose': 'static integrity / safe public artifact review'})
    return before
def digest(b):
    return hashlib.sha256(b).hexdigest()

baseline = json.loads(read('docs/evidence/finals-staging-app/2026-11-10T12-41-01-076Z/result.json'))
build = json.loads(read('docs/evidence/finals-staging-app/build-inventory.json'))
preserved = json.loads(read('docs/evidence/finals-staging-app/proxy-2026-11-10T14-43Z/preserved-baseline.json'))
result = {'kind': 'reviewer static file checks only; no application/database/provider execution'}
for label, entries in [('source', baseline['source']['files']), ('build', build['files']), ('historical_public', preserved['public_files'])]:
    changed = [e['path'] for e in entries if digest(read(e['path'])) != e['sha256']]
    result[label] = {'files': len(entries), 'changed_paths': changed}
result['build_id_matches'] = digest(read('apps/web/.next/BUILD_ID').strip()) == baseline['build']['build_id_sha256']
continuation = 'docs/evidence/finals-staging-app/continuation-2026-11-10T15-04Z/'
binding_bytes = read(continuation + 'continuation-source-binding.json')
binding = json.loads(binding_bytes)
actual_bytes = read(continuation + 'actual/result.json')
actual = json.loads(actual_bytes)
marker = json.loads(read(continuation + 'continuation-execution.json'))
preflight_bytes = read(continuation + 'preflight-1.json')
preflight = json.loads(preflight_bytes)
authorization_bytes = read(continuation + 'continuation-authorization.json')
authorization = json.loads(authorization_bytes)
result['continuation'] = {
    'source_files': binding['source_files'],
    'source_files_match': all(digest(read(e['path'])) == e['sha256'] for e in binding['source_files']),
    'source_maps_match_across_binding_marker_preflight_actual': binding['source_files'] == marker['source_files'] == preflight['source_files'] == actual['capture_preflight']['source_files'],
    'authorization_binding_matches': binding['authorization_sha256'] == marker['authorization_sha256'] == digest(authorization_bytes),
    'linked_prior_receipts_match': all(digest(read(e['path'])) == e['sha256'] for e in authorization['linked']),
    'preflight_hash_matches': marker['capture_preflight_sha256'] == actual['capture_preflight']['sha256'] == digest(preflight_bytes),
    'preflight_outcome': preflight['outcome'],
    'actual_outcome': actual['outcome'],
    'actual_failure': actual['safe_failure'],
    'actual_result_sha256': digest(actual_bytes),
    'actual_http_checks': len(actual['http']),
    'actual_browser_cases': len(actual['browser']),
    'actual_app_tls_connections': len(actual['app_pool_tls']),
}
patterns = {
    'raw_credential_dsn': re.compile(rb'postgres(?:ql)?://[^\s\x22\x27]+:[^\s\x22\x27]+@'),
    'stellar_secret_seed': re.compile(rb'(?<![A-Z2-7])S[A-Z2-7]{55}(?![A-Z2-7])'),
    'full_provider_id': re.compile(rb'\b(?:dpg|usr|tea|srv)-[a-z0-9]{10,}(?:-[a-z0-9]+)?\b'),
    'raw_session_cookie': re.compile(rb'aegispay_session=[A-Za-z0-9_-]{43}(?:;|\b)'),
}
counts = {k: 0 for k in patterns}
scanned = 0
for directory in ('deployment/finals/staging-app', 'docs/evidence/finals-staging-app'):
    for p in sorted((root / directory).rglob('*')):
        if not p.is_file():
            continue
        b = read(p.relative_to(root))
        scanned += 1
        for k, pattern in patterns.items():
            counts[k] += len(pattern.findall(b))
result['public_pattern_scan'] = {'files': scanned, 'match_counts': counts, 'limits': 'Pattern scan only; no access to private known-value corpus, private IP permit, or protected custody. No raw matches retained.'}
manifest.write_text(json.dumps(records, indent=2) + '\n')
(out / 'static-checks.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
