/** TASK-019: bounded, real production-Next / isolated-cloud-Postgres qualification.
 * No root DB scripts, integration loader, provider API, worker, model or chain call.
 * Raw HTTP, cookies, credentials, logs and fixture contents remain in memory only.
 */
import { createHash, randomBytes } from 'node:crypto';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFile, readdir, mkdir, open, link, unlink, stat } from 'node:fs/promises';
import path from 'node:path';
import { checkServerIdentity } from 'node:tls';
import { Keypair } from '@stellar/stellar-sdk';
import { chromium, expect } from '@playwright/test';
import { createStore, type Store } from '../../../src/server/db/connection.ts';
import { seedConfigFromEnvironment } from '../../../src/server/db/seed.ts';
import { reportFixture } from '../../../src/server/merchant/reports.ts';
import { ObservationProxy, CHROME } from './proxy-capture.ts';
import { FOLLOWUP, sourcePaths } from './continuation.ts';
import { publishTerminal, exclusive } from './evidence-terminal.ts';
import { ProductionLaunch, minimalEnv, requireFreePorts } from './startup.ts';

const ROOT = process.cwd();
const HERE = path.join(ROOT, 'deployment/finals/staging-app');
const CUSTODY = path.join(ROOT, '.fmd-work/staging-app-custody');
const WEBFILE = path.join(ROOT, '.env.staging.web.local');
const DBFILE = path.join(ROOT, '.env.staging.local');
const PORT = 3037;
const UPSTREAM_PORT = 3038;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const IDHASH = 'feaa345c7d4172d22feb6dd8c92794128061a2f357b2e5372c0739138b6f8f85';
const CREATED = '2026-11-10T11:55:40.452333Z';
const EXPIRES = '2026-12-10T11:55:40.452333Z';
const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
const OUT = path.join(ROOT, FOLLOWUP, 'actual');
const require = createRequire(import.meta.url);
const hash = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
class QualificationFailure extends Error {}
const check = (value: unknown, code: string): asserts value => { if (!value) throw new QualificationFailure(code); };
const read = (p: string) => readFile(p, 'utf8');
const relative = (p: string) => path.relative(ROOT, p).replaceAll('\\', '/');
const exists = async (p: string) => !!await stat(p).catch(() => null);
const report: Record<string, any> = { task: 'TASK-019', started_at: new Date().toISOString(), outcome: 'failed',
  scope: 'loopback production Next.js against exact isolated cloud staging DB; no hosted app or release acceptance',
  commands: [], checks: [], http: [], browser: [], app_pool_tls: [], cleanup: {} };
let stage = 'configuration';
let store: Store | undefined;
let app: ChildProcess | undefined;
let launch: ProductionLaunch | undefined;
let proxy: ObservationProxy | undefined;
let web: Record<string, string> = {};
let db: Record<string, string> = {};
let originalDBHash = '';
let rawLogs = '';
const sessions = new Set<string>();
const privateValues = new Set<string>();
const reportStrings = ['quick-signal:demo-parser:v1', 'deep-trace:demo-parser:v1'].flatMap(k => reportFixture(k, 'v1').findings);
const scan = { response_bodies: 0, response_bytes: 0, fixture_matches: 0, known_secret_matches: 0, full_provider_id_matches: 0, raw_dsn_matches: 0, client_ip_matches: 0 };
const clientIPs = new Set<string>();
const secretNames = /(?:SECRET|TOKEN|PASSWORD|API_KEY|ENCRYPTION_KEY|RECEIPT_SIGNING_KEY|DATABASE_URL)$/;

