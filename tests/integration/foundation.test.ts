import { randomUUID, createHash, randomBytes } from 'node:crypto';
import { StrKey } from '@stellar/stellar-sdk';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { createTestDatabase } from './support/database.js';
import { fixture, acceptInput, observedProof } from './support/fixtures.js';
import { acceptQuote, createQuote, createRun, refuseBeforeHandoff } from '../../src/server/domain/purchases.js';
import { attachVerifiedEvidence } from '../../src/server/domain/evidence.js';
import { createStore } from '../../src/server/db/connection.js';
import { seedDemo } from '../../src/server/db/seed.js';
import { migrate } from '../../src/server/db/migrate.js';
import * as s from '../../src/server/db/schema.js';

let testDb: Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async () => { testDb = await createTestDatabase(); });
afterAll(async () => { if (testDb) await testDb.cleanup(); });

describe('actual PostgreSQL financial foundation', () => {
  it('TC-007: 50 concurrent retries reserve exactly once across independent pools', async () => {
    const f = await fixture(testDb.first);
    const input = acceptInput(f);
    const attempts = await Promise.all(Array.from({ length: 50 }, (_, i) => acceptQuote(i % 2 ? testDb.first : testDb.second, input)));
    expect(new Set(attempts.map(a => a.id)).size).toBe(1);
    const [run] = await testDb.first.db.select().from(s.agentRun).where(eq(s.agentRun.id, f.run.id));
    expect(run!.reservedStroops).toBe('300000');
    const [agent] = await testDb.first.db.select().from(s.agent).where(eq(s.agent.id, f.agent.id));
    expect(agent!.lastNonce).toBe('1');
    const sameQuoteNewKey = await acceptQuote(testDb.second, { ...input, clientKey: randomUUID() });
    expect(sameQuoteNewKey.id).toBe(attempts[0]!.id);
  });
  it('binds caller key permanently to one quote and rejects same key on another quote', async () => {
    const f = await fixture(testDb.first);
    const input = acceptInput(f);
    await acceptQuote(testDb.first, input);
    const another = await createQuote(testDb.first, { ...input, resourceId: f.resource.id });
    await expect(acceptQuote(testDb.second, { ...input, quoteId: another.id })).rejects.toThrow('IDEMPOTENCY_CONFLICT');
    const alias = randomUUID();
    await acceptQuote(testDb.second, { ...input, clientKey: alias });
    await expect(acceptQuote(testDb.first, { ...input, quoteId: another.id, clientKey: alias })).rejects.toThrow('IDEMPOTENCY_CONFLICT');
  });
  it('TC-023: two quotes racing cannot reserve beyond budget or create two active attempts', async () => {
    const f = await fixture(testDb.first, { budget: '500000' });
    const input = acceptInput(f);
    const q2 = await createQuote(testDb.first, { ...input, resourceId: f.resource.id });
    const results = await Promise.allSettled([
      acceptQuote(testDb.first, input),
      acceptQuote(testDb.second, { ...input, quoteId: q2.id, clientKey: randomUUID() }),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const [run] = await testDb.first.db.select().from(s.agentRun).where(eq(s.agentRun.id, f.run.id));
    expect(run!.reservedStroops).toBe('300000');
  });
  it('TC-031: price changes affect only future quotes, accepted terms cannot be edited', async () => {
    const f = await fixture(testDb.first);
    const attempt = await acceptQuote(testDb.first, acceptInput(f));
    await testDb.first.db.update(s.resource).set({ priceStroops: '600000' }).where(eq(s.resource.id, f.resource.id));
    const next = await createQuote(testDb.first, { ...acceptInput(f), resourceId: f.resource.id });
    expect(next.amountStroops).toBe('600000');
    const [old] = await testDb.first.db.select().from(s.quote).where(eq(s.quote.id, attempt.quoteId));
    expect(old!.amountStroops).toBe('300000');
    await expect(testDb.first.db.update(s.quote).set({ amountStroops: '1' }).where(eq(s.quote.id, old!.id))).rejects.toThrow();
    await expect(testDb.first.db.update(s.quote).set({ acceptedAt: null }).where(eq(s.quote.id, old!.id))).rejects.toThrow();
  });
  it('TC-019: expired quote is rejected before reservation and nonce allocation', async () => {
    const f = await fixture(testDb.first, { expiredQuote: true });
    await expect(acceptQuote(testDb.first, acceptInput(f))).rejects.toThrow('QUOTE_EXPIRED');
    const [a] = await testDb.first.db.select().from(s.agent).where(eq(s.agent.id, f.agent.id));
    expect(a!.lastNonce).toBe('0');
  });
  it('rolls back nonce/reservation/attempt together on a downstream SQL failure', async () => {
    const f = await fixture(testDb.first);
    // A collision in the operation-derived key occurs after reservation updates.
    const existing = await fixture(testDb.first);
    const a = await acceptQuote(testDb.first, acceptInput(existing));
    await expect(acceptQuote(testDb.first, acceptInput(f), () => a.operationId)).rejects.toThrow();
    const [run] = await testDb.first.db.select().from(s.agentRun).where(eq(s.agentRun.id, f.run.id));
    const [agent] = await testDb.first.db.select().from(s.agent).where(eq(s.agent.id, f.agent.id));
    expect(run!.reservedStroops).toBe('0'); expect(agent!.lastNonce).toBe('0');
  });
  it('TC-010: unknown/manual review remain active and retain budget', async () => {
    const f = await fixture(testDb.first);
    const a = await acceptQuote(testDb.first, acceptInput(f));
    await testDb.first.db.update(s.paymentAttempt).set({ status: 'unknown' }).where(eq(s.paymentAttempt.id, a.id));
    const q2 = await createQuote(testDb.first, { ...acceptInput(f), resourceId: f.resource.id });
    await expect(acceptQuote(testDb.second, { ...acceptInput(f), quoteId: q2.id, clientKey: randomUUID() })).rejects.toThrow('OPERATION_ACTIVE');
    await testDb.first.db.update(s.paymentAttempt).set({ status: 'manual_review' }).where(eq(s.paymentAttempt.id, a.id));
    await expect(acceptQuote(testDb.second, { ...acceptInput(f), quoteId: q2.id, clientKey: randomUUID() })).rejects.toThrow('OPERATION_ACTIVE');
    const [run] = await testDb.first.db.select().from(s.agentRun).where(eq(s.agentRun.id, f.run.id));
    expect(run!.reservedStroops).toBe('300000');
  });
  it('TC-011: matching internal proof grants once, converts reservation, and cannot regress', async () => {
    const f = await fixture(testDb.first);
    const a = await acceptQuote(testDb.first, acceptInput(f));
    const proof = await observedProof(testDb.first, f, a);
    const receiptHash = createHash('sha256').update(randomUUID()).digest('hex');
    const grants = await Promise.all(Array.from({ length: 20 }, (_, i) => attachVerifiedEvidence(i % 2 ? testDb.first : testDb.second, proof, () => receiptHash)));
    expect(new Set(grants.map(g => g.id)).size).toBe(1);
    const [run] = await testDb.first.db.select().from(s.agentRun).where(eq(s.agentRun.id, f.run.id));
    expect(run!.reservedStroops).toBe('0'); expect(run!.spentStroops).toBe('300000');
    await expect(testDb.first.db.update(s.paymentAttempt).set({ status: 'unknown' }).where(eq(s.paymentAttempt.id, a.id))).rejects.toThrow();
    await expect(testDb.first.db.update(s.paymentAttempt).set({ veloStatus: 'pending' }).where(eq(s.paymentAttempt.id, a.id))).rejects.toThrow();
    await expect(testDb.first.db.update(s.paymentEvidence).set({ amountStroops: '1' })).rejects.toThrow();
  });
  it.each(['amountStroops', 'nonce', 'agentPublicKey', 'deviceHash', 'merchantAddress', 'assetContractId', 'contractId', 'innerHash', 'operationId', 'veloRequestId', 'observedEventTxHash', 'network'] as const)('rejects mismatched evidence field %s without fulfillment', async field => {
    const f = await fixture(testDb.first);
    const a = await acceptQuote(testDb.first, acceptInput(f));
    const proof = await observedProof(testDb.first, f, a);
    const foreign = await fixture(testDb.first);
    const substitutions = {
      amountStroops: '2', nonce: '2', agentPublicKey: foreign.agent.publicKey, deviceHash: foreign.agent.deviceHash,
      merchantAddress: foreign.merchant.walletAddress, assetContractId: foreign.agent.assetContractId, contractId: foreign.agent.escrowContractId,
      innerHash: 'a'.repeat(64), operationId: randomUUID(), veloRequestId: 'synthetic-foreign-request',
      observedEventTxHash: 'b'.repeat(64), network: 'mainnet',
    };
    const altered = { ...proof, [field]: substitutions[field] };
    await expect(attachVerifiedEvidence(testDb.first, altered, () => 'f'.repeat(64))).rejects.toThrow();
    const rows = await testDb.first.db.select().from(s.paymentEvidence).where(eq(s.paymentEvidence.attemptId, a.id));
    expect(rows).toHaveLength(0);
  });
  it('rejects Velo-only, chain-only or unsuccessful proof', async () => {
    const f = await fixture(testDb.first);
    const a = await acceptQuote(testDb.first, acceptInput(f));
    const proof = await observedProof(testDb.first, f, a);
    for (const altered of [{ ...proof, veloStatus: 'pending' }, { ...proof, chainSucceeded: false }]) {
      await expect(attachVerifiedEvidence(testDb.first, altered, () => 'a'.repeat(64))).rejects.toThrow();
    }
  });
  it('nonce persists on a fresh connection pool and is strictly increasing after completion', async () => {
    const f = await fixture(testDb.first);
    const a = await acceptQuote(testDb.first, acceptInput(f));
    await attachVerifiedEvidence(testDb.first, await observedProof(testDb.first, f, a), () => 'b'.repeat(64));
    const fresh = createStore(process.env.TEST_DATABASE_URL!, testDb.schemaName);
    try {
      const q2 = await createQuote(fresh, { ...acceptInput(f), resourceId: f.resource.id });
      const b = await acceptQuote(fresh, { ...acceptInput(f), quoteId: q2.id, clientKey: randomUUID() });
      expect(b.nonce).toBe('2');
    } finally { await fresh.close(); }
  });
  it('rejects foreign owner/run/agent and changed policy/snapshot before reservation', async () => {
    const f = await fixture(testDb.first), other = await fixture(testDb.first);
    for (const override of [{ ownerId: other.owner.id }, { runId: other.run.id }, { agentId: other.agent.id }]) {
      await expect(acceptQuote(testDb.first, { ...acceptInput(f), ...override })).rejects.toThrow('NOT_FOUND');
    }
    await testDb.first.db.update(s.agent).set({ status: 'unprovisioned', policyObservedLedger: null }).where(eq(s.agent.id, f.agent.id));
    await expect(acceptQuote(testDb.first, acceptInput(f))).rejects.toThrow('POLICY_NOT_READY');
  });
  it('SQL constraints reject bypassed amount, nonce, role, cross-owner and duplicate job writes', async () => {
    const f = await fixture(testDb.first);
    await expect(testDb.first.db.update(s.agentRun).set({ reservedStroops: '1000001' }).where(eq(s.agentRun.id, f.run.id))).rejects.toThrow();
    await expect(testDb.first.db.update(s.agent).set({ lastNonce: '18446744073709551616' }).where(eq(s.agent.id, f.agent.id))).rejects.toThrow();
    await expect(testDb.first.db.update(s.resource).set({ priceStroops: '-1' }).where(eq(s.resource.id, f.resource.id))).rejects.toThrow();
    await expect(testDb.first.db.insert(s.session).values({ id: randomUUID(), tokenHash: 'c'.repeat(64), role: 'merchant', ownerId: f.owner.id, expiresAt: new Date(Date.now() + 10000) })).rejects.toThrow();
    const other = await fixture(testDb.first);
    await expect(testDb.first.db.update(s.quote).set({ ownerId: other.owner.id }).where(eq(s.quote.id, f.quote.id))).rejects.toThrow();
    await expect(testDb.first.db.insert(s.job).values({ id: randomUUID(), kind: 'run', entityId: f.run.id })).rejects.toThrow();
    await expect(testDb.first.db.execute(sql`update agent_run set status = 'made_up' where id = ${f.run.id}`)).rejects.toThrow();
  });
  it('SQL prevents evidence/entitlement bypass with foreign or nonmatching context', async () => {
    const f = await fixture(testDb.first), other = await fixture(testDb.first);
    const a = await acceptQuote(testDb.first, acceptInput(f));
    const grant = await attachVerifiedEvidence(testDb.first, await observedProof(testDb.first, f, a), () => 'd'.repeat(64));
    await expect(testDb.first.db.insert(s.entitlement).values({ ...grant, id: randomUUID(), quoteId: other.quote.id, ownerId: other.owner.id, receiptTokenHash: 'e'.repeat(64) })).rejects.toThrow();
  });
  it('nonce is never recycled after a definitive pre-handoff refusal', async () => {
    const f = await fixture(testDb.first);
    const input = acceptInput(f);
    const a = await acceptQuote(testDb.first, input);
    await refuseBeforeHandoff(testDb.first, { ...input, attemptId: a.id }, 'refused');
    expect((await acceptQuote(testDb.second, input)).id).toBe(a.id);
    const q2 = await createQuote(testDb.second, { ...input, resourceId: f.resource.id });
    const b = await acceptQuote(testDb.second, { ...input, quoteId: q2.id, clientKey: randomUUID() });
    expect(b.nonce).toBe('2');
    await expect(testDb.first.db.update(s.agent).set({ lastNonce: '0' }).where(eq(s.agent.id, f.agent.id))).rejects.toThrow();
  });
  it('refuses to release held budget or prepare again after a committed handoff', async () => {
    const f = await fixture(testDb.first);
    const input = acceptInput(f), a = await acceptQuote(testDb.first, input);
    await observedProof(testDb.first, f, a);
    await testDb.first.db.update(s.paymentAttempt).set({ status: 'unknown' }).where(eq(s.paymentAttempt.id, a.id));
    await expect(refuseBeforeHandoff(testDb.first, { ...input, attemptId: a.id }, 'refused')).rejects.toThrow('OPERATION_UNRESOLVED');
    await expect(testDb.first.db.update(s.paymentAttempt).set({ status: 'preparing' }).where(eq(s.paymentAttempt.id, a.id))).rejects.toThrow();
    await expect(testDb.first.db.update(s.agentRun).set({ reservedStroops: '0' }).where(eq(s.agentRun.id, f.run.id))).rejects.toThrow();
  });
  it('late verification after timely handoff grants the original terms and normal window', async () => {
    const f = await fixture(testDb.first, { quoteTtlMs: 5000 });
    const a = await acceptQuote(testDb.first, acceptInput(f));
    const proof = await observedProof(testDb.first, f, a);
    await testDb.first.db.execute(sql`select pg_sleep(greatest(0, extract(epoch from ${f.quote.expiresAt}::timestamptz - clock_timestamp())) + 0.05)`);
    const grant = await attachVerifiedEvidence(testDb.first, proof, () => '1'.repeat(64));
    expect(grant.validUntil.getTime() - grant.createdAt.getTime()).toBe(900000);
    expect(grant.createdAt.getTime()).toBeGreaterThan(f.quote.expiresAt.getTime());
  });
  it('enforces run retry identity and one active run under independent connections', async () => {
    const f = await fixture(testDb.first);
    const input = { ownerId: f.owner.id, agentId: f.agent.id, runStartKey: f.run.runStartKey, task: f.run.taskText, modelId: f.run.modelId };
    const results = await Promise.all([createRun(testDb.first, input), createRun(testDb.second, input)]);
    expect(results.map(r => r.id)).toEqual([f.run.id, f.run.id]);
    await expect(createRun(testDb.first, { ...input, task: 'Changed task' })).rejects.toThrow('IDEMPOTENCY_CONFLICT');
    await expect(createRun(testDb.first, { ...input, runStartKey: randomUUID() })).rejects.toThrow('RUN_ACTIVE');
  });
  it('checks budget after previous spend, current cap, allowlist and policy expiry', async () => {
    const f = await fixture(testDb.first, { budget: '500000' });
    const a = await acceptQuote(testDb.first, acceptInput(f));
    await attachVerifiedEvidence(testDb.first, await observedProof(testDb.first, f, a), () => '2'.repeat(64));
    const q2 = await createQuote(testDb.first, { ...acceptInput(f), resourceId: f.resource.id });
    const input = { ...acceptInput(f), quoteId: q2.id };
    await expect(acceptQuote(testDb.first, input)).rejects.toThrow('BUDGET_EXCEEDED');
    await testDb.first.db.update(s.agent).set({ policyMaxStroops: '200000' }).where(eq(s.agent.id, f.agent.id));
    await expect(acceptQuote(testDb.first, input)).rejects.toThrow('POLICY_REFUSED');
    await testDb.first.db.update(s.merchant).set({ allowlisted: false }).where(eq(s.merchant.id, f.merchant.id));
    await expect(acceptQuote(testDb.first, input)).rejects.toThrow('MERCHANT_NOT_ALLOWED');
    await testDb.first.db.update(s.agent).set({ policyExpiresAt: new Date(0) }).where(eq(s.agent.id, f.agent.id));
    await expect(acceptQuote(testDb.first, input)).rejects.toThrow('POLICY_NOT_READY');
  });
  it('rejects SQL fractional/overflow values, invalid hash/status and unauthorized paid state', async () => {
    const f = await fixture(testDb.first);
    for (const price of ['0.1', '170141183460469231731687303715884105728']) {
      await expect(testDb.first.db.update(s.resource).set({ priceStroops: price }).where(eq(s.resource.id, f.resource.id))).rejects.toThrow();
    }
    await expect(testDb.first.db.update(s.agent).set({ lastNonce: '1.1' }).where(eq(s.agent.id, f.agent.id))).rejects.toThrow();
    const a = await acceptQuote(testDb.first, acceptInput(f));
    await expect(testDb.first.db.update(s.paymentAttempt).set({ innerHash: 'invalid' }).where(eq(s.paymentAttempt.id, a.id))).rejects.toThrow();
    await expect(testDb.first.db.update(s.paymentAttempt).set({ status: 'authorized' }).where(eq(s.paymentAttempt.id, a.id))).rejects.toThrow();
    await expect(testDb.first.db.update(s.quote).set({ status: 'paid' }).where(eq(s.quote.id, f.quote.id))).rejects.toThrow();
  });
  it('stores full i128 maximum exactly and never coerces it to a JS number', async () => {
    const f = await fixture(testDb.first);
    const maximum = '170141183460469231731687303715884105727';
    await testDb.first.db.update(s.resource).set({ priceStroops: maximum }).where(eq(s.resource.id, f.resource.id));
    const q = await createQuote(testDb.first, { ...acceptInput(f), resourceId: f.resource.id });
    expect(q.amountStroops).toBe(maximum);
    await expect(acceptQuote(testDb.first, { ...acceptInput(f), quoteId: q.id })).rejects.toThrow('POLICY_REFUSED');
  });
  it('fee conflicts remain unavailable and entitlement context stays immutable', async () => {
    const f = await fixture(testDb.first), a = await acceptQuote(testDb.first, acceptInput(f));
    const proof = { ...await observedProof(testDb.first, f, a), outerLedgerFeeStroops: '123', veloActualFeeStroops: '124' };
    const grant = await attachVerifiedEvidence(testDb.first, proof, () => '3'.repeat(64));
    const [evidence] = await testDb.first.db.select().from(s.paymentEvidence).where(eq(s.paymentEvidence.id, grant.evidenceId));
    expect(evidence!.actualFeeStroops).toBeNull(); expect(evidence!.feeProvenance).toBe('unavailable');
    await expect(testDb.first.db.update(s.entitlement).set({ validUntil: new Date(Date.now() + 9999999) }).where(eq(s.entitlement.id, grant.id))).rejects.toThrow();
    await expect(attachVerifiedEvidence(testDb.first, { ...proof, noirEventId: 'synthetic-changed-event' }, () => '3'.repeat(64))).rejects.toThrow('EVIDENCE_CONFLICT');
  });
  it('seeds only configured identities and two metadata offers; second seed preserves edits and policy', async () => {
    const f = await fixture(testDb.first);
    // Use configured public-only identities; seed must never claim policy observation.
    const config = { ownerAddress: f.owner.walletAddress, agentAddress: f.agent.publicKey, merchantAddress: f.merchant.walletAddress, deviceHash: f.agent.deviceHash, deviceContractId: f.agent.deviceContractId, agentContractId: f.agent.agentContractId, escrowContractId: f.agent.escrowContractId, assetContractId: f.agent.assetContractId };
    const result = await seedDemo(testDb.first, config);
    await testDb.first.db.update(s.resource).set({ priceStroops: '400000' }).where(eq(s.resource.resourceKey, 'quick-signal:demo-parser:v1'));
    await seedDemo(testDb.second, config);
    const [offer] = await testDb.first.db.select().from(s.resource).where(eq(s.resource.resourceKey, 'quick-signal:demo-parser:v1'));
    expect(offer!.priceStroops).toBe('400000'); expect(result.offers).toBe(2);
    const [agent] = await testDb.first.db.select().from(s.agent).where(eq(s.agent.id, f.agent.id));
    expect(agent!.status).toBe('active'); // existing real state must not be reset
    // A fresh configured key is always unprovisioned, with no fabricated observation.
    const freshConfig = { ...config, agentAddress: StrKey.encodeEd25519PublicKey(randomBytes(32)), deviceHash: randomBytes(32).toString('hex') };
    await seedDemo(testDb.first, freshConfig);
    const [fresh] = await testDb.first.db.select().from(s.agent).where(eq(s.agent.publicKey, freshConfig.agentAddress));
    expect(fresh!.status).toBe('unprovisioned'); expect(fresh!.policyObservedLedger).toBeNull();
    expect(fresh!.lastNonce).toBe('0'); expect(fresh!.policyMaxStroops).toBe('0');
    const runs = await testDb.first.db.select().from(s.agentRun).where(eq(s.agentRun.agentId, fresh!.id));
    const attempts = await testDb.first.db.select().from(s.paymentAttempt).where(eq(s.paymentAttempt.agentId, fresh!.id));
    expect(runs).toHaveLength(0); expect(attempts).toHaveLength(0);
    await expect(createRun(testDb.first, { ownerId: fresh!.ownerId, agentId: fresh!.id, runStartKey: randomUUID(), task: 'Must not run before policy setup', modelId: 'synthetic-no-model' })).rejects.toThrow('POLICY_NOT_READY');
    await expect(seedDemo(testDb.first, { ...freshConfig, ownerAddress: StrKey.encodeEd25519PublicKey(randomBytes(32)) })).rejects.toThrow('SEED_IDENTITY_CONFLICT');
  });
  it('rejects forged worker-session scope, duplicate wallet operations and invalid job targets', async () => {
    const f = await fixture(testDb.first), other = await fixture(testDb.first);
    await expect(testDb.first.db.insert(s.session).values({ id: randomUUID(), tokenHash: randomBytes(32).toString('hex'), role: 'worker', ownerId: other.owner.id, runId: f.run.id, expiresAt: new Date(Date.now() + 60000) })).rejects.toThrow();
    const wallet = { id: randomUUID(), actorAddress: f.owner.walletAddress, role: 'owner', agentId: f.agent.id, operationKind: 'registerDevice', operationPayload: {}, unsignedBodyHash: randomBytes(32).toString('hex'), expiresAt: new Date(Date.now() + 60000), status: 'prepared' };
    await testDb.first.db.insert(s.walletOperation).values(wallet);
    await expect(testDb.second.db.insert(s.walletOperation).values({ ...wallet, id: randomUUID() })).rejects.toThrow();
    await expect(testDb.first.db.insert(s.job).values({ id: randomUUID(), kind: 'reconcile', entityId: f.run.id })).rejects.toThrow();
    await expect(testDb.first.db.insert(s.walletOperation).values({ ...wallet, id: randomUUID(), actorAddress: other.owner.walletAddress })).rejects.toThrow();
  });
  it('SQL active-attempt, nonce, evidence and entitlement uniqueness cannot be bypassed', async () => {
    const f = await fixture(testDb.first), a = await acceptQuote(testDb.first, acceptInput(f));
    const q2 = await createQuote(testDb.first, { ...acceptInput(f), resourceId: f.resource.id });
    // Bypass domain guards deliberately while respecting the insert prerequisites:
    // the partial unique index must still stop a second active operation.
    await expect(testDb.first.transaction(async db => {
      await db.update(s.agent).set({ lastNonce: '2' }).where(eq(s.agent.id, f.agent.id));
      await db.update(s.agentRun).set({ reservedStroops: '600000' }).where(eq(s.agentRun.id, f.run.id));
      await db.update(s.quote).set({ status: 'accepted', acceptedAt: new Date() }).where(eq(s.quote.id, q2.id));
      const operationId = randomUUID();
      await db.insert(s.paymentAttempt).values({ id: randomUUID(), ownerId: f.owner.id, agentId: f.agent.id, quoteId: q2.id, operationId, clientIdempotencyKey: randomUUID(), idempotencyKey: `aegispay:${operationId}`, nonce: '2', status: 'accepted' });
    })).rejects.toMatchObject({ cause: { code: '23505', constraint: 'one_active_attempt_per_agent' } });
    const grant = await attachVerifiedEvidence(testDb.first, await observedProof(testDb.first, f, a), () => randomBytes(32).toString('hex'));
    const [evidence] = await testDb.first.db.select().from(s.paymentEvidence).where(eq(s.paymentEvidence.id, grant.evidenceId));
    await expect(testDb.first.db.insert(s.paymentEvidence).values({ ...evidence!, id: randomUUID() })).rejects.toThrow();
    await expect(testDb.first.db.insert(s.entitlement).values({ ...grant, id: randomUUID() })).rejects.toThrow();
  });
  it('migrations are repeatable and detect edited applied SQL checksums', async () => {
    await Promise.all([migrate(testDb.first), migrate(testDb.second)]);
    const original = await testDb.first.pool.query<{ sha256: string }>("SELECT sha256 FROM schema_migration WHERE name = '0000_foundation.sql'");
    await testDb.first.pool.query("UPDATE schema_migration SET sha256 = $1 WHERE name = '0000_foundation.sql'", ['0'.repeat(64)]);
    await expect(migrate(testDb.second)).rejects.toThrow('MIGRATION_CHECKSUM_MISMATCH');
    await testDb.first.pool.query("UPDATE schema_migration SET sha256 = $1 WHERE name = '0000_foundation.sql'", [original.rows[0]!.sha256]);
    await migrate(testDb.first);
  });
});
