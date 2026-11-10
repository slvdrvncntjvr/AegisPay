// Server/worker only: no fixture or token reaches an unauthenticated response.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import type { Store } from '../db/connection.ts';
import * as s from '../db/schema.ts';
import { ownedRun, requireRole, type Principal } from '../auth/session.ts';
import { databaseTime, deny } from '../domain/purchases.ts';
import type { ReceiptContext } from '../domain/evidence.ts';
import { reportFixture } from './reports.ts';

export function receiptTokens(secret: string | undefined) {
  if (!secret || secret.length < 32) deny('MISSING_RECEIPT_SIGNING_KEY');
  // The immutable entitlement row binds this context to exactly one quote,
  // fixture and evidence. Recovery never creates or extends a read window.
  const token = (context: ReceiptContext) => createHmac('sha256', secret).update(JSON.stringify([
    'aegispay-402/1', context.id, context.ownerId, context.resourceKey, context.validUntil.toISOString(),
  ])).digest('base64url');
  return { token, hash: (context: ReceiptContext) => createHash('sha256').update(token(context)).digest('hex') };
}
export async function ownedReceipt(store: Store, actor: Principal, id: string) {
  requireRole(actor, ['owner', 'worker']);
  const [row] = await store.db.select({ grant: s.entitlement, quote: s.quote, evidence: s.paymentEvidence }).from(s.entitlement)
    .innerJoin(s.quote, eq(s.quote.id, s.entitlement.quoteId)).innerJoin(s.paymentEvidence, eq(s.paymentEvidence.id, s.entitlement.evidenceId))
    .where(and(eq(s.entitlement.id, id), eq(s.entitlement.ownerId, actor.ownerId!)));
  if (!row) deny('NOT_FOUND');
  await ownedRun(store, actor, row.quote.runId);
  return row;
}
export async function receiptMetadata(store: Store, actor: Principal, id: string, secret: string | undefined) {
  const row = await ownedReceipt(store, actor, id), now = await databaseTime(store.db);
  let aegisReceipt: string | null = null;
  if (row.grant.validUntil > now) {
    const tokens = receiptTokens(secret);
    if (tokens.hash(row.grant) !== row.grant.receiptTokenHash) deny('RECEIPT_INVALID');
    aegisReceipt = tokens.token(row.grant);
  }
  return { receiptId: row.grant.id, quoteId: row.quote.id, resourceKey: row.grant.resourceKey, fixtureVersion: row.grant.fixtureVersion,
    validUntil: row.grant.validUntil, evidence: row.evidence, aegisReceipt };
}
export async function readReceipt(store: Store, actor: Principal, id: string, secret: string | undefined, supplied?: string, expectedResource?: string) {
  const row = await ownedReceipt(store, actor, id);
  if (row.grant.validUntil <= await databaseTime(store.db)) deny('ENTITLEMENT_EXPIRED');
  if (expectedResource && row.grant.resourceKey !== expectedResource) deny('RESOURCE_MISMATCH');
  const expected = receiptTokens(secret).hash(row.grant);
  if (expected !== row.grant.receiptTokenHash) deny('RECEIPT_INVALID');
  if (supplied !== undefined && !timingSafeEqual(createHash('sha256').update(supplied).digest(), Buffer.from(expected, 'hex'))) deny('RECEIPT_INVALID');
  const report = reportFixture(row.grant.resourceKey, row.grant.fixtureVersion);
  // Check the window at delivery with DB time, including the first-delivery CAS.
  const [valid] = await store.db.update(s.entitlement).set({ firstDeliveredAt: sql`COALESCE(first_delivered_at, clock_timestamp())` })
    .where(and(eq(s.entitlement.id, id), sql`valid_until > clock_timestamp()`)).returning({ id: s.entitlement.id });
  if (!valid) deny('ENTITLEMENT_EXPIRED');
  return { isDemo: true, resourceKey: row.grant.resourceKey, report, receiptId: row.grant.id };
}
