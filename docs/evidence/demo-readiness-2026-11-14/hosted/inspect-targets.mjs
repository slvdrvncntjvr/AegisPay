// Optional bounded authenticated GET inventory only. Never connection-info,
// billing, environment values, SQL, account/service/database creation or update.
import { readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { jsonGET, cleanNetworkEnvironment, sha } from '../../../../deployment/finals/preview/common.mjs';
const output = 'docs/evidence/demo-readiness-2026-11-14/hosted/provider-targets.json';
if (process.argv.length !== 3 || process.argv[2] !== '--inspect') {
  console.log(JSON.stringify({ status: 'not_run', code: 'EXPLICIT_READONLY_PROVIDER_INVENTORY_REQUIRED', providerMutations: 0 }));
  process.exitCode = 2;
} else {
  const requests = [];
  try {
    cleanNetworkEnvironment();
    const content = readFileSync('.env.deploy.local', 'utf8');
    if (Buffer.byteLength(content) > 65536) throw Error('PRIVATE_FILE_BOUND_EXCEEDED');
    const lines = content.split(/\r?\n/).filter(line => /^\s*(?:export\s+)?RENDER_API_KEY\s*=/.test(line));
    const key = parseEnv(lines.join('\n')).RENDER_API_KEY;
    if (!key?.trim()) throw Error('PROVIDER_KEY_UNAVAILABLE');
    const get = async (path, label) => {
      const value = await jsonGET('https://api.render.com/v1' + path, { Authorization: 'Bearer ' + key });
      requests.push({ label, method: 'GET', status: 'successful_2xx_json' }); return value;
    };
    const owners = await get('/owners?limit=20', 'accessible-workspaces');
    if (!Array.isArray(owners) || !owners.length || owners.length > 5 || owners.some(row => !/^[a-z0-9_-]+$/i.test(row.owner?.id ?? ''))) throw Error('BOUNDED_WORKSPACE_INVENTORY_REQUIRED');
    const workspaces = [];
    for (const row of owners) {
      const id = row.owner.id;
      const databases = await get('/postgres?ownerId=' + encodeURIComponent(id) + '&limit=100', 'workspace-postgres');
      const services = await get('/services?ownerId=' + encodeURIComponent(id) + '&includePreviews=true&limit=100', 'workspace-services');
      if (!Array.isArray(databases) || databases.length >= 100 || databases.some(value => !value.postgres) ||
        !Array.isArray(services) || services.length >= 100 || services.some(value => !value.service)) throw Error('COMPLETE_BOUNDED_INVENTORY_REQUIRED');
      const dbs = databases.map(value => value.postgres), apps = services.map(value => value.service);
      workspaces.push({ workspaceSha256: sha(id), postgresCount: dbs.length, freeDatabaseCount: dbs.filter(db => db.plan === 'free').length,
        noExistingFreeDatabaseObserved: !dbs.some(db => db.plan === 'free'), serviceCount: apps.length,
        proposedReleaseNameCollision: apps.some(app => ['aegispay-release-web', 'aegispay-release-worker'].includes(app.name)),
        projectDatabases: dbs.filter(db => /^aegispay-/.test(db.name ?? '')).map(db => ({ databaseSha256: sha(db.id),
          isExistingPreview: db.name === 'aegispay-finals-staging', free: db.plan === 'free', available: db.status === 'available',
          region: ['singapore', 'oregon', 'ohio', 'virginia', 'frankfurt'].includes(db.region) ? db.region : 'unknown',
          expiresAt: typeof db.expiresAt === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(db.expiresAt) ? db.expiresAt : null })) });
    }
    const report = { status: 'passed', scope: 'bounded-authenticated-readonly-provider-inventory-only', observedAt: new Date().toISOString(),
      requests, workspaces, providerMutations: 0, sqlStatements: 0, connectionInformationRead: false, rawProviderIdentifiersExported: false,
      existingPreviewPreserved: true, independentDatabaseSelected: false,
      limit: 'An empty observed Free slot is not creation eligibility/capacity; independent target selection/provisioning requires coordinator review. No existing preview/incident reuse or paid fallback.' };
    writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
  } catch {
    const report = { status: 'failed', code: 'READONLY_PROVIDER_INVENTORY_INCOMPLETE', requests, providerMutations: 0, sqlStatements: 0 };
    writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report)); process.exitCode = 1;
  }
}
