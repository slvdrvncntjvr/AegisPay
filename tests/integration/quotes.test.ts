import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDatabase } from './support/database.ts';
import { acceptInput, fixture } from './support/fixtures.ts';
import { issueSession } from '../../src/server/auth/session.ts';
import { acceptQuote, createQuote } from '../../src/server/domain/purchases.ts';
import { createApplication } from '../../src/server/http/application.ts';
import * as s from '../../src/server/db/schema.ts';

describe('TC-020/024/031 merchant future offers through authenticated HTTP (isolated PostgreSQL)', () => {
  let db: Awaited<ReturnType<typeof createTestDatabase>>;
  beforeAll(async () => { db = await createTestDatabase(); });
  afterAll(async () => { await db.cleanup(); });
  it('enforces role, ownership, origin and exact positive integer fields before mutation', async () => {
    const f = await fixture(db.first), other = await fixture(db.first);
    const owner = await issueSession(db.first, { role: 'owner', ownerId: f.owner.id });
    const merchant = await issueSession(db.first, { role: 'merchant', merchantId: f.merchant.id });
    const foreign = await issueSession(db.first, { role: 'merchant', merchantId: other.merchant.id });
    const app = createApplication({ store: db.first, env: { APP_ORIGIN: 'http://localhost:3000' }, wallet: async () => { throw new Error('WALLET_MUST_NOT_RUN'); } });
    const patch = (token: string, body: unknown, origin = 'http://localhost:3000') => app(new Request(`http://localhost:3000/api/v1/merchant/resources/${f.resource.id}`, {
      method: 'PATCH', headers: { cookie: `aegispay_session=${token}`, origin, 'content-type': 'application/json' }, body: JSON.stringify(body),
    }));
    expect((await patch('', { priceStroops: '600000' })).status).toBe(401);
    expect((await patch(owner.token, { priceStroops: '600000' })).status).toBe(403);
    expect((await patch(foreign.token, { priceStroops: '600000' })).status).toBe(404);
    expect((await patch(merchant.token, { priceStroops: '600000' }, 'https://foreign.example')).status).toBe(403);
    for (const priceStroops of ['0', '-1', '1.5', '01', '170141183460469231731687303715884105728']) {
      expect((await patch(merchant.token, { priceStroops })).status).toBe(400);
    }
    expect((await patch(merchant.token, { priceStroops: '600000', merchantAddress: other.merchant.walletAddress })).status).toBe(400);
    const [unchanged] = await db.first.db.select().from(s.resource).where(eq(s.resource.id, f.resource.id));
    expect(unchanged!.priceStroops).toBe('300000');
    const changed = await patch(merchant.token, { priceStroops: '600000', enabled: false });
    expect(changed.status).toBe(200); expect(changed.headers.get('cache-control')).toBe('no-store');
    expect(await changed.json()).toMatchObject({ id: f.resource.id, priceStroops: '600000', enabled: false });
    await expect(createQuote(db.second, { ...acceptInput(f), resourceId: f.resource.id })).rejects.toThrow('NOT_FOUND');
  });
  it('keeps accepted price and reservation unchanged while new quotes use merchant HTTP edits', async () => {
    const f = await fixture(db.first);
    const attempt = await acceptQuote(db.first, acceptInput(f));
    const merchant = await issueSession(db.first, { role: 'merchant', merchantId: f.merchant.id });
    const app = createApplication({ store: db.second, env: { APP_ORIGIN: 'http://localhost:3000' }, wallet: async () => { throw new Error('WALLET_MUST_NOT_RUN'); } });
    const response = await app(new Request(`http://localhost:3000/api/v1/merchant/resources/${f.resource.id}`, {
      method: 'PATCH', headers: { cookie: `aegispay_session=${merchant.token}`, origin: 'http://localhost:3000', 'content-type': 'application/json' }, body: JSON.stringify({ priceStroops: '900000' }),
    }));
    expect(response.status).toBe(200);
    const newer = await createQuote(db.second, { ...acceptInput(f), resourceId: f.resource.id });
    const [original] = await db.first.db.select().from(s.quote).where(eq(s.quote.id, attempt.quoteId));
    const [run] = await db.first.db.select().from(s.agentRun).where(eq(s.agentRun.id, f.run.id));
    expect(newer.amountStroops).toBe('900000'); expect(original!.amountStroops).toBe('300000');
    expect(original!.termsHash).toBe(f.quote.termsHash); expect(run!.reservedStroops).toBe('300000');
    expect(await db.first.db.select().from(s.entitlement)).toHaveLength(0);
  });
});
