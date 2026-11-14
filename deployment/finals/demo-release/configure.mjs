// Configure only exact owned Free services/database, preserving strict external TLS.
import assert from 'node:assert/strict';
import { isIP } from 'node:net';
import { execFileSync } from 'node:child_process';
import { api, context, DIR, OUT, names, read, save, receipt, owned, privateEnv } from './common.mjs';
import { serialize, writePrivate } from '../local-release/context.mjs';
if (process.argv.length !== 3 || process.argv[2] !== '--configure-owned-demo') {
  console.log(JSON.stringify({ status: 'not_run', code: 'EXPLICIT_DEMO_CONFIGURATION_REQUIRED' })); process.exitCode = 2;
} else {
  let stage = 'owned-services';
  try {
    const { database, workspace } = context(), web = await owned('web'), worker = await owned('worker');
    const db = await api('/postgres/' + encodeURIComponent(database.id));
    assert.equal(db.plan, 'free'); assert.equal(db.region, 'singapore'); assert.equal(db.owner.id, workspace.ownerId);
    const network = read('.fmd-work/release-setup/database-client-network.json'); assert.equal(network.databaseId, db.id);
    const ranges = new Set();
    for (const service of [web,worker]) {
      const ips = await api('/services/' + service.id + '/outbound-ips');
      assert.equal(ips.type, 'shared'); assert(ips.ips.length > 0 && ips.ips.length <= 16);
      for (const range of ips.ips) {
        const [ip, prefix = '32'] = range.split('/'); assert.equal(isIP(ip), 4); assert(Number(prefix) >= 24 && Number(prefix) <= 32); ranges.add(range);
      }
    }
    const expected = [network.rule, ...[...ranges].filter(range => range !== network.rule.cidrBlock).map(cidrBlock => ({ cidrBlock, description: 'AegisPay Finals verified shared Singapore service egress' }))];
    stage = 'narrow-egress-rules';
    if (JSON.stringify(db.ipAllowList) !== JSON.stringify(expected)) {
      assert.deepEqual(db.ipAllowList, [network.rule]);
      save(DIR + '/network-request.json', { databaseId: db.id, previous: db.ipAllowList, proposed: expected, sharedRegionalEgress: true });
      await api('/postgres/' + db.id, 'PATCH', { ipAllowList: expected });
    }
    assert.deepEqual((await api('/postgres/' + db.id)).ipAllowList, expected);
    const dbUrl = privateEnv('.env.release.hosted-database.local').DATABASE_URL;
    assert.equal(new URL(dbUrl).searchParams.get('sslmode'), 'verify-full'); assert.equal(new URL(dbUrl).hostname.split('.')[0], db.id);
    const origin = web.serviceDetails.url, workerOrigin = worker.serviceDetails.url;
    for (const url of [origin, workerOrigin]) { const u = new URL(url); assert.equal(u.protocol, 'https:'); assert(u.hostname.endsWith('.onrender.com') && u.pathname === '/' && !u.search); }
    const commit = execFileSync('git', ['rev-parse','HEAD'], { encoding: 'utf8' }).trim(); assert(/^[a-f0-9]{40}$/.test(commit));
    const publicKeys = ['STELLAR_NETWORK','STELLAR_RPC_URL','STELLAR_NETWORK_PASSPHRASE','NOIR_DEVICE_REGISTRY_ID','NOIR_AGENT_REGISTRY_ID','NOIR_PAYMENT_ESCROW_ID','NOIR_XLM_SAC_ID',
      'DEMO_OWNER_PUBLIC_KEY','DEMO_MERCHANT_PUBLIC_KEY','DEMO_AGENT_PUBLIC_KEY','DEMO_DEVICE_HASH','DEMO_ESCROW_FUNDING_CEILING_STROOPS','AGENT_MODEL'];
    const sharedKeys = ['RECEIPT_SIGNING_KEY','WORKER_WAKE_TOKEN'];
    stage = 'isolated-service-environments';
    for (const [role,service] of [['web',web],['worker',worker]]) {
      const local = privateEnv('.env.release.' + role + '.local');
      const keys = [...publicKeys,...sharedKeys,...(role === 'web' ? ['DEMO_OWNER_LOGIN_TOKEN','DEMO_MERCHANT_LOGIN_TOKEN'] : ['AGENT_SECRET','GEMINI_API_KEY','VELO_GAS_API_KEY','VELO_GAS_BASE_URL','ENVELOPE_ENCRYPTION_KEY'])];
      const env = Object.fromEntries(keys.map(key => { assert(local[key]); return [key,local[key]]; }));
      Object.assign(env, { NODE_VERSION: '24.22.1', NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', AEGIS_RELEASE_ENABLED: '1', AEGIS_RELEASE_COMMIT: commit,
        DATABASE_URL: dbUrl, APP_ORIGIN: origin, ...(role === 'web' ? { WORKER_WAKE_URL: workerOrigin + '/wake' } : { WORKER_HOST: '0.0.0.0', RUN_TESTNET: '0' }) });
      writePrivate('.env.release.hosted-' + role + '.local', serialize(env), true);
      save(DIR + '/environment-' + role + '.json', { serviceId: service.id, values: env });
      await api('/services/' + service.id + '/env-vars', 'PUT', Object.entries(env).map(([key,value]) => ({ key,value })));
      const values = await api('/services/' + service.id + '/env-vars?limit=100');
      const observed = new Map(values.map(row => { const v = row.envVar ?? row; return [v.key,v.value]; }));
      for (const [key,value] of Object.entries(env)) assert.equal(observed.get(key), value);
    }
    save(DIR + '/configured.json', { commit, origin, workerOrigin, databaseId: db.id });
    const result = { status: 'passed', observedAt: new Date().toISOString(), sourceCommit: commit, origin, workerOrigin,
      scope: 'exact-free-demo-environment-configuration', databaseTls: 'verify-full', sharedEgressRangeCount: ranges.size,
      broadAllInternetRule: false, secretsSeparated: true, workerInitiallyRunTestnet: '0', oldResourcesChanged: false };
    receipt('configuration', result); console.log(JSON.stringify(result));
  } catch (error) { console.log(JSON.stringify({ status: 'failed-or-uncertain', stage, code: /^PROVIDER_HTTP_/.test(error?.message ?? '') ? error.message : 'DEMO_CONFIGURATION_INCOMPLETE' })); process.exitCode = 1; }
}
