"""Read-only workspace audit; writes only this evidence directory, never Git state."""
from __future__ import annotations

import collections
import hashlib
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import unquote, urlparse
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent


def git(*args: str) -> bytes:
    return subprocess.check_output(['git', *args], cwd=ROOT, stderr=subprocess.DEVNULL)


def load(path: str):
    return json.loads((ROOT / path).read_text(encoding='utf-8-sig'))


def sha(path: str) -> str:
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def write(name: str, value):
    (OUT / name).write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


tracked = set(git('ls-files', '-z').decode().strip('\0').split('\0'))
changed = set(filter(None, git('diff', '--name-only', '-z', 'HEAD').decode().split('\0')))
untracked = set(filter(None, git('ls-files', '--others', '--exclude-standard', '-z').decode().split('\0')))
head = git('rev-parse', 'HEAD').decode().strip()
observed = datetime.now(timezone.utc).isoformat()


def entry(path: str):
    data = (ROOT / path).read_bytes()
    prior = git('show', f'HEAD:{path}') if path in tracked else None
    return {'path': path, 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data),
            'state': 'modified' if path in changed else 'tracked_unchanged' if path in tracked else 'untracked',
            'headSha256': hashlib.sha256(prior).hexdigest() if prior is not None else None,
            'stageNeeded': path in changed or path not in tracked}


ui_manifest = load('docs/evidence/finals-ui/source-manifest.json')
repair_manifest = load('docs/evidence/finals-payment/review-fix-source-fingerprints-final.json')
ui_checks = [{'path': x['path'], 'acceptedSha256': x['sha256'], 'currentSha256': sha(x['path']),
              'matches': sha(x['path']) == x['sha256']} for x in ui_manifest['files']]
repair_checks = [{'path': x['path'], 'acceptedSha256': x['sha256'], 'currentSha256': sha(x['path']),
                  'matches': sha(x['path']) == x['sha256']} for x in repair_manifest['files']]

ui_paths = [x['path'] for x in ui_manifest['files'] if x['path'] not in {'package.json', 'pnpm-lock.yaml'}]
backend_paths = [
    'package.json', 'apps/server/src/index.ts',
    'apps/server/src/worker/continuity.ts', 'apps/server/src/worker/ingress.ts',
    'apps/server/src/worker/live-adapter.ts', 'apps/server/src/worker/payment.ts',
    'apps/server/src/worker/queue.ts', 'apps/server/src/worker/runtime.ts',
    'src/server/domain/evidence.ts', 'src/server/domain/purchases.ts', 'src/server/domain/wallet.ts',
    'src/server/http/application.ts', 'src/server/http/wake.ts',
    'src/server/integrations/spike-runtime.ts', 'src/server/integrations/wallet-inspection.ts',
    'src/server/merchant/receipts.ts',
    'scripts/purchase-observe.ts', 'scripts/purchase-setup.ts', 'scripts/purchase-smoke.ts',
    'tests/integration/foundation.test.ts', 'tests/integration/http-boundaries.test.ts',
    'tests/integration/wallet.test.ts', 'tests/integration/payment-recovery.test.ts',
    'tests/integration/purchase-http.test.ts', 'tests/integration/support/payment-adapter.ts',
]
canonical_paths = ['docs/DECISION-LEDGER.md', 'docs/design-system.md', 'docs/implementation-plan.md', 'docs/index.md']
evidence_paths = [
    'docs/evidence/finals-payment/task-005.md', 'docs/evidence/finals-payment/api-contract.md',
    'docs/evidence/finals-payment/review-fixes.md',
    'docs/evidence/finals-payment/review-fix-source-fingerprints.json',
    'docs/evidence/finals-payment/review-fix-source-fingerprints-final.json',
    'docs/evidence/finals-payment/actual-testnet-fixture-setup-no-purchase-1794216467460.json',
    'docs/evidence/finals-payment/actual-read-only-purchase-preflight-1794216580451.json',
    'docs/evidence/finals-payment/actual-testnet-unresolved-checkpoint.json',
    'docs/evidence/finals-payment/actual-identity-only-observation-1794288823393.json',
    'docs/evidence/finals-payment/actual-identity-only-observation-1794289316928.json',
    'docs/evidence/finals-payment/actual-single-status-detail-1794290430016.json',
    'docs/evidence/finals-payment/actual-velo-status-1794217433978.json',
    'docs/evidence/finals-review/task-005-review.md',
    'docs/evidence/finals-review/task-005-source-fingerprints.json',
    'docs/evidence/finals-review/task-005-recheck-2026-11-10.md',
    'docs/evidence/finals-review/task-005-recheck-2026-11-10-fingerprints.json',
    'docs/evidence/finals-provider/diagnosis.md', 'docs/evidence/finals-provider/operator-request.md',
    'docs/evidence/finals-provider/local-sdk-provenance.json',
    'docs/evidence/finals-provider/primary-source-index.json',
    'docs/evidence/finals-provider/inspect-primary.py', 'docs/evidence/finals-provider/verification.json',
    'docs/evidence/finals-ui/source-manifest.json',
]
# The user explicitly excludes private reports. Do not silently grant a source
# publication exception for the new server module containing protected bodies.
quarantined = {'src/server/merchant/reports.ts': 'Contains protected fictional report bodies; required runtime dependency, omitted pending coordinator scope clarification.'}

