import { loadIntegrationEnvironment } from './db/local.js';
import { configuredStore } from '../src/server/db/connection.js';
import { seedConfigFromEnvironment, seedDemo } from '../src/server/db/seed.js';

loadIntegrationEnvironment();
const store = configuredStore();
try {
  const config = seedConfigFromEnvironment();
  const result = await seedDemo(store, config);
  console.info(JSON.stringify({ gate: 'demo-catalog-seed', offers: result.offers, policy: result.policy, payments: 0 }));
} catch (error) {
  const message = error instanceof Error ? error.message : '';
  console.error(message.startsWith('MISSING_SEED_CONFIGURATION: ') ? message : 'DEMO_SEED_FAILED');
  process.exitCode = 1;
} finally { await store.close(); }
