// Headless, disposable Testnet fixture only. Product persistence remains TASK-003.
import { createHash, randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Keypair, rpc } from '@stellar/stellar-sdk';
import { NoirContractError, type NoirAgentClient, type NoirEvent } from '@noirx402/agent-sdk';
import { z } from 'zod';
import type { GasApi } from '@carts1024/velo-sdk';
import { SpikeJournal, readSpikeRecord, writeSpikeRecord } from './spike-journal.ts';
import { inspectAuthorization, SpikeGuardError, type AuthorizationIntent } from './noir.ts';
import { spikeDigest, walletOperationOnce, type SpikeConfig, type WalletClient, type WalletOperation } from './spike-runtime.ts';
import { handoffOnce, validateExecution } from './velo.ts';
import { decodeMatchedNoirEvent, verifyAuthorizationEvidence, verifyClaimEvent } from './stellar-evidence.ts';

const fixtureSchema = z.object({ version: z.literal(1), operationId: z.string().uuid(), bindingHash: z.string().regex(/^[a-f0-9]{64}$/),
  deviceHash: z.string().regex(/^[a-f0-9]{64}$/), policyExpiresAt: z.number().int().positive() }).strict();
const balanceSchema = z.object({ escrow: z.string().regex(/^\d+$/), pending: z.string().regex(/^\d+$/), observedAt: z.string() }).strict();
const walletProofSchema = z.object({ hash: z.string().regex(/^[a-f0-9]{64}$/), ledger: z.number().int().positive(), source: z.string(), operation: z.string() }).strict();
const setupSchema = z.object({ classification: z.literal('live-noir-disposable-fixture-setup'), deviceHash: z.string(), registration: walletProofSchema,
  policy: walletProofSchema, funding: walletProofSchema, policyMaxStroops: z.literal('1000000'), policyExpiresAt: z.number().int().positive(), escrowStroops: z.literal('10000000') }).strict();
const refusalSchema = z.object({ classification: z.literal('live-contract-simulation-refusal'), includedTransaction: z.literal(false), signedOrSubmitted: z.literal(false),
  amountStroops: z.literal('1200000'), capStroops: z.literal('1000000'), errorName: z.literal('AgentNotAuthorized'), deviceHash: z.string(),
  before: balanceSchema, after: balanceSchema }).strict();
