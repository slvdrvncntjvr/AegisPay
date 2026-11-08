// Synthetic records live only in a UUID-owned PostgreSQL test schema. These are
// not live SDK observations and are never exported to docs/evidence/testnet.
import { randomUUID, randomBytes } from 'node:crypto';
import { StrKey } from '@stellar/stellar-sdk';
import { eq } from 'drizzle-orm';
import type { Store } from '../../../src/server/db/connection.js';
import * as s from '../../../src/server/db/schema.js';
import { createQuote, createRun, quoteTermsHash } from '../../../src/server/domain/purchases.js';
import type { VerifiedObservation } from '../../../src/server/domain/evidence.js';

const account = () => StrKey.encodeEd25519PublicKey(randomBytes(32));
const contract = () => StrKey.encodeContract(randomBytes(32));
export async function fixture(store: Store, options: { budget?: string; expiredQuote?: boolean; quoteTtlMs?: number } = {}) {
  const [owner] = await store.db.insert(s.owner).values({ id: randomUUID(), walletAddress: account() }).returning();
  const [merchant] = await store.db.insert(s.merchant).values({ id: randomUUID(), name: 'Synthetic test merchant', walletAddress: account() }).returning();
  const [agent] = await store.db.insert(s.agent).values({ id: randomUUID(), ownerId: owner!.id, publicKey: account(), deviceHash: randomBytes(32).toString('hex'), network: 'testnet', deviceContractId: contract(), agentContractId: contract(), escrowContractId: contract(), assetContractId: contract(), policyMaxStroops: '1000000', policyExpiresAt: new Date(Date.now() + 3600000), policyObservedLedger: 1n, status: 'active' }).returning();
  const [resource] = await store.db.insert(s.resource).values({ id: randomUUID(), merchantId: merchant!.id, resourceKey: `synthetic:${randomUUID()}`, routeSlug: randomUUID(), description: 'Test offer metadata only', priceStroops: '300000', assetContractId: agent!.assetContractId, fixtureVersion: 'v1', isDemo: true }).returning();
  const run = await createRun(store, { ownerId: owner!.id, agentId: agent!.id, runStartKey: randomUUID(), task: 'Synthetic fixture task', modelId: 'synthetic-no-model', budgetStroops: options.budget ?? '1000000' });
  const scope = { ownerId: owner!.id, agentId: agent!.id, runId: run.id, resourceId: resource!.id };
  let quote = await createQuote(store, scope);
  if (options.expiredQuote || options.quoteTtlMs) {
    const past = { ...quote, id: randomUUID(), createdAt: new Date(Date.now() - (options.expiredQuote ? 180000 : 0)), expiresAt: new Date(Date.now() + (options.expiredQuote ? -60000 : options.quoteTtlMs!)) };
    const [expired] = await store.db.insert(s.quote).values({ ...past, termsHash: quoteTermsHash(past) }).returning();
    quote = expired!;
  }
  return { owner: owner!, merchant: merchant!, agent: agent!, resource: resource!, run, quote };
}
export type Fixture = Awaited<ReturnType<typeof fixture>>;
export function acceptInput(f: Fixture) { return { ownerId: f.owner.id, agentId: f.agent.id, runId: f.run.id, quoteId: f.quote.id, clientKey: randomUUID() }; }
export async function observedProof(store: Store, f: Fixture, attempt: typeof s.paymentAttempt.$inferSelect): Promise<VerifiedObservation> {
  const innerHash = randomBytes(32).toString('hex'), outerHash = randomBytes(32).toString('hex');
  const veloRequestId = `synthetic-${randomUUID()}`;
  for (const status of ['preparing', 'signed', 'sponsoring', 'reserved']) {
    await store.db.update(s.paymentAttempt).set({ status }).where(eq(s.paymentAttempt.id, attempt.id));
  }
  await store.db.update(s.paymentAttempt).set({ status: 'submitting', innerHash, outerHash, veloRequestId, handoffCommittedAt: new Date() }).where(eq(s.paymentAttempt.id, attempt.id));
  return {
    ownerId: f.owner.id, agentId: f.agent.id, runId: f.run.id, quoteId: attempt.quoteId, attemptId: attempt.id, operationId: attempt.operationId,
    veloRequestId, veloStatus: 'succeeded', chainSucceeded: true, innerHash, outerHash, observedEventTxHash: outerHash,
    noirEventId: `synthetic-event-${randomUUID()}`, network: 'testnet', contractId: f.agent.escrowContractId, ledgerSequence: '1',
    ledgerClosedAt: new Date(), agentPublicKey: f.agent.publicKey, deviceHash: f.agent.deviceHash, merchantAddress: f.merchant.walletAddress,
    assetContractId: f.agent.assetContractId, amountStroops: f.quote.amountStroops, nonce: attempt.nonce, outerLedgerFeeStroops: null, veloActualFeeStroops: null,
  };
}
