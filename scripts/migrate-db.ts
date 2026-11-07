import { loadIntegrationEnvironment } from './db/local.ts';
import { configuredStore } from '../src/server/db/connection.ts';
import { migrate } from '../src/server/db/migrate.ts';

loadIntegrationEnvironment();
const store = configuredStore();
try { await migrate(store); console.info('Versioned database migrations applied under advisory lock'); }
catch { console.error('DATABASE_MIGRATION_FAILED'); process.exitCode = 1; }
finally { await store.close(); }
