"""Public-GET-only Render field diagnosis; never imports the provisioning helper.

Does not access environment files, provider credentials, account APIs, SQL or workers.
Only derived facts and public-source hashes are saved; bodies remain in memory.
"""
from pathlib import Path
import datetime as dt
import hashlib
import html
import json
import re
import urllib.request

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'docs/evidence/finals-staging-db/diagnosis-2026-11-10'
MCP = 'db8e54d13e462d7379f568e9129e25f9953f20b1'
CLI = 'f672d747f0a6496ed08e90338a6605efb00cd79f'
SCHEMA = 'https://api-docs.render.com/openapi/render-public-api-1.json'
URLS = {
    'schema': SCHEMA,
    'free': 'https://render.com/docs/free',
    'blueprint': 'https://render.com/docs/blueprint-spec',
    'create_reference': 'https://api-docs.render.com/reference/create-postgres',
    'create_connect': 'https://render.com/docs/postgresql-creating-connecting',
    'pooling': 'https://render.com/docs/postgresql-connection-pooling',
    'ha': 'https://render.com/docs/postgresql-high-availability',
    'replicas': 'https://render.com/docs/postgresql-read-replicas',
    'mcp_create': f'https://raw.githubusercontent.com/render-oss/render-mcp-server/{MCP}/pkg/postgres/tools.go',
    'cli_create': f'https://raw.githubusercontent.com/render-oss/cli/{CLI}/pkg/postgres/create.go',
    'cli_create_tests': f'https://raw.githubusercontent.com/render-oss/cli/{CLI}/pkg/postgres/create_test.go',
    'cli_validate': f'https://raw.githubusercontent.com/render-oss/cli/{CLI}/pkg/types/postgres/create.go',
    'cli_replicas': f'https://raw.githubusercontent.com/render-oss/cli/{CLI}/pkg/postgres/request.go',
}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def resolve(schema, value):
    while '$ref' in value:
        parts = value['$ref'].split('/')[1:]
        value = schema
        for part in parts:
            value = value[part]
    return value


def main():
    opener = urllib.request.build_opener(NoRedirect)
    sources, contents = [], {}
    for name, url in URLS.items():
        limit = 4_000_000 if name == 'schema' else 2_000_000
        request = urllib.request.Request(url, headers={'User-Agent': 'AegisPay-public-readonly-Free-diagnosis', 'Accept': 'application/json' if name == 'schema' else '*/*'}, method='GET')
        with opener.open(request, timeout=20) as response:
            raw = response.read(limit + 1)
            if len(raw) > limit or response.status != 200:
                raise RuntimeError('PUBLIC_SOURCE_LIMIT_OR_STATUS')
        contents[name] = raw.decode('utf-8')
        sources.append({'name': name, 'url': url, 'method': 'GET', 'authenticated': False, 'http_status': 200, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(), 'response_limit_bytes': limit})
    schema = json.loads(contents['schema'])
    body = resolve(schema, schema['paths']['/postgres']['post']['requestBody']['content']['application/json']['schema'])
    props = body['properties']
    optional = ['diskSizeGB', 'enableDiskAutoscaling', 'enableHighAvailability', 'connectionPool', 'readReplicas']
    projected = {}
    for name in ['name', 'ownerId', 'plan', 'version', 'region', *optional]:
        definition = resolve(schema, props[name])
        projected[name] = {'type': definition['type'], 'required': name in body['required']}
        if 'default' in definition:
            projected[name]['default'] = definition['default']
        if name in ['plan', 'version', 'region']:
            intended = {'plan': 'free', 'version': '17', 'region': 'singapore'}[name]
            projected[name]['intended_value'] = intended
            projected[name]['intended_value_in_schema_enum'] = intended in definition['enum']
    code = contents['mcp_create']
    guard = re.search(r'if postgresPlan == pgclient\.Free && diskSizeGbInt > 0\s*\{\s*return mcp\.NewToolResultError\("Free plan does not support custom disk size"\)', code)
    start = code[:guard.start()].count('\n') + 1 if guard else None
    cli_test = contents['cli_create_tests']
    optional_nil = {name: bool(re.search(r'assert\.Nil\(t, body\.' + name + r'\)', cli_test)) for name in ['DiskSizeGB', 'EnableDiskAutoscaling', 'EnableHighAvailability', 'ConnectionPool', 'ReadReplicas']}
    text = html.unescape(re.sub(r'<[^>]+>', ' ', contents['blueprint']))
    text = re.sub(r'\s+', ' ', text)
    facts = {
        'mcp_explicit_free_positive_disk_guard_found': bool(guard),
        'mcp_guard_source_lines': [start, start + 3] if start else None,
        'mcp_guard_rejects_diskSizeGB_1_by_arithmetic': bool(guard),
        'mcp_guard_scope': 'official public client behavior; not the unavailable original API error body',
        'cli_free_minimal_input_found': bool(re.search(r'Name: "my-pg", OwnerID: "[^\"]+", Plan: "free", Version: 18', cli_test)),
        'cli_unset_optionals_expected_nil': optional_nil,
        'cli_empty_read_replicas_becomes_nil': bool(re.search(r'if len\(names\) == 0\s*\{\s*return nil', contents['cli_replicas'])),
        'blueprint_fixed_free_storage_table_found': bool(re.search(r'free.{0,80}1 GB \(fixed\)', text)),
        'schema_describes_free_disk_field_condition': any(k in props['diskSizeGB'] for k in ['oneOf', 'anyOf', 'if', 'not', 'enum']),
        'schema_default_disabled_or_none': {name: props[name].get('default') for name in ['enableDiskAutoscaling', 'enableHighAvailability', 'connectionPool']},
        'original_HTTP400_reason_recovered': False,
        'account_prerequisites_rechecked': False,
        'proof_of_future_API_acceptance': False,
    }
    if not facts['mcp_explicit_free_positive_disk_guard_found'] or not all(optional_nil.values()) or not all(projected[k]['intended_value_in_schema_enum'] for k in ['plan', 'version', 'region']):
        raise RuntimeError('PUBLIC_SOURCE_ASSERTION_CHANGED_REVIEW_REQUIRED')
    result = {'observed_at_utc': dt.datetime.now(dt.timezone.utc).isoformat(), 'scope': 'public primary-source diagnosis only', 'provider_mutations': 0, 'account_API_calls': 0, 'environment_or_credential_reads': 0, 'DB_or_worker_access': 0, 'public_source_GET_count': len(sources), 'schema_sha256': sources[0]['sha256'], 'pinned_public_revisions': {'render_mcp_server': MCP, 'render_cli': CLI}, 'create_schema_fields': projected, 'derived_facts': facts, 'sources': sources, 'raw_bodies_saved': False}
    OUT.mkdir(parents=True, exist_ok=True)
    with (OUT / 'public-source-review.json').open('x', encoding='utf-8') as target:
        json.dump(result, target, indent=2)
        target.write('\n')
    print(json.dumps({'outcome': 'read_only_public_source_review_saved', 'public_GETs': len(sources), 'free_positive_disk_guard_found': bool(guard), 'schema_sha256': sources[0]['sha256']}))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'outcome': 'failed', 'exception_type_only': type(error).__name__, 'raw_error_emitted': False}))
        raise SystemExit(1)
