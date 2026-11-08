// INTERNAL WORKER BOUNDARY. No HTTP proof ingestion route may call this with
// browser/model data. The existing independent SDK/RPC verifier must run first;
// this module binds its decoded result to the durable database operation.
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { accountSchema, contractSchema, amountSchema, nonceSchema, hashSchema, uuidSchema, unsignedAmountSchema } from '@aegispay/shared';
import type { Store } from '../db/connection.js';
import * as s from '../db/schema.js';
import { databaseTime, deny, lockScope } from './purchases.js';

const observationSchema = z.strictObject({
  ownerId: uuidSchema, agentId: uuidSchema, runId: uuidSchema, quoteId: uuidSchema, attemptId: uuidSchema,
  operationId: uuidSchema, veloRequestId: z.string().min(1).max(256), veloStatus: z.literal('succeeded'), chainSucceeded: z.literal(true),
  innerHash: hashSchema, outerHash: hashSchema.nullable(), observedEventTxHash: hashSchema, noirEventId: z.string().min(1).max(256),
  network: z.literal('testnet'), contractId: contractSchema, ledgerSequence: z.string().regex(/^[1-9][0-9]*$/).max(19).refine(v => BigInt(v) <= 9223372036854775807n),
  ledgerClosedAt: z.date(), agentPublicKey: accountSchema, deviceHash: hashSchema, merchantAddress: accountSchema, assetContractId: contractSchema,
  amountStroops: amountSchema, nonce: nonceSchema,
  outerLedgerFeeStroops: unsignedAmountSchema.nullable(), veloActualFeeStroops: unsignedAmountSchema.nullable(),
});
export type VerifiedObservation = z.infer<typeof observationSchema>;
export type ReceiptContext = { id: string; ownerId: string; resourceKey: string; validUntil: Date };
export type ReceiptHashFactory = (context: ReceiptContext) => string;

