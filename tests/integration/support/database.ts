import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { loadIntegrationEnvironment } from '../../../scripts/db/local.js';
import { createStore } from '../../../src/server/db/connection.js';
import { migrate } from '../../../src/server/db/migrate.js';

export async function createTestDatabase() {
  loadIntegrationEnvironment();
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL_REQUIRED_RUN_DB_SETUP');
  const target = new URL(url);
  // Fixed distinct integration database and a fresh UUID schema, never a live ledger.
  if (target.pathname !== '/aegispay_integration' || !['127.0.0.1','localhost','[::1]'].includes(target.hostname)) throw new Error('LOCAL_TEST_DATABASE_REQUIRED');
  const schemaName = `test_${randomUUID().replaceAll('-', '')}`;
  if (!/^test_[a-f0-9]{32}$/.test(schemaName)) throw new Error('INVALID_TEST_SCHEMA');
  const admin = new Pool({ connectionString: url, connectionTimeoutMillis: 5000 });
  const ownershipToken = randomUUID();
  const first = createStore(url, schemaName, 15), second = createStore(url, schemaName, 15);
  async function cleanup() {
    await first.close(); await second.close();
    try {
      const owned = await admin.query<{ description: string }>('SELECT obj_description(oid) AS description FROM pg_namespace WHERE nspname = $1', [schemaName]);
      if (owned.rows[0]?.description !== `aegispay-test-owned:${ownershipToken}` || !/^test_[a-f0-9]{32}$/.test(schemaName)) throw new Error('TEST_SCHEMA_NOT_OWNED');
      // Only this invocation's proven test-owned schema may be removed.
      await admin.query(`DROP SCHEMA "${schemaName}" CASCADE`);
    } finally { await admin.end(); }
  }
  try {
    await admin.query(`CREATE SCHEMA "${schemaName}"`);
    await admin.query(`COMMENT ON SCHEMA "${schemaName}" IS 'aegispay-test-owned:${ownershipToken}'`);
    const version = await admin.query<{ server_version: string }>('SHOW server_version');
    if (!version.rows[0]!.server_version.startsWith('17.')) throw new Error('POSTGRES_17_REQUIRED');
    // The controlled migration runner itself must tolerate concurrent invocations.
    await Promise.all([migrate(first), migrate(second)]);
    return { first, second, cleanup, schemaName };
  } catch (error) { await cleanup(); throw error; }
}