type Fixture = z.infer<typeof fixtureSchema>;
export interface SpikeContext {
  directory: string; config: SpikeConfig; noir: NoirAgentClient; gas: GasApi;
  owner: Keypair; agent: Keypair; merchant: Keypair; encryptionKey: Buffer;
  bindingHash: string;
}
export async function loadFixture(ctx: SpikeContext, create = false): Promise<Fixture> {
  await mkdir(ctx.directory, { recursive: true, mode: 0o700 });
  const file = join(ctx.directory, 'fixture.json');
  if (create && await readSpikeRecord(file) === null) {
    const operationId = randomUUID();
    await writeSpikeRecord(file, { version: 1, operationId, bindingHash: ctx.bindingHash,
      deviceHash: createHash('sha256').update(`aegispay:${operationId}:${ctx.owner.publicKey()}:${ctx.agent.publicKey()}`).digest('hex'),
      policyExpiresAt: Math.floor(Date.now() / 1000) * 1000 + 3600000 });
  }
  const fixture = fixtureSchema.safeParse(await readSpikeRecord(file));
  if (!fixture.success) throw new SpikeGuardError('SPIKE_FIXTURE_MISSING_OR_INVALID');
  if (fixture.data.bindingHash !== ctx.bindingHash) throw new SpikeGuardError('SPIKE_DEPLOYMENT_OR_ACTOR_MISMATCH');
  return fixture.data;
}
function walletClient(noir: NoirAgentClient): WalletClient {
  return { prepare: (source, operation) => noir.prepare(source, operation), submit: (signed, operation) => noir.submit(signed, operation),
    getTransaction: hash => noir.server.getTransaction(hash) };
}
async function wallet(ctx: SpikeContext, name: string, signer: Keypair, operation: WalletOperation) {
  return walletOperationOnce({ directory: join(ctx.directory, name), client: walletClient(ctx.noir), signer, operation, config: ctx.config });
}
async function assertFixture(ctx: SpikeContext, fixture: Fixture) {
  const [owner, agent, policy, asset] = await Promise.all([ctx.noir.getDeviceOwner(fixture.deviceHash), ctx.noir.getDeviceAgent(fixture.deviceHash),
    ctx.noir.getPolicy(fixture.deviceHash), ctx.noir.getEscrowToken(fixture.deviceHash)]);
  if (owner !== ctx.owner.publicKey() || agent !== ctx.agent.publicKey() || !policy || policy.agent !== ctx.agent.publicKey() ||
      policy.asset !== ctx.config.asset || policy.maxAmount !== 1000000n || policy.expiresAt?.getTime() !== fixture.policyExpiresAt ||
      fixture.policyExpiresAt <= Date.now() || asset !== ctx.config.asset) throw new SpikeGuardError('SPIKE_FIXTURE_POLICY_MISMATCH');
}
export async function provisionSpike(ctx: SpikeContext) {
  const fixture = await loadFixture(ctx, true);
  if (fixture.policyExpiresAt <= Date.now()) throw new SpikeGuardError('SPIKE_FIXTURE_EXPIRED');
  if (await readSpikeRecord(join(ctx.directory, 'payment', 'operation.json')) !== null) throw new SpikeGuardError('SPIKE_FIXTURE_ALREADY_IN_USE');
  const registration = await wallet(ctx, 'register-device', ctx.owner, { kind: 'registerDevice', deviceHash: fixture.deviceHash, agent: ctx.agent.publicKey() });
  const policy = await wallet(ctx, 'register-policy', ctx.owner, { kind: 'registerAgent', deviceHash: fixture.deviceHash, agent: ctx.agent.publicKey(),
    asset: ctx.config.asset, maxAmount: 1000000n, expiresAt: new Date(fixture.policyExpiresAt) });
  const funding = await wallet(ctx, 'fund-escrow', ctx.owner, { kind: 'fundEscrow', deviceHash: fixture.deviceHash, token: ctx.config.asset, amount: 10000000n });
  await assertFixture(ctx, fixture);
  if (await ctx.noir.getEscrowBalance(fixture.deviceHash) !== 10000000n) throw new SpikeGuardError('SPIKE_INITIAL_ESCROW_MISMATCH');
  const proof = { classification: 'live-noir-disposable-fixture-setup', deviceHash: fixture.deviceHash, registration, policy, funding,
    policyMaxStroops: '1000000', policyExpiresAt: fixture.policyExpiresAt, escrowStroops: '10000000' };
  await writeSpikeRecord(join(ctx.directory, 'setup-proof.json'), proof);
  return proof;
}
async function balances(ctx: SpikeContext, fixture: Fixture) {
  const [escrow, pending] = await Promise.all([ctx.noir.getEscrowBalance(fixture.deviceHash), ctx.noir.getPendingBalance(ctx.merchant.publicKey())]);
  return { escrow: escrow.toString(), pending: pending.toString(), observedAt: new Date().toISOString() };
}
async function refusal(ctx: SpikeContext, fixture: Fixture) {
  const existing = await readSpikeRecord(join(ctx.directory, 'refusal.json'));
  if (existing !== null) {
    const proof = refusalSchema.safeParse(existing);
    if (!proof.success || proof.data.deviceHash !== fixture.deviceHash || proof.data.before.escrow !== proof.data.after.escrow ||
        proof.data.before.pending !== proof.data.after.pending) throw new SpikeGuardError('SAVED_REFUSAL_PROOF_INVALID');
    return proof.data;
  }
  const before = await balances(ctx, fixture);
  if (BigInt(before.escrow) < 1200000n) throw new SpikeGuardError('SPIKE_REFUSAL_NEEDS_SUFFICIENT_ESCROW');
  const preflight = await ctx.noir.checkPayment({ deviceHash: fixture.deviceHash, agent: ctx.agent.publicKey(), asset: ctx.config.asset, amount: 1200000n });
  if (preflight.ok || preflight.reason !== 'over_limit') throw new SpikeGuardError('EXPECTED_OVER_CAP_PREFLIGHT_MISSING');
  let rejected = false;
  try {
    await ctx.noir.prepare(ctx.agent.publicKey(), { kind: 'authorize', deviceHash: fixture.deviceHash, merchant: ctx.merchant.publicKey(),
      asset: ctx.config.asset, amount: 1200000n, nonce: 1n });
  } catch (error) {
    rejected = error instanceof NoirContractError && error.contract === 'paymentEscrow' && error.method === 'authorize' && error.errorName === 'AgentNotAuthorized';
    if (!rejected) throw new SpikeGuardError('CONTRACT_REFUSAL_NOT_VERIFIED');
  }
  if (!rejected) throw new SpikeGuardError('OVER_CAP_SIMULATION_UNEXPECTEDLY_ACCEPTED');
  const after = await balances(ctx, fixture);
  if (before.escrow !== after.escrow || before.pending !== after.pending) throw new SpikeGuardError('REFUSAL_BALANCE_MISMATCH');
  const proof = { classification: 'live-contract-simulation-refusal', includedTransaction: false, signedOrSubmitted: false,
    amountStroops: '1200000', capStroops: '1000000', errorName: 'AgentNotAuthorized', deviceHash: fixture.deviceHash, before, after };
  await writeSpikeRecord(join(ctx.directory, 'refusal.json'), proof);
  return proof;
}
async function eventFor(ctx: SpikeContext, chain: rpc.Api.GetSuccessfulTransactionResponse, type: NoirEvent['type'], hashes: string[]) {
  const filters = [{ type: 'contract' as const, contractIds: [ctx.config.network.contracts.paymentEscrow] }];
  let page = await ctx.noir.server.getEvents({ startLedger: chain.ledger, limit: 100, filters });
  for (let count = 0; count < 5; count++) {
    const matches = page.events.map(event => decodeMatchedNoirEvent(event, chain, ctx.config.network.contracts.paymentEscrow))
      .filter((event): event is NoirEvent => event !== null && event.type === type && hashes.includes(event.txHash));
    if (matches.length === 1) return matches[0]!;
    if (matches.length > 1) throw new SpikeGuardError('AMBIGUOUS_NOIR_EVENT');
    if (page.events.length < 100) break;
    page = await ctx.noir.server.getEvents({ cursor: page.cursor, limit: 100, filters });
  }
  throw new SpikeGuardError('NOIR_EVENT_UNAVAILABLE');
}
export async function executeSpike(ctx: SpikeContext) {
  const fixture = await loadFixture(ctx);
  const setup = setupSchema.safeParse(await readSpikeRecord(join(ctx.directory, 'setup-proof.json')));
  if (!setup.success || setup.data.deviceHash !== fixture.deviceHash || setup.data.policyExpiresAt !== fixture.policyExpiresAt ||
      setup.data.registration.source !== ctx.owner.publicKey() || setup.data.policy.source !== ctx.owner.publicKey() || setup.data.funding.source !== ctx.owner.publicKey() ||
      setup.data.registration.operation !== 'registerDevice' || setup.data.policy.operation !== 'registerAgent' || setup.data.funding.operation !== 'fundEscrow') throw new SpikeGuardError('SPIKE_SETUP_PROOF_MISSING_OR_INVALID');
  const paymentDirectory = join(ctx.directory, 'payment');
  const operation = await readSpikeRecord(join(paymentDirectory, 'operation.json'));
  if (operation === null) {
    await assertFixture(ctx, fixture);
    await refusal(ctx, fixture);
    const current = await balances(ctx, fixture);
    if (current.escrow !== '10000000' || current.pending !== '0') throw new SpikeGuardError('SPIKE_BASELINE_MISMATCH');
    await writeSpikeRecord(join(ctx.directory, 'before-payment.json'), current);
    const expiresAt = Date.now() + 120000;
    const intent = { agent: ctx.agent.publicKey(), merchant: ctx.merchant.publicKey(), deviceHash: fixture.deviceHash,
      asset: ctx.config.asset, escrow: ctx.config.network.contracts.paymentEscrow, amount: 300000n, nonce: 1n, expiresAt };
    await SpikeJournal.open(paymentDirectory, ctx.encryptionKey, { operationId: `${fixture.operationId}:authorize`, nonce: '1', expiresAt, intentHash: spikeDigest(intent) });
  }
  const journal = await SpikeJournal.open(paymentDirectory, ctx.encryptionKey);
  const intent: AuthorizationIntent = { agent: ctx.agent.publicKey(), merchant: ctx.merchant.publicKey(), deviceHash: fixture.deviceHash,
    asset: ctx.config.asset, escrow: ctx.config.network.contracts.paymentEscrow, amount: 300000n, nonce: BigInt(journal.operation.nonce), expiresAt: journal.operation.expiresAt };
  if (journal.operation.operationId !== `${fixture.operationId}:authorize` || journal.operation.nonce !== '1' || journal.operation.intentHash !== spikeDigest(intent)) throw new SpikeGuardError('SAVED_PAYMENT_INTENT_MISMATCH');
  const before = balanceSchema.parse(await readSpikeRecord(join(ctx.directory, 'before-payment.json')));
  let saved = await journal.load();
  let result;
  if (saved.handoffCommittedAt !== null) {
    if (!saved.identity) throw new SpikeGuardError('HANDOFF_IDENTITY_MISSING');
    try {
      await journal.deleteEncryptedEnvelope();
      result = await ctx.gas.getStatus(saved.identity);
    } catch { throw new SpikeGuardError('PAYMENT_OUTCOME_UNRESOLVED'); }
  } else {
    if (Date.now() >= intent.expiresAt) { await journal.refuseBeforeHandoff('QUOTE_EXPIRED'); throw new SpikeGuardError('QUOTE_EXPIRED'); }
    await assertFixture(ctx, fixture);
    const check = await ctx.noir.checkPayment(intent);
    if (!check.ok) { await journal.refuseBeforeHandoff('POLICY_REFUSED'); throw new SpikeGuardError('POLICY_REFUSED'); }
    let signed: string;
    if (await readSpikeRecord(join(paymentDirectory, 'envelope.json')) !== null) signed = await journal.readEnvelope();
    else {
      const unsigned = await ctx.noir.prepare(intent.agent, { kind: 'authorize', ...intent });
      const tx = inspectAuthorization(unsigned, intent).transaction;
      if (tx.signatures.length !== 0) throw new SpikeGuardError('UNEXPECTED_PREPARED_SIGNATURE');
      tx.sign(ctx.agent);
      signed = tx.toXDR();
      await journal.saveEnvelope(signed);
    }
    const inspected = inspectAuthorization(signed, intent);
    if (inspected.transaction.signatures.length !== 1 || !ctx.agent.verify(inspected.transaction.hash(), inspected.transaction.signatures[0]!.signature())) throw new SpikeGuardError('AGENT_SIGNATURE_MISMATCH');
    try {
      result = await handoffOnce({ gas: ctx.gas, journal, operationId: journal.operation.operationId, signedEnvelope: signed,
        expected: { innerHash: inspected.innerHash, agent: intent.agent, escrow: intent.escrow, expiresAt: intent.expiresAt } });
    } catch (error) {
      if ((await journal.load()).handoffCommittedAt !== null) throw new SpikeGuardError('PAYMENT_OUTCOME_UNRESOLVED');
      throw error;
    }
  }
  try {
    saved = await journal.load();
    if (!saved.identity || saved.handoffCommittedAt === null) throw new SpikeGuardError('HANDOFF_IDENTITY_MISSING');
    if (!['succeeded', 'failed', 'cancelled'].includes(result.status)) result = await ctx.gas.waitForResult(saved.identity, { timeoutMs: 30000, maxAttempts: 10 });
    validateExecution(result, saved.identity);
    const chain = await ctx.noir.server.getTransaction(result.outerTransactionHash!);
    if (chain.status !== rpc.Api.GetTransactionStatus.SUCCESS) throw new SpikeGuardError('CHAIN_CONFIRMATION_UNRESOLVED');
    const event = await eventFor(ctx, chain, 'payment.authorized', [saved.identity.transactionHash, result.outerTransactionHash!]);
    const authorization = verifyAuthorizationEvidence({ transaction: chain, event, velo: result, identity: saved.identity, intent, handoffCommittedAt: saved.handoffCommittedAt });
    let afterRecord = await readSpikeRecord(join(ctx.directory, 'after-payment.json'));
    if (afterRecord === null) {
      const after = await balances(ctx, fixture);
      if (BigInt(before.escrow) - BigInt(after.escrow) !== intent.amount || BigInt(after.pending) - BigInt(before.pending) !== intent.amount) throw new SpikeGuardError('AUTHORIZATION_BALANCE_MISMATCH');
      await writeSpikeRecord(join(ctx.directory, 'after-payment.json'), after);
      afterRecord = after;
    }
    const after = balanceSchema.parse(afterRecord);
    if (BigInt(before.escrow) - BigInt(after.escrow) !== intent.amount || BigInt(after.pending) - BigInt(before.pending) !== intent.amount) throw new SpikeGuardError('SAVED_BALANCE_MISMATCH');
    const claim = await wallet(ctx, 'merchant-claim', ctx.merchant, { kind: 'claim', token: ctx.config.asset });
    const claimChain = await ctx.noir.server.getTransaction(claim.hash);
    if (claimChain.status !== rpc.Api.GetTransactionStatus.SUCCESS) throw new SpikeGuardError('CLAIM_CONFIRMATION_UNRESOLVED');
    const claimEvent = await eventFor(ctx, claimChain, 'payment.claimed', [claim.hash]);
    const claimProof = verifyClaimEvent(claimChain, claimEvent, { hash: claim.hash, escrow: intent.escrow, merchant: intent.merchant, amount: BigInt(after.pending) });
    const afterClaim = await balances(ctx, fixture);
    if (afterClaim.pending !== '0' || afterClaim.escrow !== after.escrow) throw new SpikeGuardError('CLAIM_BALANCE_MISMATCH');
    return { classification: 'live-same-transaction-noir-velo-spike', observedAt: new Date().toISOString(), network: 'testnet',
      operationId: fixture.operationId, deviceHash: fixture.deviceHash, contracts: ctx.config.network.contracts, asset: ctx.config.asset,
      setup: setup.data, refusal: refusalSchema.parse(await readSpikeRecord(join(ctx.directory, 'refusal.json'))),
      veloIdentity: saved.identity, authorization, balances: { before, afterAuthorization: after, afterClaim }, claim: { ...claim, ...claimProof } };
  } catch (error) {
    if (error instanceof SpikeGuardError) throw new SpikeGuardError(error.code, error.missing, 'unresolved');
    throw new SpikeGuardError('PAYMENT_OR_CLAIM_OBSERVATION_UNRESOLVED');
  }
}
