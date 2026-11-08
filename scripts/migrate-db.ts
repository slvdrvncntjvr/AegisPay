import { loadIntegrationEnvironment } from './db/local.js';
import { configuredStore } from '../src/server/db/connection.js';
import { migrate } from '../src/server/db/migrate.js';

loadIntegrationEnvironment();
const store = configuredStore();
try { await migrate(store); console.info('Versioned database migrations applied under advisory lock'); }
catch { console.error('DATABASE_MIGRATION_FAILED'); process.exitCode = 1; }
finally { await store.close(); }
