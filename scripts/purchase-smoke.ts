// CLI exercises the actual application Request/Response boundary and durable
// PostgreSQL worker, using only the real pinned SDK adapter. No fake transport.
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { configuredStore } from '../src/server/db/connection.ts';
import * as s from '../src/server/db/schema.ts';
import { createRun, DomainError } from '../src/server/domain/purchases.ts';
import { createApplication } from '../src/server/http/application.ts';
import { issueSession } from '../src/server/auth/session.ts';
import { receiptTokens } from '../src/server/merchant/receipts.ts';
import { createNoir, readTestnetConfig, SpikeGuardError } from '../src/server/integrations/noir.ts';
import { readSpikeRecord, writeSpikeRecord } from '../src/server/integrations/spike-journal.ts';
import { createLivePaymentAdapter } from '../apps/server/src/worker/live-adapter.ts';
import { encryptionKey, observationOnly, paymentSnapshot, processPayment } from '../apps/server/src/worker/payment.ts';
import { purchaseDirectory, setupPurchase } from './purchase-setup.ts';
import { safeFailure, verifyContracts } from './verify-contracts.ts';

const keysSchema = z.strictObject({ runStartKey: z.uuid(), clientKey: z.uuid(), agentId: z.uuid() });
const idSchema = z.strictObject({ id: z.uuid() });
async function checkpoint(name: string, value: unknown) {
  const file = `${purchaseDirectory}/cli-${name}.json`;
  if (!await writeSpikeRecord(file, value)) throw new SpikeGuardError('SMOKE_CHECKPOINT_CONFLICT');
}
export async function purchaseSmoke(env: NodeJS.ProcessEnv, execute = false, observeOnly = false) {
  const needed = ['DATABASE_URL', 'DEMO_DEVICE_HASH', 'DEMO_AGENT_PUBLIC_KEY', 'DEMO_OWNER_PUBLIC_KEY', 'DEMO_MERCHANT_PUBLIC_KEY', 'APP_ORIGIN', 'RECEIPT_SIGNING_KEY', 'ENVELOPE_ENCRYPTION_KEY', 'AGENT_SECRET', 'VELO_GAS_API_KEY', 'VELO_GAS_BASE_URL'];
  const missing = needed.filter(name => !env[name]);
  if (missing.length) throw new SpikeGuardError('MISSING_CONFIGURATION', missing);
  const config = readTestnetConfig(env), receipt = receiptTokens(env.RECEIPT_SIGNING_KEY), key = encryptionKey(env.ENVELOPE_ENCRYPTION_KEY);
  const { proof } = await verifyContracts(env), noir = createNoir(config), store = configuredStore(env);
  let sessionId: string | undefined;
  try {
    const [agent] = await store.db.select().from(s.agent).where(and(eq(s.agent.publicKey, env.DEMO_AGENT_PUBLIC_KEY!), eq(s.agent.deviceHash, env.DEMO_DEVICE_HASH!)));
    if (!agent || agent.deviceContractId !== config.network.contracts.deviceRegistry || agent.agentContractId !== config.network.contracts.agentRegistry || agent.escrowContractId !== config.network.contracts.paymentEscrow || agent.assetContractId !== config.asset) throw new SpikeGuardError('DB_DEPLOYMENT_IDENTITY_NOT_READY');
    const [{ last }, policy, owner, deviceAgent, token, escrow, pending] = await Promise.all([
      store.db.select({ last: sql<string>`coalesce(max(nonce),0)::text` }).from(s.paymentAttempt).where(eq(s.paymentAttempt.agentId, agent.id)).then(rows => rows[0]!),
      noir.getPolicy(agent.deviceHash), noir.getDeviceOwner(agent.deviceHash), noir.getDeviceAgent(agent.deviceHash), noir.getEscrowToken(agent.deviceHash), noir.getEscrowBalance(agent.deviceHash), noir.getPendingBalance(env.DEMO_MERCHANT_PUBLIC_KEY!),
    ]);
    if (last !== agent.lastNonce || owner !== env.DEMO_OWNER_PUBLIC_KEY || deviceAgent !== agent.publicKey || token !== config.asset) throw new SpikeGuardError('NONCE_OR_DEVICE_CONTINUITY_NOT_VERIFIED');
    const savedAttempt = idSchema.nullable().parse(await readSpikeRecord(`${purchaseDirectory}/cli-attempt.json`));
    if (observeOnly) {
      if (!savedAttempt) throw new SpikeGuardError('SAVED_HANDOFF_IDENTITY_REQUIRED');
      const saved = await paymentSnapshot(store, savedAttempt.id);
      if (saved.agent.id !== agent.id || !saved.attempt.handoffCommittedAt || !saved.attempt.veloRequestId || !saved.attempt.innerHash) throw new SpikeGuardError('SAVED_HANDOFF_IDENTITY_REQUIRED');
    }
    // Recovery after dispatch needs no current policy or escrow permission.
    if (!savedAttempt && (!policy?.expiresAt || policy.agent !== agent.publicKey || policy.asset !== config.asset || policy.maxAmount < 300000n || policy.expiresAt.getTime() <= Date.now() || escrow < 300000n)) throw new SpikeGuardError('CURRENT_POLICY_OR_ESCROW_NOT_READY');
    if (!execute) return { classification: 'actual-read-only-purchase-preflight', network: 'testnet', deviceHash: agent.deviceHash, lastNonce: agent.lastNonce, policyExpiresAt: policy?.expiresAt, escrowStroops: escrow.toString(), savedAttemptId: savedAttempt?.id ?? null, veloReadiness: 'must-validate-real-reservation-before-handoff', purchaseExecuted: false, deploymentVerification: proof };
    const live = await createLivePaymentAdapter(env, store);
    const adapter = observeOnly ? observationOnly(live) : live;
    await mkdir(purchaseDirectory, { recursive: true, mode: 0o700 });
    let keys = keysSchema.nullable().parse(await readSpikeRecord(`${purchaseDirectory}/cli-keys.json`));
    if (observeOnly && !keys) throw new SpikeGuardError('SMOKE_CHECKPOINT_INCOMPLETE');
    if (!keys) { keys = { runStartKey: randomUUID(), clientKey: randomUUID(), agentId: agent.id }; await checkpoint('keys', keys); }
    if (keys.agentId !== agent.id) throw new SpikeGuardError('SMOKE_AGENT_IDENTITY_CONFLICT');
    let savedRun = idSchema.nullable().parse(await readSpikeRecord(`${purchaseDirectory}/cli-run.json`));
    if (observeOnly && !savedRun) throw new SpikeGuardError('SMOKE_CHECKPOINT_INCOMPLETE');
    if (!savedRun) {
      const run = await createRun(store, { ownerId: agent.ownerId, agentId: agent.id, runStartKey: keys.runStartKey, task: 'CLI acceptance: deliberately buy one fictional QuickSignal report for 300000 stroops', modelId: 'cli-acceptance-no-model', budgetStroops: '300000' });
      savedRun = { id: run.id }; await checkpoint('run', savedRun);
    }
    const issued = await issueSession(store, { role: 'worker', ownerId: agent.ownerId, runId: savedRun.id }); sessionId = issued.session.id;
    const app = createApplication({ store, env, wallet: async () => { throw new Error('CLI_WALLET_UNAVAILABLE'); }, wake: async () => {} });
    async function request(path: string, status: number, method = 'GET', body?: unknown) {
      const response = await app(new Request(new URL(path, env.APP_ORIGIN), { method, headers: { authorization: `Bearer ${issued.token}`, 'content-type': 'application/json', 'idempotency-key': keys!.clientKey }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
      const value: unknown = await response.json();
      if (response.status !== status) {
        const parsed = z.object({ error: z.object({ code: z.string() }) }).safeParse(value);
        throw new SpikeGuardError(parsed.success ? parsed.data.error.code : 'SMOKE_HTTP_UNEXPECTED_STATUS');
      }
      return value;
    }
    let savedQuote = idSchema.nullable().parse(await readSpikeRecord(`${purchaseDirectory}/cli-quote.json`));
    if (observeOnly && !savedQuote) throw new SpikeGuardError('SMOKE_CHECKPOINT_INCOMPLETE');
    if (!savedQuote) {
      if (!await readSpikeRecord(`${purchaseDirectory}/cli-before.json`)) await checkpoint('before', { escrowStroops: escrow.toString(), pendingStroops: pending.toString() });
      const challenge = z.object({ quoteId: z.uuid(), amountStroops: z.literal('300000'), merchantAddress: z.literal(env.DEMO_MERCHANT_PUBLIC_KEY!), resourceKey: z.literal('quick-signal:demo-parser:v1') }).parse(await request(`/api/demo/quick-signal?dependency=demo-parser&runId=${savedRun.id}`, 402));
      savedQuote = { id: challenge.quoteId }; await checkpoint('quote', savedQuote);
    }
    const saved = savedAttempt ? await paymentSnapshot(store, savedAttempt.id) : null;
    if (saved && (saved.agent.id !== agent.id || saved.quote.runId !== savedRun.id || saved.quote.id !== savedQuote.id)) throw new SpikeGuardError('SMOKE_ATTEMPT_IDENTITY_CONFLICT');
    const accepted = saved ? { attemptId: saved.attempt.id, quoteId: saved.quote.id } : z.object({ attemptId: z.uuid(), quoteId: z.literal(savedQuote.id) }).parse(await request('/api/v1/payment-attempts', 202, 'POST', { quoteId: savedQuote.id }));
    if (!savedAttempt) await checkpoint('attempt', { id: accepted.attemptId });
    else if (savedAttempt.id !== accepted.attemptId) throw new SpikeGuardError('SMOKE_ATTEMPT_IDENTITY_CONFLICT');
    console.info(JSON.stringify({ gate: 'purchase:smoke', classification: observeOnly ? 'actual-testnet-payment-observation-only' : 'actual-testnet-payment-in-progress', attemptId: accepted.attemptId, quoteId: savedQuote.id, amountStroops: '300000' }));
    // Polling invokes observation on the saved attempt. processPayment's SQL
    // marker guarantees no new sign/sponsor/submit after the initial handoff.
    const deadline = Date.now() + 90000;
    let snapshot = await paymentSnapshot(store, accepted.attemptId);
    while (Date.now() < deadline) {
      await processPayment(store, accepted.attemptId, adapter, key, receipt.hash);
      snapshot = await paymentSnapshot(store, accepted.attemptId);
      if (['authorized', 'refused', 'expired', 'failed', 'manual_review'].includes(snapshot.attempt.status)) break;
      await new Promise(resolve => setTimeout(resolve, 2500));
    }
    const view = z.object({ status: z.literal('authorized'), receiptId: z.uuid() }).safeParse(await request(`/api/v1/payment-attempts/${accepted.attemptId}`, 200));
    if (!view.success) throw new SpikeGuardError('PAID_RESOURCE_GATE_UNRESOLVED', [], 'unresolved');
    const metadata = z.object({ evidence: z.record(z.string(), z.unknown()), validUntil: z.string() }).parse(await request(`/api/v1/receipts/${view.data.receiptId}`, 200));
    const content = z.object({ isDemo: z.literal(true), resourceKey: z.literal('quick-signal:demo-parser:v1'), receiptId: z.literal(view.data.receiptId), report: z.object({ findings: z.array(z.string()).min(1) }) }).parse(await request(`/api/v1/receipts/${view.data.receiptId}/resource`, 200));
    const before = z.object({ escrowStroops: z.string(), pendingStroops: z.string() }).parse(await readSpikeRecord(`${purchaseDirectory}/cli-before.json`));
    const after = { escrowStroops: (await noir.getEscrowBalance(agent.deviceHash)).toString(), pendingStroops: (await noir.getPendingBalance(env.DEMO_MERCHANT_PUBLIC_KEY!)).toString() };
    if (BigInt(before.escrowStroops) - BigInt(after.escrowStroops) !== 300000n || BigInt(after.pendingStroops) - BigInt(before.pendingStroops) !== 300000n) throw new SpikeGuardError('PURCHASE_BALANCE_DELTA_MISMATCH', [], 'unresolved');
    await store.transaction(async db => {
      await db.update(s.agentRun).set({ status: 'completed', finishedAt: sql`clock_timestamp()` }).where(and(eq(s.agentRun.id, savedRun.id), eq(s.agentRun.status, 'running')));
      await db.update(s.job).set({ status: 'done', leaseOwner: null, leaseUntil: null }).where(and(eq(s.job.entityId, savedRun.id), eq(s.job.kind, 'run')));
      await db.update(s.job).set({ status: 'done', leaseOwner: null, leaseUntil: null }).where(and(eq(s.job.entityId, accepted.attemptId), eq(s.job.kind, 'reconcile')));
    });
    return { classification: 'actual-testnet-cli-paid-resource', observedAt: new Date().toISOString(), runId: savedRun.id, quoteId: savedQuote.id, attemptId: accepted.attemptId, operationId: snapshot.attempt.operationId, nonce: snapshot.attempt.nonce, veloRequestId: snapshot.attempt.veloRequestId, evidence: metadata.evidence, receiptId: view.data.receiptId, validUntil: metadata.validUntil, resourceKey: content.resourceKey, reportDelivered: true, reportBodyExported: false, merchantClaim: 'separate-not-executed', before, after, deploymentVerification: proof };
  } finally {
    if (sessionId) await store.db.update(s.session).set({ revokedAt: sql`clock_timestamp()` }).where(eq(s.session.id, sessionId)).catch(() => {});
    await store.close(); key.fill(0);
  }
}
async function main() {
  const args = process.argv.slice(2);
  try {
    if (args.length > 1 || args.some(arg => !['--setup', '--preflight', '--execute', '--observe'].includes(arg))) throw new SpikeGuardError('UNSUPPORTED_PURCHASE_SMOKE_ARGUMENT');
    const report = args[0] === '--setup' ? await setupPurchase(process.env) : await purchaseSmoke(process.env, args[0] === '--execute' || args[0] === '--observe', args[0] === '--observe');
    await mkdir('docs/evidence/finals-payment', { recursive: true });
    const artifact = `docs/evidence/finals-payment/${report.classification}-${Date.now()}.json`;
    await writeFile(artifact, JSON.stringify(report, (_k, v: unknown) => typeof v === 'bigint' ? v.toString() : v, 2) + '\n', { flag: 'wx' });
    console.info(JSON.stringify({ gate: 'purchase:smoke', status: 'passed', classification: report.classification, artifact }));
  } catch (error) {
    const result = error instanceof DomainError ? { status: 'not_run', code: error.code } : safeFailure(error);
    console.error(JSON.stringify({ gate: 'purchase:smoke', ...result })); process.exitCode = 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
