import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { Keypair, Networks, rpc } from '@stellar/stellar-sdk';
import type { NoirAgentClient } from '@noirx402/agent-sdk';
import { z } from 'zod';
import { amountSchema } from '@aegispay/shared';
import type { Database, Store } from '../db/connection.ts';
import * as s from '../db/schema.ts';
import type { Principal } from '../auth/session.ts';
import { requireRole } from '../auth/session.ts';
import { databaseTime, deny } from './purchases.ts';
import { inspectWalletOperation, type SpikeConfig, type WalletOperation } from '../integrations/wallet-inspection.ts';

export const walletInput = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('registerDevice') }),
  z.strictObject({ kind: z.literal('registerAgent'), maxAmountStroops: amountSchema.refine(v => BigInt(v) <= 1000000n), expiresAt: z.iso.datetime() }),
  z.strictObject({ kind: z.enum(['fundEscrow', 'defundEscrow']), amountStroops: amountSchema.refine(v => BigInt(v) <= 10000000n) }),
  z.strictObject({ kind: z.enum(['revokeAgent', 'sweepOnRevoke', 'claim']) }),
]);
type WalletInput = z.infer<typeof walletInput>;
export type WalletActor = Pick<Principal, 'role' | 'ownerId' | 'merchantId'>;
export type WalletObservationJob = Pick<typeof s.job.$inferSelect, 'id' | 'kind' | 'entityId' | 'leaseOwner'>;
// UPDATE evaluates the current row under PostgreSQL's row lock. A stale RPC
// snapshot must never undo an operator suspension committed during that read.
export function observedPolicyStatus(hasPolicy: boolean, revoked = false) {
  return sql`CASE WHEN ${s.agent.status} = 'disabled' THEN 'disabled'
    WHEN ${hasPolicy} THEN 'active'
    WHEN ${revoked} OR ${s.agent.status} = 'revoked' THEN 'revoked'
    ELSE 'unprovisioned' END`;
}
export interface WalletGateway {
  config: SpikeConfig;
  fundingCeilingStroops?: string;
  fundingDeviceHash?: string;
  fundingAgentPublicKey?: string;
  prepare(source: string, operation: WalletOperation): Promise<string>;
  submit(signed: string, operation: WalletOperation): Promise<string>;
  getTransaction(hash: string): Promise<rpc.Api.GetTransactionResponse>;
  getPolicy: NoirAgentClient['getPolicy'];
  getDeviceOwner: NoirAgentClient['getDeviceOwner'];
  getDeviceAgent: NoirAgentClient['getDeviceAgent'];
  getEscrowToken: NoirAgentClient['getEscrowToken'];
  getEscrowBalance: NoirAgentClient['getEscrowBalance'];
  getPendingBalance: NoirAgentClient['getPendingBalance'];
  latestLedger(): Promise<number>;
}
export function walletFundingCeiling(env: Record<string, string | undefined>): string {
  const ceiling = amountSchema.parse(env.DEMO_ESCROW_FUNDING_CEILING_STROOPS?.trim() || '10000000');
  if (BigInt(ceiling) > 10000000n) throw new Error('INVALID_FUNDING_CEILING');
  return ceiling;
}
async function requireFundingRoom(db: Database, agent: typeof s.agent.$inferSelect, amount: string, gateway: WalletGateway, currentOperationId?: string) {
  // The optional authority is operator configuration bound to one exact context.
  // Other contexts retain the existing per-operation input bound.
  if (gateway.fundingCeilingStroops === undefined) return;
  if (gateway.fundingDeviceHash !== agent.deviceHash || gateway.fundingAgentPublicKey !== agent.publicKey) deny('CONTRACT_MISMATCH');
  const ceiling = BigInt(walletFundingCeiling({ DEMO_ESCROW_FUNDING_CEILING_STROOPS: gateway.fundingCeilingStroops }));
  // Caller owns agent lock; acquire wallet rows afterward, matching submission.
  // Confirmed funding consumes lifetime authority even after spend/reclaim.
  const operations = await db.select().from(s.walletOperation).where(and(eq(s.walletOperation.agentId, agent.id), eq(s.walletOperation.operationKind, 'fundEscrow'))).for('update');
  const now = await databaseTime(db);
  let reservedOrFunded = 0n;
  for (const operation of operations) {
    if (operation.id === currentOperationId || operation.status === 'failed' ||
      !operation.handoffCommittedAt && (operation.status === 'expired' || operation.status === 'prepared' && operation.expiresAt <= now)) continue;
    const input = walletInput.parse(operation.operationPayload.input);
    if (input.kind !== 'fundEscrow' || operation.operationPayload.deviceHash !== agent.deviceHash || operation.operationPayload.agentPublicKey !== agent.publicKey || operation.operationPayload.asset !== agent.assetContractId) deny('CONTRACT_MISMATCH');
    reservedOrFunded += BigInt(input.amountStroops);
  }
  const balance = await gateway.getEscrowBalance(agent.deviceHash);
  if (balance < 0n || BigInt(amount) + balance > ceiling || BigInt(amount) + reservedOrFunded > ceiling) deny('FUNDING_CEILING_EXCEEDED');
}
function operationFor(input: WalletInput, agent: typeof s.agent.$inferSelect | null, asset: string): WalletOperation {
  if (input.kind === 'claim') return { kind: 'claim', token: asset };
  if (!agent) deny('NOT_FOUND');
  const deviceHash = agent.deviceHash;
  switch (input.kind) {
    case 'registerDevice': return { kind: input.kind, deviceHash, agent: agent.publicKey };
    case 'registerAgent': return { kind: input.kind, deviceHash, agent: agent.publicKey, asset, maxAmount: BigInt(input.maxAmountStroops), expiresAt: new Date(input.expiresAt) };
    case 'fundEscrow': case 'defundEscrow': return { kind: input.kind, deviceHash, token: asset, amount: BigInt(input.amountStroops) };
    case 'revokeAgent': return { kind: input.kind, deviceHash };
    case 'sweepOnRevoke': return { kind: input.kind, deviceHash, token: asset, agent: agent.publicKey };
  }
}
async function signingContext(store: Store, actor: WalletActor) {
  requireRole(actor, ['owner', 'merchant']);
  if (actor.role === 'merchant') {
    const [merchant] = await store.db.select().from(s.merchant).where(eq(s.merchant.id, actor.merchantId!));
    if (!merchant) deny('NOT_FOUND');
    return { address: merchant.walletAddress, agent: null };
  }
  const [owner] = await store.db.select().from(s.owner).where(eq(s.owner.id, actor.ownerId!));
  const [agent] = await store.db.select().from(s.agent).where(eq(s.agent.ownerId, actor.ownerId!));
  if (!owner || !agent) deny('NOT_FOUND');
  return { address: owner.walletAddress, agent };
}
async function requireSafeReclaim(db: Database, agent: typeof s.agent.$inferSelect, gateway: WalletGateway) {
  // Caller holds the agent row lock shared with quote acceptance. Unknown or
  // otherwise unresolved attempts keep their reservation and escrow untouched.
  const [attempt] = await db.select({ id: s.paymentAttempt.id }).from(s.paymentAttempt).where(and(
    eq(s.paymentAttempt.agentId, agent.id), sql`${s.paymentAttempt.status} NOT IN ('authorized','refused','expired','failed')`,
  ));
  if (attempt) deny('OPERATION_ACTIVE');
  if (await gateway.getPolicy(agent.deviceHash) !== null) deny('POLICY_NOT_READY');
}
export async function prepareWallet(store: Store, actor: WalletActor, raw: unknown, gateway: WalletGateway) {
  const input = walletInput.parse(raw);
  requireRole(actor, input.kind === 'claim' ? ['merchant'] : ['owner']);
  const context = await signingContext(store, actor);
  return store.transaction(async db => {
    // Serialize preparation across requests/processes, including SDK awaits.
    await db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${context.address}, 0))`);
    // Match quote acceptance and reclaim submission: agent before wallet rows.
    // In particular, expiring a saved preparation must not invert this order.
    const [lockedAgent] = context.agent ? await db.select().from(s.agent).where(eq(s.agent.id, context.agent.id)).for('update') : [];
    const a = lockedAgent ?? null;
    if (context.agent && !a) deny('NOT_FOUND');
    const now = await databaseTime(db);
    await db.update(s.walletOperation).set({ status: 'expired', updatedAt: now }).where(and(eq(s.walletOperation.actorAddress, context.address), eq(s.walletOperation.status, 'prepared'), sql`${s.walletOperation.expiresAt} <= clock_timestamp()`));
    const [active] = await db.select().from(s.walletOperation).where(and(eq(s.walletOperation.actorAddress, context.address), sql`${s.walletOperation.status} IN ('prepared','submitting','unknown')`));
    if (active) deny('OPERATION_ACTIVE');
    if (a) {
      if (a.assetContractId !== gateway.config.asset || a.deviceContractId !== gateway.config.network.contracts.deviceRegistry || a.agentContractId !== gateway.config.network.contracts.agentRegistry || a.escrowContractId !== gateway.config.network.contracts.paymentEscrow) deny('CONTRACT_MISMATCH');
      const owner = await gateway.getDeviceOwner(a.deviceHash);
      if ((input.kind === 'registerDevice' && owner !== null) || (input.kind !== 'registerDevice' && owner !== context.address)) deny('POLICY_NOT_READY');
      if (input.kind !== 'registerDevice' && await gateway.getDeviceAgent(a.deviceHash) !== a.publicKey) deny('CONTRACT_MISMATCH');
      if (input.kind === 'registerAgent' && (new Date(input.expiresAt).getTime() <= now.getTime() || new Date(input.expiresAt).getTime() > now.getTime() + 3600000)) deny('INVALID_INPUT');
      if (input.kind === 'sweepOnRevoke' || input.kind === 'defundEscrow') {
        // The installed contract refuses sweeping a live policy. Re-read it;
        // database status alone is never sufficient authority to reclaim.
        await requireSafeReclaim(db, a, gateway);
      }
      const token = await gateway.getEscrowToken(a.deviceHash);
      if (token !== null && token !== gateway.config.asset) deny('CONTRACT_MISMATCH');
      if (input.kind === 'fundEscrow') await requireFundingRoom(db, a, input.amountStroops, gateway);
    }
    const operation = operationFor(input, a, gateway.config.asset);
    const unsignedXdr = await gateway.prepare(context.address, operation);
    const after = await databaseTime(db);
    const tx = inspectWalletOperation(unsignedXdr, context.address, operation, gateway.config, after.getTime());
    if (tx.signatures.length !== 0 || !tx.timeBounds || BigInt(tx.timeBounds.minTime) * 1000n > BigInt(after.getTime())) deny('INVALID_INPUT');
    const expiresAt = new Date(Math.min(after.getTime() + 120000, Number(tx.timeBounds.maxTime) * 1000));
    const id = randomUUID();
    await db.insert(s.walletOperation).values({ id, actorAddress: context.address, role: actor.role, agentId: a?.id ?? null,
      operationKind: input.kind, operationPayload: { input, deviceHash: a?.deviceHash ?? null, agentPublicKey: a?.publicKey ?? null, asset: gateway.config.asset },
      unsignedBodyHash: tx.hash().toString('hex'), expiresAt, status: 'prepared', createdAt: after });
    if (input.kind === 'claim') await db.insert(s.merchantClaim).values({ id: randomUUID(), merchantId: actor.merchantId!, assetContractId: gateway.config.asset, walletOperationId: id, status: 'prepared' });
    return { operationId: id, unsignedXdr, networkPassphrase: Networks.TESTNET, signerAddress: context.address, expiresAt };
  });
}
export async function ownedWallet(store: Store, actor: WalletActor, id: string) {
  const context = await signingContext(store, actor);
  const [row] = await store.db.select().from(s.walletOperation).where(and(eq(s.walletOperation.id, id), eq(s.walletOperation.actorAddress, context.address), eq(s.walletOperation.role, actor.role)));
  if (!row) deny('NOT_FOUND');
  return { row, ...context };
}
function storedOperation(row: typeof s.walletOperation.$inferSelect, agent: typeof s.agent.$inferSelect | null, gateway: WalletGateway) {
  if (row.operationPayload.asset !== gateway.config.asset || (agent && (row.operationPayload.deviceHash !== agent.deviceHash || row.operationPayload.agentPublicKey !== agent.publicKey))) deny('CONTRACT_MISMATCH');
  return operationFor(walletInput.parse(row.operationPayload.input), agent, gateway.config.asset);
}
export const walletView = (row: typeof s.walletOperation.$inferSelect) => ({ operationId: row.id, kind: row.operationKind, status: row.status, txHash: row.txHash, expiresAt: row.expiresAt });
export async function submitWallet(store: Store, actor: WalletActor, id: string, signed: string, gateway: WalletGateway, wake?: () => Promise<void>) {
  const { row, agent } = await ownedWallet(store, actor, id);
  if (row.handoffCommittedAt || row.status !== 'prepared') {
    if (row.handoffCommittedAt && ['submitting', 'unknown'].includes(row.status)) await wake?.().catch(() => {});
    return walletView(row);
  }
  const op = storedOperation(row, agent, gateway);
  const now = await databaseTime(store.db);
  if (row.expiresAt <= now) deny('QUOTE_EXPIRED');
  const tx = inspectWalletOperation(signed, row.actorAddress, op, gateway.config, now.getTime());
  if (tx.hash().toString('hex') !== row.unsignedBodyHash || tx.signatures.length !== 1 ||
    !tx.signatures[0]!.hint().equals(Keypair.fromPublicKey(row.actorAddress).signatureHint()) ||
    !Keypair.fromPublicKey(row.actorAddress).verify(tx.hash(), tx.signatures[0]!.signature())) deny('INVALID_INPUT');
  const won = await store.transaction(async db => {
    let lockedAgent = agent;
    if (agent && ['sweepOnRevoke', 'defundEscrow', 'fundEscrow'].includes(row.operationKind)) {
      const [locked] = await db.select().from(s.agent).where(eq(s.agent.id, agent.id)).for('update');
      if (!locked) deny('NOT_FOUND');
      lockedAgent = locked;
    }
    // A concurrent submit may have completed while this request waited for the
    // agent lock. Observe its saved identity before rechecking mutable chain
    // state or counting its funding amount again. Keep agent-before-wallet order.
    const [current] = await db.select().from(s.walletOperation).where(eq(s.walletOperation.id, id)).for('update');
    if (!current) deny('NOT_FOUND');
    if (current.handoffCommittedAt || current.status !== 'prepared') return false;
    if (lockedAgent && ['sweepOnRevoke', 'defundEscrow', 'fundEscrow'].includes(row.operationKind)) {
      if (op.kind === 'fundEscrow') await requireFundingRoom(db, lockedAgent, op.amount.toString(), gateway, row.id);
      else await requireSafeReclaim(db, lockedAgent, gateway);
    }
    const [claimed] = await db.update(s.walletOperation).set({ status: 'submitting', handoffCommittedAt: sql`clock_timestamp()`, txHash: row.unsignedBodyHash, updatedAt: sql`clock_timestamp()` })
      .where(and(eq(s.walletOperation.id, id), eq(s.walletOperation.status, 'prepared'), sql`${s.walletOperation.handoffCommittedAt} IS NULL AND ${s.walletOperation.expiresAt} > clock_timestamp()`)).returning();
    if (!claimed) return false;
    await db.insert(s.job).values({ id: randomUUID(), kind: 'wallet_observe', entityId: id });
    if (row.operationKind === 'claim') await db.update(s.merchantClaim).set({ status: 'submitting', txHash: row.unsignedBodyHash }).where(eq(s.merchantClaim.walletOperationId, id));
    return true;
  });
  if (won) {
    // The durable handoff and observation job exist before waking a sleeping
    // worker. Wake failure never repeats submission or rolls back the marker.
    await wake?.().catch(() => {});
    try {
      // No automatic retry after this committed boundary, even on local timeout.
      if (Date.now() >= row.expiresAt.getTime()) deny('QUOTE_EXPIRED');
      const hash = await gateway.submit(signed, op);
      if (hash !== row.unsignedBodyHash) deny('CONTRACT_MISMATCH');
    } catch { /* Identity-only observation below and on worker restart. */ }
  }
  return observeWallet(store, actor, id, gateway);
}
export async function observeWallet(store: Store, actor: WalletActor, id: string, gateway: WalletGateway, job?: WalletObservationJob) {
  const { row, agent } = await ownedWallet(store, actor, id);
  if (!row.handoffCommittedAt && row.status === 'prepared') {
    // An unsigned preparation is never submitted by observation. Expire it
    // using DB time, under the same agent-before-wallet order as handoff.
    await store.transaction(async db => {
      if (agent) await db.select({ id: s.agent.id }).from(s.agent).where(eq(s.agent.id, agent.id)).for('update');
      await db.update(s.walletOperation).set({ status: 'expired', updatedAt: sql`clock_timestamp()` }).where(and(
        eq(s.walletOperation.id, id), eq(s.walletOperation.status, 'prepared'),
        sql`${s.walletOperation.handoffCommittedAt} IS NULL AND ${s.walletOperation.expiresAt} <= clock_timestamp()`,
      ));
    });
    return walletView((await ownedWallet(store, actor, id)).row);
  }
  if (!row.handoffCommittedAt || !row.txHash || ['confirmed', 'failed'].includes(row.status)) return walletView(row);
  const op = storedOperation(row, agent, gateway);
  async function write<T>(work: (db: Database) => Promise<T>) {
    return store.transaction(async db => {
      // Worker lease -> agent -> wallet -> claim; browser observation omits only
      // the lease. No network request runs while these observation locks are held.
      const [owned] = job ? await db.select().from(s.job).where(and(eq(s.job.id, job.id), eq(s.job.kind, job.kind),
        eq(s.job.entityId, job.entityId), eq(s.job.status, 'leased'), eq(s.job.leaseOwner, job.leaseOwner ?? ''))).for('update') : [];
      if (job && (!owned?.leaseUntil || owned.leaseUntil <= await databaseTime(db))) throw new Error('WALLET_LEASE_LOST');
      if (agent) await db.select({ id: s.agent.id }).from(s.agent).where(eq(s.agent.id, agent.id)).for('update');
      const result = await work(db);
      if (job && owned!.leaseUntil! <= await databaseTime(db)) throw new Error('WALLET_LEASE_LOST');
      return result;
    });
  }
  try {
    const chain = await gateway.getTransaction(row.txHash);
    if (chain.status !== rpc.Api.GetTransactionStatus.SUCCESS && chain.status !== rpc.Api.GetTransactionStatus.FAILED) throw new Error('UNRESOLVED');
    // RPC specifies a decimal-string timestamp; SDK 16.4.1 types it as a
    // number but preserves the wire value. Accept both representations without
    // coercing whitespace, exponent notation, fractions or unsafe integers.
    const rawCreatedAt: unknown = chain.createdAt;
    const createdAt = typeof rawCreatedAt === 'string' && /^[1-9]\d{0,15}$/.test(rawCreatedAt) ? Number(rawCreatedAt) : rawCreatedAt;
    if (chain.feeBump !== false || !Number.isSafeInteger(chain.ledger) || chain.ledger <= 0 ||
      typeof createdAt !== 'number' || !Number.isSafeInteger(createdAt) || createdAt <= 0 || !Number.isSafeInteger(chain.applicationOrder) || chain.applicationOrder < 1 ||
      chain.ledger > chain.latestLedger || chain.ledger < chain.oldestLedger || !chain.resultMetaXdr) deny('CONTRACT_MISMATCH');
    const tx = inspectWalletOperation(chain.envelopeXdr.toXDR('base64'), row.actorAddress, op, gateway.config, row.handoffCommittedAt.getTime());
    if (chain.txHash !== row.txHash || tx.hash().toString('hex') !== row.unsignedBodyHash || tx.signatures.length !== 1 ||
      !tx.signatures[0]!.hint().equals(Keypair.fromPublicKey(row.actorAddress).signatureHint()) ||
      !Keypair.fromPublicKey(row.actorAddress).verify(tx.hash(), tx.signatures[0]!.signature())) deny('CONTRACT_MISMATCH');
    if (chain.status === rpc.Api.GetTransactionStatus.FAILED) {
      // FAILED is an included ledger result, unlike NOT_FOUND, timeout or local
      // refusal. Require a negative result code for the exact saved transaction.
      if (chain.resultXdr.result().switch().value >= 0) deny('CONTRACT_MISMATCH');
      await write(async db => {
        const [failed] = await db.update(s.walletOperation).set({ status: 'failed', updatedAt: sql`clock_timestamp()` })
          .where(and(eq(s.walletOperation.id, id), sql`${s.walletOperation.status} IN ('submitting','unknown')`)).returning();
        if (failed && op.kind === 'claim') await db.update(s.merchantClaim).set({ status: 'failed', txHash: row.txHash }).where(eq(s.merchantClaim.walletOperationId, id));
      });
      return walletView((await ownedWallet(store, actor, id)).row);
    }
    if (chain.resultXdr.result().switch().name !== 'txSuccess') deny('CONTRACT_MISMATCH');
    // Claim amount comes only from the embedded independently successful event.
    let claimAmount: string | null = null;
    if (op.kind === 'claim') {
      const { Address, scValToNative } = await import('@stellar/stellar-sdk');
      const events = chain.events.contractEventsXdr.flat().filter(e => {
        if (e.type().name !== 'contract' || !e.contractId() || Address.contract(Buffer.from(e.contractId()! as unknown as Uint8Array)).toString() !== gateway.config.network.contracts.paymentEscrow) return false;
        const b = e.body().v0();
        return b.topics().length === 2 && scValToNative(b.topics()[0]!) === 'claim' && scValToNative(b.topics()[1]!) === row.actorAddress;
      });
      if (events.length !== 1) deny('CONTRACT_MISMATCH');
      const amount: unknown = scValToNative(events[0]!.body().v0().data());
      if (typeof amount !== 'bigint' || amount <= 0n) deny('CONTRACT_MISMATCH');
      claimAmount = amount.toString();
    }
    // Policy cache is refreshed from independent reads after confirmed setup.
    let policy: Awaited<ReturnType<WalletGateway['getPolicy']>> = null;
    if (agent) {
      if (await gateway.getDeviceOwner(agent.deviceHash) !== row.actorAddress || await gateway.getDeviceAgent(agent.deviceHash) !== agent.publicKey) deny('CONTRACT_MISMATCH');
      policy = await gateway.getPolicy(agent.deviceHash);
      if (policy && (policy.agent !== agent.publicKey || policy.asset !== gateway.config.asset || policy.maxAmount <= 0n || !policy.expiresAt)) deny('CONTRACT_MISMATCH');
    }
    await write(async db => {
      const [confirmed] = await db.update(s.walletOperation).set({ status: 'confirmed', updatedAt: sql`clock_timestamp()` }).where(and(eq(s.walletOperation.id, id), sql`${s.walletOperation.status} IN ('submitting','unknown')`)).returning();
      if (!confirmed) return;
      if (agent) await db.update(s.agent).set({ status: observedPolicyStatus(policy !== null, row.operationKind === 'revokeAgent'), policyMaxStroops: policy?.maxAmount.toString() ?? '0', policyExpiresAt: policy?.expiresAt ?? new Date(0), policyObservedLedger: BigInt(chain.ledger) }).where(eq(s.agent.id, agent.id));
      if (op.kind === 'claim') await db.update(s.merchantClaim).set({ status: 'confirmed', txHash: row.txHash, observedClaimAmountStroops: claimAmount, confirmedAt: sql`clock_timestamp()` }).where(eq(s.merchantClaim.walletOperationId, id));
    });
    return { ...walletView((await ownedWallet(store, actor, id)).row), ledger: chain.ledger };
  } catch (error) {
    if (error instanceof Error && error.message === 'WALLET_LEASE_LOST') throw error;
    await write(async db => {
      await db.update(s.walletOperation).set({ status: 'unknown', updatedAt: sql`clock_timestamp()` }).where(and(eq(s.walletOperation.id, id), eq(s.walletOperation.status, 'submitting')));
    });
    return walletView((await ownedWallet(store, actor, id)).row);
  }
}