export async function attachVerifiedEvidence(store: Store, input: unknown, receiptHash: ReceiptHashFactory) {
  const proof = observationSchema.parse(input);
  return store.transaction(async db => {
    const { agent, run } = await lockScope(db, proof);
    const [quote] = await db.select().from(s.quote).where(and(eq(s.quote.id, proof.quoteId), eq(s.quote.ownerId, proof.ownerId), eq(s.quote.agentId, agent.id), eq(s.quote.runId, run.id))).for('update');
    if (!quote) deny('NOT_FOUND');
    const [attempt] = await db.select().from(s.paymentAttempt).where(and(eq(s.paymentAttempt.id, proof.attemptId), eq(s.paymentAttempt.quoteId, quote.id), eq(s.paymentAttempt.ownerId, proof.ownerId), eq(s.paymentAttempt.agentId, agent.id))).for('update');
    if (!attempt) deny('NOT_FOUND');
    if (attempt.operationId !== proof.operationId || attempt.veloRequestId !== proof.veloRequestId || attempt.innerHash !== proof.innerHash || attempt.outerHash !== proof.outerHash ||
        proof.contractId !== agent.escrowContractId || proof.network !== quote.network || proof.agentPublicKey !== quote.agentPublicKey ||
        proof.deviceHash !== quote.deviceHash || proof.merchantAddress !== quote.merchantAddress || proof.assetContractId !== quote.assetContractId ||
        proof.amountStroops !== quote.amountStroops || proof.nonce !== attempt.nonce || !attempt.handoffCommittedAt ||
        attempt.handoffCommittedAt >= quote.expiresAt || !quote.acceptedAt || attempt.handoffCommittedAt < quote.acceptedAt ||
        proof.ledgerClosedAt < attempt.handoffCommittedAt || ![proof.innerHash, proof.outerHash].includes(proof.observedEventTxHash)) deny('EVIDENCE_CONTEXT_MISMATCH');
    const digest = createHash('sha256').update(JSON.stringify(proof)).digest('hex');
    const [existingEvidence] = await db.select().from(s.paymentEvidence).where(eq(s.paymentEvidence.attemptId, attempt.id));
    if (existingEvidence) {
      if (attempt.status !== 'authorized' || existingEvidence.evidenceDigest !== digest) deny('EVIDENCE_CONFLICT');
      const [grant] = await db.select().from(s.entitlement).where(and(eq(s.entitlement.evidenceId, existingEvidence.id), eq(s.entitlement.quoteId, quote.id), eq(s.entitlement.ownerId, proof.ownerId)));
      if (!grant) deny('EVIDENCE_CONFLICT');
      return grant;
    }
    if (!['submitting', 'submitted', 'unknown', 'manual_review'].includes(attempt.status)) deny('ATTEMPT_NOT_HANDED_OFF');
    const verifiedAt = await databaseTime(db);
    if (proof.ledgerClosedAt > verifiedAt) deny('EVIDENCE_CLOCK_MISMATCH');
    // EQ-004: a conflict or missing source stays unavailable; fee is never payer spend.
    const matchedFee = proof.outerLedgerFeeStroops !== null && proof.veloActualFeeStroops !== null && proof.outerLedgerFeeStroops === proof.veloActualFeeStroops;
    await db.update(s.paymentAttempt).set({ veloStatus: 'succeeded', updatedAt: verifiedAt }).where(eq(s.paymentAttempt.id, attempt.id));
    const [evidence] = await db.insert(s.paymentEvidence).values({
      id: randomUUID(), attemptId: attempt.id, innerHash: proof.innerHash, outerHash: proof.outerHash,
      observedEventTxHash: proof.observedEventTxHash, noirEventId: proof.noirEventId, network: proof.network, contractId: proof.contractId,
      ledgerSequence: BigInt(proof.ledgerSequence), ledgerClosedAt: proof.ledgerClosedAt, agentPublicKey: proof.agentPublicKey,
      deviceHash: proof.deviceHash, merchantAddress: proof.merchantAddress, assetContractId: proof.assetContractId, amountStroops: proof.amountStroops, nonce: proof.nonce,
      actualFeeStroops: matchedFee ? proof.outerLedgerFeeStroops : null, feeProvenance: matchedFee ? 'outer_ledger_and_velo' : 'unavailable', evidenceDigest: digest, verifiedAt,
    }).returning();
    const context = { id: randomUUID(), ownerId: proof.ownerId, resourceKey: quote.resourceKey, validUntil: new Date(verifiedAt.getTime() + 900000) };
    const [grant] = await db.insert(s.entitlement).values({ ...context, quoteId: quote.id, evidenceId: evidence!.id, fixtureVersion: quote.fixtureVersion, receiptTokenHash: hashSchema.parse(receiptHash(context)), createdAt: verifiedAt }).returning();
    const amount = BigInt(quote.amountStroops);
    if (BigInt(run.reservedStroops) < amount) deny('BUDGET_RESERVATION_MISSING');
    await db.update(s.agentRun).set({ reservedStroops: (BigInt(run.reservedStroops) - amount).toString(), spentStroops: (BigInt(run.spentStroops) + amount).toString(), status: 'running' }).where(eq(s.agentRun.id, run.id));
    await db.update(s.paymentAttempt).set({ status: 'authorized', updatedAt: verifiedAt }).where(and(eq(s.paymentAttempt.id, attempt.id), eq(s.paymentAttempt.status, attempt.status)));
    await db.update(s.quote).set({ status: 'paid' }).where(eq(s.quote.id, quote.id));
    await db.insert(s.auditEvent).values({ actorKind: 'worker', actorId: agent.id, entityKind: 'attempt', entityId: attempt.id, kind: 'authorization_verified', correlationId: attempt.operationId, safeMetadata: { quoteId: quote.id, evidenceId: evidence!.id, innerHash: proof.innerHash } });
    return grant!;
  });
}
