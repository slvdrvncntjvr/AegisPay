"""Read-only bounded host, configuration-name and local database checks.

Never print raw command failures, environment values, credentials, or DB URLs.
"""
from pathlib import Path
import datetime
import json
import os
import re
import subprocess

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).parent


def run(args):
    try:
        result = subprocess.run(args, cwd=ROOT, capture_output=True, text=True,
                                encoding='utf-8', errors='replace', timeout=30,
                                env={**os.environ, 'COREPACK_ENABLE_NETWORK': '0'})
        return result.returncode, result.stdout.strip()
    except Exception as error:
        return type(error).__name__, ''


def envnames(path):
    values = {}
    if path.is_file():
        for line in path.read_text(encoding='utf-8-sig').splitlines():
            match = re.match(r'^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$', line)
            if match:
                values[match[1]] = bool(match[2].strip().strip('\"\''))
    return {'exists': path.is_file(), 'presence': values}


report = {'observed_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat()}
report['environment_name_presence'] = {
    name: envnames(ROOT / name) for name in [
        '.env.local', '.env.worker.local', '.env.integration.local', '.env.deploy.local',
        'apps/web/.env.local', 'apps/web/.env.production.local']}
report['process_name_presence'] = {name: bool(os.environ.get(name)) for name in [
    'RENDER_API_KEY', 'RENDER_API_TOKEN', 'VERCEL_TOKEN', 'WORKER_WAKE_TOKEN',
    'WORKER_WAKE_URL', 'DATABASE_URL', 'GEMINI_API_KEY']}

for name, args in {
    'node': ['node', '--version'],
    'pnpm_cached': ['corepack.cmd', 'pnpm', '--version'],
    'vercel_cached': ['node', str(Path(os.environ['LOCALAPPDATA']) / 'npm-cache/_npx/29d463b7a51d914c/node_modules/vercel/dist/vc.js'), '--version'],
    'github_identity': ['gh', 'api', 'user', '--jq', '.login'],
    'github_repo': ['gh', 'repo', 'view', 'slvdrvncntjvr/AegisPay', '--json', 'nameWithOwner,visibility,defaultBranchRef,viewerPermission'],
    'github_main': ['git', 'ls-remote', '--heads', 'origin', 'main'],
    'docker_server': ['docker', 'version', '--format', '{{.Server.Version}}'],
    'docker_aegispay_containers': ['docker', 'ps', '-a', '--filter', 'name=aegispay', '--format', '{{.Names}}|{{.Status}}|{{.Ports}}'],
    'docker_aegispay_volumes': ['docker', 'volume', 'ls', '--filter', 'name=aegispay', '--format', '{{.Name}}'],
}.items():
    code, stdout = run(args)
    report[name] = {'exit_code': code, 'safe_result': stdout if code == 0 else None}

db_script = """
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { Pool } from 'pg';
const values = parseEnv(readFileSync('.env.integration.local', 'utf8'));
const report = {};
for (const name of ['DATABASE_URL', 'TEST_DATABASE_URL']) {
  let pool;
  try {
    const url = new URL(values[name]);
    if (url.hostname !== '127.0.0.1' || url.port !== '53371' || !['/aegispay', '/aegispay_integration'].includes(url.pathname)) throw new Error('UNEXPECTED_LOCAL_TARGET');
    pool = new Pool({connectionString: values[name], connectionTimeoutMillis: 3000});
    const result = await pool.query("SELECT current_database() AS database, current_setting('server_version') AS version");
    report[name] = {reachable: true, ...result.rows[0]};
  } catch { report[name] = {reachable: false}; }
  finally { if (pool) await pool.end(); }
}
console.log(JSON.stringify(report));
"""
code, stdout = run(['node', '--input-type=module', '-e', db_script])
try:
    report['local_db_readonly_query'] = {'exit_code': code, 'result': json.loads(stdout) if code == 0 else None}
except ValueError:
    report['local_db_readonly_query'] = {'exit_code': code, 'result': None}

report['browser_files'] = {}
for name, path in {
    'edge': Path(os.environ.get('PROGRAMFILES(X86)', 'C:/Program Files (x86)')) / 'Microsoft/Edge/Application/msedge.exe',
    'chrome': Path(os.environ.get('PROGRAMFILES', 'C:/Program Files')) / 'Google/Chrome/Application/chrome.exe',
    'playwright_cache': Path(os.environ['LOCALAPPDATA']) / 'ms-playwright',
}.items():
    report['browser_files'][name] = {'exists': path.exists()}
    if path.is_dir():
        report['browser_files'][name]['cached_folders'] = [p.name for p in path.iterdir() if p.is_dir()]

(OUT / 'supplemental-current.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, indent=2))