baseline_paths = [
    'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc', 'tsconfig.json',
    'apps/web/package.json', 'apps/server/package.json', 'packages/shared/package.json',
    'packages/agent/package.json', 'packages/shared/src/index.ts',
    'apps/web/src/app/api/[...path]/route.ts', 'apps/web/src/app/api/health/route.ts',
    'src/server/db/schema.ts', 'src/server/db/connection.ts', 'src/server/db/migrate.ts',
    'src/server/auth/session.ts', 'src/server/http/boundaries.ts',
    'src/server/integrations/noir.ts', 'src/server/integrations/velo.ts',
    'src/server/integrations/stellar-evidence.ts', 'src/server/integrations/spike-journal.ts',
    'src/server/integrations/spike-driver.ts', 'scripts/verify-contracts.ts',
    'tests/integration/support/database.ts', 'tests/integration/support/fixtures.ts',
    'vitest.config.ts', 'playwright.config.ts',
    'docs/evidence/testnet/spike-c080d947-714b-43cf-92d0-ad9ed7c01439-1794064999769.json',
    'docs/submission/AegisPay-pitch-draft.pdf',
]
baseline_paths = [p for p in baseline_paths if (ROOT / p).exists()]
proposed = set(ui_paths + backend_paths + canonical_paths + evidence_paths)
missing_candidates = sorted(p for p in proposed if not (ROOT / p).is_file())
if missing_candidates:
    raise RuntimeError('Missing explicit candidate paths: ' + ', '.join(missing_candidates))

# Known secret values stay in memory. Nothing emits names, values, lengths,
# fingerprints or excerpts of individual secrets; only per-path booleans.
secret_values: set[str] = set()
config_presence = {}
for name in ['.env.worker.local', '.env.spike.local', '.env.integration.local', '.env.local', 'apps/web/.env.local']:
    path = ROOT / name
    config_presence[name] = path.exists()
    if not path.is_file():
        continue
    for line in path.read_text(encoding='utf-8-sig').splitlines():
        match = re.match(r'^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$', line)
        if not match or not re.search(r'SECRET|API_KEY|TOKEN|PASSWORD|DATABASE_URL|ENCRYPTION_KEY|RECEIPT_SIGNING_KEY', match[1]):
            continue
        value = match[2]
        if value.startswith('"'):
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                value = value.strip('"')
        else:
            value = value.strip("'")
        if len(value) >= 12:
            secret_values.add(value)
        if 'DATABASE_URL' in match[1]:
            password = urlparse(value).password
            if password and len(password) >= 12:
                secret_values.add(unquote(password))


def sensitive_json(value):
    forbidden = {'xdr', 'envelope', 'signedxdr', 'signed_xdr', 'signedenvelope', 'signed_envelope', 'transactionxdr',
                 'aegisreceipt', 'receipttoken', 'receipt_token', 'sessiontoken', 'session_token', 'cookie', 'authorization'}
    if isinstance(value, dict):
        return any((k.lower() in forbidden and isinstance(v, str) and bool(v)) or sensitive_json(v) for k, v in value.items())
    if isinstance(value, list):
        return any(sensitive_json(v) for v in value)
    return False


