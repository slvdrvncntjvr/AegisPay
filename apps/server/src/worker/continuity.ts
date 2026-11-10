import { and, eq, sql } from 'drizzle-orm';
import type { Store } from '../../../../src/server/db/connection.ts';
import * as s from '../../../../src/server/db/schema.ts';
import { deny } from '../../../../src/server/domain/purchases.ts';

// The pinned contract exposes no nonce getter. A new application spend requires
// its independently confirmed initial registration and complete local nonce
// history, rather than silently treating a historical spike device as unused.
export async function assertNonceContinuity(store: Store, agent: typeof s.agent.$inferSelect) {
  const [registration] = await store.db.select().from(s.walletOperation).where(and(
    eq(s.walletOperation.agentId, agent.id), eq(s.walletOperation.operationKind, 'registerDevice'), eq(s.walletOperation.status, 'confirmed'),
  ));
  if (!registration?.txHash || registration.operationPayload.deviceHash !== agent.deviceHash || registration.operationPayload.agentPublicKey !== agent.publicKey) deny('NONCE_CONTINUITY_UNVERIFIED');
  const result = await store.db.execute<{ count: string; maximum: string | null }>(sql`SELECT count(*)::text AS count, max(nonce)::text AS maximum FROM payment_attempt WHERE agent_id = ${agent.id}`);
  const history = result.rows[0]!;
  if (BigInt(history.count) !== BigInt(agent.lastNonce) || BigInt(history.maximum ?? '0') !== BigInt(agent.lastNonce)) deny('NONCE_CONTINUITY_UNVERIFIED');
}
