import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase } from './support/database.js';
import { fixture } from './support/fixtures.js';
import { issueSession, sessionCookie } from '../../src/server/auth/session.js';
import { createApplication } from '../../src/server/http/application.js';
import { jsonBody } from '../../src/server/http/boundaries.js';
import * as s from '../../src/server/db/schema.js';

describe('TC-024 request and response boundaries with real PostgreSQL', () => {
  let db: Awaited<ReturnType<typeof createTestDatabase>>;
  beforeAll(async () => { db = await createTestDatabase(); });
  afterAll(async () => { await db.cleanup(); });
  it('denies public state, quote, sponsor and proof ingestion before mutation', async () => {
    const app = createApplication({ store: db.first, env: { APP_ORIGIN: 'http://localhost:3000' }, wallet: async () => { throw new Error('SECRET_SENTINEL'); } });
    for (const path of ['/api/v1/state', '/api/demo/quick-signal', '/api/v1/payment-attempts', '/api/webhook/noir', '/api/v1/sponsor']) {
      const r = await app(new Request(`http://localhost:3000${path}`));
      expect(r.status).toBe(401); expect(r.headers.get('cache-control')).toBe('no-store');
      expect(await r.text()).not.toContain('SECRET_SENTINEL');
    }
    expect(await db.first.db.select().from(s.quote)).toHaveLength(0);
  });
  it('requires exact Origin and streams bounded bodies without trusting Content-Length', async () => {
    const f = await fixture(db.first);
    const session = await issueSession(db.first, { role: 'owner', ownerId: f.owner.id });
    const app = createApplication({ store: db.first, env: { APP_ORIGIN: 'http://localhost:3000' }, wallet: async () => { throw new Error('SECRET_SENTINEL'); } });
    for (const origin of ['', 'https://attacker.example', 'http://localhost:3000.evil']) {
      const r = await app(new Request('http://localhost:3000/api/v1/wallet-operations', { method: 'POST', headers: { origin, cookie: `aegispay_session=${session.token}`, 'content-type': 'application/json' }, body: '{}' }));
      expect(r.status).toBe(403);
    }
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(9000)); controller.enqueue(new Uint8Array(9000)); controller.close(); } });
    const streamed = new Request('http://localhost', { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': '1' }, body: stream, duplex: 'half' } as RequestInit);
    await expect(jsonBody(streamed)).rejects.toThrow('BODY_TOO_LARGE');
    await expect(jsonBody(new Request('http://localhost', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' }))).rejects.toThrow('INVALID_INPUT');
    const r = await app(new Request('http://localhost:3000/api/v1/wallet-operations', { method: 'POST', headers: { origin: 'http://localhost:3000', cookie: `aegispay_session=${session.token}`, 'content-type': 'application/json' }, body: '{}' }));
    expect(r.status).toBe(503); expect(await r.text()).not.toContain('SECRET_SENTINEL');
  });
  it('isolates merchant state from owner task/checkpoint and secures cookies', async () => {
    const f = await fixture(db.first);
    const merchant = await issueSession(db.first, { role: 'merchant', merchantId: f.merchant.id });
    const app = createApplication({ store: db.first, env: { APP_ORIGIN: 'http://localhost:3000' }, wallet: async () => { throw new Error('not used'); } });
    const r = await app(new Request('http://localhost:3000/api/v1/state', { headers: { cookie: `aegispay_session=${merchant.token}` } }));
    expect(r.status).toBe(200); const text = await r.text();
    expect(text).not.toContain(f.run.taskText); expect(text).not.toContain('toolCheckpoint');
    expect(sessionCookie('x', 'https://aegispay-live.vercel.app')).toContain('HttpOnly; SameSite=Strict; Max-Age=28800; Secure');
    expect(() => sessionCookie('x', 'http://external.test')).toThrow();
  });
});
