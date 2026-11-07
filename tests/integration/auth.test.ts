import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDatabase } from './support/database.js';
import { fixture } from './support/fixtures.js';
import { authenticate, digest, issueSession, login, ownedRun, throttle } from '../../src/server/auth/session.js';
import * as s from '../../src/server/db/schema.js';

describe('TC-020 PostgreSQL private sessions and isolation', () => {
  let db: Awaited<ReturnType<typeof createTestDatabase>>;
  beforeAll(async () => { db = await createTestDatabase(); });
  afterAll(async () => { await db.cleanup(); });
  it('maps a private login to configured wallet identity and persists only a 32-byte token hash', async () => {
    const f = await fixture(db.first);
    const secret = 'independent-owner-login-secret-32-bytes-minimum';
    const result = await login(db.first, 'owner', secret, { DEMO_OWNER_LOGIN_TOKEN: secret, DEMO_OWNER_PUBLIC_KEY: f.owner.walletAddress });
    expect(Buffer.from(result.token, 'base64url')).toHaveLength(32);
    expect(result.session.ownerId).toBe(f.owner.id);
    expect(result.session.tokenHash).toBe(digest(result.token));
    expect(JSON.stringify(result.session)).not.toContain(result.token);
    const request = new Request('http://localhost', { headers: { cookie: `aegispay_session=${result.token}` } });
    expect((await authenticate(db.second, request)).id).toBe(result.session.id);
    await expect(login(db.first, 'owner', 'bad', { DEMO_OWNER_LOGIN_TOKEN: secret })).rejects.toThrow('AUTH_INVALID');
    await db.first.db.update(s.session).set({ revokedAt: new Date() }).where(eq(s.session.id, result.session.id));
    await expect(authenticate(db.second, request)).rejects.toThrow('AUTH_INVALID');
  });
  it('worker bearer cannot cross runs, use a cookie, or become a wallet owner', async () => {
    const one = await fixture(db.first), two = await fixture(db.first);
    const issued = await issueSession(db.first, { role: 'worker', ownerId: one.owner.id, runId: one.run.id });
    const principal = await authenticate(db.second, new Request('http://localhost', { headers: { authorization: `Bearer ${issued.token}` } }));
    expect((await ownedRun(db.first, principal, one.run.id)).id).toBe(one.run.id);
    await expect(ownedRun(db.first, principal, two.run.id)).rejects.toThrow('NOT_FOUND');
    await expect(authenticate(db.first, new Request('http://localhost', { headers: { cookie: `aegispay_session=${issued.token}` } }))).rejects.toThrow('AUTH_INVALID');
    const owner = await issueSession(db.first, { role: 'owner', ownerId: two.owner.id });
    await expect(ownedRun(db.first, owner.session, one.run.id)).rejects.toThrow('NOT_FOUND');
  });
  it('enforces a shared throttle under independent-connection contention', async () => {
    const key = crypto.randomUUID();
    const results = await Promise.allSettled(Array.from({ length: 10 }, (_, i) => throttle(i % 2 ? db.first : db.second, key, 5, 900)));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(5);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(5);
  });
});
