import { createHash, randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { amountSchema, MAX_NONCE, uuidSchema } from '@aegispay/shared';
import type { Database, Store } from '../db/connection.js';
import * as s from '../db/schema.js';

export interface Scope { ownerId: string; agentId: string; runId: string }
export interface AcceptInput extends Scope { quoteId: string; clientKey: string }
export class DomainError extends Error { constructor(readonly code: string) { super(code); } }
export function deny(code: string): never { throw new DomainError(code); }
export async function databaseTime(db: Database): Promise<Date> {
  const result = await db.execute<{ now: Date }>(sql`select clock_timestamp() as now`);
  return new Date(result.rows[0]!.now);
}
function validateScope(scope: Scope) { for (const value of [scope.ownerId, scope.agentId, scope.runId]) uuidSchema.parse(value); }

// All financial callers share the canonical agent -> run -> quote -> attempt order.
export async function lockScope(db: Database, scope: Scope) {
  validateScope(scope);
  const [agent] = await db.select().from(s.agent).where(and(eq(s.agent.id, scope.agentId), eq(s.agent.ownerId, scope.ownerId))).for('update');
  if (!agent) deny('NOT_FOUND');
  const [run] = await db.select().from(s.agentRun).where(and(eq(s.agentRun.id, scope.runId), eq(s.agentRun.agentId, agent.id), eq(s.agentRun.ownerId, scope.ownerId))).for('update');
  if (!run) deny('NOT_FOUND');
  return { agent, run };
}
function assertReady(agent: typeof s.agent.$inferSelect, now: Date) {
  if (agent.status !== 'active' || agent.policyObservedLedger === null || BigInt(agent.policyMaxStroops) <= 0n || agent.policyExpiresAt <= now || agent.network !== 'testnet') deny('POLICY_NOT_READY');
}
type Terms = Pick<typeof s.quote.$inferSelect, 'id' | 'resourceId' | 'ownerId' | 'agentId' | 'runId' | 'merchantId' | 'resourceKey' | 'fixtureVersion' | 'merchantAddress' | 'amountStroops' | 'assetContractId' | 'network' | 'deviceHash' | 'agentPublicKey' | 'expiresAt'>;
export function quoteTermsHash(q: Terms): string {
  const canonical = [q.id, q.resourceId, q.ownerId, q.agentId, q.runId, q.merchantId, q.resourceKey, q.fixtureVersion,
    q.merchantAddress, q.amountStroops, q.assetContractId, q.network, q.deviceHash, q.agentPublicKey, q.expiresAt.toISOString()];
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
export async function createRun(store: Store, input: { ownerId: string; agentId: string; runStartKey: string; task: string; modelId: string; budgetStroops?: string }) {
  uuidSchema.parse(input.ownerId); uuidSchema.parse(input.agentId); uuidSchema.parse(input.runStartKey);
  const budget = amountSchema.parse(input.budgetStroops ?? '1000000');
  if (BigInt(budget) > 1000000n || !input.task.trim() || input.task.length > 2000 || !input.modelId.trim()) deny('INVALID_RUN');
  return store.transaction(async db => {
    const [agent] = await db.select().from(s.agent).where(and(eq(s.agent.id, input.agentId), eq(s.agent.ownerId, input.ownerId))).for('update');
    if (!agent) deny('NOT_FOUND');
    const [existing] = await db.select().from(s.agentRun).where(and(eq(s.agentRun.ownerId, input.ownerId), eq(s.agentRun.runStartKey, input.runStartKey)));
    if (existing) {
      if (existing.agentId !== input.agentId || existing.taskText !== input.task || existing.budgetStroops !== budget || existing.modelId !== input.modelId) deny('IDEMPOTENCY_CONFLICT');
      return existing;
    }
    assertReady(agent, await databaseTime(db));
    const [active] = await db.select({ id: s.agentRun.id }).from(s.agentRun).where(and(eq(s.agentRun.agentId, agent.id), sql`${s.agentRun.status} IN ('queued','running','waiting_payment')`));
    if (active) deny('RUN_ACTIVE');
    const [run] = await db.insert(s.agentRun).values({ id: randomUUID(), ownerId: input.ownerId, agentId: agent.id, runStartKey: input.runStartKey, status: 'queued', taskText: input.task, budgetStroops: budget, modelId: input.modelId }).returning();
    await db.insert(s.job).values({ id: randomUUID(), kind: 'run', entityId: run!.id });
    return run!;
  });
}
export async function createQuote(store: Store, input: Scope & { resourceId: string }) {
  uuidSchema.parse(input.resourceId);
  return store.transaction(async db => {
    const { agent, run } = await lockScope(db, input);
    if (!['queued', 'running', 'waiting_payment'].includes(run.status)) deny('RUN_NOT_ACTIVE');
    const [resource] = await db.select().from(s.resource).where(eq(s.resource.id, input.resourceId)).for('share');
    if (!resource || !resource.enabled) deny('NOT_FOUND');
    const [merchant] = await db.select().from(s.merchant).where(eq(s.merchant.id, resource.merchantId)).for('share');
    if (!merchant?.allowlisted) deny('MERCHANT_NOT_ALLOWED');
    if (resource.assetContractId !== agent.assetContractId) deny('CONTRACT_MISMATCH');
    const now = await databaseTime(db);
    const terms = {
      id: randomUUID(), resourceId: resource.id, ownerId: input.ownerId, agentId: agent.id, runId: run.id, merchantId: merchant.id,
      resourceKey: resource.resourceKey, fixtureVersion: resource.fixtureVersion, merchantAddress: merchant.walletAddress, amountStroops: resource.priceStroops,
      assetContractId: resource.assetContractId, network: agent.network, deviceHash: agent.deviceHash, agentPublicKey: agent.publicKey,
      expiresAt: new Date(now.getTime() + 120000),
    };
    const [quote] = await db.insert(s.quote).values({ ...terms, termsHash: quoteTermsHash(terms), createdAt: now, status: 'open' }).returning();
    return quote!;
  });
}
export async function acceptQuote(store: Store, input: AcceptInput, operationId: () => string = randomUUID) {
  uuidSchema.parse(input.quoteId); uuidSchema.parse(input.clientKey);
  return store.transaction(async db => {
    const { agent, run } = await lockScope(db, input);
    const [quote] = await db.select().from(s.quote).where(and(eq(s.quote.id, input.quoteId), eq(s.quote.ownerId, input.ownerId), eq(s.quote.agentId, agent.id), eq(s.quote.runId, run.id))).for('update');
    if (!quote) deny('NOT_FOUND');
    const [keyBinding] = await db.select().from(s.paymentAcceptKey).where(and(eq(s.paymentAcceptKey.ownerId, input.ownerId), eq(s.paymentAcceptKey.clientKey, input.clientKey)));
    if (keyBinding && keyBinding.quoteId !== quote.id) deny('IDEMPOTENCY_CONFLICT');
    const [existing] = await db.select().from(s.paymentAttempt).where(eq(s.paymentAttempt.quoteId, quote.id)).for('update');
    if (existing) {
      if (existing.ownerId !== input.ownerId || existing.agentId !== agent.id) deny('NOT_FOUND');
      if (!keyBinding) await db.insert(s.paymentAcceptKey).values({ id: randomUUID(), ownerId: input.ownerId, clientKey: input.clientKey, quoteId: quote.id, attemptId: existing.id });
      return existing;
    }
    const now = await databaseTime(db);
    if (quote.expiresAt <= now) deny('QUOTE_EXPIRED');
    if (quote.status !== 'open' || quote.acceptedAt !== null) deny('QUOTE_NOT_OPEN');
    if (!['queued', 'running', 'waiting_payment'].includes(run.status)) deny('RUN_NOT_ACTIVE');
    assertReady(agent, now);
    if (quote.termsHash !== quoteTermsHash(quote) || quote.network !== agent.network || quote.agentPublicKey !== agent.publicKey || quote.deviceHash !== agent.deviceHash || quote.assetContractId !== agent.assetContractId) deny('QUOTE_SNAPSHOT_MISMATCH');
    const [merchant] = await db.select().from(s.merchant).where(eq(s.merchant.id, quote.merchantId)).for('share');
    const [resource] = await db.select().from(s.resource).where(eq(s.resource.id, quote.resourceId)).for('share');
    if (!merchant?.allowlisted || merchant.walletAddress !== quote.merchantAddress) deny('MERCHANT_NOT_ALLOWED');
    if (!resource?.enabled || resource.merchantId !== merchant.id || resource.assetContractId !== quote.assetContractId) deny('QUOTE_SNAPSHOT_MISMATCH');
    const [active] = await db.select({ id: s.paymentAttempt.id }).from(s.paymentAttempt).where(and(eq(s.paymentAttempt.agentId, agent.id), sql`${s.paymentAttempt.status} NOT IN ('authorized','refused','expired','failed')`));
    if (active) deny('OPERATION_ACTIVE');
    const amount = BigInt(amountSchema.parse(quote.amountStroops));
    if (amount > BigInt(agent.policyMaxStroops)) deny('POLICY_REFUSED');
    if (BigInt(run.budgetStroops) - BigInt(run.spentStroops) - BigInt(run.reservedStroops) < amount) deny('BUDGET_EXCEEDED');
    const nextNonce = BigInt(agent.lastNonce) + 1n;
    if (nextNonce > MAX_NONCE) deny('NONCE_EXHAUSTED');
    const id = uuidSchema.parse(operationId());
    await db.update(s.agent).set({ lastNonce: nextNonce.toString() }).where(eq(s.agent.id, agent.id));
    await db.update(s.agentRun).set({ reservedStroops: (BigInt(run.reservedStroops) + amount).toString(), status: 'waiting_payment' }).where(eq(s.agentRun.id, run.id));
    await db.update(s.quote).set({ acceptedAt: now, status: 'accepted' }).where(and(eq(s.quote.id, quote.id), eq(s.quote.status, 'open')));
    const [attempt] = await db.insert(s.paymentAttempt).values({ id: randomUUID(), ownerId: input.ownerId, agentId: agent.id, quoteId: quote.id, operationId: id, clientIdempotencyKey: input.clientKey, idempotencyKey: `aegispay:${id}`, nonce: nextNonce.toString(), status: 'accepted' }).returning();
    await db.insert(s.paymentAcceptKey).values({ id: randomUUID(), ownerId: input.ownerId, clientKey: input.clientKey, quoteId: quote.id, attemptId: attempt!.id });
    await db.insert(s.job).values({ id: randomUUID(), kind: 'reconcile', entityId: attempt!.id });
    await db.insert(s.auditEvent).values({ actorKind: 'owner', actorId: input.ownerId, entityKind: 'attempt', entityId: attempt!.id, kind: 'budget_reserved', correlationId: id, safeMetadata: { quoteId: quote.id, amountStroops: quote.amountStroops, nonce: nextNonce.toString() } });
    return attempt!;
  });
}

// Definitive local refusal/expiry is not live contract enforcement. This helper
// cannot release an unresolved handoff; chain failure resolution is a later task.
export async function refuseBeforeHandoff(store: Store, input: Scope & { quoteId: string; attemptId: string }, status: 'refused' | 'expired') {
  return store.transaction(async db => {
    const { run } = await lockScope(db, input);
    const [quote] = await db.select().from(s.quote).where(and(eq(s.quote.id, input.quoteId), eq(s.quote.ownerId, input.ownerId), eq(s.quote.agentId, input.agentId), eq(s.quote.runId, input.runId))).for('update');
    if (!quote) deny('NOT_FOUND');
    const [attempt] = await db.select().from(s.paymentAttempt).where(and(eq(s.paymentAttempt.id, input.attemptId), eq(s.paymentAttempt.quoteId, quote.id))).for('update');
    if (!attempt) deny('NOT_FOUND');
    if (attempt.status === status) return attempt;
    if (attempt.handoffCommittedAt || !['accepted','preparing','signed','sponsoring','reserved'].includes(attempt.status)) deny('OPERATION_UNRESOLVED');
    if (status === 'expired' && quote.expiresAt > await databaseTime(db)) deny('QUOTE_NOT_EXPIRED');
    await db.update(s.agentRun).set({ reservedStroops: (BigInt(run.reservedStroops) - BigInt(quote.amountStroops)).toString(), status: 'running' }).where(eq(s.agentRun.id, run.id));
    await db.update(s.quote).set({ status }).where(eq(s.quote.id, quote.id));
    const [updated] = await db.update(s.paymentAttempt).set({ status, signedXdrCiphertext: null, cipherIv: null, cipherTag: null, encryptionKeyVersion: null, updatedAt: await databaseTime(db) }).where(eq(s.paymentAttempt.id, attempt.id)).returning();
    return updated!;
  });
}
