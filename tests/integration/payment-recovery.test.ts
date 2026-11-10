import { randomBytes } from 'node:crypto';
import { VeloValidationError } from '@carts1024/velo-sdk';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { createTestDatabase } from './support/database.ts';
import { acceptInput, fixture } from './support/fixtures.ts';
import { syntheticAdapter } from './support/payment-adapter.ts';
import { acceptQuote } from '../../src/server/domain/purchases.ts';
import { decryptEnvelope, encryptEnvelope, observationOnly, paymentSnapshot, processPayment } from '../../apps/server/src/worker/payment.ts';
import { receiptTokens } from '../../src/server/merchant/receipts.ts';
import { SpikeGuardError } from '../../src/server/integrations/noir.ts';
import * as s from '../../src/server/db/schema.ts';

describe('TC-007/012/019/029 independent PostgreSQL crash and one-handoff recovery', () => {
  let db: Awaited<ReturnType<typeof createTestDatabase>>;
  const key = randomBytes(32), receipt = receiptTokens(randomBytes(32).toString('base64url'));
  beforeAll(async () => { db = await createTestDatabase(); });
  afterAll(async () => { await db.cleanup(); });
  async function setup(options: Parameters<typeof syntheticAdapter>[0] = {}, ttl?: number) {
    const f = await fixture(db.first, ttl ? { quoteTtlMs: ttl } : {}), attempt = await acceptQuote(db.first, acceptInput(f)), transport = syntheticAdapter(options);
    const original = transport.adapter.gas.sponsor;
    transport.adapter.gas.sponsor = async (envelope, input) => {
      const saved = await paymentSnapshot(db.first, attempt.id);
      const r = await original(envelope, input);
      return { ...r, transactionHash: saved.attempt.innerHash!, sourceWallet: f.agent.publicKey, targetContractIds: [f.agent.escrowContractId] };
    };
    const run = (fault?: (stage: string) => Promise<void>, second = false) => processPayment(second ? db.second : db.first, attempt.id, transport.adapter, key, receipt.hash, fault);
    return { f, attempt, ...transport, run };
  }
  it('encrypts with fresh GCM IV and binds ciphertext to the immutable operation', () => {
    const encrypted = encryptEnvelope('SENSITIVE_TEST_XDR', 'operation-A', key);
    expect(encrypted.signedXdrCiphertext.toString()).not.toContain('SENSITIVE_TEST_XDR');
    const row = { ...encrypted, operationId: 'operation-B' } as typeof s.paymentAttempt.$inferSelect;
    expect(() => decryptEnvelope(row, key)).toThrow();
  });
  it('50 independent consumers grant one entitlement, spend once and delete ciphertext', async () => {
    const t = await setup();
    await Promise.all(Array.from({ length: 50 }, (_, i) => t.run(undefined, i % 2 === 1)));
    expect(t.counts.sign).toBe(1); expect(t.counts.submit).toBe(1);
    const row = await paymentSnapshot(db.first, t.attempt.id);
    expect(row.attempt.status).toBe('authorized'); expect(row.attempt.signedXdrCiphertext).toBeNull();
    const grants = await db.first.db.select().from(s.entitlement).where(eq(s.entitlement.quoteId, t.f.quote.id)); expect(grants).toHaveLength(1);
  });
  for (const stage of ['after_envelope', 'after_reserve_before_persist', 'after_reservation', 'before_handoff', 'after_submit', 'before_grant']) {
    it(`recovers ${stage} from saved identities without resigning or submitting twice`, async () => {
      const t = await setup();
      await expect(t.run(async current => { if (current === stage) throw new Error('INJECTED_CRASH'); })).rejects.toThrow('INJECTED_CRASH');
      await t.run(undefined, true);
      expect(t.counts.sign).toBe(1); expect(t.counts.submit).toBe(1);
      expect((await paymentSnapshot(db.first, t.attempt.id)).attempt.status).toBe('authorized');
    });
  }
  it('crash immediately after handoff remains unresolved; never sends after restart', async () => {
    const t = await setup();
    await expect(t.run(async stage => { if (stage === 'after_handoff_before_send') throw new Error('INJECTED_CRASH'); })).rejects.toThrow();
    await t.run(undefined, true); await t.run();
    expect(t.counts.submit).toBe(0); expect(t.counts.sign).toBe(1);
    const row = await paymentSnapshot(db.first, t.attempt.id);
    expect(row.attempt.status).toBe('unknown'); expect(row.attempt.signedXdrCiphertext).toBeNull();
    expect(await db.first.db.select().from(s.entitlement).where(eq(s.entitlement.quoteId, t.f.quote.id))).toHaveLength(0);
  });
  it('interruption after signing before persistence stops for manual review', async () => {
    const t = await setup();
    await expect(t.run(async stage => { if (stage === 'after_sign_before_persist') throw new Error('INJECTED_CRASH'); })).rejects.toThrow();
    await t.run(undefined, true);
    expect(t.counts.sign).toBe(1); expect(t.counts.submit).toBe(0);
    expect((await paymentSnapshot(db.first, t.attempt.id)).attempt.status).toBe('manual_review');
  });
  it('Velo success without chain proof stays unknown and keeps the budget reserved', async () => {
    const t = await setup({ unavailableChain: true }); await t.run(); await t.run(undefined, true);
    expect(t.counts.submit).toBe(1); expect(t.counts.sign).toBe(1);
    expect((await paymentSnapshot(db.first, t.attempt.id)).attempt.status).toBe('unknown');
    const [run] = await db.first.db.select().from(s.agentRun).where(eq(s.agentRun.id, t.f.run.id)); expect(run!.reservedStroops).toBe('300000');
  });
  it('unknown resumes by the original identity even when disabled and clears its safe error only after verification', async () => {
    const t = await setup({ unknown: true }); await t.run();
    expect((await paymentSnapshot(db.first, t.attempt.id)).attempt.status).toBe('unknown');
    await db.second.db.update(s.agent).set({ status: 'disabled' }).where(eq(s.agent.id, t.f.agent.id));
    t.options.unknown = false;
    await t.run(undefined, true);
    const { attempt } = await paymentSnapshot(db.first, t.attempt.id);
    expect(attempt.status).toBe('authorized'); expect(attempt.errorCode).toBeNull();
    expect(t.counts.sign).toBe(1); expect(t.counts.submit).toBe(1);
    expect((await paymentSnapshot(db.first, t.attempt.id)).agent.status).toBe('disabled');
  });
  for (const mismatch of ['outer_hash', 'invocation', 'evidence_context'] as const) {
    it(`R2 moves deterministic ${mismatch} contradiction to manual review without releasing or granting`, async () => {
      const t = await setup({ unknown: true }); await t.run();
      const before = await paymentSnapshot(db.first, t.attempt.id);
      t.options.unknown = false;
      if (mismatch === 'outer_hash') {
        const original = t.adapter.gas.getStatus;
        t.adapter.gas.getStatus = async (identity, options) => ({ ...await original(identity, options), outerTransactionHash: randomBytes(32).toString('hex') });
      } else if (mismatch === 'invocation') {
        t.adapter.verify = async () => { throw new SpikeGuardError('INVOCATION_MISMATCH'); };
      } else {
        const original = t.adapter.verify;
        t.adapter.verify = async input => ({ ...await original(input), amountStroops: '1' });
      }
      await t.run(undefined, true);
      const { attempt } = await paymentSnapshot(db.first, t.attempt.id);
      expect(attempt.status).toBe('manual_review'); expect(attempt.errorCode).toBe('PAYMENT_EVIDENCE_CONTRADICTION');
      expect(attempt.nonce).toBe(before.attempt.nonce); expect(attempt.veloRequestId).toBe(before.attempt.veloRequestId);
      expect(attempt.innerHash).toBe(before.attempt.innerHash); expect(attempt.outerHash).toBe(before.attempt.outerHash);
      expect(attempt.handoffCommittedAt).toEqual(before.attempt.handoffCommittedAt);
      expect(t.counts.sign).toBe(1); expect(t.counts.sponsor).toBe(1); expect(t.counts.submit).toBe(1);
      expect(await db.first.db.select().from(s.entitlement).where(eq(s.entitlement.quoteId, t.f.quote.id))).toHaveLength(0);
      const [run] = await db.first.db.select().from(s.agentRun).where(eq(s.agentRun.id, t.f.run.id));
      expect(run!.reservedStroops).toBe('300000'); expect(run!.spentStroops).toBe('0');
    });
  }
  for (const code of ['CHAIN_SUCCESS_NOT_VERIFIED', 'NOIR_EVENT_UNAVAILABLE']) {
    it(`R2 temporarily missing ${code} stays unknown rather than contradiction`, async () => {
      const t = await setup();
      t.adapter.verify = async () => { throw new SpikeGuardError(code); };
      await t.run();
      const { attempt } = await paymentSnapshot(db.first, t.attempt.id);
      expect(attempt.status).toBe('unknown'); expect(attempt.errorCode).toBe('PAYMENT_OBSERVATION_UNAVAILABLE');
      expect(await db.first.db.select().from(s.entitlement).where(eq(s.entitlement.quoteId, t.f.quote.id))).toHaveLength(0);
    });
  }
  it('R2 temporarily absent provider outer hash is missing evidence, not a contradictory hash', async () => {
    const t = await setup({ unknown: true }); await t.run();
    const before = await paymentSnapshot(db.first, t.attempt.id);
    expect(before.attempt.outerHash).not.toBeNull();
    const original = t.adapter.gas.getStatus;
    t.options.unknown = false;
    t.adapter.gas.getStatus = async (identity, options) => ({ ...await original(identity, options), outerTransactionHash: null });
    await t.run(undefined, true);
    const { attempt } = await paymentSnapshot(db.first, t.attempt.id);
    expect(attempt.status).toBe('unknown'); expect(attempt.errorCode).toBe('PAYMENT_STATUS_UNKNOWN');
    expect(attempt.outerHash).toBe(before.attempt.outerHash);
    expect(t.counts.verify).toBe(0); expect(t.counts.submit).toBe(1);
    const [run] = await db.first.db.select().from(s.agentRun).where(eq(s.agentRun.id, t.f.run.id));
    expect(run!.reservedStroops).toBe('300000'); expect(run!.spentStroops).toBe('0');
    expect(await db.first.db.select().from(s.entitlement).where(eq(s.entitlement.quoteId, t.f.quote.id))).toHaveLength(0);
  });
  it('R2 a stale owner cannot persist a contradiction decision', async () => {
    const t = await setup();
    t.adapter.verify = async () => {
      await db.second.db.update(s.agent).set({ leaseOwner: 'replacement-worker', leaseUntil: sql`clock_timestamp() + interval '120 seconds'` }).where(eq(s.agent.id, t.f.agent.id));
      throw new SpikeGuardError('TRANSACTION_HASH_MISMATCH');
    };
    await t.run();
    const { attempt, agent } = await paymentSnapshot(db.first, t.attempt.id);
    expect(attempt.status).toBe('submitted'); expect(attempt.errorCode).toBeNull();
    expect(agent.leaseOwner).toBe('replacement-worker');
    expect(await db.first.db.select().from(s.entitlement).where(eq(s.entitlement.quoteId, t.f.quote.id))).toHaveLength(0);
    const [run] = await db.first.db.select().from(s.agentRun).where(eq(s.agentRun.id, t.f.run.id));
    expect(run!.reservedStroops).toBe('300000'); expect(run!.spentStroops).toBe('0');
  });
  it('identity-only recovery keeps a provider 409 held after quote and policy expiry', async () => {
    const t = await setup({ unknown: true }, 5000); await t.run();
    const before = await paymentSnapshot(db.first, t.attempt.id);
    await db.first.db.execute(sql`select pg_sleep(greatest(0, extract(epoch from ${t.f.quote.expiresAt}::timestamptz - clock_timestamp())) + 0.05)`);
    await db.first.db.update(s.agent).set({ policyExpiresAt: new Date(0) }).where(eq(s.agent.id, t.f.agent.id));
    let observed: unknown;
    t.adapter.gas.getStatus = async identity => { observed = identity; throw new VeloValidationError('PRIVATE_PROVIDER_ERROR', { status: 409 }); };
    await processPayment(db.second, t.attempt.id, observationOnly(t.adapter), key, receipt.hash);
    expect(observed).toEqual({ requestId: before.attempt.veloRequestId, transactionHash: before.attempt.innerHash });
    const after = await paymentSnapshot(db.first, t.attempt.id);
    expect(after.attempt.status).toBe('unknown');
    expect(after.attempt.errorCode).toBe('PAYMENT_OBSERVATION_UNAVAILABLE');
    expect(after.attempt.handoffCommittedAt).toEqual(before.attempt.handoffCommittedAt);
    expect(after.attempt.nonce).toBe(before.attempt.nonce);
    expect(t.counts.sign).toBe(1); expect(t.counts.sponsor).toBe(1); expect(t.counts.submit).toBe(1);
    expect(await db.first.db.select().from(s.entitlement).where(eq(s.entitlement.quoteId, t.f.quote.id))).toHaveLength(0);
    const [run] = await db.first.db.select().from(s.agentRun).where(eq(s.agentRun.id, t.f.run.id));
    expect(run!.reservedStroops).toBe('300000'); expect(run!.spentStroops).toBe('0');
  });
  it('explicit observation-only adapter permits verified recovery and rejects financial methods', async () => {
    const t = await setup({ unknown: true }); await t.run();
    const adapter = observationOnly(t.adapter);
    const snapshot = await paymentSnapshot(db.first, t.attempt.id);
    await expect(adapter.prepare(snapshot)).rejects.toThrow('OBSERVATION_ONLY');
    await expect(adapter.gas.sponsor('SHOULD_NEVER_REACH_PROVIDER', { idempotencyKey: 'unused' })).rejects.toThrow('OBSERVATION_ONLY');
    await expect(adapter.gas.submit({ requestId: 'unused', transactionHash: '0'.repeat(64), transactionXdr: 'SHOULD_NEVER_REACH_PROVIDER' })).rejects.toThrow('OBSERVATION_ONLY');
    t.options.unknown = false;
    await processPayment(db.second, t.attempt.id, adapter, key, receipt.hash);
    expect((await paymentSnapshot(db.first, t.attempt.id)).attempt.status).toBe('authorized');
    expect(t.counts.sign).toBe(1); expect(t.counts.sponsor).toBe(1); expect(t.counts.submit).toBe(1);
  });
  it('expires before sponsorship after an awaited step without dispatch', async () => {
    const t = await setup({}, 5000);
    await t.run(async stage => { if (stage === 'after_envelope') await db.first.db.execute(sql`select pg_sleep(greatest(0, extract(epoch from ${t.f.quote.expiresAt}::timestamptz - clock_timestamp())) + 0.05)`); });
    expect(t.counts.submit).toBe(0); expect(t.counts.sponsor).toBe(0);
    expect((await paymentSnapshot(db.first, t.attempt.id)).attempt.status).toBe('expired');
  });
  it('timely handoff grants original terms even when independent confirmation is late', async () => {
    const t = await setup({}, 5000);
    await t.run(async stage => { if (stage === 'after_submit') await db.first.db.execute(sql`select pg_sleep(greatest(0, extract(epoch from ${t.f.quote.expiresAt}::timestamptz - clock_timestamp())) + 0.05)`); });
    expect((await paymentSnapshot(db.first, t.attempt.id)).attempt.status).toBe('authorized');
  });
  it('R3 a final ownership read blocked across quote expiry preserves the marker and never submits', async () => {
    const t = await setup({}, 5000);
    const blocker = await db.second.pool.connect();
    let released: Promise<unknown> | undefined;
    try {
      await t.run(async stage => {
        if (stage !== 'after_handoff_before_send') return;
        await blocker.query('BEGIN');
        const held = await blocker.query<{ valid_lease: boolean }>('SELECT lease_until > $2::timestamptz AS valid_lease FROM agent WHERE id = $1 FOR UPDATE', [t.f.agent.id, t.f.quote.expiresAt]);
        expect(held.rows[0]!.valid_lease).toBe(true);
        // The executor's final SELECT FOR SHARE waits on this second connection.
        // Release only after DB time has crossed the immutable quote deadline.
        released = blocker.query('SELECT pg_sleep(greatest(0, extract(epoch from $1::timestamptz - clock_timestamp())) + 0.05)', [t.f.quote.expiresAt]).then(() => blocker.query('COMMIT'));
      });
      await released;
      const beforeRetry = await paymentSnapshot(db.first, t.attempt.id);
      expect(beforeRetry.attempt.status).toBe('manual_review'); expect(beforeRetry.attempt.errorCode).toBe('POST_HANDOFF_QUOTE_EXPIRED');
      expect(beforeRetry.attempt.handoffCommittedAt!.getTime()).toBeLessThan(t.f.quote.expiresAt.getTime());
      expect(beforeRetry.attempt.veloRequestId).not.toBeNull(); expect(beforeRetry.attempt.innerHash).not.toBeNull();
      expect(beforeRetry.attempt.signedXdrCiphertext).toBeNull();
      await t.run(undefined, true);
      const afterRetry = await paymentSnapshot(db.first, t.attempt.id);
      expect(afterRetry.attempt.handoffCommittedAt).toEqual(beforeRetry.attempt.handoffCommittedAt);
      expect(afterRetry.attempt.nonce).toBe(beforeRetry.attempt.nonce);
      expect(afterRetry.attempt.status).toBe('manual_review');
      expect(t.counts.sign).toBe(1); expect(t.counts.sponsor).toBe(1); expect(t.counts.submit).toBe(0); expect(t.counts.observe).toBe(0);
      expect(await db.first.db.select().from(s.entitlement).where(eq(s.entitlement.quoteId, t.f.quote.id))).toHaveLength(0);
      const [run] = await db.first.db.select().from(s.agentRun).where(eq(s.agentRun.id, t.f.run.id));
      expect(run!.reservedStroops).toBe('300000'); expect(run!.spentStroops).toBe('0');
    } finally { await released; await blocker.query('ROLLBACK'); blocker.release(); }
  });
  it('a worker that loses ownership before grant cannot mutate payment or entitlement', async () => {
    const t = await setup();
    await expect(t.run(async stage => {
      if (stage === 'before_grant') await db.second.db.update(s.agent).set({ leaseOwner: 'replacement-worker', leaseUntil: sql`clock_timestamp() + interval '120 seconds'` }).where(eq(s.agent.id, t.f.agent.id));
    })).rejects.toThrow('LEASE_LOST');
    expect(await db.first.db.select().from(s.entitlement).where(eq(s.entitlement.quoteId, t.f.quote.id))).toHaveLength(0);
    expect((await paymentSnapshot(db.first, t.attempt.id)).attempt.status).toBe('submitted');
    await db.second.db.update(s.agent).set({ leaseUntil: sql`clock_timestamp() - interval '1 second'` }).where(eq(s.agent.id, t.f.agent.id));
    await t.run(undefined, true);
    expect(t.counts.submit).toBe(1); expect(t.counts.sign).toBe(1);
    expect((await paymentSnapshot(db.first, t.attempt.id)).attempt.status).toBe('authorized');
  });
});
