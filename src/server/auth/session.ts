import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { Store } from '../db/connection.ts';
import * as s from '../db/schema.ts';
import { databaseTime, deny } from '../domain/purchases.ts';

export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export const equalSecret = (a: string, b: string) => timingSafeEqual(Buffer.from(digest(a), 'hex'), Buffer.from(digest(b), 'hex'));
export type Principal = typeof s.session.$inferSelect;
export const COOKIE = 'aegispay_session';
export async function throttle(store: Store, key: string, limit: number, seconds: number) {
  // DB time, atomic UPSERT, shared across all web/worker processes. No raw IPs.
  const result = await store.db.execute<{ attempts: number }>(sql`
    INSERT INTO auth_throttle(key_hash, window_start, attempts, expires_at)
    VALUES (${digest(key)}, clock_timestamp(), 1, clock_timestamp() + ${seconds} * interval '1 second')
    ON CONFLICT (key_hash) DO UPDATE SET
      attempts = CASE WHEN auth_throttle.expires_at <= clock_timestamp() THEN 1 ELSE auth_throttle.attempts + 1 END,
      window_start = CASE WHEN auth_throttle.expires_at <= clock_timestamp() THEN clock_timestamp() ELSE auth_throttle.window_start END,
      expires_at = CASE WHEN auth_throttle.expires_at <= clock_timestamp() THEN clock_timestamp() + ${seconds} * interval '1 second' ELSE auth_throttle.expires_at END
    RETURNING attempts`);
  if (result.rows[0]!.attempts > limit) deny('RATE_LIMITED');
}
export async function issueSession(store: Store, scope: { role: 'owner'; ownerId: string } | { role: 'merchant'; merchantId: string } | { role: 'worker'; ownerId: string; runId: string }) {
  const token = randomBytes(32).toString('base64url');
  const now = await databaseTime(store.db);
  const [session] = await store.db.insert(s.session).values({ id: randomUUID(), ...scope, tokenHash: digest(token), createdAt: now,
    expiresAt: new Date(now.getTime() + (scope.role === 'worker' ? 900000 : 28800000)) }).returning();
  return { token, session: session! };
}
export async function login(store: Store, role: 'owner' | 'merchant', token: string, env: NodeJS.ProcessEnv) {
  const secret = env[role === 'owner' ? 'DEMO_OWNER_LOGIN_TOKEN' : 'DEMO_MERCHANT_LOGIN_TOKEN'];
  if (!secret || secret.length < 32) deny('DEPENDENCY_UNAVAILABLE');
  if (!equalSecret(token, secret)) deny('AUTH_INVALID');
  const address = env[role === 'owner' ? 'DEMO_OWNER_PUBLIC_KEY' : 'DEMO_MERCHANT_PUBLIC_KEY'];
  if (role === 'owner') {
    const [owner] = await store.db.select().from(s.owner).where(eq(s.owner.walletAddress, address ?? ''));
    if (!owner) deny('DEPENDENCY_UNAVAILABLE');
    return issueSession(store, { role, ownerId: owner.id });
  }
  const [merchant] = await store.db.select().from(s.merchant).where(eq(s.merchant.walletAddress, address ?? ''));
  if (!merchant) deny('DEPENDENCY_UNAVAILABLE');
  return issueSession(store, { role, merchantId: merchant.id });
}
export async function authenticate(store: Store, request: Request): Promise<Principal> {
  const bearer = request.headers.get('authorization');
  const cookie = request.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  const token = bearer?.startsWith('Bearer ') ? bearer.slice(7) : cookie;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) deny('AUTH_INVALID');
  const [session] = await store.db.select().from(s.session).where(and(eq(s.session.tokenHash, digest(token)), isNull(s.session.revokedAt), gt(s.session.expiresAt, sql`clock_timestamp()`)));
  if (!session || (bearer !== null && session.role !== 'worker') || (bearer === null && session.role === 'worker')) deny('AUTH_INVALID');
  return session;
}
export function requireRole(actor: Principal, roles: string[]) { if (!roles.includes(actor.role)) deny('FORBIDDEN'); }
export async function ownedRun(store: Store, actor: Principal, id: string) {
  requireRole(actor, ['owner', 'worker']);
  if (actor.role === 'worker' && actor.runId !== id) deny('NOT_FOUND');
  const [run] = await store.db.select().from(s.agentRun).where(and(eq(s.agentRun.id, id), eq(s.agentRun.ownerId, actor.ownerId!)));
  if (!run) deny('NOT_FOUND');
  return run;
}
export function sessionCookie(token: string, origin: string, clear = false) {
  const url = new URL(origin);
  const secure = url.protocol === 'https:';
  if (!secure && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) deny('DEPENDENCY_UNAVAILABLE');
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : 28800}${secure ? '; Secure' : ''}`;
}
