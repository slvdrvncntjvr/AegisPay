import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { and, eq, sql, type SQL } from 'drizzle-orm';
import type { GasApi, GasSubmitResult } from '@carts1024/velo-sdk';
import type { Store } from '../../../../src/server/db/connection.ts';
import * as s from '../../../../src/server/db/schema.ts';
import { assertWorkerFence, databaseTime, deny, DomainError, lockScope, refuseBeforeHandoff } from '../../../../src/server/domain/purchases.ts';
import { attachVerifiedEvidence, type ReceiptHashFactory, type VerifiedObservation } from '../../../../src/server/domain/evidence.ts';
import { validateReservation } from '../../../../src/server/integrations/velo.ts';
import { SpikeGuardError } from '../../../../src/server/integrations/noir.ts';

export interface PaymentAdapter {
  prepare(input: { quote: typeof s.quote.$inferSelect; attempt: typeof s.paymentAttempt.$inferSelect; agent: typeof s.agent.$inferSelect }): Promise<{ signedEnvelope: string; innerHash: string }>;
  gas: Pick<GasApi, 'sponsor' | 'submit' | 'getStatus'>;
  verify(input: { quote: typeof s.quote.$inferSelect; attempt: typeof s.paymentAttempt.$inferSelect; agent: typeof s.agent.$inferSelect; execution: GasSubmitResult }): Promise<VerifiedObservation>;
}
// Explicit recovery entrypoints cannot accidentally re-enter a financial path,
// even if a future executor edit weakens its handoff-branch check.
export function observationOnly(adapter: PaymentAdapter): PaymentAdapter {
  const forbidden = async (): Promise<never> => { throw new SpikeGuardError('OBSERVATION_ONLY'); };
  return { prepare: forbidden, verify: input => adapter.verify(input),
    gas: { getStatus: (identity, options) => adapter.gas.getStatus(identity, options), sponsor: forbidden, submit: forbidden } };
}
export function encryptionKey(value: string | undefined) {
  if (!value || !/^[A-Za-z0-9+/]{43}=$/.test(value)) deny('MISSING_ENVELOPE_ENCRYPTION_KEY');
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) deny('MISSING_ENVELOPE_ENCRYPTION_KEY');
  return key;
}
export function encryptEnvelope(envelope: string, operationId: string, key: Buffer) {
  const cipherIv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, cipherIv);
  cipher.setAAD(Buffer.from(operationId));
  return { signedXdrCiphertext: Buffer.concat([cipher.update(envelope, 'utf8'), cipher.final()]), cipherIv, cipherTag: cipher.getAuthTag(), encryptionKeyVersion: 'v1', signedXdrFingerprint: createHash('sha256').update(envelope).digest('hex') };
}
export function decryptEnvelope(row: typeof s.paymentAttempt.$inferSelect, key: Buffer) {
  if (!row.signedXdrCiphertext || !row.cipherIv || !row.cipherTag || row.encryptionKeyVersion !== 'v1') deny('ENVELOPE_UNAVAILABLE');
  const decipher = createDecipheriv('aes-256-gcm', key, row.cipherIv);
  decipher.setAAD(Buffer.from(row.operationId)); decipher.setAuthTag(row.cipherTag);
  const envelope = Buffer.concat([decipher.update(row.signedXdrCiphertext), decipher.final()]).toString('utf8');
  if (createHash('sha256').update(envelope).digest('hex') !== row.signedXdrFingerprint) deny('ENVELOPE_FINGERPRINT_MISMATCH');
  return envelope;
}
const wipe = { signedXdrCiphertext: null, cipherIv: null, cipherTag: null, encryptionKeyVersion: null };
const contradictions = new Set([
  'EXECUTION_IDENTITY_MISMATCH', 'FEE_BUMP_RESULT_MISMATCH', 'TRANSACTION_HASH_MISMATCH',
  'AGENT_SIGNATURE_MISMATCH', 'AUTHORIZATION_EVENT_MISMATCH', 'AUTHORIZATION_EVENT_NOT_IN_TRANSACTION',
  'INVALID_HANDOFF_TIME', 'INVOCATION_MISMATCH', 'UNEXPECTED_ENVELOPE', 'UNEXPECTED_OPERATION',
  'UNEXPECTED_AUTHORIZATION', 'INVALID_ENVELOPE', 'INVALID_FINANCIAL_INTEGER', 'TRANSACTION_EXPIRED',
  'EVIDENCE_CONTEXT_MISMATCH', 'EVIDENCE_CONFLICT', 'EVIDENCE_CLOCK_MISMATCH', 'BUDGET_RESERVATION_MISSING',
  'AMBIGUOUS_NOIR_EVENT', 'DEPLOYMENT_MISMATCH', 'NONCE_CONTINUITY_UNVERIFIED', 'HANDOFF_IDENTITY_MISSING',
  'RESERVATION_MISMATCH', 'ENVELOPE_FINGERPRINT_MISMATCH',
]);
export async function paymentSnapshot(store: Store, id: string) {
  const [row] = await store.db.select({ attempt: s.paymentAttempt, quote: s.quote, agent: s.agent }).from(s.paymentAttempt)
    .innerJoin(s.quote, eq(s.quote.id, s.paymentAttempt.quoteId)).innerJoin(s.agent, eq(s.agent.id, s.paymentAttempt.agentId)).where(eq(s.paymentAttempt.id, id));
  if (!row) deny('NOT_FOUND');
  return row;
}
// A lease allows work, never a second financial dispatch. The irreversible CAS
// marker remains authoritative even when a lease expires or the process dies.
export async function processPayment(store: Store, id: string, adapter: PaymentAdapter, key: Buffer, receiptHash: ReceiptHashFactory,
  fault?: (stage: string) => Promise<void>) {
  const token = randomUUID();
  let snapshot = await paymentSnapshot(store, id);
  if (['authorized', 'refused', 'expired', 'failed'].includes(snapshot.attempt.status)) return;
  if (snapshot.attempt.status === 'manual_review' && snapshot.attempt.errorCode === 'POST_HANDOFF_QUOTE_EXPIRED') return;
  const [lease] = await store.db.update(s.agent).set({ leaseOwner: token, leaseUntil: sql`clock_timestamp() + interval '120 seconds'` })
    .where(and(eq(s.agent.id, snapshot.agent.id), sql`(${s.agent.leaseUntil} IS NULL OR ${s.agent.leaseUntil} <= clock_timestamp())`)).returning({ id: s.agent.id });
  if (!lease) return;
  try {
    snapshot = await paymentSnapshot(store, id);
    if (['authorized', 'refused', 'expired', 'failed'].includes(snapshot.attempt.status)) return;
    if (snapshot.attempt.status === 'manual_review' && snapshot.attempt.errorCode === 'POST_HANDOFF_QUOTE_EXPIRED') return;
    const { quote, agent } = snapshot;
    const scope = { ownerId: quote.ownerId, agentId: agent.id, runId: quote.runId, quoteId: quote.id, attemptId: id };
    async function update(values: Partial<Omit<typeof s.paymentAttempt.$inferInsert, 'handoffCommittedAt'>> & { handoffCommittedAt?: Date | SQL }, expected: string) {
      const row = await store.transaction(async db => {
        const locked = await lockScope(db, scope);
        await assertWorkerFence(db, locked.agent, { leaseOwner: token });
        const [savedQuote] = await db.select().from(s.quote).where(eq(s.quote.id, quote.id)).for('update');
        const now = await databaseTime(db);
        if (values.handoffCommittedAt && (!savedQuote || savedQuote.expiresAt <= now)) deny('QUOTE_EXPIRED');
        const [changed] = await db.update(s.paymentAttempt).set({ ...values, updatedAt: sql`clock_timestamp()` }).where(and(eq(s.paymentAttempt.id, id), eq(s.paymentAttempt.status, expected))).returning();
        if (!changed) deny('LEASE_LOST');
        return changed;
      });
      snapshot.attempt = row;
      return row;
    }
    async function fresh() {
      const now = await databaseTime(store.db);
      if (quote.expiresAt <= now) { await refuseBeforeHandoff(store, scope, 'expired', { leaseOwner: token }); return false; }
      return true;
    }
    if (!snapshot.attempt.handoffCommittedAt) {
      if (snapshot.attempt.status === 'preparing') {
        // A crash may have signed without saving bytes. Conservatively stop;
        // signing a replacement with a new sequence would hide uncertainty.
        await update({ status: 'manual_review', errorCode: 'PREPARATION_INTERRUPTED', ...wipe }, 'preparing'); return;
      }
      if (['unknown', 'manual_review'].includes(snapshot.attempt.status)) return;
      if (!await fresh()) return;
      if (snapshot.attempt.status === 'accepted') {
        await update({ status: 'preparing' }, 'accepted');
        await fault?.('before_prepare');
        const prepared = await adapter.prepare(snapshot);
        await fault?.('after_sign_before_persist');
        if (!await fresh()) return;
        await update({ status: 'signed', innerHash: prepared.innerHash, ...encryptEnvelope(prepared.signedEnvelope, snapshot.attempt.operationId, key) }, 'preparing');
        await fault?.('after_envelope');
      }
      // Only the exact saved envelope may be recovered before first handoff.
      const envelope = decryptEnvelope(snapshot.attempt, key);
      if (snapshot.attempt.status === 'signed') await update({ status: 'sponsoring' }, 'signed');
      if (!snapshot.attempt.veloRequestId) {
        if (!await fresh()) return;
        const reservation = await adapter.gas.sponsor(envelope, { idempotencyKey: snapshot.attempt.idempotencyKey });
        await fault?.('after_reserve_before_persist');
        if (!await fresh()) return;
        const identity = validateReservation(reservation, { innerHash: snapshot.attempt.innerHash!, agent: quote.agentPublicKey, escrow: agent.escrowContractId, expiresAt: quote.expiresAt.getTime() });
        await update({ status: 'reserved', veloRequestId: identity.requestId, veloStatus: 'reserved' }, 'sponsoring');
        await fault?.('after_reservation');
      }
      if (!await fresh()) return;
      const identity = { requestId: snapshot.attempt.veloRequestId!, transactionHash: snapshot.attempt.innerHash! };
      await fault?.('before_handoff');
      // Separate durable reservation from exclusive financial handoff. SQL time
      // enforces expiry after every asynchronous wait, including fault injection.
      // update locks agent/run/quote before the status CAS, fencing ownership
      // and quote expiry in the same transaction as the irreversible marker.
      await update({ status: 'submitting', handoffCommittedAt: sql`clock_timestamp()`, ...wipe }, 'reserved');
      await fault?.('after_handoff_before_send');
      const readStarted = performance.now();
      const [ownership] = await store.db.select({ leaseOwner: s.agent.leaseOwner, leaseUntil: s.agent.leaseUntil,
        observedAt: sql<Date>`clock_timestamp()` }).from(s.agent).where(eq(s.agent.id, agent.id)).for('share');
      // Bound DB time conservatively by the entire monotonic read duration,
      // including pool/lock/network delay after the server sampled its clock.
      // There are no application awaits between the final decision and submit.
      const dispatchTime = ownership ? new Date(ownership.observedAt).getTime() + Math.ceil(performance.now() - readStarted) : Infinity;
      if (!ownership || ownership.leaseOwner !== token || !ownership.leaseUntil || ownership.leaseUntil.getTime() <= dispatchTime) deny('LEASE_LOST');
      if (quote.expiresAt.getTime() <= dispatchTime) {
        await update({ status: 'manual_review', errorCode: 'POST_HANDOFF_QUOTE_EXPIRED' }, 'submitting');
        return; // retain marker and budget; operator review, never redispatch
      }
      const result = await adapter.gas.submit({ ...identity, transactionXdr: envelope }, { maxRetries: 0 });
      await fault?.('after_submit');
      await update({ status: 'submitted', veloStatus: result.status, outerHash: result.outerTransactionHash ?? null }, 'submitting');
    }
    snapshot = await paymentSnapshot(store, id);
    if (!snapshot.attempt.handoffCommittedAt) return;
    if (!snapshot.attempt.veloRequestId || !snapshot.attempt.innerHash) deny('HANDOFF_IDENTITY_MISSING');
    const execution = await adapter.gas.getStatus({ requestId: snapshot.attempt.veloRequestId, transactionHash: snapshot.attempt.innerHash });
    if (execution.requestId !== snapshot.attempt.veloRequestId || execution.transactionHash !== snapshot.attempt.innerHash || snapshot.attempt.outerHash && execution.outerTransactionHash && execution.outerTransactionHash !== snapshot.attempt.outerHash) deny('EXECUTION_IDENTITY_MISMATCH');
    if (execution.status !== 'succeeded' || execution.reconciliationRequired || !execution.outerTransactionHash) {
      // Provider-only failure is insufficient to release held budget. Chain
      // absence is not definitive non-success, so retain the original identity.
      if (snapshot.attempt.status !== 'manual_review') await update({ status: 'unknown', veloStatus: execution.status, errorCode: 'PAYMENT_STATUS_UNKNOWN' }, snapshot.attempt.status);
      return;
    }
    await update({ veloStatus: execution.status, outerHash: execution.outerTransactionHash }, snapshot.attempt.status);
    const proof = await adapter.verify({ ...snapshot, execution });
    await fault?.('before_grant');
    await attachVerifiedEvidence(store, proof, receiptHash, { leaseOwner: token });
  } catch (error) {
    const current = await paymentSnapshot(store, id);
    // Only deterministic guards that occur before signing are releasable. An
    // interrupted prepare stays held because signature persistence is uncertain.
    const scope = { ownerId: current.quote.ownerId, agentId: current.agent.id, runId: current.quote.runId, quoteId: current.quote.id, attemptId: id };
    try {
      if ((error instanceof SpikeGuardError || error instanceof DomainError) && contradictions.has(error.code) && !['authorized','refused','expired','failed'].includes(current.attempt.status)) {
        await store.transaction(async db => {
          const locked = await lockScope(db, scope);
          await assertWorkerFence(db, locked.agent, { leaseOwner: token });
          await db.update(s.paymentAttempt).set({ status: 'manual_review', errorCode: 'PAYMENT_EVIDENCE_CONTRADICTION', updatedAt: sql`clock_timestamp()` })
            .where(and(eq(s.paymentAttempt.id, id), eq(s.paymentAttempt.status, current.attempt.status)));
        });
      } else if (!current.attempt.handoffCommittedAt && (error instanceof SpikeGuardError || error instanceof DomainError) && ['POLICY_REFUSED', 'POLICY_NOT_READY', 'QUOTE_EXPIRED'].includes(error.code)) {
        await refuseBeforeHandoff(store, scope, error.code === 'QUOTE_EXPIRED' ? 'expired' : 'refused', { leaseOwner: token });
      } else if (!['authorized','refused','expired','failed','manual_review'].includes(current.attempt.status)) {
        await store.transaction(async db => {
          const locked = await lockScope(db, scope);
          await assertWorkerFence(db, locked.agent, { leaseOwner: token });
          // Safe fixed code only; never serialize the SDK/provider exception.
          await db.update(s.paymentAttempt).set({ status: current.attempt.handoffCommittedAt ? 'unknown' : current.attempt.status, errorCode: 'PAYMENT_OBSERVATION_UNAVAILABLE', updatedAt: sql`clock_timestamp()` }).where(and(eq(s.paymentAttempt.id, id), eq(s.paymentAttempt.status, current.attempt.status)));
        });
      }
    } catch { /* Lost ownership may not mutate the operation. */ }
    if (fault) throw error; // explicit crash-injection test gets the failure
  } finally {
    await store.db.update(s.agent).set({ leaseOwner: null, leaseUntil: null }).where(and(eq(s.agent.id, snapshot.agent.id), eq(s.agent.leaseOwner, token)));
  }
}
