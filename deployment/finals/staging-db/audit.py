"""Read-only offline artifact hygiene plus documentation gates; no provider/SQL calls."""
from pathlib import Path
import ast
import datetime as dt
import hashlib
import json
import re
import subprocess
import urllib.parse

ROOT = Path(__file__).resolve().parents[3]
SCOPES = [ROOT / 'deployment/finals/staging-db', ROOT / 'docs/evidence/finals-staging-db']
OUTPUT = SCOPES[1] / 'checks.json'


def collect_values():
    values = set()
    files = 0
    for path in ROOT.glob('.env*'):
        if not path.is_file() or path.name == '.env.example':
            continue
        files += 1
        for line in path.read_text(encoding='utf-8-sig').splitlines():
            match = re.match(r'^([A-Za-z_][A-Za-z0-9_]*)=(.*)$', line)
            if not match:
                continue
            key, value = match[1], match[2].strip()
            if value.startswith('"'):
                try:
                    value = json.loads(value)
                except ValueError:
                    continue
            elif value.startswith("'") and value.endswith("'"):
                value = value[1:-1]
            if not isinstance(value, str):
                continue
            sensitive = bool(re.search(r'KEY|SECRET|TOKEN|PASSWORD|DATABASE_URL|CONNECTION_STRING|STAGING_POSTGRES_ID|STAGING_OWNER_ID', key))
            if sensitive and len(value) >= 8:
                values.add(value)
            if value.startswith(('postgres://', 'postgresql://')):
                parsed = urllib.parse.urlsplit(value)
                if parsed.password:
                    values.add(urllib.parse.unquote(parsed.password))
    return values, files


def main():
    values, env_count = collect_values()
    files = sorted(p for base in SCOPES for p in base.rglob('*') if p.is_file() and '__pycache__' not in p.parts and p != OUTPUT)
    raw_id = re.compile(r'\b(?:usr|tea|dpg|srv)-[a-z0-9]{10,}(?:-[a-z0-9]+)?\b')
    raw_dsn = re.compile(r'postgres(?:ql)?://[^\s\"\']+:[^\s\"\']+@')
    secret_hits = id_hits = dsn_hits = 0
    inventory = []
    for path in files:
        data = path.read_bytes()
        content = data.decode('utf-8')
        secret_hits += sum(bool(value and value in content) for value in values)
        id_hits += len(raw_id.findall(content))
        dsn_hits += len(raw_dsn.findall(content))
        if path.suffix == '.py':
            ast.parse(content, filename=str(path.relative_to(ROOT)))
        inventory.append({'path': path.relative_to(ROOT).as_posix(), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    checks = []
    commands = [
        ['node', '--check', 'deployment/finals/staging-db/verify-connectivity.mjs'],
        ['python', 'tools/check-docs.py'],
        ['python', 'fmd/tools/check-implementation-plan.py', 'docs/implementation-plan.md', '--strict'],
    ]
    for command in commands:
        result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=60)
        # No child output is released unless it also passes the memory-only known-secret scan.
        output = result.stdout + result.stderr
        if any(v and v in output for v in values) or raw_id.search(output) or raw_dsn.search(output):
            output = 'CHILD_OUTPUT_HYGIENE_GUARD'
            secret_hits += 1
        checks.append({'command': command, 'exit_code': result.returncode, 'output': output.strip()})
    ignored = subprocess.run(['git', 'check-ignore', '--quiet', '.env.staging.local'], cwd=ROOT, capture_output=True, timeout=10).returncode == 0
    passed = not (secret_hits or id_hits or dsn_hits) and ignored and all(v['exit_code'] == 0 for v in checks)
    report = {
        'observed_at_utc': dt.datetime.now(dt.timezone.utc).isoformat(),
        'scope': 'offline artifact hygiene, syntax and documentation only; no application, cloud TLS or SQL test',
        'outcome': 'passed' if passed else 'failed',
        'files_checked': len(files),
        'private_env_files_read_in_memory': env_count,
        'known_values_not_persisted': True,
        'known_credential_value_matches': secret_hits,
        'full_Render_identity_or_resource_ID_matches': id_hits,
        'raw_database_DSN_matches': dsn_hits,
        'staging_env_ignored': ignored,
        'staging_env_created': (ROOT / '.env.staging.local').exists(),
        'checks': checks, 'artifact_inventory': inventory,
    }
    OUTPUT.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({k: report[k] for k in ['outcome', 'files_checked', 'known_credential_value_matches', 'full_Render_identity_or_resource_ID_matches', 'raw_database_DSN_matches', 'staging_env_created']}))
    return 0 if passed else 1


if __name__ == '__main__':
    raise SystemExit(main())
