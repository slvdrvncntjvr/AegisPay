// Explicit reversible LOCAL preparation only. No actors/catalog seed, financial
// SDK, provider, chain, original worker/preview configuration or signed material.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { Pool } from 'pg';
import { createStore } from '../../../../src/server/db/connection.ts';
import { migrate } from '../../../../src/server/db/migrate.ts';

const directory = 'docs/evidence/demo-readiness-2026-11-14/hosted/';
const files = ['.env.release.database.local', '.env.release.web.local', '.env.release.worker.local'];
if (process.argv.length !== 3 || !['--prepare', '--resume'].includes(process.argv[2])) {
  console.log(JSON.stringify({ status: 'not_run', code: 'EXPLICIT_LOCAL_PREPARATION_REQUIRED', financialActions: 0 }));
  process.exitCode = 2;
} else {
  let admin, store, stage = 'local-custody';
  try {
    const local = parseEnv(readFileSync('.env.integration.local', 'utf8'));
    const target = new URL(local.TEST_DATABASE_URL);
    const project = local.AEGISPAY_POSTGRES_PROJECT;
    if (target.pathname !== '/aegispay_integration' || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) ||
      !/^aegispay-foundation-[a-f0-9]{12}$/.test(project ?? '')) throw Error('OWNED_LOOPBACK_REQUIRED');
    stage = 'container-ownership';
    const docker = args => {
      const result = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true });
      if (result.status !== 0) throw Error('OWNED_DOCKER_UNAVAILABLE');
      return result.stdout.trim();
    };
    const ids = docker(['ps', '-q', '--filter', `label=com.docker.compose.project=${project}`]).split(/\r?\n/).filter(Boolean);
    if (ids.length !== 1) throw Error('EXACT_OWNED_CONTAINER_REQUIRED');
    const [container] = JSON.parse(docker(['inspect', ids[0]]));
    if (resolve(container.Config.Labels['com.docker.compose.project.working_dir']) !== resolve('deployment')) throw Error('DOCKER_OWNERSHIP_MISMATCH');
    const bindings = container.NetworkSettings.Ports['5432/tcp'];
    const endpointMapped = bindings?.length === 1 && bindings[0].HostIp === '127.0.0.1' && target.hostname === '127.0.0.1' && Number(bindings[0].HostPort) === Number(target.port || 5432);
    if (!endpointMapped) throw Error('OWNED_LOCAL_ENDPOINT_REQUIRED');
    const proposal = JSON.parse(readFileSync(directory + 'context-proposal.json', 'utf8'));
    if (proposal.databaseCreated || proposal.targetDatabaseName !== 'aegispay_release_20261114' || proposal.agentId !== null) throw Error('PROPOSAL_ALREADY_PREPARED_OR_CHANGED');
    stage = 'local-database-prerequisites';
    admin = new Pool({ connectionString: target.href, max: 1, connectionTimeoutMillis: 5000 });
    const version = (await admin.query('SHOW server_version')).rows[0].server_version;
    if (!version.startsWith('17.')) throw Error('POSTGRES17_REQUIRED');
    const found = await admin.query("SELECT 1 FROM pg_database WHERE datname='aegispay_release_20261114'");
    const resume = process.argv[2] === '--resume';
    let ownership;
    target.pathname = '/aegispay_release_20261114';
    const serialize = values => '# Isolated LOCAL release preparation; never copy to preview.\n' + Object.entries(values).map(([key, value]) => key + '=' + JSON.stringify(value)).join('\n') + '\n';
    if (resume) {
      if (!found.rowCount || !files.every(file => existsSync(file))) throw Error('EXISTING_TARGET_REQUIRES_IDENTITY_REVIEW_NO_OVERWRITE');
      const custody = parseEnv(readFileSync(files[0], 'utf8'));
      ownership = custody.AEGIS_RELEASE_DB_OWNERSHIP;
      if (custody.DATABASE_URL !== target.href || !/^[a-f0-9-]{36}$/.test(ownership ?? '') ||
        (await admin.query("SELECT shobj_description(oid,'pg_database') AS comment FROM pg_database WHERE datname='aegispay_release_20261114'")).rows[0].comment !== 'aegispay-release-owned:' + ownership) throw Error('EXISTING_TARGET_REQUIRES_IDENTITY_REVIEW_NO_OVERWRITE');
    } else {
      if (found.rowCount || files.some(file => existsSync(file))) throw Error('EXISTING_TARGET_REQUIRES_IDENTITY_REVIEW_NO_OVERWRITE');
      ownership = randomUUID();
      stage = 'new-local-database';
      await admin.query('CREATE DATABASE aegispay_release_20261114');
      // The only interpolation is a locally generated UUID, never user input.
      await admin.query(`COMMENT ON DATABASE aegispay_release_20261114 IS 'aegispay-release-owned:${ownership}'`);
      writeFileSync(files[0], serialize({ DATABASE_URL: target.href, AEGIS_RELEASE_DB_OWNERSHIP: ownership }), { flag: 'wx', mode: 0o600 });
    }
    stage = 'new-local-migrations';
    store = createStore(target.href);
    await migrate(store);
    const counts = {};
    for (const table of ['owner', 'merchant', 'agent', 'resource', 'agent_run', 'quote', 'payment_attempt', 'payment_evidence', 'entitlement', 'wallet_operation', 'merchant_claim', 'job', 'session', 'run_event', 'audit_event', 'auth_throttle']) {
      counts[table] = Number((await store.pool.query(`SELECT count(*)::text AS n FROM "${table}"`)).rows[0].n);
    }
    if (Object.values(counts).some(value => value !== 0)) throw Error('EMPTY_LOCAL_TARGET_REQUIRED');
    const migrations = (await store.pool.query('SELECT name,sha256 FROM schema_migration ORDER BY name')).rows;
    if (migrations.length !== 5 || !migrations.some(row => row.name === '0004_nonfinancial_run_budget.sql')) throw Error('EXACT_MIGRATIONS_REQUIRED');
    stage = 'new-private-config';
    const receipt = randomBytes(48).toString('base64url'), wake = randomBytes(48).toString('base64url');
    const common = { NODE_ENV: 'production', APP_ORIGIN: proposal.targetAppOrigin, DATABASE_URL: target.href,
      STELLAR_NETWORK: 'testnet', STELLAR_RPC_URL: 'https://soroban-testnet.stellar.org', STELLAR_NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
      NOIR_DEVICE_REGISTRY_ID: proposal.contracts.deviceRegistry, NOIR_AGENT_REGISTRY_ID: proposal.contracts.agentRegistry,
      NOIR_PAYMENT_ESCROW_ID: proposal.contracts.paymentEscrow, NOIR_XLM_SAC_ID: proposal.asset,
      DEMO_AGENT_PUBLIC_KEY: proposal.agentPublicKey, DEMO_DEVICE_HASH: proposal.deviceHash,
      RECEIPT_SIGNING_KEY: receipt, WORKER_WAKE_TOKEN: wake, AGENT_MODEL: 'models/gemini-3.5-flash' };
    const web = resume ? parseEnv(readFileSync(files[1], 'utf8')) : { ...common, NEXT_TELEMETRY_DISABLED: '1', WORKER_WAKE_URL: 'http://127.0.0.1:3020/wake',
      DEMO_OWNER_LOGIN_TOKEN: randomBytes(48).toString('base64url'), DEMO_MERCHANT_LOGIN_TOKEN: randomBytes(48).toString('base64url') };
    const worker = resume ? parseEnv(readFileSync(files[2], 'utf8')) : { ...common, WORKER_HOST: '127.0.0.1', PORT: '3020', RUN_TESTNET: '0', ENVELOPE_ENCRYPTION_KEY: randomBytes(32).toString('base64') };
    if ([web, worker].some(config => config.DATABASE_URL !== target.href || config.APP_ORIGIN !== proposal.targetAppOrigin ||
      ['DEMO_OWNER_PUBLIC_KEY', 'DEMO_MERCHANT_PUBLIC_KEY', 'AGENT_SECRET', 'VELO_GAS_API_KEY', 'GEMINI_API_KEY'].some(name => config[name]))) throw Error('EMPTY_LOCAL_TARGET_REQUIRED');
    if (!resume) {
      writeFileSync(files[1], serialize(web), { flag: 'wx', mode: 0o600 });
      writeFileSync(files[2], serialize(worker), { flag: 'wx', mode: 0o600 });
    }
    stage = 'private-acl';
    let restrictedAcl = process.platform !== 'win32';
    if (process.platform === 'win32') {
      const command = "$releaseSid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User; foreach($releasePath in @('.env.release.database.local','.env.release.web.local','.env.release.worker.local')) { $releaseAcl=New-Object System.Security.AccessControl.FileSecurity; $releaseAcl.SetOwner($releaseSid); $releaseAcl.SetAccessRuleProtection($true,$false); $releaseAcl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($releaseSid,'FullControl','Allow'))); Set-Acl -LiteralPath $releasePath -AclObject $releaseAcl -ErrorAction Stop }";
      // A PowerShell7 terminal's inherited module path breaks Windows
      // PowerShell's Security module autoload. Let that child use its own default.
      const aclEnvironment = { ...process.env }; delete aclEnvironment.PSModulePath;
      const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { env: aclEnvironment, windowsHide: true, stdio: 'ignore' });
      restrictedAcl = result.status === 0;
      if (!restrictedAcl) throw Error('PRIVATE_ACL_REQUIRED');
    }
    proposal.databaseCreated = true;
    proposal.databaseSeeded = false;
    proposal.localSchemaPrepared = true;
    writeFileSync(directory + 'context-proposal.json', JSON.stringify(proposal, null, 2) + '\n');
    const report = { status: 'passed', scope: 'new-owned-loopback-schema-and-private-config-only', observedAt: new Date().toISOString(),
      databaseName: proposal.targetDatabaseName, version, ownershipCommentVerified: (await admin.query("SELECT shobj_description(oid,'pg_database') AS comment FROM pg_database WHERE datname='aegispay_release_20261114'")).rows[0].comment === 'aegispay-release-owned:' + ownership,
      loopback: true, ownedContainerPortBindingMatched: endpointMapped, tlsRequiredForHostedOnly: true, migrations, counts, financialActions: 0, actorsSeeded: false,
      privateConfigFiles: files, privateConfigValuesExported: false, userOnlyAcl: restrictedAcl,
      webEnvironmentNames: Object.keys(web).sort(), workerEnvironmentNames: Object.keys(worker).sort(),
      absentFinancialProviderNames: ['AGENT_SECRET', 'VELO_GAS_API_KEY', 'GEMINI_API_KEY'], missing: ['CONFIRMED_OWNER_MERCHANT_PUBLIC_ADDRESSES', 'HUMAN_WALLET_SETUP_CONSENT', 'FRESH_PURCHASE_INTENT_BEFORE_SPENDING', 'INDEPENDENT_HOSTED_DATABASE_TARGET'] };
    writeFileSync(directory + 'local-preparation.json', JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  } catch (error) {
    const localCodes = new Set(['OWNED_LOOPBACK_REQUIRED', 'OWNED_DOCKER_UNAVAILABLE', 'EXACT_OWNED_CONTAINER_REQUIRED', 'DOCKER_OWNERSHIP_MISMATCH', 'OWNED_LOCAL_ENDPOINT_REQUIRED', 'PROPOSAL_ALREADY_PREPARED_OR_CHANGED', 'POSTGRES17_REQUIRED', 'EXISTING_TARGET_REQUIRES_IDENTITY_REVIEW_NO_OVERWRITE', 'EMPTY_LOCAL_TARGET_REQUIRED', 'EXACT_MIGRATIONS_REQUIRED', 'PRIVATE_ACL_REQUIRED']);
    const detail = localCodes.has(error?.message) ? error.message : 'LOCAL_PREPARATION_DEPENDENCY_FAILURE';
    console.log(JSON.stringify({ status: 'failed', code: 'LOCAL_PREPARATION_INCOMPLETE_DO_NOT_RECREATE_OR_ADOPT_TARGET', stage, detail, financialActions: 0 }));
    process.exitCode = 1;
  } finally { await store?.close(); await admin?.end(); }
}
