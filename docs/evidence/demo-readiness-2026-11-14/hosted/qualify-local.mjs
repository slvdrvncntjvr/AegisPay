// Own empty local target only; temporary real app/worker processes, no actor seed,
// financial/provider credentials, model/chain calls, wallet or purchase requests.
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import net from 'node:net';
import { Pool } from 'pg';
const directory = 'docs/evidence/demo-readiness-2026-11-14/hosted/';
if (process.argv.length !== 3 || process.argv[2] !== '--qualify') {
  console.log(JSON.stringify({ status: 'not_run', code: 'EXPLICIT_EMPTY_LOCAL_QUALIFICATION_REQUIRED', financialActions: 0 }));
  process.exitCode = 2;
} else {
  let pool, stage = 'private-local-custody';
  const children = [], checks = [];
  try {
    const web = parseEnv(readFileSync('.env.release.web.local', 'utf8'));
    const worker = parseEnv(readFileSync('.env.release.worker.local', 'utf8'));
    const custody = parseEnv(readFileSync('.env.release.database.local', 'utf8'));
    const target = new URL(custody.DATABASE_URL);
    const local = parseEnv(readFileSync('.env.integration.local', 'utf8'));
    const integration = new URL(local.TEST_DATABASE_URL);
    if (!/^aegispay-foundation-[a-f0-9]{12}$/.test(local.AEGISPAY_POSTGRES_PROJECT ?? '') ||
      target.host !== integration.host || target.username !== integration.username || target.password !== integration.password) throw Error('OWNED_LOCAL_ENDPOINT_REQUIRED');
    const docker = args => {
      const result = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true });
      if (result.status !== 0) throw Error('OWNED_DOCKER_UNAVAILABLE');
      return result.stdout.trim();
    };
    const containerIds = docker(['ps', '-q', '--filter', `label=com.docker.compose.project=${local.AEGISPAY_POSTGRES_PROJECT}`]).split(/\r?\n/).filter(Boolean);
    if (containerIds.length !== 1) throw Error('EXACT_OWNED_CONTAINER_REQUIRED');
    const [container] = JSON.parse(docker(['inspect', containerIds[0]]));
    const bindings = container.NetworkSettings.Ports['5432/tcp'];
    const endpointMapped = resolve(container.Config.Labels['com.docker.compose.project.working_dir']) === resolve('deployment') &&
      bindings?.length === 1 && bindings[0].HostIp === '127.0.0.1' && target.hostname === '127.0.0.1' && Number(bindings[0].HostPort) === Number(target.port || 5432);
    if (!endpointMapped) throw Error('OWNED_LOCAL_ENDPOINT_REQUIRED');
    if (target.pathname !== '/aegispay_release_20261114' || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) ||
      web.DATABASE_URL !== custody.DATABASE_URL || worker.DATABASE_URL !== custody.DATABASE_URL ||
      web.APP_ORIGIN !== 'http://127.0.0.1:3019' || worker.APP_ORIGIN !== web.APP_ORIGIN || worker.PORT !== '3020' || worker.WORKER_HOST !== '127.0.0.1' || worker.RUN_TESTNET !== '0') throw Error('EXACT_LOCAL_CUSTODY_REQUIRED');
    if ([web, worker].some(config => ['AGENT_SECRET', 'VELO_GAS_API_KEY', 'GEMINI_API_KEY', 'SPIKE_OWNER_SECRET', 'SPIKE_MERCHANT_SECRET', 'DEMO_OWNER_PUBLIC_KEY', 'DEMO_MERCHANT_PUBLIC_KEY'].some(name => config[name])) ||
      ['ENVELOPE_ENCRYPTION_KEY'].some(name => web[name]) || ['DEMO_OWNER_LOGIN_TOKEN', 'DEMO_MERCHANT_LOGIN_TOKEN'].some(name => worker[name]) ||
      web.WORKER_WAKE_TOKEN !== worker.WORKER_WAKE_TOKEN || worker.WORKER_WAKE_TOKEN.length < 32) throw Error('PRIVATE_ENVIRONMENT_SEPARATION_REQUIRED');
    if (readdirSync('apps/web').some(name => /^\.env(?:\.|$)/.test(name)) || !existsSync('apps/web/.next/BUILD_ID')) throw Error('NO_WEB_DOTENV_AND_PRODUCTION_BUILD_REQUIRED');
    pool = new Pool({ connectionString: target.href, max: 1, connectionTimeoutMillis: 5000 });
    const owned = (await pool.query("SELECT shobj_description(oid,'pg_database') AS comment FROM pg_database WHERE datname=current_database()")).rows[0]?.comment;
    if (owned !== 'aegispay-release-owned:' + custody.AEGIS_RELEASE_DB_OWNERSHIP) throw Error('LOCAL_DATABASE_OWNERSHIP_REQUIRED');
    const expected = JSON.parse(readFileSync(directory + 'local-preparation.json', 'utf8'));
    const migrations = (await pool.query('SELECT name,sha256 FROM schema_migration ORDER BY name')).rows;
    if (JSON.stringify(migrations) !== JSON.stringify(expected.migrations)) throw Error('MIGRATION_CHECKSUM_CHANGED');
    async function emptyCounts() {
      const counts = {};
      for (const table of Object.keys(expected.counts)) {
        if (!/^[a-z_]+$/.test(table)) throw Error('FIXED_TABLE_REQUIRED');
        counts[table] = Number((await pool.query(`SELECT count(*)::text AS n FROM "${table}"`)).rows[0].n);
      }
      if (Object.values(counts).some(count => count !== 0)) throw Error('EMPTY_LOCAL_DATABASE_REQUIRED');
      return counts;
    }
    await emptyCounts();
    for (const port of [3019, 3020]) await new Promise((resolve, reject) => {
      const server = net.createServer(); server.once('error', reject);
      server.listen(port, '127.0.0.1', () => server.close(error => error ? reject(error) : resolve()));
    });
    const os = {};
    for (const name of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TMPDIR', 'TMP', 'TEMP']) if (process.env[name]) os[name] = process.env[name];
    const start = (args, env, cwd) => {
      const child = spawn(process.execPath, args, { env: { ...os, ...env }, cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.on('data', () => {}); child.stderr.on('data', () => {});
      child.on('error', () => {}); children.push(child); return child;
    };
    stage = 'real-empty-local-process-start';
    start([createRequire(import.meta.url).resolve('next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '3019'], web, 'apps/web');
    start(['--import', 'tsx', 'apps/server/src/index.ts'], worker, process.cwd());
    for (const url of ['http://127.0.0.1:3019/api/health', 'http://127.0.0.1:3020/health']) {
      let ready = false;
      for (let attempt = 0; attempt < 40; attempt++) {
        try { const response = await fetch(url, { signal: AbortSignal.timeout(1000) }); ready = response.status === 200; await response.body?.cancel(); if (ready) break; } catch { /* Local startup polling only, no external operation. */ }
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      if (!ready) throw Error('LOCAL_STARTUP_INCOMPLETE');
    }
    async function check(name, url, expectedStatus, init = {}) {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(5000), redirect: 'error' });
      await response.body?.cancel();
      checks.push({ name, expectedStatus, observedStatus: response.status, passed: response.status === expectedStatus });
      if (response.status !== expectedStatus) throw Error('LOCAL_HTTP_GATE_FAILED');
    }
    stage = 'real-empty-local-http';
    for (const path of ['/api/health', '/login', '/app']) await check('web:' + path, web.APP_ORIGIN + path, 200);
    for (const path of ['/api/v1/state', '/api/v1/catalog', '/api/v1/runs']) await check('anonymous:' + path, web.APP_ORIGIN + path, 401);
    const origin = 'http://127.0.0.1:3020';
    await check('worker-health', origin + '/health', 200);
    await check('worker-root-closed', origin + '/', 404);
    await check('worker-wake-get-closed', origin + '/wake', 404);
    await check('worker-no-auth', origin + '/wake', 401, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    await check('worker-invalid-auth', origin + '/wake', 401, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer INVALID_NON_CREDENTIAL' }, body: '{}' });
    const headers = { 'content-type': 'application/json', authorization: 'Bearer ' + worker.WORKER_WAKE_TOKEN };
    await check('worker-browser-origin', origin + '/wake', 403, { method: 'POST', headers: { ...headers, origin: web.APP_ORIGIN }, body: '{}' });
    await check('worker-extra-field', origin + '/wake', 400, { method: 'POST', headers, body: '{"unexpected":true}' });
    await check('worker-oversize', origin + '/wake', 413, { method: 'POST', headers, body: ' '.repeat(2048) });
    await check('worker-malformed-json', origin + '/wake', 400, { method: 'POST', headers, body: '{' });
    await check('worker-unsupported-content', origin + '/wake', 400, { method: 'POST', headers: { authorization: headers.authorization, 'content-type': 'text/plain' }, body: '{}' });
    await check('worker-empty-authenticated-wake', origin + '/wake', 202, { method: 'POST', headers, body: '{}' });
    stage = 'post-wake-local-readback';
    // The real worker may only find an empty queue. No actor, run or financial
    // job is inserted by this gate; valid wake simply exercises its real ingress.
    await new Promise(resolve => setTimeout(resolve, 300));
    const counts = await emptyCounts();
    const report = { status: 'passed', scope: 'real-empty-loopback-app-worker-startup-and-ingress-only', observedAt: new Date().toISOString(),
      databaseName: 'aegispay_release_20261114', ownershipVerified: true, ownedContainerPortBindingMatched: endpointMapped, migrationChecksumsUnchanged: true, checks, counts,
      privateEnvironmentSeparation: true, signerAndProviderCredentialsPresent: false, actorsSeeded: false, financialActions: 0,
      fullRelease: false, limit: 'No authenticated owner/merchant or chain/model/payment/wallet lifecycle acceptance; processes stopped after qualification.' };
    writeFileSync(directory + 'local-qualification.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
  } catch {
    const report = { status: 'failed', code: 'LOCAL_QUALIFICATION_INCOMPLETE', stage, checks, financialActions: 0 };
    writeFileSync(directory + 'local-qualification-failure.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report)); process.exitCode = 1;
  } finally {
    for (const child of children) if (child.exitCode === null && child.signalCode === null) {
      await new Promise(resolve => {
        const timeout = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 5000);
        child.once('exit', () => { clearTimeout(timeout); resolve(); }); child.kill('SIGTERM');
      });
    }
    await pool?.end();
  }
}
