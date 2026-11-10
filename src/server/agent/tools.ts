import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { amountSchema, attemptStatusSchema, quoteChallengeSchema, resourceKeySchema, uuidSchema } from '@aegispay/shared';
import type { Store } from '../db/connection.ts';
import * as s from '../db/schema.ts';
import { issueSession } from '../auth/session.ts';
import { createApplication } from '../http/application.ts';
import { DomainError } from '../domain/purchases.ts';
import type { GeminiToolCall, JsonValue } from '../integrations/model.ts';
import type { RunCheckpoint } from './state.ts';
import type { RunEventKind } from './events.ts';

const attemptView = z.object({ attemptId: uuidSchema, quoteId: uuidSchema, operationId: uuidSchema, status: attemptStatusSchema, receiptId: uuidSchema.nullable().optional() });
const refusals = new Set(['POLICY_REFUSED', 'POLICY_NOT_READY', 'BUDGET_EXCEEDED', 'QUOTE_EXPIRED', 'NOT_FOUND', 'MERCHANT_NOT_ALLOWED', 'QUOTE_NOT_OPEN', 'QUOTE_SNAPSHOT_MISMATCH', 'CONTRACT_MISMATCH', 'OPERATION_ACTIVE', 'ENTITLEMENT_EXPIRED']);
type Event = (kind: RunEventKind, payload: Record<string, unknown>) => Promise<void>;

