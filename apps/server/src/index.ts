import { createIntentGate } from './intent-gate.js';
import { healthSchema } from '@aegispay/shared';

// Private process bootstrap. Job execution is TASK-005; model round trips TASK-007.
// There is no public listener and this bootstrap cannot sign or submit a payment.
const gate = createIntentGate();
gate.accept({ tool: 'discover_offers' });
healthSchema.parse({ status: 'ok', network: 'testnet' });
console.info(JSON.stringify({ component: 'private-worker', state: 'bootstrap', jobExecution: 'unimplemented' }));
if (!process.argv.includes('--check')) {
  await new Promise<void>(resolve => {
    const timer = setInterval(() => { /* keep the private runtime alive until job wiring */ }, 30000);
    const stop = () => { clearInterval(timer); resolve(); };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });
}
