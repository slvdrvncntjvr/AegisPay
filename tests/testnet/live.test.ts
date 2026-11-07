import { test } from 'node:test';
import { runSpikePreflight } from '../../scripts/spike-noir-velo.js';

// Required acceptance case fails, rather than skips, without real evidence.
test('TASK-002 live same-transaction Noir/Velo acceptance', async () => {
  await runSpikePreflight();
});
