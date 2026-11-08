import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { Keypair, Networks, rpc } from '@stellar/stellar-sdk';
import type { NoirAgentClient } from '@noirx402/agent-sdk';
import { z } from 'zod';
import { amountSchema } from '@aegispay/shared';
import type { Store } from '../db/connection.js';
import * as s from '../db/schema.js';
import type { Principal } from '../auth/session.js';
import { requireRole } from '../auth/session.js';
import { databaseTime, deny } from './purchases.js';
import { inspectWalletOperation, type SpikeConfig, type WalletOperation } from '../integrations/spike-runtime.js';

export const walletInput = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('registerDevice') }),
  z.strictObject({ kind: z.literal('registerAgent'), maxAmountStroops: amountSchema.refine(v => BigInt(v) <= 1000000n), expiresAt: z.iso.datetime() }),
  z.strictObject({ kind: z.enum(['fundEscrow', 'defundEscrow']), amountStroops: amountSchema.refine(v => BigInt(v) <= 10000000n) }),
  z.strictObject({ kind: z.enum(['revokeAgent', 'sweepOnRevoke', 'claim']) }),
]);
type WalletInput = z.infer<typeof walletInput>;
export interface WalletGateway {
  config: SpikeConfig;
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
async function signingContext(store: Store, actor: Principal) {
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
export async function prepareWallet(store: Store, actor: Principal, raw: unknown, gateway: WalletGateway) {
  const input = walletInput.parse(raw);
  requireRole(actor, input.kind === 'claim' ? ['merchant'] : ['owner']);
  const context = await signingContext(store, actor);
  return store.transaction(async db => {
    // Serialize preparation across requests/processes, including SDK awaits.
    await db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${context.address}, 0))`);
    const now = await databaseTime(db);
    await db.update(s.walletOperation).set({ status: 'expired', updatedAt: now }).where(and(eq(s.walletOperation.actorAddress, context.address), eq(s.walletOperation.status, 'prepared'), sql`${s.walletOperation.expiresAt} <= clock_timestamp()`));
    const [active] = await db.select().from(s.walletOperation).where(and(eq(s.walletOperation.actorAddress, context.address), sql`${s.walletOperation.status} IN ('prepared','submitting','unknown')`));
    if (active) deny('OPERATION_ACTIVE');
    const a = context.agent;
    if (a) {
      if (a.assetContractId !== gateway.config.asset || a.deviceContractId !== gateway.config.network.contracts.deviceRegistry || a.agentContractId !== gateway.config.network.contracts.agentRegistry || a.escrowContractId !== gateway.config.network.contracts.paymentEscrow) deny('CONTRACT_MISMATCH');
      const owner = await gateway.getDeviceOwner(a.deviceHash);
      if ((input.kind === 'registerDevice' && owner !== null) || (input.kind !== 'registerDevice' && owner !== context.address)) deny('POLICY_NOT_READY');
      if (input.kind !== 'registerDevice' && await gateway.getDeviceAgent(a.deviceHash) !== a.publicKey) deny('CONTRACT_MISMATCH');
      if (input.kind === 'registerAgent' && (new Date(input.expiresAt).getTime() <= now.getTime() || new Date(input.expiresAt).getTime() > now.getTime() + 3600000)) deny('INVALID_INPUT');
      if (input.kind === 'sweepOnRevoke' || input.kind === 'defundEscrow') {
        // The installed contract refuses sweeping a live policy. Re-read it;
        // database status alone is never sufficient authority to reclaim.
        if (await gateway.getPolicy(a.deviceHash) !== null) deny('POLICY_NOT_READY');
      }
      const token = await gateway.getEscrowToken(a.deviceHash);
      if (token !== null && token !== gateway.config.asset) deny('CONTRACT_MISMATCH');
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
export async function ownedWallet(store: Store, actor: Principal, id: string) {
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
export async function submitWallet(store: Store, actor: Principal, id: string, signed: string, gateway: WalletGateway) {
  const { row, agent } = await ownedWallet(store, actor, id);
  if (row.handoffCommittedAt || row.status !== 'prepared') return walletView(row);
  const op = storedOperation(row, agent, gateway);
  const now = await databaseTime(store.db);
  if (row.expiresAt <= now) deny('QUOTE_EXPIRED');
  const tx = inspectWalletOperation(signed, row.actorAddress, op, gateway.config, now.getTime());
  if (tx.hash().toString('hex') !== row.unsignedBodyHash || tx.signatures.length !== 1 ||
    !tx.signatures[0]!.hint().equals(Keypair.fromPublicKey(row.actorAddress).signatureHint()) ||
    !Keypair.fromPublicKey(row.actorAddress).verify(tx.hash(), tx.signatures[0]!.signature())) deny('INVALID_INPUT');
  const won = await store.transaction(async db => {
    const [claimed] = await db.update(s.walletOperation).set({ status: 'submitting', handoffCommittedAt: sql`clock_timestamp()`, txHash: row.unsignedBodyHash, updatedAt: sql`clock_timestamp()` })
      .where(and(eq(s.walletOperation.id, id), eq(s.walletOperation.status, 'prepared'), sql`${s.walletOperation.handoffCommittedAt} IS NULL AND ${s.walletOperation.expiresAt} > clock_timestamp()`)).returning();
    if (!claimed) return false;
    await db.insert(s.job).values({ id: randomUUID(), kind: 'wallet_observe', entityId: id });
    if (row.operationKind === 'claim') await db.update(s.merchantClaim).set({ status: 'submitting', txHash: row.unsignedBodyHash }).where(eq(s.merchantClaim.walletOperationId, id));
    return true;
  });
  if (won) {
    try {
      // No automatic retry after this committed boundary, even on local timeout.
      if (Date.now() >= row.expiresAt.getTime()) deny('QUOTE_EXPIRED');
      const hash = await gateway.submit(signed, op);
      if (hash !== row.unsignedBodyHash) deny('CONTRACT_MISMATCH');
    } catch { /* Identity-only observation below and on worker restart. */ }
  }
  return observeWallet(store, actor, id, gateway);
}
export async function observeWallet(store: Store, actor: Principal, id: string, gateway: WalletGateway) {
  const { row, agent } = await ownedWallet(store, actor, id);
  if (!row.handoffCommittedAt || !row.txHash || ['confirmed', 'failed'].includes(row.status)) return walletView(row);
  const op = storedOperation(row, agent, gateway);
  try {
    const chain = await gateway.getTransaction(row.txHash);
    if (chain.status !== rpc.Api.GetTransactionStatus.SUCCESS || chain.feeBump || chain.resultXdr.result().switch().name !== 'txSuccess') throw new Error('UNRESOLVED');
    const tx = inspectWalletOperation(chain.envelopeXdr.toXDR('base64'), row.actorAddress, op, gateway.config, row.handoffCommittedAt.getTime());
    if (chain.txHash !== row.txHash || tx.hash().toString('hex') !== row.unsignedBodyHash || tx.signatures.length !== 1 || !Keypair.fromPublicKey(row.actorAddress).verify(tx.hash(), tx.signatures[0]!.signature())) deny('CONTRACT_MISMATCH');
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
    await store.transaction(async db => {
      await db.update(s.walletOperation).set({ status: 'confirmed', updatedAt: sql`clock_timestamp()` }).where(and(eq(s.walletOperation.id, id), sql`${s.walletOperation.status} IN ('submitting','unknown')`));
      if (agent) await db.update(s.agent).set({ status: policy ? 'active' : row.operationKind === 'revokeAgent' || agent.status === 'revoked' ? 'revoked' : 'unprovisioned', policyMaxStroops: policy?.maxAmount.toString() ?? '0', policyExpiresAt: policy?.expiresAt ?? new Date(0), policyObservedLedger: BigInt(chain.ledger) }).where(eq(s.agent.id, agent.id));
      if (op.kind === 'claim') await db.update(s.merchantClaim).set({ status: 'confirmed', txHash: row.txHash, observedClaimAmountStroops: claimAmount, confirmedAt: sql`clock_timestamp()` }).where(eq(s.merchantClaim.walletOperationId, id));
    });
    return { ...walletView(row), status: 'confirmed', ledger: chain.ledger };
  } catch {
    await store.db.update(s.walletOperation).set({ status: 'unknown', updatedAt: sql`clock_timestamp()` }).where(and(eq(s.walletOperation.id, id), eq(s.walletOperation.status, 'submitting')));
    return { ...walletView(row), status: 'unknown' };
  }
}
