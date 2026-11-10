// Test-only durable synthetic transport. No SDK client, queue consumer, real
// signature, network request or live evidence writer is constructed here.
import { fork, type ChildProcess } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { GasSubmitResult } from '@carts1024/velo-sdk';
import type { Store } from '../../../src/server/db/connection.ts';
import { paymentSnapshot, type PaymentAdapter } from '../../../apps/server/src/worker/payment.ts';

export const syntheticKey = Buffer.alloc(32, 17); // Public test data, never a worker key.
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const stages = ['after_sign_before_persist', 'after_envelope', 'after_reserve_before_persist',
  'after_reservation', 'before_handoff', 'after_handoff_before_send', 'after_submit', 'before_grant'] as const;
export type DeathStage = typeof stages[number];
export interface ChildInput { attemptId: string; invocation: string; actor: string; stopAt: DeathStage | null }
export interface ChildMessage { kind: 'ready' | 'blocked' | 'done' | 'error'; actor: string; pid: number; backendPid?: number; stage?: string; code?: string; environmentNames?: string[] }
export interface ProviderRow {
  attempt_id: string; fingerprint: string; inner_hash: string; request_id: string | null;
  idempotency_key: string | null; outer_hash: string | null; ledger_closed_at: Date | null;
}
export interface TestEvent { seq: number; actor: string; pid: number; kind: string; detail: Record<string, unknown>; at: Date }

export async function installProcessTables(store: Store, invocation: string) {
  await store.pool.query(`CREATE TABLE synthetic_process_invocation (id uuid PRIMARY KEY);
    CREATE TABLE synthetic_process_event (seq serial PRIMARY KEY, actor uuid NOT NULL, pid integer NOT NULL,
      kind text NOT NULL, detail jsonb NOT NULL, at timestamptz NOT NULL DEFAULT clock_timestamp());
    CREATE TABLE synthetic_process_provider (attempt_id uuid PRIMARY KEY REFERENCES payment_attempt(id),
      fingerprint text NOT NULL, inner_hash text NOT NULL, request_id text UNIQUE,
      idempotency_key text UNIQUE, outer_hash text, ledger_closed_at timestamptz)`);
  await store.pool.query('INSERT INTO synthetic_process_invocation VALUES ($1)', [invocation]);
}
export async function event(store: Store, input: ChildInput, kind: string, detail: Record<string, unknown> = {}) {
  await store.pool.query('INSERT INTO synthetic_process_event(actor,pid,kind,detail) VALUES ($1,$2,$3,$4)',
    [input.actor, process.pid, kind, detail]);
}
export async function events(store: Store): Promise<TestEvent[]> {
  return (await store.pool.query<TestEvent>('SELECT * FROM synthetic_process_event ORDER BY seq')).rows;
}
export async function provider(store: Store, attemptId: string): Promise<ProviderRow> {
  const row = (await store.pool.query<ProviderRow>('SELECT * FROM synthetic_process_provider WHERE attempt_id=$1', [attemptId])).rows[0];
  if (!row) throw new Error('SYNTHETIC_PROVIDER_HISTORY_MISSING');
  return row;
}