scan = []
for path in sorted(proposed):
    content = (ROOT / path).read_bytes()
    text = content.decode('utf-8', errors='ignore') if not path.endswith('.woff2') else ''
    parsed = load(path) if path.endswith('.json') else None
    scan.append({'path': path, 'knownPrivateValueMatch': any(v.encode() in content for v in secret_values),
                 'stellarSecretLiteralMatch': bool(re.search(r'(?<![A-Za-z0-9])[S][A-Z2-7]{55}(?![A-Za-z0-9])', text)),
                 'nonemptySerializedSensitiveField': sensitive_json(parsed),
                 'fixtureSentinelReference': 'AEGIS_PRIVATE_' in text,
                 'binaryAcceptedAsset': path.endswith('.woff2')})
unsafe = [x['path'] for x in scan if x['knownPrivateValueMatch'] or x['stellarSecretLiteralMatch'] or x['nonemptySerializedSensitiveField']]

# Static local imports only: no execution or package install. Record dependency
# edges relative to HEAD/proposed paths; server-only fixtures remain quarantined.
imports = []
queue = list(ui_paths + backend_paths)
seen = set()
while queue:
    path = queue.pop()
    if path in seen or not path.endswith(('.ts', '.tsx', '.js', '.mjs')):
        continue
    seen.add(path)
    text = (ROOT / path).read_text(encoding='utf-8-sig')
    patterns = r'(?:from\s*|import\s*\(\s*|import\s*)[\'\"](\.[^\'\"]+)[\'\"]'
    for relative in re.findall(patterns, text):
        raw = (ROOT / path).parent / relative
        options = [raw]
        if raw.suffix in {'.js', '.mjs'}:
            options += [raw.with_suffix('.ts'), raw.with_suffix('.tsx')]
        if not raw.suffix:
            options += [Path(str(raw) + s) for s in ('.ts', '.tsx', '.js')] + [raw / 'index.ts']
        target_path = next((p for p in options if p.is_file()), None)
        target = target_path.resolve().relative_to(ROOT).as_posix() if target_path else None
        state = 'unresolved' if target is None else 'quarantined' if target in quarantined else 'proposed' if target in proposed else 'tracked_baseline' if target in tracked else 'untracked_omitted'
        imports.append({'from': path, 'specifier': relative, 'target': target, 'disposition': state})
        if target and target not in quarantined:
            queue.append(target)

# New/changed evidence link closure: existing HEAD targets are recognized without
# treating their old external availability or complete recursive contents as new evidence.
links = []
for path in sorted(proposed):
    if not path.endswith('.md'):
        continue
    text = (ROOT / path).read_text(encoding='utf-8-sig')
    for link in re.findall(r'!?\[[^\]]*\]\(([^\s)]+)(?:\s+[^)]*)?\)', text):
        link = link.strip('<>')
        if link.startswith(('http:', 'https:', 'mailto:', '#')):
            continue
        clean = unquote(link.split('#')[0])
        if not clean:
            continue
        target_path = ((ROOT / path).parent / clean).resolve()
        try:
            target = target_path.relative_to(ROOT).as_posix()
        except ValueError:
            links.append({'from': path, 'target': 'outside-workspace', 'disposition': 'excluded'})
            continue
        disposition = 'proposed' if target in proposed else 'tracked_baseline' if target in tracked else 'omitted_exists' if target_path.exists() else 'missing'
        links.append({'from': path, 'target': target, 'disposition': disposition})

public_links = []
for path in ui_paths:
    if not path.endswith(('.ts', '.tsx')):
        continue
    text = (ROOT / path).read_text(encoding='utf-8-sig')
    for url in sorted(set(re.findall(r'https://[^\s\'\"<>`]+', text))):
        match = re.match(r'https://github.com/slvdrvncntjvr/AegisPay/blob/([^/]+)/(.+)', url)
        local_object = None
        if match:
            ref = 'HEAD' if match[1] == 'main' else match[1]
            try:
                git('cat-file', '-e', f'{ref}:{unquote(match[2])}')
                local_object = True
            except subprocess.CalledProcessError:
                local_object = False
        public_links.append({'from': path, 'url': url, 'gitObjectAvailableLocally': local_object,
                             'newNetworkCheck': False})