function parse(text: string) {
  const entries = text.split(/\r?\n/).filter(l => /^[A-Z][A-Z0-9_]*=/.test(l)).map(l => {
    const index = l.indexOf('='); let value = l.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    return [l.slice(0, index), value];
  });
  check(new Set(entries.map(e => e[0])).size === entries.length, 'DUPLICATE_ENV_KEY');
  return Object.fromEntries(entries);
}
function remember(text: string) {
  for (const [key, value] of Object.entries(parse(text))) if (secretNames.test(key) && value.length >= 12) {
    privateValues.add(value);
    if (/DATABASE_URL$/.test(key)) { try { const u = new URL(value); if (u.password) { privateValues.add(u.password); privateValues.add(decodeURIComponent(u.password)); } } catch { /* Classified below; never emitted. */ } }
  }
}
function inspect(buffer: Buffer | string, includeFixtures = true) {
  const text = buffer.toString();
  return { fixture_matches: includeFixtures ? reportStrings.filter(v => text.includes(v) || text.includes(JSON.stringify(v).slice(1, -1))).length : 0,
    known_secret_matches: [...privateValues].filter(v => text.includes(v) || text.includes(encodeURIComponent(v))).length,
    full_provider_id_matches: (text.match(/\b(?:dpg|usr|tea|srv)-[a-z0-9]{10,}(?:-[a-z0-9]+)?\b/g) ?? []).length,
    raw_dsn_matches: (text.match(/postgres(?:ql)?:\/\/[^\s"']+:[^\s"']+@/g) ?? []).length,
    client_ip_matches: [...clientIPs].filter(v => text.includes(v)).length };
}
function scanResponse(raw: Buffer | string) {
  scan.response_bodies++; scan.response_bytes += Buffer.byteLength(raw);
  const hits = inspect(raw);
  for (const [k, v] of Object.entries(hits)) scan[k as keyof typeof scan] += v;
  check(Object.values(hits).every(v => v === 0), 'RESPONSE_HYGIENE_FAILED');
}
async function files(directory: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue;
    const p = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await files(p)); else if (entry.isFile()) found.push(p);
  }
  return found.sort();
}
function powershell(script: string) {
  // Orca's PowerShell 7 module path is incompatible with Windows PowerShell 5.
  const env = { ...minimalEnv(), PSModulePath: `${process.env.SystemRoot}/System32/WindowsPowerShell/v1.0/Modules` };
  const result = spawnSync(`${process.env.SystemRoot}/System32/WindowsPowerShell/v1.0/powershell.exe`, ['-NoProfile', '-NonInteractive', '-Command', script], { env, windowsHide: true, encoding: 'utf8' });
  check(result.status === 0, 'PROTECTED_ACL_OPERATION_FAILED');
  return result.stdout.trim();
}
const quotePS = (s: string) => "'" + s.replaceAll("'", "''") + "'";
function acl(p: string, apply = false) {
  const q = quotePS(p);
  const script = `$ErrorActionPreference='Stop'; $p=${q}; $sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User; $system=[System.Security.Principal.SecurityIdentifier]::new('S-1-5-18'); ` +
    (apply ? `$a=Get-Acl -LiteralPath $p; $a.SetAccessRuleProtection($true,$false); foreach($r in @($a.Access)) { [void]$a.RemoveAccessRuleSpecific($r) }; foreach($s in @($sid,$system)) { $r=[System.Security.AccessControl.FileSystemAccessRule]::new($s,'FullControl','Allow'); $a.AddAccessRule($r) }; Set-Acl -LiteralPath $p -AclObject $a; ` : '') +
    `$a=Get-Acl -LiteralPath $p; if(-not $a.AreAccessRulesProtected) { exit 1 }; $rules=@($a.Access); if($rules.Count -ne 2) { exit 2 }; foreach($r in $rules) { $s=$r.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value; if($s -notin @($sid.Value,$system.Value) -or $r.AccessControlType -ne 'Allow' -or $r.IsInherited -or $r.FileSystemRights -ne 'FullControl') { exit 3 } }; Write-Output 'verified'`;
  check(powershell(script) === 'verified', 'PROTECTED_ACL_VERIFICATION_FAILED');
}
async function exclusiveProtected(p: string, contents: string) {
  check(!await exists(p), 'PROTECTED_TARGET_ALREADY_EXISTS');
  const temporary = path.join(CUSTODY, 'pending-' + randomBytes(12).toString('hex'));
  const handle = await open(temporary, 'wx', 0o600);
  try {
    acl(temporary, true); // Empty file; verified before the first secret byte.
    await handle.writeFile(contents, 'utf8'); await handle.sync();
  } finally { await handle.close(); }
  // An atomic, exclusive same-volume link publishes the complete file; never overwrites.
  await link(temporary, p); await unlink(temporary); acl(p);
}
async function run(executable: string, args: string[], env = minimalEnv(), cwd = ROOT, timeout = 120000) {
  const started = new Date().toISOString();
  const result = await new Promise<{ status: number | null; output: string }>((resolve, reject) => {
    let output = '';
    const child = spawn(executable, args, { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => { child.kill(); reject(new Error('BOUNDED_CHILD_TIMEOUT')); }, timeout);
    child.stdout.on('data', b => { output += b.toString(); }); child.stderr.on('data', b => { output += b.toString(); });
    child.once('error', () => { clearTimeout(timer); reject(new Error('CHILD_START_FAILED')); });
    child.once('exit', status => { clearTimeout(timer); resolve({ status, output }); });
  });
  const hygiene = inspect(result.output, false);
  report.commands.push({ executable: executable === process.execPath ? 'node' : executable, args: args.map(a => path.isAbsolute(a) ? relative(a) : a), cwd: relative(cwd) || '.', started_at: started, exit: result.status, output_sha256: hash(result.output), output_bytes: Buffer.byteLength(result.output), hygiene });
  check(Object.values(hygiene).every(v => v === 0), 'CHILD_LOG_HYGIENE_FAILED');
  return result;
}
async function counts() {
  const names = ['owner','merchant','agent','resource','schema_migration','session','auth_throttle','agent_run','quote','payment_attempt','payment_evidence','entitlement','job','wallet_operation','merchant_claim','run_event','audit_event','payment_accept_key'];
  const result: Record<string, number> = {};
  for (const name of names) result[name] = Number((await store!.pool.query(`SELECT count(*)::int AS count FROM "${name}"`)).rows[0].count);
  return result;
}
function assertNonfinancial(c: Record<string, number>) {
  for (const name of ['agent_run','quote','payment_attempt','payment_evidence','entitlement','job','wallet_operation','merchant_claim','run_event','audit_event','payment_accept_key']) check(c[name] === 0, 'UNEXPECTED_FINANCIAL_OR_EXECUTION_ROWS');
}
async function fingerprint() {
  // Use the preserved observed source closure; no Git operation in this scope.
  const baseline=JSON.parse(await read(path.join(ROOT,'docs/evidence/finals-staging-app/2026-11-10T12-41-01-076Z/result.json')));
  const paths = baseline.source.files.map((f:any)=>f.path) as string[];
  const inventory = await Promise.all([...new Set(paths)].sort().map(async p => ({ path: p, sha256: hash(await readFile(path.join(ROOT, p))) })));
  check(hash(JSON.stringify(inventory))===baseline.source.sha256,'APPLICATION_SOURCE_CLOSURE_CHANGED');
  return { sha256: hash(JSON.stringify(inventory)), files: inventory };
}
async function verifyFullBuild(){
  const index=JSON.parse(await read(path.join(ROOT,'docs/evidence/finals-staging-app/build-inventory.json')));
  check(index.sha256==='3e6d864cf2f90759c110bbb283cbe53d4028a6b63c199a8a03f81662c12f07b0'&&hash(JSON.stringify(index.files))===index.sha256,'ORIGINAL_FULL_BUILD_INVENTORY_CHANGED');
  let serverFixtures=0,clientFixtures=0;
  for(const f of index.files){const bytes=await readFile(path.join(ROOT,f.path));check(hash(bytes)===f.sha256,'FULL_BUILD_FILE_CHANGED');const hits=inspect(bytes,f.client);check(Object.values(hits).every(v=>v===0),'FULL_BUILD_PRIVATE_OR_CLIENT_FIXTURE_LEAK');if(f.client)clientFixtures+=inspect(bytes).fixture_matches;else serverFixtures+=inspect(bytes).fixture_matches;}
  check(clientFixtures===0&&serverFixtures>0,'FULL_BUILD_FIXTURE_BOUNDARY_FAILED');
  return{files_verified:index.files.length,inventory_sha256:index.sha256,client_fixture_matches:clientFixtures,server_fixture_matches:serverFixtures};
}
async function verifyPool() {
  const client = await store!.pool.connect();
  try {
    const c = client as any; const stream = c.connection.stream;
    const host = new URL(db.DATABASE_URL!).hostname;
    check(stream.encrypted && stream.authorized && !checkServerIdentity(host, stream.getPeerCertificate()), 'REAL_STORE_TLS_FAILED');
    check(checkServerIdentity('qualification.invalid', stream.getPeerCertificate())?.code === 'ERR_TLS_CERT_ALTNAME_INVALID', 'HOSTNAME_NEGATIVE_CHECK_FAILED');
    const parameters = c.connectionParameters;
    check(parameters.ssl && parameters.ssl.rejectUnauthorized !== false && !parameters.ssl.checkServerIdentity, 'REAL_STORE_TLS_CONFIGURATION_FAILED');
    const info = (await client.query('SELECT current_database() AS db, current_user AS usr, current_schema() AS schema, version() AS version')).rows[0];
    check(info.db === decodeURIComponent(new URL(db.DATABASE_URL!).pathname.slice(1)) && info.usr === decodeURIComponent(new URL(db.DATABASE_URL!).username) && info.schema === 'public' && /^PostgreSQL 17\./.test(info.version), 'REAL_STORE_IDENTITY_FAILED');
    const ssl = (await client.query('SELECT ssl, version FROM pg_stat_ssl WHERE pid = pg_backend_pid()')).rows[0];
    check(ssl.ssl === true, 'SERVER_TLS_NOT_CONFIRMED');
    const limits = (await client.query("SELECT current_setting('max_connections')::int AS max_connections")).rows[0];
    check(limits.max_connections >= 20, 'FREE_DATABASE_CONNECTION_HEADROOM_TOO_SMALL');
    report.store_tls = { real_createStore: true, encrypted: true, authorized: true, hostname_verified: true, wrong_hostname_rejected: true,
      protocol: stream.getProtocol(), server_pg_stat_ssl: ssl.ssl, server_tls_version: ssl.version, pool_max: store!.pool.options.max,
      server_max_connections: limits.max_connections, helper_connections: 1, production_app_pool_max: 10, requests_serialized: true };
  } finally { client.release(); }
}
async function http(p: string, options: RequestInit = {}, expected = 200, label = p) {
  const response = await fetch(ORIGIN + p, { ...options, redirect: 'manual', signal: AbortSignal.timeout(20000) });
  const buffer = Buffer.from(await response.arrayBuffer()); scanResponse(buffer);
  const record = { label, method: options.method ?? 'GET', status: response.status, expected, no_store: response.headers.get('cache-control') === 'no-store', content_type: response.headers.get('content-type')?.split(';')[0], bytes: buffer.length, sha256: hash(buffer) };
  report.http.push(record); check(response.status === expected, 'HTTP_EXPECTATION_FAILED_' + report.http.length);
  if (p.startsWith('/api/')) check(record.no_store, 'API_CACHE_CONTROL_FAILED');
  return { response, body: buffer.toString(), json: () => JSON.parse(buffer.toString()) };
}
function cookieFrom(response: Response) {
  const value = response.headers.get('set-cookie') ?? '';
  check(/HttpOnly/i.test(value) && /SameSite=Strict/i.test(value) && /Path=\//.test(value) && /Max-Age=28800/.test(value) && !/;\s*Secure/i.test(value), 'LOOPBACK_COOKIE_FLAGS_FAILED');
  const cookie = value.split(';')[0]!; const token = cookie.slice(cookie.indexOf('=') + 1);
  check(/^[A-Za-z0-9_-]{43}$/.test(token), 'SESSION_TOKEN_FORMAT_FAILED');
  privateValues.add(token); sessions.add(hash(token)); return cookie;
}
function verifyState(state: any, role: string) {
  check(state.role === role && state.network === 'testnet' && state.offers.length === 2 && state.walletAddress === web[role === 'owner' ? 'DEMO_OWNER_PUBLIC_KEY' : 'DEMO_MERCHANT_PUBLIC_KEY'], 'ROLE_STATE_MISMATCH');
  check(state.walletOperations.length === 0 && state.balances.status === 'unavailable', 'UNEXPECTED_WALLET_STATE');
  if (role === 'owner') check(state.agent.publicKey === web.DEMO_AGENT_PUBLIC_KEY && state.agent.deviceHash === web.DEMO_DEVICE_HASH && state.agent.status === 'unprovisioned' && state.agent.policyMaxStroops === '0' && state.agent.policyObservedLedger === null && new Date(state.agent.policyExpiresAt).getTime() === 0 && state.runs.length === 0 && state.attempts.length === 0 && state.health.database === 'available' && state.health.model === 'worker_only', 'OWNER_ZERO_POLICY_STATE_FAILED');
  else check(!state.agent && !state.runs && !state.attempts && state.claims.length === 0, 'MERCHANT_PRIVATE_STATE_ISOLATION_FAILED');
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const authorization=JSON.parse(await read(path.join(ROOT,FOLLOWUP,'continuation-authorization.json')));
  check(authorization.task==='task_eb0e2e40e433'&&authorization.dispatch==='ctx_7ffda5859c9c','EXPLICIT_CONTINUATION_AUTHORIZATION_REQUIRED');
  for(const link of authorization.linked)check(hash(await readFile(path.join(ROOT,link.path)))===link.sha256,'CONTINUATION_PREREQUISITE_OR_PRIOR_RECEIPT_CHANGED');
  report.continuation={task:authorization.task,dispatch:authorization.dispatch,authorization_sha256:hash(await readFile(path.join(ROOT,FOLLOWUP,'continuation-authorization.json'))),linked:authorization.linked};
  const source_files=await Promise.all(sourcePaths.map(async p=>({path:p,sha256:hash(await readFile(path.join(ROOT,p)))})));
  const binding=JSON.parse(await read(path.join(ROOT,FOLLOWUP,'continuation-source-binding.json')));
  check(JSON.stringify(binding.source_files)===JSON.stringify(source_files)&&binding.authorization_sha256===report.continuation.authorization_sha256,'CONTINUATION_SOURCE_BINDING_MISMATCH');
  report.continuation.source_binding_sha256=hash(await readFile(path.join(ROOT,FOLLOWUP,'continuation-source-binding.json')));
  const prerequisites=JSON.parse(await read(path.join(ROOT,FOLLOWUP,'repair-prerequisites.json')));
  check(binding.repair_prerequisites_sha256===hash(await readFile(path.join(ROOT,FOLLOWUP,'repair-prerequisites.json'))),'REPAIR_PREREQUISITE_BINDING_FAILED');
  for(const p of prerequisites.receipts){check(hash(await readFile(path.join(ROOT,p.path)))===p.sha256,'REPAIR_PREREQUISITE_CHANGED');const item=JSON.parse(await read(path.join(ROOT,p.path)));check(item.outcome==='passed','REPAIR_PREREQUISITE_NOT_PASSED');if(p.role==='startup')check(item.startup.classification==='READY'&&item.cleanup.owned_process_exited&&item.proxy.upstream_requests===0&&item.startup.staging_tls_observations===0,'CONCRETE_STARTUP_READINESS_REQUIRED');}
  report.repair_prerequisites=prerequisites;
  let accepted:any;
  for(const name of (await readdir(path.join(ROOT,FOLLOWUP))).filter(p=>/^preflight-[1-3]\.json$/.test(p)).sort().reverse()){
    const receipt=JSON.parse(await read(path.join(ROOT,FOLLOWUP,name)));
    if(receipt.outcome==='passed'&&JSON.stringify(receipt.source_files)===JSON.stringify(source_files)){accepted={path:FOLLOWUP+'/'+name,sha256:hash(await readFile(path.join(ROOT,FOLLOWUP,name))),receipt};break;}
  }
  check(accepted&&accepted.receipt.contexts.length===2&&accepted.receipt.contexts.every((c:any)=>c.completed&&c.exact_request_count_maps_match&&c.missing_delivered_captures===0&&c.failures===0),'IMMUTABLE_MATCHING_CAPTURE_PREFLIGHT_REQUIRED');
  report.capture_preflight={path:accepted.path,sha256:accepted.sha256,source_files};
  // New explicit continuation receipt; the exhausted original marker remains.
  const marker=await open(path.join(ROOT,FOLLOWUP,'continuation-execution.json'),'wx');
  try{await marker.writeFile(JSON.stringify({at:new Date().toISOString(),command:'node --import tsx deployment/finals/staging-app/qualify.ts --resume',task:authorization.task,dispatch:authorization.dispatch,authorization_sha256:report.continuation.authorization_sha256,capture_preflight_sha256:accepted.sha256,source_files})+'\n');}finally{await marker.close();}
  check(process.version === 'v24.22.1', 'PINNED_NODE_REQUIRED');
  check(Object.keys(process.env).filter(k => /^(?:https?_proxy|all_proxy|node_options|node_extra_ca_certs|node_tls_reject_unauthorized|pg.*)$/i.test(k)).length === 0, 'UNSAFE_TLS_PROXY_OR_PG_ENV');
  check(process.argv.slice(2).every(a => a === '--resume') && process.argv.slice(2).length <= 1, 'INVALID_GATE_ARGUMENTS');
  const resume = process.argv.includes('--resume');
  check(resume,'SAME_CUSTODY_RESUME_ONLY');
  acl(DBFILE); originalDBHash = hash(await readFile(DBFILE)); db = parse(await read(DBFILE));
  check(Object.keys(db).sort().join(',') === ['DATABASE_URL','RENDER_STAGING_POSTGRES_ID','RENDER_STAGING_OWNER_ID','RENDER_STAGING_CREATED_AT','RENDER_STAGING_EXPIRES_AT'].sort().join(','), 'STAGING_CUSTODY_ALLOWLIST_FAILED');
  check(hash(db.RENDER_STAGING_POSTGRES_ID!) === IDHASH && db.RENDER_STAGING_CREATED_AT === CREATED && db.RENDER_STAGING_EXPIRES_AT === EXPIRES && Date.now() < Date.parse(EXPIRES), 'EXACT_RESOURCE_LIFECYCLE_FAILED');
  const url = new URL(db.DATABASE_URL!);
  check(['postgresql:','postgres:'].includes(url.protocol) && url.hostname === `${db.RENDER_STAGING_POSTGRES_ID}.singapore-postgres.render.com` && (!url.port || url.port === '5432') && url.username && url.password && url.pathname === '/aegispay_finals_staging', 'EXACT_RESOURCE_DSN_FAILED');
  check([...url.searchParams].length === 1 && url.searchParams.get('sslmode') === 'verify-full', 'STRICT_URL_TLS_REQUIRED');
  report.configuration = { exact_resource_sha256: IDHASH, created_at: CREATED, expires_at: EXPIRES, strict_tls: true, original_custody_acl_verified: true, original_staging_file_sha256: originalDBHash };
  for (const name of await readdir(ROOT)) if (/^\.env(?:\..*)?$/.test(name) && name !== '.env.example') remember(await read(path.join(ROOT, name)));
  const permit = JSON.parse(await read(path.join(ROOT, '.fmd-work/staging-ip-allow-permit.json')));
  for (const ip of JSON.stringify(permit).match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) ?? []) clientIPs.add(ip);
  const rotationPermit=await read(path.join(ROOT,'.fmd-work/staging-ip-rotation-permit-2026-11-10.json'));
  for(const ip of rotationPermit.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g)??[])clientIPs.add(ip);
  check(clientIPs.size === 2, 'OLD_AND_NEW_CLIENT_IP_SCAN_CONFIGURATION_FAILED');
  for (const name of ['.env', '.env.local', '.env.production', '.env.production.local']) check(!await exists(path.join(ROOT,'apps/web',name)), 'NEXT_AUTOMATIC_ENV_FILE_PRESENT');
  await requireFreePorts();
  if (!await exists(CUSTODY)) { await mkdir(CUSTODY); acl(CUSTODY, true); } else acl(CUSTODY);
  if (!resume) check(!await exists(WEBFILE), 'WEB_CONFIG_EXISTS_RESUME_REQUIRED');
  const configuredPublic = ['DEMO_OWNER_PUBLIC_KEY','DEMO_MERCHANT_PUBLIC_KEY','NOIR_DEVICE_REGISTRY_ID','NOIR_AGENT_REGISTRY_ID','NOIR_PAYMENT_ESCROW_ID','NOIR_XLM_SAC_ID','STELLAR_NETWORK','STELLAR_NETWORK_PASSPHRASE'];
  // Only named public settings are selected for seed/runtime. No worker env is loaded.
  const worker = parse(await read(path.join(ROOT,'.env.worker.local')));
  const publicEnv = Object.fromEntries(configuredPublic.map(k => { check(!!worker[k], 'MISSING_ALLOWLISTED_PUBLIC_SETTING'); return [k,worker[k]!]; }));
  check(publicEnv.STELLAR_NETWORK === 'testnet' && publicEnv.STELLAR_NETWORK_PASSPHRASE === 'Test SDF Network ; September 2015', 'TESTNET_CONFIGURATION_REQUIRED');
  const verified = JSON.parse(await read(path.join(ROOT,'docs/evidence/testnet/contracts-1794013516299.json')));
  const verifiedText = JSON.stringify(verified);
  check(configuredPublic.filter(k => k.startsWith('NOIR_')).every(k => verifiedText.includes(publicEnv[k]!)), 'VERIFIED_CONTRACT_TUPLE_MISMATCH');
  const originalIdentities = new Set<string>();
  for (const name of await readdir(ROOT)) if (/^\.env(?:\..*)?$/.test(name) && name !== '.env.example' && name !== '.env.staging.web.local') {
    const raw = await read(path.join(ROOT,name));
    for (const line of raw.split(/\r?\n/)) if (/^(?:DEMO_AGENT_PUBLIC_KEY|DEMO_DEVICE_HASH)=/.test(line)) originalIdentities.add(line.slice(line.indexOf('=')+1).trim().replace(/^['"]|['"]$/g,''));
  }
  if (resume) {
    acl(WEBFILE); web = parse(await read(WEBFILE));
    check(await exists(path.join(CUSTODY,'initial-fresh-schema.json')), 'RESUME_WITHOUT_FRESH_SCHEMA_CUSTODY');
    const prior = JSON.parse(await read(path.join(CUSTODY,'initial-fresh-schema.json')));
    check(prior.resource_sha256 === IDHASH && prior.web_sha256 === hash(await readFile(WEBFILE)), 'RESUME_CUSTODY_MISMATCH');
  } else {
    const keypair = Keypair.random(); const device = randomBytes(32).toString('hex');
    check(!originalIdentities.has(keypair.publicKey()) && !originalIdentities.has(device), 'STAGING_IDENTITY_NOT_DISTINCT');
    web = { NODE_ENV: 'production', APP_ORIGIN: ORIGIN, DATABASE_URL: db.DATABASE_URL!, ...publicEnv, DEMO_AGENT_PUBLIC_KEY: keypair.publicKey(), DEMO_DEVICE_HASH: device,
      DEMO_OWNER_LOGIN_TOKEN: randomBytes(48).toString('base64url'), DEMO_MERCHANT_LOGIN_TOKEN: randomBytes(48).toString('base64url'), RECEIPT_SIGNING_KEY: randomBytes(48).toString('base64url') };
    await exclusiveProtected(path.join(CUSTODY,'independent-agent.json'), JSON.stringify({ purpose: 'unprovisioned independent staging identity; no chain action authorized', agent_secret: keypair.secret(), device_hash: device }) + '\n');
    const envText = Object.entries(web).map(([k,v]) => `${k}=${JSON.stringify(v)}`).join('\n') + '\n';
    await exclusiveProtected(WEBFILE, envText);
  }
  const allowedWeb = ['NODE_ENV','APP_ORIGIN','DATABASE_URL',...configuredPublic,'DEMO_AGENT_PUBLIC_KEY','DEMO_DEVICE_HASH','DEMO_OWNER_LOGIN_TOKEN','DEMO_MERCHANT_LOGIN_TOKEN','RECEIPT_SIGNING_KEY'];
  check(Object.keys(web).sort().join(',') === allowedWeb.sort().join(',') && web.NODE_ENV === 'production' && web.APP_ORIGIN === ORIGIN && web.DATABASE_URL === db.DATABASE_URL, 'WEB_ENV_ALLOWLIST_FAILED');
  check(!originalIdentities.has(web.DEMO_AGENT_PUBLIC_KEY!) && !originalIdentities.has(web.DEMO_DEVICE_HASH!), 'IDENTITY_REUSE_FORBIDDEN');
  check(['DEMO_OWNER_LOGIN_TOKEN','DEMO_MERCHANT_LOGIN_TOKEN','RECEIPT_SIGNING_KEY'].every(k => /^[A-Za-z0-9_-]{64}$/.test(web[k]!)) && new Set(['DEMO_OWNER_LOGIN_TOKEN','DEMO_MERCHANT_LOGIN_TOKEN','RECEIPT_SIGNING_KEY'].map(k => web[k])).size === 3, 'AUTH_SECRET_ENTROPY_OR_DISTINCTNESS_FAILED');
  remember(await read(WEBFILE)); const privateIdentity = JSON.parse(await read(path.join(CUSTODY,'independent-agent.json'))); privateValues.add(privateIdentity.agent_secret);
  report.web_configuration = { keys: Object.keys(web).sort(), acl_verified_before_secret_write: true, exclusive_atomic_persistence: true, fresh_distinct_secrets_48_bytes_each: true,
    public_agent_sha256: hash(web.DEMO_AGENT_PUBLIC_KEY!), device_sha256: hash(web.DEMO_DEVICE_HASH!), differs_from_original_configured_identities: true,
    agent_secret_separate_protected_custody_only: true, no_worker_model_wake_or_financial_credentials_in_app: true, app_origin: ORIGIN, trust_proxy_unset: true };
  stage = 'database-tls-verification';
  store = createStore(db.DATABASE_URL!, 'public', 1); store.pool.on('error', () => {}); await verifyPool();
  // Actual DB clock and remaining login budget are observed read-only before
  // migration/seed/app/login work. No reset, poll or sleep on insufficient budget.
  stage='database-clock-login-budget';
  const budgetClient=await store.pool.connect();
  try{
    await budgetClient.query('BEGIN READ ONLY');
    const now=(await budgetClient.query('SELECT clock_timestamp() AS now')).rows[0].now as Date;
    const budget:Record<string,any>={database_time:now.toISOString(),read_only:true,roles:{}};let sufficient=true;let notBefore=now.getTime();
    for(const [label,key,limit,required] of [['owner','login:untrusted-proxy:owner',5,3],['merchant','login:untrusted-proxy:merchant',5,3],['global','login:global',50,6]] as const){
      const row=(await budgetClient.query('SELECT attempts,expires_at FROM auth_throttle WHERE key_hash=$1',[hash(key)])).rows[0];
      const active=!!row&&row.expires_at.getTime()>now.getTime();const remaining=active?limit-row.attempts:limit;
      budget.roles[label]={attempts:row?.attempts??0,window_active:active,expires_at:row?.expires_at?.toISOString()??null,remaining,required};
      if(remaining<required){sufficient=false;notBefore=Math.max(notBefore,row.expires_at.getTime());}
    }
    await budgetClient.query('COMMIT');budget.sufficient=sufficient;if(!sufficient)budget.not_before=new Date(notBefore+1000).toISOString();report.login_budget=budget;
    check(sufficient,'REAL_LOGIN_THROTTLE_BUDGET_INSUFFICIENT');
  }finally{budgetClient.release();}
  stage='database-existing-metadata';
  const publicObjects = await store.pool.query("SELECT c.relname, c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname");
  const publicRoutines = await store.pool.query("SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'");
  if (!resume) {
    check(publicObjects.rowCount === 0 && publicRoutines.rowCount === 0, 'FRESH_PUBLIC_SCHEMA_REQUIRED');
    await exclusiveProtected(path.join(CUSTODY,'initial-fresh-schema.json'), JSON.stringify({ at: new Date().toISOString(), resource_sha256: IDHASH, web_sha256: hash(await readFile(WEBFILE)), objects: 0, routines: 0 }) + '\n');
  }
  report.fresh_schema_guard = { first_run: !resume, observed_public_objects_before_migration: publicObjects.rowCount, observed_public_routines_before_migration: publicRoutines.rowCount, protected_initial_empty_schema_receipt: true };
  report.migrations = (await store.pool.query('SELECT name, sha256 FROM schema_migration ORDER BY name')).rows;
  check(report.migrations.length === 4, 'EXPECTED_FOUR_CHECKSUM_MIGRATIONS');
  const historical=JSON.parse(await read(path.join(ROOT,'docs/evidence/finals-staging-app/2026-11-10T12-41-01-076Z/result.json')));
  check(JSON.stringify(report.migrations)===JSON.stringify(historical.migrations),'EXISTING_MIGRATION_CHECKSUMS_CHANGED');
  const beforeSeed = await counts(); assertNonfinancial(beforeSeed);
  if (!resume) check(['owner','merchant','agent','resource','session','auth_throttle'].every(k => beforeSeed[k] === 0), 'FRESH_CATALOG_STATE_REQUIRED');
  else check(beforeSeed.owner <= 1 && beforeSeed.merchant <= 1 && beforeSeed.agent <= 1 && beforeSeed.resource <= 2, 'RESUME_FOREIGN_METADATA_REJECTED');
  const seed=seedConfigFromEnvironment(web);
  const catalog=await store.pool.query('SELECT r.resource_key,r.price_stroops,r.fixture_version,r.asset_contract_id,m.wallet_address FROM resource r JOIN merchant m ON m.id=r.merchant_id ORDER BY r.resource_key');
  check(catalog.rows.length===2&&catalog.rows.every((r:any)=>r.asset_contract_id===seed.assetContractId&&r.wallet_address===seed.merchantAddress&&r.fixture_version==='v1'&&r.price_stroops===(r.resource_key==='quick-signal:demo-parser:v1'?'300000':r.resource_key==='deep-trace:demo-parser:v1'?'1200000':'invalid')),'EXISTING_SEED_CATALOG_CHANGED');
  const afterSeed = await counts(); assertNonfinancial(afterSeed);
  check(afterSeed.owner === 1 && afterSeed.merchant === 1 && afterSeed.agent === 1 && afterSeed.resource === 2, 'METADATA_SEED_COUNTS_FAILED');
  const a = (await store.pool.query('SELECT public_key, device_hash, policy_max_stroops, policy_expires_at, policy_observed_ledger, status, last_nonce FROM agent')).rows[0];
  check(a.public_key === web.DEMO_AGENT_PUBLIC_KEY && a.device_hash === web.DEMO_DEVICE_HASH && a.policy_max_stroops === '0' && a.policy_expires_at.getTime() === 0 && a.policy_observed_ledger === null && a.status === 'unprovisioned' && a.last_nonce === '0', 'SEEDED_AGENT_IS_NOT_ZERO_UNPROVISIONED');
  const identity=(await store.pool.query('SELECT o.wallet_address, a.device_contract_id,a.agent_contract_id,a.escrow_contract_id,a.asset_contract_id FROM agent a JOIN owner o ON o.id=a.owner_id')).rows[0];
  check(identity.wallet_address===seed.ownerAddress&&identity.device_contract_id===seed.deviceContractId&&identity.agent_contract_id===seed.agentContractId&&identity.escrow_contract_id===seed.escrowContractId&&identity.asset_contract_id===seed.assetContractId,'EXISTING_SEED_IDENTITY_CHANGED');
  report.after_seed_counts = afterSeed;
  const existingSessions=(await store.pool.query('SELECT count(*) FILTER (WHERE revoked_at IS NULL)::int AS unrevoked FROM session')).rows[0];
  check(existingSessions.unrevoked===0,'RESUME_HAS_UNREVOKED_SESSION');
  report.existing_revoked_session_count=afterSeed.session;
  report.seed = { existing_seedDemo: true, metadata_only: true, policy_stroops: '0', expiry_epoch: true, observed_ledger_null: true, nonce: '0', status: 'unprovisioned', verified_public_contract_tuple: true, no_chain_registration_or_funding: true };
  stage = 'build';
  const source = await fingerprint(); report.source = { baseline_head: '0bf81ff36d7c2bb5bba22b5f127b9519535bf494', application_commit: 'b2661c0', ...source };
  const next = require.resolve('next/dist/bin/next');
  let reusable: any;
  if (resume) for (const directory of (await readdir(path.join(ROOT,'docs/evidence/finals-staging-app'))).sort().reverse()) {
    const previous = path.join(ROOT,'docs/evidence/finals-staging-app',directory,'result.json');
    if (!await exists(previous)) continue;
    const receipt=JSON.parse(await read(previous));
    if(receipt.build?.source_sha256===source.sha256 && receipt.build?.build_id_sha256===hash((await read(path.join(ROOT,'apps/web/.next/BUILD_ID'))).trim())) { reusable={...receipt.build,receipt:relative(previous)}; break; }
  }
  if(reusable) report.build={...reusable,fresh_build:false,source_and_build_receipt_match:true};
  else throw new QualificationFailure('UNCHANGED_MATCHING_BUILD_REQUIRED_NO_REBUILD');
  report.full_build_before=await verifyFullBuild();
  stage = 'production-http';
  const appEnv = minimalEnv(web);
  launch=new ProductionLaunch(next,path.join(HERE,'tls-observer.cjs'),path.join(ROOT,'apps/web'),appEnv,s=>{rawLogs+=s;});app=launch.child;
  report.app_process = { pid: app.pid, host: '127.0.0.1', port: UPSTREAM_PORT, browser_proxy_port:PORT, windows_hidden: true, minimal_environment_keys: Object.keys(appEnv).sort(), instrumentation: 'read-only TLS observation on actual pg Pool connect; normal HTTP observation proxy, no API mocks or configuration changes' };
  proxy=new ObservationProxy(UPSTREAM_PORT,scanResponse,(method,p,status,headers)=>{
    if(method==='POST'&&p==='/api/session'&&status===204)for(let n=0;n<headers.length;n+=2)if(headers[n]!.toLowerCase()==='set-cookie'){
      const token=/^aegispay_session=([A-Za-z0-9_-]{43});/.exec(headers[n+1]!);if(token){sessions.add(hash(token[1]!));privateValues.add(token[1]!);}
    }
  });
  check(await proxy.start(PORT)===ORIGIN,'PROXY_BROWSER_ORIGIN_CHANGED');
  report.startup=await launch.wait();
  check(report.startup.classification==='READY','PRODUCTION_STARTUP_'+report.startup.classification);
  const health=await fetch(ORIGIN+'/api/health',{signal:AbortSignal.timeout(20000)});await health.arrayBuffer();check(health.status===200,'PRODUCTION_HEALTH_FAILED');
  // Next 16 validates the RSC cache key against headers. Use its pinned helper,
  // just as the actual client does, rather than inventing a cache-buster value.
  const rscURL=new URL(ORIGIN+'/app');
  await require('next/dist/client/components/router-reducer/set-cache-busting-search-param').setCacheBustingSearchParam(rscURL,{RSC:'1'});
  const anonymousPaths = ['/','/login','/app',rscURL.pathname+rscURL.search];
  for (const p of anonymousPaths) {
    const page = await http(p, p.includes('_rsc') ? {headers:{RSC:'1'}} : {}, 200, p.includes('_rsc') ? 'anonymous RSC app shell' : 'anonymous ' + p);
    check(!page.body.includes(web.DEMO_AGENT_PUBLIC_KEY!) && !page.body.includes(web.DEMO_DEVICE_HASH!), 'ANONYMOUS_STAGING_STATE_LEAK');
    if (p.includes('_rsc')) check(page.response.headers.get('content-type')?.startsWith('text/x-component'), 'ACTUAL_RSC_RESPONSE_REQUIRED');
  }
  const missing = '00000000-0000-4000-8000-000000000019';
  const protectedReads = ['/api/v1/state','/api/v1/catalog',`/api/v1/receipts/${missing}`,`/api/v1/receipts/${missing}/resource`,`/api/demo/quick-signal?dependency=demo-parser&runId=${missing}`,`/api/demo/deep-trace?dependency=demo-parser&runId=${missing}`,`/api/v1/runs/${missing}`,`/api/v1/runs/${missing}/events`];
  for (const p of protectedReads) await http(p, {}, 401, 'anonymous protected route ' + p.split('?')[0]);
  await http('/api/session',{},401,'anonymous session read denied');
  await http('/api/v1/catalog',{headers:{Cookie:'aegispay_session=invalid'}},401,'invalid session catalog denied');
  await http('/api/v1/state', {headers:{Cookie:'aegispay_session=invalid'}}, 401, 'invalid session denied');
  await http('/api/session', { method:'POST', headers:{Origin:'http://qualification.invalid','Content-Type':'application/json'}, body:JSON.stringify({role:'owner',token:'invalid'}) }, 403, 'bad-origin login rejected before throttle');
  for (const role of ['owner','merchant']) {
    const login = await http('/api/session',{method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({role,token:web[role==='owner'?'DEMO_OWNER_LOGIN_TOKEN':'DEMO_MERCHANT_LOGIN_TOKEN']})},204, role+' actual HTTP login');
    const cookie = cookieFrom(login.response);
    const state = await http('/api/v1/state',{headers:{Cookie:cookie}},200,role+' database state'); verifyState(state.json(),role);
    if (role === 'owner') {
      const catalog = await http('/api/v1/catalog',{headers:{Cookie:cookie}},200,'owner catalog metadata'); check(catalog.json().offers.length===2,'CATALOG_COUNT_FAILED');
      for (const p of protectedReads.filter(p=>p.includes('receipts') || p.includes('/demo/'))) await http(p,{headers:{Cookie:cookie}},404,'owner nonexistent/unowned object denied before grant/quote');
    } else {
      await http('/api/v1/catalog',{headers:{Cookie:cookie}},403,'merchant owner-only catalog refusal');
      await http(`/api/v1/receipts/${missing}`,{headers:{Cookie:cookie}},403,'merchant owner-only receipt read refusal');
      await http(`/api/v1/runs/${missing}`,{headers:{Cookie:cookie}},403,'merchant owner-only run read refusal');
      await http(protectedReads.find(p=>p.includes('/demo/'))!,{headers:{Cookie:cookie}},403,'merchant protected report refusal');
    }
    await http('/api/session',{method:'DELETE',headers:{Cookie:cookie,Origin:'http://qualification.invalid'}},403,role+' bad-origin logout denied');
    await http('/api/v1/state',{headers:{Cookie:cookie}},200,role+' session survives refused logout');
    const logout = await http('/api/session',{method:'DELETE',headers:{Cookie:cookie,Origin:ORIGIN}},204,role+' actual HTTP logout');
    check(/Max-Age=0/.test(logout.response.headers.get('set-cookie')??''),'LOGOUT_COOKIE_NOT_CLEARED');
    await http('/api/v1/state',{headers:{Cookie:cookie}},401,role+' previous cookie revoked');
  }
  // Every emitted client asset, including source maps if present, is fetched over HTTP.
  const staticRoot = path.join(ROOT,'apps/web/.next/static'); const assets: any[] = [];
  for (const p of await files(staticRoot)) {
    const uri = '/_next/static/' + path.relative(staticRoot,p).replaceAll('\\','/');
    const response = await fetch(ORIGIN+uri,{signal:AbortSignal.timeout(20000)}); const bytes=Buffer.from(await response.arrayBuffer());
    check(response.status===200,'STATIC_ASSET_HTTP_FAILED'); scanResponse(bytes);
    assets.push({path:uri,bytes:bytes.length,sha256:hash(bytes)});
  }
  report.client_asset_inventory = assets;
  stage = 'real-browser';
  const browser = await chromium.launch({ executablePath:CHROME, headless:true });
  report.browser_response_capture={method:'normal HTTP upstream entity capture before delivery; CDP lifecycle observation only',later_get_substitution_allowed:false,contexts:[]};
  try {
    for (const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}]) for (const role of ['owner','merchant']) {
      const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height}, serviceWorkers:'block'});
      const page=await context.newPage(); let forbiddenRequests=0; let unexpectedNetwork=0; let pageErrors=0;
      const capture=await proxy.capture(context,page);
      try {
      page.on('request',request=> {
        const u=new URL(request.url());
        if(u.origin!==ORIGIN) unexpectedNetwork++;
        if((request.method()!=='GET' && u.pathname!=='/api/session') || /wallet-state|wallet-operations|payment-attempts|\/demo\/|\/runs(?:\/|$)/.test(u.pathname)) forbiddenRequests++;
      });
      page.on('pageerror',()=>{ pageErrors++; });
      await capture.drain('BEFORE_NAVIGATION');
      await page.goto(ORIGIN+'/app'); await expect(page).toHaveURL(/\/login\?expired=1$/);
      await capture.drain('AFTER_TRANSITION');
      await page.getByRole('combobox',{name:'Role',exact:true}).selectOption(role);
      await page.getByLabel('Demo access token').fill(web[role==='owner'?'DEMO_OWNER_LOGIN_TOKEN':'DEMO_MERCHANT_LOGIN_TOKEN']!);
      await capture.drain('BEFORE_NAVIGATION');
      await page.getByRole('button',{name:'Sign in',exact:true}).click();
      await expect(page).toHaveURL(ORIGIN+'/app'); await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();
      await expect(page.getByText('Authenticated database snapshot',{exact:false})).toBeVisible();
      if(role==='owner') await expect(page.getByRole('button',{name:'Start task',exact:true})).toBeDisabled();
      else await expect(page.getByRole('heading',{level:1})).toHaveText('Your terms. Your claim.');
      const cookie=(await context.cookies()).find(c=>c.name==='aegispay_session');
      check(cookie?.httpOnly && cookie.sameSite==='Strict' && !cookie.secure && cookie.path==='/', 'BROWSER_COOKIE_ATTRIBUTES_FAILED');
      sessions.add(hash(cookie.value)); privateValues.add(cookie.value);
      const inBrowser=await page.evaluate(async()=>({state:await(await fetch('/api/v1/state',{cache:'no-store'})).json(), storage:JSON.stringify({...localStorage,...sessionStorage}), html:document.documentElement.outerHTML, cookie:document.cookie}));
      verifyState(inBrowser.state,role); scanResponse(JSON.stringify(inBrowser.state)); scanResponse(inBrowser.storage); scanResponse(inBrowser.html);
      check(!inBrowser.cookie.includes('aegispay_session'),'BROWSER_COOKIE_NOT_HTTPONLY');
      await capture.drain('BEFORE_NAVIGATION');
      await page.reload(); await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();
      await expect(page.getByText('Authenticated database snapshot',{exact:false})).toBeVisible();
      check(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'BROWSER_HORIZONTAL_OVERFLOW');
      await capture.drain('BEFORE_LOGOUT');
      await page.getByRole('button',{name:'Sign out',exact:true}).click(); await expect(page).toHaveURL(ORIGIN+'/login');
      await capture.drain('AFTER_TRANSITION');
      check(!(await context.cookies()).some(c=>c.name==='aegispay_session'),'BROWSER_LOGOUT_COOKIE_RETAINED');
      // This independent security GET is outside browser request correlation;
      // it never substitutes for any captured browser body.
      await capture.detach();
      const previous=await http('/api/v1/state',{headers:{Cookie:'aegispay_session='+cookie.value}},401,`${viewport.name} ${role} previous browser cookie revoked`);
      check(previous.response.status===401 && forbiddenRequests===0 && unexpectedNetwork===0 && pageErrors===0,'BROWSER_NETWORK_OR_RUNTIME_FAILED');
      const summary=capture.summary();
      check(summary.exact_request_count_maps_match&&summary.failures===0&&summary.missing_delivered_captures===0&&summary.pending_captures===0&&summary.pending_browser_requests===0,'BROWSER_CAPTURE_INCOMPLETE');
      report.browser.push({viewport:viewport.name,role,real_login:true,real_database_state:true,reload_session_persisted:true,logout_revoked_previous_cookie:true,
        http_only_same_site_cookie:true,private_storage_clean:true,no_horizontal_overflow:true,no_forbidden_financial_requests:true,no_external_network_requests:true,page_errors:pageErrors,
        traces_screenshots_video_storage_exports:false,route_mocks:false,reverse_observation_proxy:true,native_browser_cache_qualified:false});
      }finally{
        // Diagnostics survive assertions, navigation failures and disposal.
        await capture.detach().catch(()=>{report.browser_capture_cleanup_failed=true;report.outcome='failed';});
        report.browser_response_capture.contexts.push({viewport:viewport.name,role,...capture.summary()});
        await context.close();
      }
    }
  } finally { await browser.close(); }
  check(report.browser.length===4,'BROWSER_MATRIX_INCOMPLETE');
  check(!report.browser_capture_cleanup_failed,'BROWSER_CAPTURE_CLEANUP_FAILED');
  stage='final-database';
  report.final_counts=await counts(); assertNonfinancial(report.final_counts);
  const sessionState=(await store.pool.query('SELECT count(*)::int AS count, count(*) FILTER (WHERE revoked_at IS NULL)::int AS unrevoked FROM session')).rows[0];
  check(sessionState.count===report.existing_revoked_session_count+6 && sessionState.unrevoked===0 && sessions.size===6,'TEST_SESSIONS_NOT_ALL_REVOKED');
  report.sessions={created_this_invocation:6,prior_revoked_preserved:report.existing_revoked_session_count,total:sessionState.count,revoked:sessionState.count,unrevoked:sessionState.unrevoked};
  const throttleRows=await store.pool.query('SELECT attempts FROM auth_throttle WHERE key_hash = ANY($1::text[])',[['owner','merchant'].map(role=>hash('login:untrusted-proxy:'+role))]);
  check(throttleRows.rows.length===2 && throttleRows.rows.every(r=>r.attempts<=5),'REAL_LOGIN_THROTTLE_LIMIT_EXCEEDED');
  report.throttles={role_counters:throttleRows.rows.map(r=>r.attempts).sort(),limits_unmodified:true,rows_preserved:true};
  report.model_health_label='worker_only is returned configuration copy; model availability was not observed';
  const migrationAfter=(await store.pool.query('SELECT name, sha256 FROM schema_migration ORDER BY name')).rows;
  check(JSON.stringify(migrationAfter)===JSON.stringify(report.migrations),'MIGRATION_HISTORY_CHANGED');
  const finalAgent=(await store.pool.query('SELECT status, last_nonce, policy_max_stroops, policy_observed_ledger FROM agent')).rows[0];
  check(finalAgent.status==='unprovisioned'&&finalAgent.last_nonce==='0'&&finalAgent.policy_max_stroops==='0'&&finalAgent.policy_observed_ledger===null,'AGENT_CHANGED_DURING_REHEARSAL');
  check((await fingerprint()).sha256===report.source.sha256,'APPLICATION_SOURCE_CHANGED');
  report.full_build_after=await verifyFullBuild();
  check(report.http.length>=41,'COMPLETE_HTTP_MATRIX_REQUIRED');
  report.outcome='passed';
}
async function writeEvidence(name: string, value: unknown) {
  const text=JSON.stringify(value,null,2)+'\n'; const found=inspect(text,false);
  check(Object.values(found).every(v=>v===0),'PUBLIC_EVIDENCE_HYGIENE_FAILED');
  const handle=await open(path.join(OUT,name),'wx'); try { await handle.writeFile(text); } finally { await handle.close(); }
}