export function durableSyntheticAdapter(store: Store, input: ChildInput): PaymentAdapter {
  const saved = () => paymentSnapshot(store, input.attemptId);
  const history = () => provider(store, input.attemptId);
  function execution(p: ProviderRow): GasSubmitResult {
    if (!p.request_id) throw new Error('SYNTHETIC_RESERVATION_MISSING');
    return { object: 'gas_submit_result', requestId: p.request_id, transactionHash: p.inner_hash,
      outerTransactionHash: p.outer_hash, status: p.outer_hash ? 'succeeded' : 'claimed',
      reservedStroops: '100', actualFeeStroops: null, expiresAt: '2099-01-01T00:00:00.000Z', reconciliationRequired: false };
  }
  return {
    async prepare({ attempt }) {
      const signedEnvelope = `SYNTHETIC-PROCESS-TEST-ONLY:${attempt.operationId}`;
      const innerHash = hash(`SYNTHETIC-INNER:${attempt.operationId}`);
      await event(store, input, 'sign', { operationId: attempt.operationId });
      await store.pool.query('INSERT INTO synthetic_process_provider(attempt_id,fingerprint,inner_hash) VALUES($1,$2,$3)',
        [attempt.id, hash(signedEnvelope), innerHash]);
      return { signedEnvelope, innerHash };
    },
    gas: {
      async sponsor(envelope, options) {
        await event(store, input, 'sponsor', { fingerprint: hash(envelope), idempotencyKey: options.idempotencyKey });
        let p = await history();
        if (p.fingerprint !== hash(envelope) || p.idempotency_key && p.idempotency_key !== options.idempotencyKey) throw new Error('SYNTHETIC_ENVELOPE_CHANGED');
        await store.pool.query(`UPDATE synthetic_process_provider SET request_id=coalesce(request_id,$2),
          idempotency_key=coalesce(idempotency_key,$3) WHERE attempt_id=$1`,
          [input.attemptId, `synthetic-process-reservation-${randomUUID()}`, options.idempotencyKey]);
        p = await history();
        const { agent, quote } = await saved();
        return { object: 'gas_sponsor_reservation', requestId: p.request_id!, transactionHash: p.inner_hash,
          decision: 'reserved', replayed: true, sourceWallet: agent.publicKey, targetContractIds: [agent.escrowContractId],
          innerMaxFeeStroops: '100', reservedStroops: '100', expiresAt: quote.expiresAt.toISOString() };
      },
      async submit(identity, options) {
        await event(store, input, 'submit', { requestId: identity.requestId, innerHash: identity.transactionHash,
          fingerprint: hash(identity.transactionXdr), maxRetries: options?.maxRetries });
        const p = await history();
        if (p.request_id !== identity.requestId || p.inner_hash !== identity.transactionHash || p.fingerprint !== hash(identity.transactionXdr)) throw new Error('SYNTHETIC_SUBMIT_IDENTITY_CHANGED');
        const result = await store.pool.query(`UPDATE synthetic_process_provider SET outer_hash=$2,ledger_closed_at=clock_timestamp()
          WHERE attempt_id=$1 AND outer_hash IS NULL RETURNING attempt_id`, [input.attemptId, hash(`SYNTHETIC-OUTER:${identity.requestId}`)]);
        if (result.rowCount !== 1) throw new Error('SYNTHETIC_DUPLICATE_SUBMIT');
        return execution(await history());
      },
      async getStatus(identity) {
        await event(store, input, 'observe', { requestId: identity.requestId, innerHash: identity.transactionHash });
        const p = await history();
        if (p.request_id !== identity.requestId || p.inner_hash !== identity.transactionHash) throw new Error('SYNTHETIC_OBSERVATION_IDENTITY_CHANGED');
        return execution(p);
      },
    },
    async verify({ quote, attempt, agent, execution: result }) {
      await event(store, input, 'verify', { requestId: result.requestId, innerHash: result.transactionHash });
      const p = await history();
      if (!p.outer_hash || !p.ledger_closed_at) throw new Error('SYNTHETIC_EXECUTION_NOT_PERSISTED');
      return { ownerId: quote.ownerId, agentId: agent.id, runId: quote.runId, quoteId: quote.id, attemptId: attempt.id,
        operationId: attempt.operationId, veloRequestId: p.request_id!, veloStatus: 'succeeded', chainSucceeded: true,
        innerHash: p.inner_hash, outerHash: p.outer_hash, observedEventTxHash: p.outer_hash,
        noirEventId: `synthetic-process-event-${attempt.id}`, network: 'testnet', contractId: agent.escrowContractId,
        ledgerSequence: '1', ledgerClosedAt: p.ledger_closed_at, agentPublicKey: agent.publicKey, deviceHash: quote.deviceHash,
        merchantAddress: quote.merchantAddress, assetContractId: quote.assetContractId, amountStroops: quote.amountStroops,
        nonce: attempt.nonce, outerLedgerFeeStroops: null, veloActualFeeStroops: null };
    },
  };
}

