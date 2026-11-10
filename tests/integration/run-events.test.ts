import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDatabase } from './support/database.ts';
import { fixture } from './support/fixtures.ts';
import { issueSession } from '../../src/server/auth/session.ts';
import { createApplication } from '../../src/server/http/application.ts';
import * as s from '../../src/server/db/schema.ts';

for (const key of ['DATABASE_URL', 'AGENT_SECRET', 'VELO_API_KEY', 'VELO_GAS_API_KEY', 'VELO_GAS_BASE_URL', 'GEMINI_API_KEY', 'ENVELOPE_ENCRYPTION_KEY', 'SPIKE_OWNER_SECRET', 'SPIKE_MERCHANT_SECRET', 'STELLAR_RPC_URL', 'RUN_TESTNET', 'RECEIPT_SIGNING_KEY', 'WORKER_WAKE_TOKEN', 'DEMO_OWNER_LOGIN_TOKEN', 'DEMO_MERCHANT_LOGIN_TOKEN']) delete process.env[key];
describe('API007 SQL cursor, run ownership and event projection (offline)', () => {
  let db: Awaited<ReturnType<typeof createTestDatabase>>;
  let runId: string;
  let app: ReturnType<typeof createApplication>;
  let owner: string, foreign: string, merchant: string, worker: string, wrongWorker: string;
  beforeAll(async () => {
    db = await createTestDatabase(); const f = await fixture(db.first), other = await fixture(db.first);
    runId = f.run.id;
    owner = (await issueSession(db.first, { role: 'owner', ownerId: f.owner.id })).token;
    foreign = (await issueSession(db.first, { role: 'owner', ownerId: other.owner.id })).token;
    merchant = (await issueSession(db.first, { role: 'merchant', merchantId: f.merchant.id })).token;
    worker = (await issueSession(db.first, { role: 'worker', ownerId: f.owner.id, runId })).token;
    const [otherOwnedRun] = await db.first.db.insert(s.agentRun).values({ ...f.run, id: randomUUID(), runStartKey: randomUUID(), status: 'completed' }).returning();
    wrongWorker = (await issueSession(db.first, { role: 'worker', ownerId: f.owner.id, runId: otherOwnedRun!.id })).token;
    app = createApplication({ store: db.first, env: { APP_ORIGIN: 'http://localhost' }, wallet: async () => { throw new Error('NO_WALLET_OR_NETWORK'); } });
    await db.first.db.update(s.agentRun).set({ toolCheckpoint: { token: 'PRIVATE_CHECKPOINT_SENTINEL', providerContent: 'PRIVATE_THOUGHT' } }).where(eq(s.agentRun.id, runId));
    await db.first.db.insert(s.runEvent).values(Array.from({ length: 103 }, (_v, i) => ({ runId, kind: 'model_turn', safePayload: { turn: i % 8 + 1, apiKey: 'PRIVATE_KEY_SENTINEL', report: 'AEGIS_PRIVATE_REPORT', token: 'PRIVATE_TOKEN_SENTINEL' } })));
  });
  afterAll(async () => { await db.cleanup(); });
  const send = (suffix = '', token = owner, bearer = false, id = runId) => app(new Request(`http://localhost/api/v1/runs/${id}/events${suffix}`, { headers: bearer ? { authorization: `Bearer ${token}` } : { cookie: `aegispay_session=${token}` } }));
  it('paginates ascending by decimal int64 ID, caps100 and does not expose private stored values', async () => {
    const response = await send(); expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store');
    const first = await response.json() as { events: { id: string; safePayload: unknown }[]; nextCursor: string };
    expect(first.events).toHaveLength(100); expect(first.nextCursor).toBe(first.events.at(-1)!.id);
    expect(first.events.every((e, i) => !i || BigInt(e.id) > BigInt(first.events[i - 1]!.id))).toBe(true);
    expect(first.events[0]!.safePayload).toEqual({ turn: 1 });
    expect(JSON.stringify(first)).not.toMatch(/PRIVATE|AEGIS_PRIVATE|providerContent|checkpoint|token|apiKey/);
    const second = await (await send(`?after=${first.nextCursor}`)).json() as typeof first;
    expect(second.events).toHaveLength(3); expect(BigInt(second.events[0]!.id)).toBeGreaterThan(BigInt(first.nextCursor));
    const empty = await (await send('?after=9223372036854775807')).json();
    expect(empty).toEqual({ events: [], nextCursor: '9223372036854775807' });
  });
  it.each(['', '0', '-1', '+1', '01', '1.0', '1e2', 'NaN', '9223372036854775808', '99999999999999999999999999', '1&after=2'])('rejects malformed/overflow/duplicate after=%s', async cursor => {
    expect((await send(`?after=${cursor}`)).status).toBe(400);
  });
  it('enforces owner, worker run and merchant boundaries before reading events', async () => {
    expect((await send('', '')).status).toBe(401);
    expect((await send('', foreign)).status).toBe(404);
    expect((await send('', merchant)).status).toBe(403);
    expect((await send('', worker, true)).status).toBe(200);
    expect((await send('', wrongWorker, true)).status).toBe(404);
    expect((await send('', owner, false, randomUUID())).status).toBe(404);
  });
  it('skips unknown/invalid payloads while advancing the cursor past them', async () => {
    const prior = await db.first.db.select().from(s.runEvent).where(eq(s.runEvent.runId, runId)).orderBy(s.runEvent.id);
    const after = prior.at(-1)!.id.toString();
    const inserted = await db.first.db.insert(s.runEvent).values([
      { runId, kind: 'provider_dump', safePayload: { text: 'PRIVATE_THOUGHT' } },
      { runId, kind: 'payment_accepted', safePayload: { quoteId: randomUUID(), amountStroops: 'malformed', report: 'PRIVATE_REPORT' } },
      { runId, kind: 'run_started', safePayload: { privateReasoning: 'PRIVATE_THOUGHT' } },
    ]).returning();
    const response = await (await send(`?after=${after}`)).json() as { events: unknown[]; nextCursor: string };
    expect(response.events).toHaveLength(1); expect(response.nextCursor).toBe(inserted.at(-1)!.id.toString());
    expect(JSON.stringify(response)).not.toContain('PRIVATE');
  });
  it('exports public commentary only to the owning run, stripping private extras and rejecting unsafe summaries', async () => {
    const prior = await db.first.db.select().from(s.runEvent).where(eq(s.runEvent.runId, runId)).orderBy(s.runEvent.id);
    const inserted = await db.first.db.insert(s.runEvent).values([
      { runId, kind: 'model_choice', safePayload: { turn: 1, decision: 'tools_proposed', summaryStatus: 'provided', summary: 'QuickSignal fits the task.', providerContent: 'PRIVATE_THOUGHT', thoughtSignature: 'PRIVATE_SIGNATURE', args: { token: 'PRIVATE_TOKEN' }, report: 'AEGIS_PRIVATE_REPORT' } },
      { runId, kind: 'model_choice', safePayload: { turn: 2, decision: 'no_tool', summaryStatus: 'missing', summary: null, checkpoint: 'PRIVATE_CHECKPOINT' } },
      { runId, kind: 'model_choice', safePayload: { turn: 3, decision: 'no_tool', summaryStatus: 'provided', summary: 'Payment settled.' } },
    ]).returning();
    const response = await send(`?after=${prior.at(-1)!.id}`);
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store');
    const payload = await response.json();
    expect(payload.events.map((e: { safePayload: unknown }) => e.safePayload)).toEqual([
      { turn: 1, decision: 'tools_proposed', summaryStatus: 'provided', summary: 'QuickSignal fits the task.' },
      { turn: 2, decision: 'no_tool', summaryStatus: 'missing', summary: null },
    ]);
    expect(payload.nextCursor).toBe(inserted.at(-1)!.id.toString());
    expect(JSON.stringify(payload)).not.toMatch(/PRIVATE|signature|providerContent|token|checkpoint|settled/);
    expect((await send('', foreign)).status).toBe(404);
    expect((await send('', merchant)).status).toBe(403);
    expect((await send('', wrongWorker, true)).status).toBe(404);
  });
});
