// Invoked only by the process-death integration harness, never a real consumer.
import { createStore } from '../../../src/server/db/connection.ts';
import { processPayment } from '../../../apps/server/src/worker/payment.ts';
import { durableSyntheticAdapter, event, hash, stages, syntheticKey, type ChildInput, type ChildMessage } from './process-death.ts';

const allowed = new Set(['SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'TEST_DATABASE_URL', 'TEST_SCHEMA', 'NODE_CHANNEL_FD', 'NODE_CHANNEL_SERIALIZATION_MODE']);
function send(message: Omit<ChildMessage, 'pid'>) { process.send?.({ ...message, pid: process.pid }); }
process.once('message', (input: ChildInput) => {
  void (async () => {
    for (const name of ['HOMEDRIVE', 'HOMEPATH', 'LOGONSERVER', 'PATH', 'SYSTEMDRIVE', 'USERDOMAIN', 'USERNAME', 'USERPROFILE']) {
      if (process.env[name] === '') delete process.env[name];
    }
    const url = new URL(process.env.TEST_DATABASE_URL ?? 'invalid:');
    const schema = process.env.TEST_SCHEMA ?? '';
    if (Object.keys(process.env).some(key => !allowed.has(key)) || url.pathname !== '/aegispay_integration' ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !/^test_[a-f0-9]{32}$/.test(schema) ||
      ![input.attemptId, input.invocation, input.actor].every(v => /^[a-f0-9-]{36}$/.test(v)) ||
      input.stopAt !== null && !stages.includes(input.stopAt)) throw new Error('CHILD_CONFIGURATION_REJECTED');
    const store = createStore(url.toString(), schema, 1);
    try {
      const owned = await store.pool.query(`SELECT pg_backend_pid() AS pid FROM synthetic_process_invocation
        WHERE id=$1 AND obj_description((SELECT oid FROM pg_namespace WHERE nspname=$2)) LIKE 'aegispay-test-owned:%'`, [input.invocation, schema]);
      if (owned.rowCount !== 1) throw new Error('CHILD_SCHEMA_NOT_OWNED');
      const backendPid = owned.rows[0]!.pid as number;
      await event(store, input, 'start', { backendPid, environmentNames: Object.keys(process.env).sort() });
      send({ kind: 'ready', actor: input.actor, backendPid });
      try {
        await processPayment(store, input.attemptId, durableSyntheticAdapter(store, input), syntheticKey,
          context => hash(`SYNTHETIC-RECEIPT:${JSON.stringify(context)}`), async stage => {
            if (stage !== input.stopAt) return;
            await event(store, input, 'blocked', { stage });
            send({ kind: 'blocked', actor: input.actor, stage, backendPid });
            // No throw, rejection, timer or release path into processPayment.
            // The parent must terminate this actual OS process to get past here.
            await new Promise<never>(() => {});
          });
      } finally {
        await event(store, input, 'finally');
      }
      await event(store, input, 'done');
      send({ kind: 'done', actor: input.actor, backendPid });
    } finally { await store.close(); }
  })().then(() => { process.disconnect?.(); }, (error: unknown) => {
    send({ kind: 'error', actor: input.actor, code: error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : 'CHILD_INTERNAL_ERROR',
      environmentNames: Object.keys(process.env).sort() }); process.exitCode = 1; process.disconnect?.();
  });
});
