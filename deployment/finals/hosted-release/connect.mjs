// Exact NEW Free database only: one coordinator IPv4/32 rule, private connection
// custody, and a read-only strict-TLS probe. Never logs DSN/password/IP values.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { isIP } from 'node:net';
import { spawnSync } from 'node:child_process';
import { jsonGET, cleanNetworkEnvironment, sha } from '../preview/common.mjs';
import { writePrivate, isolatedEnvironment } from '../local-release/context.mjs';
const dir = '.fmd-work/release-setup/';
const out = 'docs/evidence/hosted-release-2026-11-14/database-tls.json';
if (process.argv.length !== 3 || process.argv[2] !== '--connect-exact-new-database') {
  console.log(JSON.stringify({ status: 'not_run', code: 'EXPLICIT_NEW_DATABASE_TLS_CHECK_REQUIRED' })); process.exitCode = 2;
} else {
  const report = { observedAt: new Date().toISOString(), scope: 'exact-independent-new-free-database-tls', networkPatches: 0, connectionInformationRead: false, privateValuesPrinted: false };
  try {
    cleanNetworkEnvironment();
    const workspace = JSON.parse(readFileSync(dir + 'hosted-workspace.json', 'utf8'));
    const database = JSON.parse(readFileSync(dir + 'hosted-database.json', 'utf8'));
    if (sha(workspace.ownerId) !== '7511972d690f6a542e309a172b838073226f635dbc5c0cdf125d382f990d19eb' ||
      sha(database.id) !== '78ef7162df9c523cab7d0fb7316b9e7a700271b83d0e4ec72d1ac8bd81bd6e7f' || database.ownerId !== workspace.ownerId) throw Error('EXACT_NEW_DATABASE_REQUIRED');
    const key = parseEnv(readFileSync('.env.deploy.local', 'utf8').split(/\r?\n/).filter(line => /^\s*(?:export\s+)?RENDER_API_KEY\s*=/.test(line)).join('\n')).RENDER_API_KEY;
    if (!key) throw Error('PROVIDER_ACCESS_REQUIRED');
    const auth = { Authorization: 'Bearer ' + key };
    const get = path => jsonGET('https://api.render.com/v1' + path, auth);
    const metadata = await get('/postgres/' + encodeURIComponent(database.id));
    if (metadata.id !== database.id || metadata.owner?.id !== workspace.ownerId || metadata.name !== 'aegispay-finals-release' || metadata.plan !== 'free' || metadata.region !== 'singapore' || metadata.version !== '17' || metadata.status !== 'available') throw Error('FREE_DATABASE_READBACK_MISMATCH');
    async function ip(origin) {
      const response = await fetch(origin, { redirect: 'error', signal: AbortSignal.timeout(10000) });
      if (!response.ok) { await response.body?.cancel(); throw Error('CLIENT_IP_OBSERVATION_FAILED'); }
      let value = '';
      for await (const chunk of response.body) { value += Buffer.from(chunk).toString(); if (value.length > 64) throw Error('BOUNDED_CLIENT_IP_REQUIRED'); }
      if (isIP(value.trim()) !== 4) throw Error('EXACT_CLIENT_IPV4_REQUIRED');
      return value.trim();
    }
    const [first, second] = await Promise.all([ip('https://api.ipify.org'), ip('https://checkip.amazonaws.com')]);
    if (first !== second) throw Error('INDEPENDENT_CLIENT_IPV4_MISMATCH');
    const rule = { cidrBlock: first + '/32', description: 'AegisPay Finals exact coordinator TLS/migration access' };
    if (existsSync(dir + 'database-client-network.json')) {
      const saved = JSON.parse(readFileSync(dir + 'database-client-network.json', 'utf8'));
      if (saved.databaseId !== database.id || JSON.stringify(saved.rule) !== JSON.stringify(rule) || JSON.stringify(metadata.ipAllowList) !== JSON.stringify([rule])) throw Error('SAVED_NETWORK_CHANGE_REQUIRES_OBSERVATION');
    } else {
      if (metadata.ipAllowList?.length !== 0) throw Error('EXACT_EMPTY_NEW_DATABASE_RULES_REQUIRED');
      writePrivate(dir + 'database-client-network.json', JSON.stringify({ databaseId: database.id, rule, recordedAt: new Date().toISOString(), patchMayOccur: true }) + '\n', true);
      report.networkPatches = 1;
      const response = await fetch('https://api.render.com/v1/postgres/' + encodeURIComponent(database.id), { method: 'PATCH', redirect: 'error', signal: AbortSignal.timeout(20000),
        headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ ipAllowList: [rule] }) });
      report.networkHttpStatus = response.status; await response.body?.cancel();
      if (!response.ok) throw Error('NETWORK_CHANGE_NOT_CONFIRMED_OBSERVE_ONLY');
      const changed = await get('/postgres/' + encodeURIComponent(database.id));
      if (changed.id !== database.id || changed.plan !== 'free' || JSON.stringify(changed.ipAllowList) !== JSON.stringify([rule])) throw Error('NETWORK_READBACK_MISMATCH');
    }
    const credentials = await get('/postgres/' + encodeURIComponent(database.id) + '/connection-info');
    report.connectionInformationRead = true;
    const target = new URL(credentials.externalConnectionString);
    if (!['postgres:', 'postgresql:'].includes(target.protocol) || target.hostname.split('.')[0] !== database.id || !target.hostname.endsWith('.singapore-postgres.render.com') ||
      decodeURIComponent(target.pathname.slice(1)) !== metadata.databaseName || decodeURIComponent(target.username) !== metadata.databaseUser || !target.password) throw Error('EXACT_EXTERNAL_TLS_TARGET_REQUIRED');
    target.searchParams.set('sslmode', 'verify-full');
    const privateFile = '.env.release.hosted-database.local';
    if (!existsSync(privateFile)) writePrivate(privateFile, 'DATABASE_URL=' + JSON.stringify(target.href) + '\n', true);
    else if (parseEnv(readFileSync(privateFile, 'utf8')).DATABASE_URL !== target.href) throw Error('HOSTED_PRIVATE_CUSTODY_MISMATCH');
    const check = spawnSync(process.execPath, ['deployment/finals/staging-db/verify-connectivity.mjs'], { encoding: 'utf8', windowsHide: true, timeout: 25000,
      env: isolatedEnvironment({ AEGIS_STAGING_EXTERNAL_URL: target.href, AEGIS_STAGING_EXPECTED_ID: database.id,
        AEGIS_STAGING_EXPECTED_DATABASE: metadata.databaseName, AEGIS_STAGING_EXPECTED_USER: metadata.databaseUser }) });
    const probe = JSON.parse(check.stdout);
    if (check.status !== 0 || probe.outcome !== 'passed' || !probe.tls_authorized || probe.select_one !== 1) throw Error('STRICT_TLS_PROBE_FAILED');
    Object.assign(report, { status: 'passed', clientRulePrefix: 32, clientRuleCount: 1, broadAccess: false, strictCertificateAndHostnameValidation: true,
      tlsProtocol: probe.tls_protocol, postgresVersion: probe.server_version, readOnlySqlStatements: probe.sql_statements, migrationsRun: false,
      oldResourcesChanged: false, limit: 'Independent new database prerequisite only; no hosted application or payment acceptance.' });
  } catch (error) { Object.assign(report, { status: 'not_completed_or_uncertain', code: /^[A-Z_0-9]+$/.test(error?.message ?? '') ? error.message : 'NEW_DATABASE_CONNECTION_INCOMPLETE' }); process.exitCode = 1; }
  writeFileSync(out, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify(report));
}