// Deliberate allowlist: never spread process.env, inherit execArgv/NODE_OPTIONS,
// read a worker env file, or place a DB connection string in process arguments.
export function childEnvironment(schemaName: string): NodeJS.ProcessEnv {
  const target = new URL(process.env.TEST_DATABASE_URL ?? 'invalid:');
  if (target.pathname !== '/aegispay_integration' || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) || !/^test_[a-f0-9]{32}$/.test(schemaName)) throw new Error('LOCAL_TEST_DATABASE_REQUIRED');
  const env: NodeJS.ProcessEnv = { TEST_DATABASE_URL: target.toString(), TEST_SCHEMA: schemaName };
  for (const name of ['SystemRoot', 'WINDIR', 'TEMP', 'TMP']) if (process.env[name]) env[name] = process.env[name];
  // libuv supplies these Windows defaults from the parent if absent. Explicit
  // empty entries prevent that implicit inheritance; the child removes them.
  if (process.platform === 'win32') for (const name of ['HOMEDRIVE', 'HOMEPATH', 'LOGONSERVER', 'PATH', 'SYSTEMDRIVE', 'USERDOMAIN', 'USERNAME', 'USERPROFILE']) env[name] = '';
  return env;
}

export function startPaymentChild(schemaName: string, input: ChildInput) {
  const child = fork(fileURLToPath(new URL('./payment-process-child.ts', import.meta.url)), [], {
    execArgv: ['--import', 'tsx'], env: childEnvironment(schemaName), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  const messages: ChildMessage[] = [];
  let exited = false, outputBytes = 0;
  const listeners = new Set<() => void>();
  child.stdout!.on('data', (data: Buffer) => { outputBytes += data.length; });
  child.stderr!.on('data', (data: Buffer) => { outputBytes += data.length; });
  child.on('message', (message: ChildMessage) => { messages.push(message); for (const notify of listeners) notify(); });
  const exit = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(resolve => {
    child.once('exit', (code, signal) => { exited = true; resolve({ code, signal }); for (const notify of listeners) notify(); });
    child.once('error', () => { exited = true; resolve({ code: -1, signal: null }); for (const notify of listeners) notify(); });
  });
  // Independent of Vitest's timeout: terminate only this owned ChildProcess.
  const watchdog = setTimeout(() => { if (!exited) child.kill('SIGKILL'); }, 15000);
  void exit.then(() => clearTimeout(watchdog));
  async function wait(kind: ChildMessage['kind']) {
    return new Promise<ChildMessage>((resolve, reject) => {
      const timeout = setTimeout(() => finish(new Error('CHILD_HANDSHAKE_TIMEOUT')), 12000);
      function finish(value: ChildMessage | Error) {
        clearTimeout(timeout); listeners.delete(check);
        if (value instanceof Error) reject(value); else resolve(value);
      }
      function check() {
        const message = messages.find(m => m.kind === kind);
        if (message) finish(message);
        else if (exited || messages.some(m => m.kind === 'error')) {
          const error = messages.find(m => m.kind === 'error');
          finish(new Error(`CHILD_EXECUTION_FAILED_REDACTED:${error?.code ?? 'NO_IPC_ERROR'}:${error?.environmentNames?.join(',') ?? ''}:outputBytes=${outputBytes}`));
        }
      }
      listeners.add(check); check();
    });
  }
  async function stop() {
    if (!exited && !child.kill('SIGKILL')) throw new Error('OWNED_CHILD_TERMINATION_FAILED');
    return exit;
  }
  child.send(input);
  return { child, input, wait, exit, stop, outputBytes: () => outputBytes };
}
export type OwnedChild = ReturnType<typeof startPaymentChild>;
export function assertOwnedPid(child: ChildProcess, pid: number) {
  if (child.pid !== pid || pid === process.pid || !Number.isSafeInteger(pid) || pid < 1) throw new Error('CHILD_PID_NOT_OWNED');
}
