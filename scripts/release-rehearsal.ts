// Explicit, isolated application rehearsal. Default is inert. No spike journal,
// original worker configuration, setup, funding, owner signing or claim dispatch.
import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { accountSchema, amountSchema, hashSchema, resourceKeySchema } from '@aegispay/shared';
import { configuredStore } from '../src/server/db/connection.ts';
import * as s from '../src/server/db/schema.ts';
import { createRun, quoteTermsHash } from '../src/server/domain/purchases.ts';
import { createNoir, readTestnetConfig } from '../src/server/integrations/noir.ts';
import { createVelo, validateExecution } from '../src/server/integrations/velo.ts';
import { authorizationVerifier } from '../src/server/integrations/payment-verifier.ts';
import { createGeminiClient, type GeminiClient } from '../src/server/integrations/model.ts';
import { verifyContracts } from './verify-contracts.ts';
import { assertNonceContinuity } from '../apps/server/src/worker/continuity.ts';
import { paymentSnapshot } from '../apps/server/src/worker/payment.ts';
import { claimJob, finishJob } from '../apps/server/src/worker/queue.ts';
import { processRun } from '../apps/server/src/worker/run.ts';

export const QUARANTINED_ATTEMPT = 'f69178b7-0b0b-46fa-8e82-65c2dd5deee5';
const QUARANTINED_DEVICE = '790905edd7c6d36e300d0149ed6d73ef60db6bcc6635c50fa2b7312dc7bbeb7c';
export const releaseManifest = z.strictObject({
  network: z.literal('testnet'), agentId: z.uuid().refine(v => v !== 'e901976a-7ef3-4784-b510-bc1632935d35'), ownerPublicKey: accountSchema, agentPublicKey: accountSchema,
  merchantPublicKey: accountSchema, deviceHash: hashSchema.refine(v => v !== QUARANTINED_DEVICE), runStartKey: z.uuid(), task: z.string().min(1).max(2000),
  maxPaymentStroops: amountSchema.refine(v => BigInt(v) <= 1000000n),
  expectedPrices: z.strictObject({ 'quick-signal:demo-parser:v1': amountSchema, 'deep-trace:demo-parser:v1': amountSchema }),
  attemptIds: z.array(z.uuid()).max(2).refine(ids => new Set(ids).size === ids.length && !ids.includes(QUARANTINED_ATTEMPT)),
});
export type ReleaseManifest = z.infer<typeof releaseManifest>;
export const manifestDigest = (manifest: ReleaseManifest) => createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
export function validateConsent(raw: unknown, manifest: ReleaseManifest, now = Date.now()) {
  const consent = z.strictObject({ manifestSha256: hashSchema, purchaseCount: z.literal(1), network: z.literal('testnet'),
    userStatement: z.literal('I authorize one fresh independent Testnet model purchase within this exact manifest.'),
    approvedAt: z.iso.datetime(), expiresAt: z.iso.datetime() }).parse(raw);
  if (consent.manifestSha256 !== manifestDigest(manifest) || Date.parse(consent.approvedAt) > now ||
    Date.parse(consent.expiresAt) <= now || Date.parse(consent.approvedAt) < now - 900000 ||
    Date.parse(consent.expiresAt) > Date.parse(consent.approvedAt) + 900000) throw new Error('FRESH_EXACT_PURCHASE_CONSENT_REQUIRED');
}
async function boundedText(file: string) {
  const handle = await open(file, 'r');
  try {
    const stat = await handle.stat(); if (!stat.isFile() || stat.size > 65536) throw new Error('RELEASE_FILE_INVALID');
    const buffer = Buffer.alloc(65537); const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > 65536) throw new Error('RELEASE_FILE_INVALID'); return buffer.subarray(0, bytesRead).toString('utf8');
  } finally { await handle.close(); }
}
export async function rehearse(phase: string, manifest: ReleaseManifest, env: NodeJS.ProcessEnv) {
  if (!['preflight', 'wallet-checkpoint', 'model-no-purchase', 'purchase', 'resume', 'observe'].includes(phase)) throw new Error('RELEASE_PHASE_REQUIRED');
  if (phase === 'purchase') throw new Error('PURCHASE_PHASE_DISABLED_EXACT_DURABLE_AUTHORITY_REQUIRED');
  if (env.RUN_TESTNET !== '1') throw new Error('EXPLICIT_TESTNET_OPT_IN_REQUIRED');
  if (manifest.ownerPublicKey !== env.DEMO_OWNER_PUBLIC_KEY || manifest.agentPublicKey !== env.DEMO_AGENT_PUBLIC_KEY ||
    manifest.merchantPublicKey !== env.DEMO_MERCHANT_PUBLIC_KEY || manifest.deviceHash !== env.DEMO_DEVICE_HASH) throw new Error('RELEASE_CONTEXT_MISMATCH');
  const config = readTestnetConfig(env), store = configuredStore(env);
  try {
    const [agent] = await store.db.select().from(s.agent).where(eq(s.agent.id, manifest.agentId));
    const [owner] = agent ? await store.db.select().from(s.owner).where(eq(s.owner.id, agent.ownerId)) : [];
    const [quarantine] = await store.db.select().from(s.paymentAttempt).where(eq(s.paymentAttempt.id, QUARANTINED_ATTEMPT));
    if (!agent || owner?.walletAddress !== manifest.ownerPublicKey || agent.publicKey !== manifest.agentPublicKey || agent.deviceHash !== manifest.deviceHash ||
      agent.network !== 'testnet' || agent.assetContractId !== config.asset || agent.deviceContractId !== config.network.contracts.deviceRegistry ||
      agent.agentContractId !== config.network.contracts.agentRegistry || agent.escrowContractId !== config.network.contracts.paymentEscrow ||
      quarantine?.agentId === agent.id) throw new Error('INDEPENDENT_RELEASE_AGENT_REQUIRED');
    const offers = await store.db.select().from(s.resource).where(eq(s.resource.enabled, true));
    if (offers.length !== 2 || offers.some(o => !resourceKeySchema.safeParse(o.resourceKey).success || o.priceStroops !== manifest.expectedPrices[o.resourceKey as keyof ReleaseManifest['expectedPrices']] || o.assetContractId !== config.asset)) throw new Error('RELEASE_CATALOG_MISMATCH');
    for (const offer of offers) {
      const [merchant] = await store.db.select().from(s.merchant).where(eq(s.merchant.id, offer.merchantId));
      if (!merchant?.allowlisted || merchant.walletAddress !== manifest.merchantPublicKey) throw new Error('RELEASE_MERCHANT_MISMATCH');
    }
    await verifyContracts(env); await assertNonceContinuity(store, agent);
    const noir = createNoir(config);
    const [chainOwner, chainAgent, policy, escrow] = await Promise.all([noir.getDeviceOwner(agent.deviceHash), noir.getDeviceAgent(agent.deviceHash), noir.getPolicy(agent.deviceHash), noir.getEscrowBalance(agent.deviceHash)]);
    if (chainOwner !== manifest.ownerPublicKey || chainAgent !== agent.publicKey) throw new Error('RELEASE_CHAIN_ACTOR_MISMATCH');
    const base = { classification: 'actual-application-release-rehearsal', phase, observedAt: new Date().toISOString(), manifestSha256: manifestDigest(manifest), agentId: agent.id,
      originalIncident: quarantine ? 'excluded-no-writes' : 'absent-from-target-database-no-preservation-claim', fullRelease: false };
    if (phase === 'preflight' || phase === 'wallet-checkpoint') return { ...base, status: 'passed', lastNonce: agent.lastNonce,
      policyReady: !!policy?.expiresAt && policy.expiresAt.getTime() > Date.now() && policy.agent === agent.publicKey && policy.asset === config.asset && policy.maxAmount > 0n,
      escrowStroops: escrow.toString(), financialActions: 0, missing: ['MANUAL_FREIGHTER_LIFECYCLE_EVIDENCE', 'FULL_HOSTED_QUALIFICATION'] };
    if (phase === 'observe' || phase === 'resume') {
      if (phase === 'observe' && manifest.attemptIds.length !== 2 || phase === 'resume' && manifest.attemptIds.length !== 1) throw new Error('EXACT_APPLICATION_ATTEMPT_IDS_REQUIRED');
      const proofs = [];
      for (const id of manifest.attemptIds) {
        const snapshot = await paymentSnapshot(store, id);
        if (snapshot.agent.id !== agent.id || snapshot.quote.termsHash !== quoteTermsHash(snapshot.quote) || !snapshot.attempt.handoffCommittedAt || !snapshot.attempt.veloRequestId || !snapshot.attempt.innerHash) throw new Error('SAVED_RELEASE_HANDOFF_REQUIRED');
        const execution = validateExecution(await createVelo(env).gas.getStatus({ requestId: snapshot.attempt.veloRequestId, transactionHash: snapshot.attempt.innerHash }), { requestId: snapshot.attempt.veloRequestId, transactionHash: snapshot.attempt.innerHash });
        const proof = await authorizationVerifier(noir, config)({ ...snapshot, execution });
        proofs.push({ attemptId: id, operationId: proof.operationId, nonce: proof.nonce, innerHash: proof.innerHash, outerHash: proof.outerHash, observedEventTxHash: proof.observedEventTxHash, ledger: proof.ledgerSequence });
      }
      for (const field of ['operationId', 'nonce', 'innerHash'] as const) if (new Set(proofs.map(p => p[field])).size !== proofs.length) throw new Error('DISTINCT_APPLICATION_PURCHASES_REQUIRED');
      return { ...base, status: 'passed', proofs, financialActions: 0, entitlementGranted: false, limit: 'Identity-only independent verifier; no receipt grant, model resume, claim or full-release acceptance.' };
    }
    if (!policy?.expiresAt || policy.expiresAt.getTime() <= Date.now() || policy.agent !== agent.publicKey || policy.asset !== config.asset || policy.maxAmount < BigInt(manifest.maxPaymentStroops) || escrow < BigInt(manifest.maxPaymentStroops)) throw new Error('FINITE_RELEASE_POLICY_AND_ESCROW_REQUIRED');
    const held = await store.db.select().from(s.paymentAttempt).where(and(eq(s.paymentAttempt.agentId, agent.id), sql`${s.paymentAttempt.status} NOT IN ('authorized','refused','expired','failed')`));
    if (held.length) throw new Error('RELEASE_PAYMENT_UNRESOLVED_OBSERVE_ONLY');
    const [existing] = await store.db.select().from(s.agentRun).where(and(eq(s.agentRun.ownerId, agent.ownerId), eq(s.agentRun.runStartKey, manifest.runStartKey)));
    if (existing) throw new Error('RELEASE_RUN_EXISTS_OBSERVE_ONLY');
    if (!env.AGENT_MODEL) throw new Error('AGENT_MODEL_REQUIRED');
    if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY_REQUIRED');
    // Authority is persisted before the ordinary job becomes visible. Even a
    // competing normal consumer/restart cannot buy from a zero-budget run.
    // Tools still use the actual HTTP boundary. This is a diagnostic only.
    const run = await createRun(store, { ownerId: agent.ownerId, agentId: agent.id, runStartKey: manifest.runStartKey,
      task: manifest.task, modelId: env.AGENT_MODEL, budgetStroops: '0' });
    const runId = run.id;
    const real = createGeminiClient({ apiKey: env.GEMINI_API_KEY, model: env.AGENT_MODEL });
    const client: GeminiClient = { async generateStep(contents, tools, signal) {
      const step = await real.generateStep(contents, tools, signal);
      if (step.calls.some(c => c.name === 'purchase_quote' || c.name === 'read_purchase')) throw new Error('RELEASE_PURCHASE_NOT_CONSENTED');
      return step;
    } };
    const job = await claimJob(store, ['run'], runId); if (!job) throw new Error('RELEASE_RUN_LEASE_REQUIRED');
    let done = false;
    try { done = await processRun({ store, job, env, client }); } finally { await finishJob(store, job, done); }
    const attempts = await store.db.select().from(s.paymentAttempt).innerJoin(s.quote, eq(s.quote.id, s.paymentAttempt.quoteId)).where(eq(s.quote.runId, runId));
    if (phase === 'model-no-purchase' && attempts.length) throw new Error('NONFINANCIAL_REHEARSAL_INVARIANT');
    const [observedRun] = await store.db.select().from(s.agentRun).where(eq(s.agentRun.id, runId));
    return { ...base, status: phase === 'model-no-purchase' && observedRun?.status === 'completed' && !attempts.length ? 'passed' : 'incomplete', runId, runStatus: observedRun?.status,
      attemptIds: attempts.map(a => a.payment_attempt.id), financialActions: 0,
      limit: 'Zero-budget diagnostic is not sensible no-purchase with available budget. Purchase execution is disabled pending durable exact-price/deadline authority.' };
  } finally {
    await store.close();
  }
}
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.info(JSON.stringify({ status: 'not_run', gate: 'release-rehearsal', financialActions: 0, missing: ['EXPLICIT_PHASE', 'INDEPENDENT_RELEASE_MANIFEST', 'ISOLATED_RELEASE_ENVIRONMENT', 'FRESH_USER_CONSENT_BEFORE_PURCHASE'] })); process.exitCode = 2; return;
  }
  const options = z.strictObject({ '--phase': z.string(), '--manifest': z.string(), '--worker-env-file': z.literal('.env.release.worker.local') })
    .parse(Object.fromEntries(Array.from({ length: args.length / 2 }, (_, i) => [args[i * 2], args[i * 2 + 1]])));
  if (args.length % 2 || new Set(args.filter((_, i) => i % 2 === 0)).size !== args.length / 2) throw new Error('RELEASE_ARGUMENTS_INVALID');
  if (options['--phase'] === 'purchase') {
    console.info(JSON.stringify({ status: 'not_run', gate: 'release-rehearsal', code: 'PURCHASE_PHASE_DISABLED_EXACT_DURABLE_AUTHORITY_REQUIRED', financialActions: 0 }));
    process.exitCode = 2; return;
  }
  const manifest = releaseManifest.parse(JSON.parse(await boundedText(options['--manifest'])));
  const env = { ...parseEnv(await boundedText(options['--worker-env-file'])), RUN_TESTNET: process.env.RUN_TESTNET ?? '0' };
  const report = await rehearse(options['--phase'], manifest, env);
  console.info(JSON.stringify(report)); if (report.status !== 'passed') process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main().catch(() => {
  console.error(JSON.stringify({ status: 'not_run_or_incomplete', gate: 'release-rehearsal', code: 'RELEASE_PREREQUISITE_OR_GATE_FAILED', limit: 'Inspect authenticated state by saved manifest/run identity; do not create a replacement intent.' })); process.exitCode = 1;
});