try { await main(); }
catch(error) {
  report.outcome='failed'; report.failed_stage=stage;
  // Only fixed internal failures and explicit dependency enums are published.
  const code=typeof(error as any)?.code==='string'?(error as any).code:'';
  const connections=['ECONNREFUSED','ECONNRESET','ETIMEDOUT','EHOSTUNREACH','ENETUNREACH','ENOTFOUND','EAI_AGAIN','CERT_HAS_EXPIRED','ERR_TLS_CERT_ALTNAME_INVALID','UNABLE_TO_VERIFY_LEAF_SIGNATURE','DEPTH_ZERO_SELF_SIGNED_CERT','SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_GET_ISSUER_CERT_LOCALLY'];
  const sqlstates=['08000','08001','08003','08004','08006','08007','08P01','28P01','28000','3D000','42501','42P01','42703','53300','53400','57P01','57P02','57P03','57014','40001','40P01','23505','23503','23514','25006','25P02','22003','22007'];
  report.safe_failure=error instanceof QualificationFailure?error.message:connections.includes(code)?'ALLOWLISTED_CONNECTION_FAILURE':sqlstates.includes(code)?'ALLOWLISTED_DATABASE_FAILURE':(error as any)?.name==='TimeoutError'?'BROWSER_OR_OPERATION_TIMEOUT':'QUALIFICATION_ASSERTION_OR_DEPENDENCY_FAILED';
  if(connections.includes(code))report.connection_category=code;
  if(sqlstates.includes(code))report.sqlstate=code;
}
finally {
  if(launch)report.startup_pre_cleanup=launch.snapshot();
  if(proxy){
    await proxy.close().catch(()=>{report.outcome='failed';report.cleanup.proxy_close_failed=true;});
    report.observation_proxy=proxy.summary();report.cleanup.owned_proxy_closed=true;
    if(report.observation_proxy.failures||report.observation_proxy.pending||report.observation_proxy.upstream_requests!==report.observation_proxy.upstream_captured){report.outcome='failed';report.safe_capture_failure='PROXY_BODY_COVERAGE_INCOMPLETE';}
  }
  if(launch) {
    report.cleanup.production_launch=await launch.stop();report.cleanup.owned_next_pid=app?.pid;report.cleanup.owned_next_exited=report.cleanup.production_launch.owned_process_exited;
    if(!report.cleanup.owned_next_exited) { report.outcome='failed'; report.cleanup.safe_failure='OWNED_PROCESS_EXIT_NOT_CONFIRMED'; }
  }
  for(const line of rawLogs.split(/\r?\n/)) if(line.startsWith('[staging-tls]')) {
    try { const item=JSON.parse(line.slice('[staging-tls]'.length)); report.app_pool_tls.push(item); } catch { report.outcome='failed'; }
  }
  report.app_logs={bytes:Buffer.byteLength(rawLogs),sha256:hash(rawLogs),hygiene:inspect(rawLogs,false),raw_logs_saved:false};
  if(Object.values(report.app_logs.hygiene).some(v=>v!==0)) report.outcome='failed';
  if(app && (report.app_pool_tls.length===0 || report.app_pool_tls.some((v:any)=>!(v.resource_matches&&v.encrypted&&v.authorized&&v.hostname_verified&&v.wrong_hostname_rejected&&v.strict_configuration&&v.pool_max===10)))) { report.outcome='failed'; report.safe_app_tls_failure='ACTUAL_NEXT_POOL_TLS_NOT_VERIFIED'; }
  if(store) {
    try {
      if(sessions.size) await store.pool.query('UPDATE session SET revoked_at=clock_timestamp() WHERE token_hash=ANY($1::text[]) AND revoked_at IS NULL',[[...sessions]]);
      if(report.migrations) {
        report.cleanup.final_allowlisted_counts=await counts(); assertNonfinancial(report.cleanup.final_allowlisted_counts);
        report.cleanup.sessions=(await store.pool.query('SELECT count(*)::int AS total,count(*) FILTER(WHERE revoked_at IS NOT NULL)::int AS revoked,count(*) FILTER(WHERE revoked_at IS NULL)::int AS unrevoked FROM session')).rows[0];
        check(report.cleanup.sessions.unrevoked===0,'CLEANUP_HAS_UNREVOKED_SESSION');
      }
      report.cleanup.test_session_revocation_by_invocation_hash_only=true;
    } catch { report.outcome='failed'; report.cleanup.database_cleanup_failed=true; }
    await store.close().catch(()=>{report.outcome='failed';});
  }
  if(originalDBHash) { report.cleanup.original_staging_config_unchanged=hash(await readFile(DBFILE))===originalDBHash; if(!report.cleanup.original_staging_config_unchanged) report.outcome='failed'; }
  report.response_hygiene=scan;
  for(const command of [['tools/check-docs.py'],['fmd/tools/check-implementation-plan.py','docs/implementation-plan.md','--strict']]) {
    try {
      const python = spawnSync('python',['-c','import sys; print(sys.executable)'],{windowsHide:true,encoding:'utf8'});
      check(python.status===0 && path.isAbsolute(python.stdout.trim()),'PYTHON_RESOLUTION_FAILED');
      const result=await run(python.stdout.trim(),command,minimalEnv(),ROOT,60000); if(result.status!==0)report.outcome='failed';
    } catch { report.outcome='failed'; report.docs_check_failed=true; }
  }
  report.finished_at=new Date().toISOString();
  try {
    const inventory=[];
    for(const p of [...await files(HERE),...await files(OUT)]) { const bytes=await readFile(p); const hits=inspect(bytes,false); check(Object.values(hits).every(v=>v===0),'ARTIFACT_HYGIENE_FAILED'); inventory.push({path:relative(p),bytes:bytes.length,sha256:hash(bytes)}); }
    const terminal=await publishTerminal(OUT,report,inventory,text=>{check(Object.values(inspect(text,false)).every(v=>v===0),'TERMINAL_EVIDENCE_HYGIENE_FAILED');});
    process.stdout.write(JSON.stringify({outcome:report.outcome,report:relative(path.join(OUT,'result.json')),safe_failure:report.safe_failure,failed_stage:report.failed_stage,http_checks:report.http.length,browser_cases:report.browser.length,actual_app_tls_connections:report.app_pool_tls.length,finalization_sha256:terminal.finalization_sha256,expected_exit:terminal.exit_code,requires_observed_exit:true})+'\n');
  } catch { report.outcome='failed';await exclusive(path.join(OUT,'finalization-failure.json'),JSON.stringify({outcome:'failed',safe_failure:'TERMINAL_EVIDENCE_NOT_FINALIZED',expected_exit:1})+'\n').catch(()=>{}); process.stdout.write(JSON.stringify({outcome:'failed',safe_failure:'TERMINAL_EVIDENCE_NOT_FINALIZED'})+'\n'); }
  process.exitCode=report.outcome==='passed'?0:1;
}