# The proof link is assembled from constants, so a literal-URL regex alone
# cannot establish closure. Check its exact known HEAD object separately.
proof_target = 'docs/evidence/testnet/spike-c080d947-714b-43cf-92d0-ad9ed7c01439-1794064999769.json'
git('cat-file', '-e', f'HEAD:{proof_target}')
public_links.append({'from': 'apps/web/src/app/console.tsx',
    'url': 'https://github.com/slvdrvncntjvr/AegisPay/blob/main/' + proof_target,
    'derivation': 'PUBLIC_PROOF.githubRepo + /blob/main/ + PUBLIC_PROOF.evidencePath',
    'gitObjectAvailableLocally': True, 'newNetworkCheck': False})

project_records = []
for path in ['docs/evidence/finals-proof-deployment/provider-before.json', 'docs/evidence/finals-proof-deployment/production-readback.json', 'docs/evidence/finals-proof-deployment/final-readback.json']:
    value = load(path)
    project = value.get('project', {})
    deploy = value.get('deployment', {})
    project_records.append({'path': path, 'sha256': sha(path), 'observedAt': value.get('observedAt'),
        'projectFieldsPresent': list(project), 'gitIntegrationFieldsPresent': any(re.search('git|repository|autodeploy', key, re.I) for key in project),
        'rootDirectory': project.get('rootDirectory'), 'framework': project.get('framework'),
        'sourceFilesOutsideRootDirectory': project.get('sourceFilesOutsideRootDirectory'),
        'configuredEnvCount': value.get('configuredEnvCount'), 'readyState': deploy.get('readyState'),
        'target': deploy.get('target'), 'gitSourceFieldPresent': 'gitSource' in deploy,
        'deploymentSourceFieldPresent': 'source' in deploy})
deploy_risk = {'records': project_records, 'gitAutoDeploy': 'unknown; saved sanitized projections omit Git repository/link/branch/trigger controls',
    'currentWorktreeIsIdenticalToPublishedRestrictedUpload': False,
    'trackedGithubWorkflowPaths': sorted(p for p in tracked if p.startswith('.github/workflows/')),
    'currentRootVercelBuildsActualWorkspace': True,
    'futureGitPushShouldBeTreatedAsPotentialDeployment': True,
    'networkOrProviderCalls': False}
upload = load('docs/evidence/finals-proof-deployment/upload-manifest.json')
upload_paths = [row['path'] for row in upload['files']]
deploy_risk['savedRestrictedUpload'] = {
    'manifestPath': 'docs/evidence/finals-proof-deployment/upload-manifest.json',
    'manifestSha256': sha('docs/evidence/finals-proof-deployment/upload-manifest.json'),
    'fileCount': upload['fileCount'], 'bytes': upload['bytes'],
    'fullApplicationCatchallIncluded': any('[...path]' in p for p in upload_paths),
    'workerImplementationIncluded': any(p.startswith('apps/server/src/') for p in upload_paths),
    'sourcePaths': upload_paths,
}

baseline_package = json.loads(git('show', 'HEAD:package.json'))
current_package = load('package.json')
pins = {key: baseline_package.get(key) == current_package.get(key) for key in ['dependencies', 'devDependencies', 'engines', 'packageManager', 'workspaces', 'pnpm']}
scripts = {'added': sorted(set(current_package['scripts']) - set(baseline_package['scripts'])),
           'removed': sorted(set(baseline_package['scripts']) - set(current_package['scripts'])),
           'changed': sorted(k for k in set(current_package['scripts']) & set(baseline_package['scripts']) if current_package['scripts'][k] != baseline_package['scripts'][k])}

shared = {'observedAt': observed, 'head': head, 'taskId': 'task_99ae5c2f2499', 'dispatchId': 'ctx_12c267cf2a70',
          'purpose': 'Reviewable LOCAL checkpoint candidates only; no staging, commit, push, build, test, deployment or financial execution.'}
