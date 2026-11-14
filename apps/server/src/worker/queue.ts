import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import type { Store } from '../../../../src/server/db/connection.ts';
import * as s from '../../../../src/server/db/schema.ts';

export async function claimJob(store: Store, kinds: string[] = ['reconcile'], entityId?: string) {
  if (!kinds.length) return null;
  return store.transaction(async db => {
    const [job] = await db.select().from(s.job).where(and(sql`kind IN (${sql.join(kinds.map(kind => sql`${kind}`), sql`, `)})`, entityId ? eq(s.job.entityId, entityId) : undefined, sql`available_at <= clock_timestamp() AND (status = 'queued' OR (status = 'leased' AND lease_until <= clock_timestamp()))`))
      .orderBy(s.job.availableAt).limit(1).for('update', { skipLocked: true });
    if (!job) return null;
    const [claimed] = await db.update(s.job).set({ status: 'leased', leaseOwner: randomUUID(), leaseUntil: sql`clock_timestamp() + interval '180 seconds'`, attemptCount: job.attemptCount + 1 }).where(eq(s.job.id, job.id)).returning();
    return claimed!;
  });
}
export async function finishJob(store: Store, job: typeof s.job.$inferSelect, done: boolean) {
  // Only observations back off. A saved handoff never becomes a submit retry.
  const delay = Math.min(60, 2 ** Math.min(job.attemptCount, 6));
  const rows = await store.db.update(s.job).set({ status: done ? 'done' : 'queued', leaseOwner: null, leaseUntil: null, availableAt: sql`clock_timestamp() + ${delay} * interval '1 second'` })
    .where(and(eq(s.job.id, job.id), eq(s.job.leaseOwner, job.leaseOwner!), sql`lease_until > clock_timestamp()`)).returning({ id: s.job.id });
  return rows.length === 1;
}
