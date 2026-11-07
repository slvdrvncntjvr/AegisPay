import { loadIntegrationEnvironment } from './db/local.ts';
import { configuredStore } from '../src/server/db/connection.ts';
import { seedConfigFromEnvironment, seedDemo } from '../src/server/db/seed.ts';

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
