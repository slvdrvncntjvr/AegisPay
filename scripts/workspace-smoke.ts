import assert from 'node:assert/strict';
import { toolIntentSchema, xlmToStroops } from '@aegispay/shared';
import { BoundedIntentGuard } from '@aegispay/agent';
import { createIntentGate } from '../apps/server/src/intent-gate.js';
import { parseToolIntent, runtimeHealth } from '../apps/web/src/runtime.js';
import { GET, runtime } from '../apps/web/src/app/api/health/route.js';

assert.equal(runtime, 'nodejs');
assert.deepEqual(await GET().json(), runtimeHealth());
assert.equal(xlmToStroops('0.03'), 300000n);
const intent = toolIntentSchema.parse({ tool: 'discover_offers' });
assert.deepEqual(parseToolIntent(intent), intent);
new BoundedIntentGuard().accept(intent);
assert.deepEqual(createIntentGate().accept(intent), intent);
console.info('workspace smoke: 4 real packages, web Node route, shared schemas and worker guard passed; no payment or model execution');
