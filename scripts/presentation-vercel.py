"""Pinned CLI for this fresh allowlisted packet; secret values never reach logs or argv."""
from pathlib import Path
import json
import os
import re
import subprocess
import sys
import datetime

ROOT = Path(__file__).resolve().parents[1]
STAGE = ROOT / '.fmd-work/presentation-proof-20261118'
PRIVATE = ROOT / '.fmd-work/presentation-publish-20261118'
OUT = ROOT / 'docs/evidence/product-presentation-2026-11-18'
CLI = 'C:/Users/Vincent/AppData/Local/npm-cache/_npx/29d463b7a51d914c/node_modules/vercel/dist/vc.js'
PROJECT = 'prj_87hFYLDrQpbUsSlAgoFMsTIE7aTq'
sys.stdout.reconfigure(encoding='utf-8')
auth = json.loads((Path(os.environ['APPDATA']) / 'com.vercel.cli/Data/auth.json').read_text(encoding='utf-8'))
secrets = [v for v in auth.values() if isinstance(v, str) and len(v) > 12]
action = sys.argv[1]
if action == '--dry' and len(sys.argv) == 2:
    args = ['deploy', '--dry', '--json', '--project', PROJECT, '--yes']
    name = 'publish-proof-dry'
elif action == '--deploy' and len(sys.argv) == 3:
    commit = sys.argv[2]
    assert re.fullmatch('[a-f0-9]{40}', commit)
    marker = PRIVATE / 'vercel-deploy-request.json'
    with marker.open('x', encoding='utf-8') as f:
        json.dump({'requestedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'project': PROJECT, 'sourceCommit': commit, 'stage': str(STAGE)}, f)
    args = ['deploy', '--prod', '--skip-domain', '--no-wait', '--json', '--project', PROJECT, '--yes', '--meta', 'task=TASK-034', '--meta', 'sourceCommit='+commit]
    name = 'publish-proof-deploy'
elif action == '--promote' and len(sys.argv) == 3:
    deployment = sys.argv[2]
    assert re.fullmatch(r'dpl_[A-Za-z0-9]+', deployment)
    with (PRIVATE / 'vercel-promote-request.json').open('x', encoding='utf-8') as f:
        json.dump({'requestedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'deployment': deployment}, f)
    args = ['promote', deployment, '--yes']
    name = 'publish-proof-promote'
else:
    raise SystemExit('Explicit --dry / --deploy commit / --promote deployment required')
result = subprocess.run(['node', CLI] + args, cwd=STAGE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, encoding='utf-8', errors='replace')
def clean(text):
    for secret in secrets:
        text = text.replace(secret, '[REDACTED]')
    return re.sub(r'([?&]x-vercel-protection-bypass=)[^&\s]+', r'\1[REDACTED]', text)
stdout, stderr = clean(result.stdout), clean(result.stderr)
(OUT / (name+'.txt')).write_text(stdout+'\n'+stderr, encoding='utf-8')
if result.returncode == 0 and action in ['--dry', '--deploy']:
    try:
        value = json.loads(stdout)
    except ValueError:
        raise SystemExit('Saved CLI output is not JSON; inspect safe receipt without retrying deploy')
    (OUT / (name+'.json')).write_text(json.dumps(value, indent=2)+'\n', encoding='utf-8')
print(json.dumps({'action': action, 'exitCode': result.returncode, 'receipt': name, 'stdoutBytes': len(stdout), 'stderrBytes': len(stderr)}))
if result.returncode:
    print(stderr[-1800:])
sys.exit(result.returncode)