write('ui-allowlist.json', {**shared, 'files': [entry(p) for p in ui_paths], 'acceptedManifestChecks': ui_checks,
    'dependencyQualification': 'Root package.json belongs to backend allowlist; current bytes differ from accepted UI reference, while root-lock hash still matches and package pins equal HEAD.'})
write('backend-allowlist.json', {**shared, 'sourceFiles': [entry(p) for p in backend_paths],
    'canonicalChanges': [entry(p) for p in canonical_paths], 'minimumEvidence': [entry(p) for p in evidence_paths],
    'acceptedRepairChecks': repair_checks, 'quarantinedRequiredDependencies': [{**entry(p), 'reason': reason} for p, reason in quarantined.items()],
    'selfContainedRunnableCheckout': not any(x['disposition'] in {'quarantined', 'unresolved', 'untracked_omitted'} for x in imports),
    'publicEvidenceLinkClosure': not any(x['disposition'] not in {'proposed', 'tracked_baseline'} for x in links)})
write('baseline-and-dependencies.json', {**shared, 'unchangedBaselineDependencies': [entry(p) for p in baseline_paths],
    'packagePinsUnchangedAgainstHead': pins, 'packageScriptDeltaAgainstHead': scripts,
    'localImportEdges': imports, 'publicUiExternalLinks': public_links, 'newNetworkChecks': False})
write('link-closure.json', {**shared, 'links': links,
    'qualification': 'Checks proposed Markdown local targets against current proposal or existing HEAD; existing baseline links are not recursively reaudited.'})
write('hygiene-scan.json', {**shared, 'configurationFilePresence': config_presence,
    'knownPrivateValuesAvailableInMemory': bool(secret_values), 'candidates': scan, 'unsafeCandidatePaths': unsafe,
    'limitations': ['No OCR/binary secret proof', 'Known-values scan cannot rule out unknown, encoded or previously rotated credentials',
                   'Server-only fixture source is quarantined under private-report exclusion; sentinel references in tests/docs are not report body exports',
                   'Local configuration contents, signed journals and raw logs are excluded and never serialized']})
write('stored-deployment-review.json', {**shared, **deploy_risk})

inventory = []
for path in sorted(changed | untracked):
    if path.startswith('docs/evidence/finals-source-checkpoint/'):
        continue
    p = ROOT / path
    if not p.is_file():
        continue
    category = 'proposed' if path in proposed else 'quarantined_private_fixture' if path in quarantined else 'excluded_config' if path.startswith('.env') else 'excluded_capture_or_binary' if p.suffix.lower() in {'.bin', '.png', '.pdf', '.woff2', '.ttf'} else 'excluded_log' if p.suffix.lower() in {'.txt', '.log'} else 'not_proposed_other_unreviewed_work'
    inventory.append({'path': path, 'state': 'modified' if path in changed else 'untracked', 'bytes': p.stat().st_size, 'category': category})
write('working-tree-inventory.json', {**shared, 'files': inventory, 'counts': dict(collections.Counter(x['category'] for x in inventory)),
    'excludedLargestFiles': sorted([x for x in inventory if x['category'] != 'proposed'], key=lambda x: -x['bytes'])[:20],
    'untouchedIndex': True, 'noIgnoreOverrides': True})
print(json.dumps({'head': head, 'uiFiles': len(ui_paths), 'uiSourceChecksMatch': all(x['matches'] for x in ui_checks if x['path'] not in {'package.json', 'pnpm-lock.yaml'}),
    'repairChecksMatch': all(x['matches'] for x in repair_checks), 'backendSourceFiles': len(backend_paths), 'canonicalFiles': len(canonical_paths),
    'minimumEvidenceFiles': len(evidence_paths), 'unsafeCandidatePaths': unsafe,
    'blockingImportEdges': [x for x in imports if x['disposition'] in {'quarantined', 'unresolved', 'untracked_omitted'}],
    'unclosedLinks': [x for x in links if x['disposition'] not in {'proposed', 'tracked_baseline'}],
    'inventoryCounts': dict(collections.Counter(x['category'] for x in inventory))}, indent=2))
