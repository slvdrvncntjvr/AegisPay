// One exact Free database in the confirmed NEW workspace. No service, billing,
// environment, SQL, connection-info, deletion or old-resource mutation.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { jsonGET, cleanNetworkEnvironment, sha } from '../preview/common.mjs';
import { writePrivate } from '../local-release/context.mjs';
const custody = '.fmd-work/release-setup/';
const out = 'docs/evidence/hosted-release-2026-11-14/';
const expectedWorkspaceHash = '7511972d690f6a542e309a172b838073226f635dbc5c0cdf125d382f990d19eb';
const operation = process.argv[2];
if (process.argv.length !== 3 || !['--create-reviewed-free', '--observe', '--recover-create-receipt'].includes(operation)) {
  console.log(JSON.stringify({ status: 'not_run', code: 'EXPLICIT_EXACT_FREE_DATABASE_OPERATION_REQUIRED' })); process.exitCode = 2;
} else {
  const report = { observedAt: new Date().toISOString(), scope: 'independent-free-postgres-only', providerCreateRequests: 0, connectionInformationRead: false, sqlStatements: 0 };
  try {
    cleanNetworkEnvironment();
    const workspace = JSON.parse(readFileSync(custody + 'hosted-workspace.json', 'utf8'));
    if (workspace.name !== 'AegisPay Finals' || sha(workspace.ownerId) !== expectedWorkspaceHash) throw Error('EXACT_CONFIRMED_WORKSPACE_REQUIRED');
    const key = parseEnv(readFileSync('.env.deploy.local', 'utf8').split(/\r?\n/).filter(line => /^\s*(?:export\s+)?RENDER_API_KEY\s*=/.test(line)).join('\n')).RENDER_API_KEY;
    if (!key) throw Error('PROVIDER_ACCESS_REQUIRED');
    const auth = { Authorization: 'Bearer ' + key };
    const get = path => jsonGET('https://api.render.com/v1' + path, auth);
    const owner = await get('/owners/' + encodeURIComponent(workspace.ownerId));
    if (owner.id !== workspace.ownerId || owner.name !== workspace.name) throw Error('WORKSPACE_READBACK_MISMATCH');
    let database;
    if (operation === '--create-reviewed-free') {
      const template = JSON.parse(readFileSync('deployment/finals/hosted-release/database-request.json', 'utf8'));
      const expected = { name: 'aegispay-finals-release', plan: 'free', region: 'singapore', version: '17', enableHighAvailability: false, enableDiskAutoscaling: false, connectionPool: 'none', ipAllowList: [], readReplicas: [] };
      if (JSON.stringify(template) !== JSON.stringify(expected)) throw Error('REVIEWED_FREE_REQUEST_CHANGED');
      const schema = JSON.parse(readFileSync('.fmd-work/render-release-schema.json', 'utf8'));
      if (!schema.components.schemas.postgresPOSTInput.properties.plan.enum.includes('free') || !schema.components.schemas.postgresVersion.enum.includes('17')) throw Error('OFFICIAL_SCHEMA_MISMATCH');
      const rows = await get('/postgres?ownerId=' + encodeURIComponent(workspace.ownerId) + '&limit=100');
      if (!Array.isArray(rows) || rows.length !== 0) throw Error('NEW_EMPTY_WORKSPACE_DATABASE_SLOT_REQUIRED');
      if (existsSync(custody + 'database-create-attempt.json') || existsSync(custody + 'hosted-database.json')) throw Error('SAVED_CREATE_MUST_BE_OBSERVED_NOT_REPEATED');
      const payload = JSON.stringify({ ...template, ownerId: workspace.ownerId });
      writePrivate(custody + 'database-create-attempt.json', JSON.stringify({ workspaceId: workspace.ownerId, requestSha256: sha(payload), recordedAt: new Date().toISOString(), createMayOccur: true }) + '\n', true);
      report.providerCreateRequests = 1;
      const response = await fetch('https://api.render.com/v1/postgres', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(25000),
        headers: { ...auth, 'content-type': 'application/json', Accept: 'application/json' }, body: payload });
      report.createHttpStatus = response.status;
      if (response.status !== 201) { await response.body?.cancel(); throw Error(response.status === 402 ? 'FREE_CREATION_REQUIRES_EXTERNAL_BILLING_STEP' : 'CREATE_NOT_CONFIRMED_OBSERVE_ONLY'); }
      let size = 0; const chunks = [];
      for await (const chunk of response.body) { size += chunk.length; if (size > 1024 * 1024) throw Error('BOUNDED_CREATE_RESPONSE_REQUIRED'); chunks.push(Buffer.from(chunk)); }
      database = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      // Save exact returned identity privately before any further provider call.
      writePrivate(custody + 'database-create-response.json', JSON.stringify(database) + '\n', true);
    } else if (operation === '--recover-create-receipt') {
      const attempt = JSON.parse(readFileSync(custody + 'database-create-attempt.json', 'utf8'));
      const receipt = JSON.parse(readFileSync(custody + 'database-create-response.json', 'utf8'));
      if (attempt.workspaceId !== workspace.ownerId || !/^dpg-[a-z0-9-]+$/i.test(receipt.id ?? '') || receipt.owner?.id !== workspace.ownerId || receipt.name !== 'aegispay-finals-release') throw Error('EXACT_SAVED_CREATE_RECEIPT_REQUIRED');
      database = await get('/postgres/' + encodeURIComponent(receipt.id));
      if (database.id !== receipt.id) throw Error('SAVED_IDENTITY_READBACK_MISMATCH');
      report.recovery = 'original-201-receipt-identity-only-no-new-create';
    } else {
      const saved = JSON.parse(readFileSync(custody + 'hosted-database.json', 'utf8'));
      if (saved.ownerId !== workspace.ownerId || saved.name !== 'aegispay-finals-release') throw Error('EXACT_SAVED_DATABASE_REQUIRED');
      database = await get('/postgres/' + encodeURIComponent(saved.id));
    }
    let expectedRules = [];
    if (operation === '--observe' && existsSync(custody + 'database-client-network.json')) {
      const network = JSON.parse(readFileSync(custody + 'database-client-network.json', 'utf8'));
      if (network.databaseId !== database.id || !/^\d{1,3}(?:\.\d{1,3}){3}\/32$/.test(network.rule?.cidrBlock ?? '')) throw Error('SAVED_NARROW_NETWORK_RULE_REQUIRED');
      expectedRules = [network.rule];
    }
    if (!/^dpg-[a-z0-9-]+$/i.test(database.id ?? '') || database.owner?.id !== workspace.ownerId || database.name !== 'aegispay-finals-release' ||
      database.plan !== 'free' || database.region !== 'singapore' || String(database.version) !== '17' || database.highAvailabilityEnabled || database.diskAutoscalingEnabled ||
      JSON.stringify(database.ipAllowList) !== JSON.stringify(expectedRules) || database.readReplicas?.length !== 0) throw Error('CREATED_DATABASE_READBACK_MISMATCH');
    if (operation !== '--observe') writePrivate(custody + 'hosted-database.json', JSON.stringify({ id: database.id, ownerId: workspace.ownerId, name: database.name, selectedAt: new Date().toISOString() }) + '\n', true);
    Object.assign(report, { status: 'passed', workspace: workspace.name, databaseName: database.name, databaseSha256: sha(database.id), databaseStatus: database.status,
      plan: database.plan, region: database.region, version: database.version, expiresAt: database.expiresAt ?? null, externalAccessRules: expectedRules.length, previewAndOriginalResourcesChanged: false,
      limit: 'Database identity only; no TLS connection/migration/app/worker/payment release acceptance.' });
  } catch (error) {
    Object.assign(report, { status: 'not_completed_or_uncertain', code: /^[A-Z_0-9]+$/.test(error?.message ?? '') ? error.message : 'DATABASE_OPERATION_INCOMPLETE_OBSERVE_SAVED_IDENTITY' });
    process.exitCode = 1;
  }
  const path = out + (operation === '--observe' ? 'database-observation-' : 'database-create-') + Date.now() + '.json';
  writeFileSync(path, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify(report));
}