// Runs only within the consumer's fenced SQL transaction. The HTTP application
// reuses that same transaction, so quote/accept/read and checkpoint commit together.
// No SDK, network fetch, wallet gateway, signer or provider credential is reachable.
export async function trustedTool(input: { store: Store; env: NodeJS.ProcessEnv; run: typeof s.agentRun.$inferSelect; state: RunCheckpoint; call: GeminiToolCall; event: Event }) {
  const { store, run, state, call, event } = input;
  const session = await issueSession(store, { role: 'worker', ownerId: run.ownerId, runId: run.id });
  const app = createApplication({ store, env: { APP_ORIGIN: input.env.APP_ORIGIN ?? 'http://localhost', ...(input.env.RECEIPT_SIGNING_KEY ? { RECEIPT_SIGNING_KEY: input.env.RECEIPT_SIGNING_KEY } : {}) },
    wallet: async () => { throw new Error('MODEL_WALLET_FORBIDDEN'); }, wake: async () => {} });
  const send = async (path: string, body?: unknown, clientKey?: string) => {
    const response = await app(new Request(`http://localhost${path}`, { method: body ? 'POST' : 'GET',
      headers: { authorization: `Bearer ${session.token}`, ...(body ? { 'content-type': 'application/json', 'idempotency-key': clientKey! } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) }));
    const value: unknown = await response.json();
    if (!response.ok && response.status !== 402) {
      const code = z.object({ error: z.object({ code: z.string() }) }).safeParse(value);
      if (code.success && refusals.has(code.data.error.code)) throw new DomainError(code.data.error.code);
      throw new Error('MODEL_DEPENDENCY_UNAVAILABLE');
    }
    return { value, status: response.status, quoteHeader: response.headers.get('aegis-quote') };
  };
  try {
    const intent = call.intent;
    if (intent.tool === 'discover_offers') {
      const result = z.object({ offers: z.array(z.object({ resourceKey: resourceKeySchema, description: z.string().max(2000), priceStroops: amountSchema, isDemo: z.literal(true) })).max(2) }).parse((await send('/api/v1/catalog')).value);
      state.discovered = true;
      return { response: { offers: result.offers, budgetStroops: run.budgetStroops, reservedStroops: run.reservedStroops, spentStroops: run.spentStroops } as Record<string, JsonValue>, waiting: false };
    }
    if (intent.tool === 'request_quote') {
      if (!state.discovered) throw new DomainError('DISCOVER_OFFERS_REQUIRED');
      if (state.purchase) throw new DomainError('PAYMENT_UNRESOLVED');
      // One immutable quote per selected resource survives model and process retries.
      const existing = Object.values(state.quotes).find(q => q.resourceKey === intent.resourceKey);
      if (existing) return { response: { ...existing }, waiting: false };
      const slug = intent.resourceKey === 'quick-signal:demo-parser:v1' ? 'quick-signal' : 'deep-trace';
      const result = await send(`/api/demo/${slug}?dependency=demo-parser&runId=${run.id}`);
      const challenge = quoteChallengeSchema.parse(result.value);
      if (result.status !== 402 || result.quoteHeader !== challenge.quoteId || challenge.resourceKey !== intent.resourceKey) throw new Error('RUN_CHECKPOINT_INVALID');
      const [q] = await store.db.select().from(s.quote).where(and(eq(s.quote.id, challenge.quoteId), eq(s.quote.ownerId, run.ownerId), eq(s.quote.agentId, run.agentId), eq(s.quote.runId, run.id)));
      if (!q || q.amountStroops !== challenge.amountStroops || q.assetContractId !== challenge.assetContractId || q.resourceKey !== challenge.resourceKey || q.merchantAddress !== challenge.merchantAddress || q.expiresAt.toISOString() !== challenge.expiresAt) throw new Error('RUN_CHECKPOINT_INVALID');
      state.quotes[q.id] = challenge;
      await event('quote_received', challenge);
      return { response: { ...challenge }, waiting: false };
    }
    const challenge = state.quotes[intent.quoteId];
    if (!challenge) throw new DomainError('QUOTE_NOT_DISCOVERED');
    if (state.purchase && state.purchase.quoteId !== intent.quoteId) throw new DomainError('PAYMENT_UNRESOLVED');
    if (intent.tool === 'purchase_quote' && !state.purchase) {
      const clientKey = randomUUID();
      const accepted = attemptView.parse((await send('/api/v1/payment-attempts', { quoteId: intent.quoteId }, clientKey)).value);
      if (accepted.quoteId !== intent.quoteId) throw new Error('RUN_CHECKPOINT_INVALID');
      state.purchase = { quoteId: accepted.quoteId, clientKey, attemptId: accepted.attemptId, operationId: accepted.operationId };
      await event('payment_accepted', { ...challenge, ...state.purchase });
    }
    if (!state.purchase) throw new DomainError('PURCHASE_REQUIRED');
    const observed = attemptView.parse((await send(`/api/v1/payment-attempts/${state.purchase.attemptId}`)).value);
    if (observed.quoteId !== intent.quoteId || observed.attemptId !== state.purchase.attemptId || observed.operationId !== state.purchase.operationId) throw new Error('RUN_CHECKPOINT_INVALID');
    await event('payment_observed', { ...observed, receiptId: observed.receiptId ?? null });
    const unresolved = !['authorized', 'refused', 'expired', 'failed'].includes(observed.status);
    if (unresolved) return { response: { ...observed, receiptId: null }, waiting: true };
    if (intent.tool === 'purchase_quote' || observed.status !== 'authorized') return { response: { ...observed, receiptId: observed.receiptId ?? null }, waiting: false };
    if (!observed.receiptId) throw new Error('MODEL_DEPENDENCY_UNAVAILABLE');
    const delivered = z.object({ isDemo: z.literal(true), resourceKey: resourceKeySchema, receiptId: uuidSchema,
      report: z.object({ title: z.string().max(1000), label: z.string().max(1000), findings: z.array(z.string().max(8000)).max(20) }) }).parse((await send(`/api/v1/receipts/${observed.receiptId}/resource`)).value);
    if (delivered.receiptId !== observed.receiptId || delivered.resourceKey !== challenge.resourceKey) throw new Error('RUN_CHECKPOINT_INVALID');
    state.delivered = { quoteId: intent.quoteId, receiptId: delivered.receiptId };
    await event('resource_delivered', { ...state.delivered, resourceKey: delivered.resourceKey });
    return { response: { ...delivered }, waiting: false };
  } catch (error) {
    if (error instanceof DomainError) return { response: { status: 'refused', code: refusals.has(error.code) || ['DISCOVER_OFFERS_REQUIRED', 'PAYMENT_UNRESOLVED', 'QUOTE_NOT_DISCOVERED', 'PURCHASE_REQUIRED'].includes(error.code) ? error.code : 'TOOL_REFUSED' }, waiting: false };
    throw error;
  } finally {
    await store.db.update(s.session).set({ revokedAt: sql`clock_timestamp()` }).where(eq(s.session.id, session.session.id));
  }
}
