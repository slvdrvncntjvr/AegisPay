import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { uuidSchema } from '@aegispay/shared';
import type { Store } from '../db/connection.ts';
import * as s from '../db/schema.ts';
import { authenticate, login, ownedRun, requireRole, sessionCookie, throttle } from '../auth/session.ts';
import { deny } from '../domain/purchases.ts';
import { ownedWallet, prepareWallet, submitWallet, observeWallet, walletView, type WalletGateway } from '../domain/wallet.ts';
import { checkOrigin, json, jsonBody, safeError } from './boundaries.ts';

export interface ApplicationContext {
  store: Store;
  env: NodeJS.ProcessEnv;
  wallet(): Promise<WalletGateway>;
  wake?: () => Promise<void>;
}
export function createApplication(context: ApplicationContext) {
  const { store, env } = context;
  return async (request: Request): Promise<Response> => {
    try {
      const url = new URL(request.url);
      const path = url.pathname.split('/').filter(Boolean);
      const mutating = !['GET', 'HEAD'].includes(request.method);
      if (url.pathname === '/api/health' && request.method === 'GET') return json({ status: 'ok', network: 'testnet' });
      if (!env.APP_ORIGIN) deny('DEPENDENCY_UNAVAILABLE');
      if (url.pathname === '/api/session' && request.method === 'POST') {
        checkOrigin(request, env.APP_ORIGIN);
        // Proxy headers are ignored by default. Trust only the configured host.
        const ip = env.TRUST_VERCEL_PROXY === '1' ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown' : 'untrusted-proxy';
        await throttle(store, 'login:global', 50, 60);
        const input = z.strictObject({ role: z.enum(['owner', 'merchant']), token: z.string().min(1).max(512) }).parse(await jsonBody(request));
        await throttle(store, `login:${ip}:${input.role}`, 5, 900);
        const result = await login(store, input.role, input.token, env);
        return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store', 'Set-Cookie': sessionCookie(result.token, env.APP_ORIGIN) } });
      }
      const actor = await authenticate(store, request);
      if (mutating && actor.role !== 'worker') checkOrigin(request, env.APP_ORIGIN);
      await throttle(store, `${mutating ? 'write' : 'poll'}:${mutating ? actor.ownerId ?? actor.merchantId : actor.id}`, mutating ? 30 : 60, 60);
      if (url.pathname === '/api/session' && request.method === 'DELETE') {
        requireRole(actor, ['owner', 'merchant']);
        await store.db.update(s.session).set({ revokedAt: sql`clock_timestamp()` }).where(eq(s.session.id, actor.id));
        return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store', 'Set-Cookie': sessionCookie('', env.APP_ORIGIN, true) } });
      }
      if (url.pathname === '/api/v1/state' && request.method === 'GET') {
        requireRole(actor, ['owner', 'merchant']);
        const offers = await store.db.select({ id: s.resource.id, resourceKey: s.resource.resourceKey, description: s.resource.description, priceStroops: s.resource.priceStroops, enabled: s.resource.enabled, isDemo: s.resource.isDemo }).from(s.resource).where(actor.role === 'merchant' ? eq(s.resource.merchantId, actor.merchantId!) : eq(s.resource.isDemo, true));
        if (actor.role === 'owner') {
          const [agent] = await store.db.select().from(s.agent).where(eq(s.agent.ownerId, actor.ownerId!));
          const [owner] = await store.db.select({ walletAddress: s.owner.walletAddress }).from(s.owner).where(eq(s.owner.id, actor.ownerId!));
          const runs = await store.db.select({ id: s.agentRun.id, task: s.agentRun.taskText, status: s.agentRun.status, createdAt: s.agentRun.createdAt, reservedStroops: s.agentRun.reservedStroops, spentStroops: s.agentRun.spentStroops, finalAnswer: s.agentRun.finalAnswer, errorCode: s.agentRun.errorCode }).from(s.agentRun).where(eq(s.agentRun.ownerId, actor.ownerId!)).orderBy(desc(s.agentRun.createdAt)).limit(20);
          const attempts = await store.db.select({ attemptId: s.paymentAttempt.id, quoteId: s.paymentAttempt.quoteId, operationId: s.paymentAttempt.operationId, status: s.paymentAttempt.status, innerHash: s.paymentAttempt.innerHash, outerHash: s.paymentAttempt.outerHash, veloRequestId: s.paymentAttempt.veloRequestId, veloStatus: s.paymentAttempt.veloStatus, errorCode: s.paymentAttempt.errorCode }).from(s.paymentAttempt).where(eq(s.paymentAttempt.ownerId, actor.ownerId!)).orderBy(desc(s.paymentAttempt.createdAt)).limit(30);
          const walletOperations = owner ? await store.db.select().from(s.walletOperation).where(eq(s.walletOperation.actorAddress, owner.walletAddress)).orderBy(desc(s.walletOperation.createdAt)).limit(10) : [];
          return json({ role: actor.role, network: 'testnet', health: { database: 'available', chain: 'unavailable_until_refresh', model: 'worker_only' }, walletAddress: owner?.walletAddress, agent, offers, runs, attempts, walletOperations: walletOperations.map(walletView), balances: { status: 'unavailable', code: 'CHAIN_REFRESH_REQUIRED' } });
        }
        const [merchant] = await store.db.select().from(s.merchant).where(eq(s.merchant.id, actor.merchantId!));
        const claims = await store.db.select().from(s.merchantClaim).where(eq(s.merchantClaim.merchantId, actor.merchantId!)).orderBy(desc(s.merchantClaim.createdAt)).limit(20);
        const operations = merchant ? await store.db.select().from(s.walletOperation).where(eq(s.walletOperation.actorAddress, merchant.walletAddress)).orderBy(desc(s.walletOperation.createdAt)).limit(10) : [];
        return json({ role: actor.role, network: 'testnet', walletAddress: merchant?.walletAddress, offers, claims, walletOperations: operations.map(walletView), balances: { status: 'unavailable', code: 'CHAIN_REFRESH_REQUIRED' } });
      }
      if (url.pathname === '/api/v1/wallet-state' && request.method === 'GET') {
        requireRole(actor, ['owner', 'merchant']);
        const gateway = await context.wallet();
        const observedAt = new Date().toISOString();
        if (actor.role === 'merchant') {
          const [m] = await store.db.select().from(s.merchant).where(eq(s.merchant.id, actor.merchantId!));
          if (!m) deny('NOT_FOUND');
          const pending = await gateway.getPendingBalance(m.walletAddress);
          return json({ pendingStroops: pending.toString(), observedAt, observedLedger: await gateway.latestLedger(), assetContractId: gateway.config.asset });
        }
        const [a] = await store.db.select().from(s.agent).where(eq(s.agent.ownerId, actor.ownerId!));
        const [o] = await store.db.select().from(s.owner).where(eq(s.owner.id, actor.ownerId!));
        if (!a || !o) deny('NOT_FOUND');
        const [policy, owner, deviceAgent, balance, token] = await Promise.all([gateway.getPolicy(a.deviceHash), gateway.getDeviceOwner(a.deviceHash), gateway.getDeviceAgent(a.deviceHash), gateway.getEscrowBalance(a.deviceHash), gateway.getEscrowToken(a.deviceHash)]);
        if (owner !== null && owner !== o.walletAddress || deviceAgent !== null && deviceAgent !== a.publicKey || token !== null && token !== gateway.config.asset || policy && (policy.agent !== a.publicKey || policy.asset !== gateway.config.asset || policy.maxAmount <= 0n || !policy.expiresAt)) deny('CONTRACT_MISMATCH');
        const ledger = await gateway.latestLedger();
        await store.db.update(s.agent).set({ status: policy ? 'active' : a.status === 'revoked' ? 'revoked' : 'unprovisioned', policyMaxStroops: policy?.maxAmount.toString() ?? '0', policyExpiresAt: policy?.expiresAt ?? new Date(0), policyObservedLedger: BigInt(ledger) }).where(eq(s.agent.id, a.id));
        return json({ policy: policy ? { agent: policy.agent, maxAmountStroops: policy.maxAmount.toString(), asset: policy.asset, expiresAt: policy.expiresAt } : null, deviceOwner: owner, deviceAgent, escrowStroops: balance.toString(), assetContractId: token, observedAt, observedLedger: ledger });
      }
      if (url.pathname === '/api/v1/wallet-operations' && request.method === 'POST') {
        requireRole(actor, ['owner', 'merchant']);
        const input = await jsonBody(request);
        return json(await prepareWallet(store, actor, input, await context.wallet()), 201);
      }
      if (path[0] === 'api' && path[1] === 'v1' && path[2] === 'wallet-operations' && path[3]) {
        const id = uuidSchema.parse(path[3]);
        await ownedWallet(store, actor, id); // authorization before SDK creation
        if (path.length === 4 && request.method === 'GET') return json(await observeWallet(store, actor, id, await context.wallet()));
        if (path.length === 5 && path[4] === 'submit' && request.method === 'POST') {
          const input = z.strictObject({ signedXdr: z.string().min(1).max(260000) }).parse(await jsonBody(request, 262144));
          return json(await submitWallet(store, actor, id, input.signedXdr, await context.wallet()), 202);
        }
      }
      if (path[0] === 'api' && path[1] === 'v1' && path[2] === 'runs' && path.length === 4 && request.method === 'GET') {
        const run = await ownedRun(store, actor, uuidSchema.parse(path[3]));
        return json({ runId: run.id, task: run.taskText, status: run.status, finalAnswer: run.finalAnswer, errorCode: run.errorCode });
      }
      // No proof-ingest, checkout webhook, agent-sign or submit endpoint exists.
      deny('NOT_FOUND');
    } catch (error) { return safeError(error); }
  };
}
