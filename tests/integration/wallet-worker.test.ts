import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Account, Address, Contract, Keypair, Networks, TransactionBuilder, nativeToScVal, rpc, xdr, type Transaction } from '@stellar/stellar-sdk';
import { toCall } from '@noirx402/agent-sdk';
import { eq, sql } from 'drizzle-orm';
import { createTestDatabase } from './support/database.ts';
import { fixture } from './support/fixtures.ts';
import { prepareWallet, submitWallet, observeWallet, type WalletActor, type WalletGateway } from '../../src/server/domain/wallet.ts';
import { processWalletObservation, walletConsumer } from '../../apps/server/src/worker/wallet.ts';
import { claimJob } from '../../apps/server/src/worker/queue.ts';
import { createApplication } from '../../src/server/http/application.ts';
import { issueSession } from '../../src/server/auth/session.ts';
import * as s from '../../src/server/db/schema.ts';

// Real PostgreSQL and generated Testnet-format signed bodies; all SDK transport
// is synthetic, with no network access, real key, live evidence or entitlement.
describe('TASK-021 durable human-wallet observation, terminal failure and lease fencing', () => {
  let db: Awaited<ReturnType<typeof createTestDatabase>>;
  beforeEach(async () => { db = await createTestDatabase(); });
  afterEach(async () => { await db.cleanup(); });
  async function setup(kind: 'registerDevice' | 'claim' = 'registerDevice', handoff = true, timeoutSeconds = 120) {
    const f = await fixture(db.first), signer = Keypair.random();
    const config = { asset: f.agent.assetContractId, network: { rpcUrl: 'https://soroban-testnet.stellar.org', networkPassphrase: Networks.TESTNET, contracts: { deviceRegistry: f.agent.deviceContractId, agentRegistry: f.agent.agentContractId, paymentEscrow: f.agent.escrowContractId } } };
    let actor: WalletActor;
    if (kind === 'claim') {
      await db.first.db.update(s.merchant).set({ walletAddress: signer.publicKey() }).where(eq(s.merchant.id, f.merchant.id));
      actor = { role: 'merchant', merchantId: f.merchant.id, ownerId: null };
    } else {
      await db.first.db.update(s.owner).set({ walletAddress: signer.publicKey() }).where(eq(s.owner.id, f.owner.id));
      actor = { role: 'owner', ownerId: f.owner.id, merchantId: null };
    }
    const gateway: WalletGateway = {
      config, prepare: vi.fn(async (source, operation) => {
        const call = toCall(source, operation);
        return new TransactionBuilder(new Account(source, '1'), { fee: '100', networkPassphrase: Networks.TESTNET })
          .addOperation(new Contract(config.network.contracts[call.contract]).call(call.method, ...call.args)).setTimeout(timeoutSeconds).build().toXDR();
      }), submit: vi.fn(async () => { throw new Error('SYNTHETIC_RESPONSE_LOSS'); }),
      getTransaction: vi.fn(async (hash: string): Promise<rpc.Api.GetTransactionResponse> => ({ status: rpc.Api.GetTransactionStatus.NOT_FOUND, txHash: hash, latestLedger: 3, latestLedgerCloseTime: 1, oldestLedger: 1, oldestLedgerCloseTime: 1 })),
      getPolicy: async () => null, getDeviceOwner: async () => null, getDeviceAgent: async () => f.agent.publicKey,
      getEscrowToken: async () => null, getEscrowBalance: async () => 0n, getPendingBalance: async () => 0n, latestLedger: async () => 3,
    };
    const prepared = await prepareWallet(db.first, actor, { kind }, gateway);
    const tx = TransactionBuilder.fromXDR(prepared.unsignedXdr, Networks.TESTNET) as Transaction; tx.sign(signer);
    if (handoff) {
      expect((await submitWallet(db.first, actor, prepared.operationId, tx.toXDR(), gateway)).status).toBe('unknown');
      gateway.getDeviceOwner = async () => signer.publicKey();
    }
    return { f, actor, signer, gateway, prepared, tx };
  }
  it('status check expires only an unhanded preparation and permits a fresh review', async () => {
    const { actor, gateway, prepared } = await setup('registerDevice', false, 2);
    expect((await observeWallet(db.second, actor, prepared.operationId, gateway)).status).toBe('prepared');
    await db.first.db.execute(sql`SELECT pg_sleep(greatest(0,extract(epoch FROM (${prepared.expiresAt.toISOString()}::timestamptz-clock_timestamp()))) + 0.02)`);
    expect((await observeWallet(db.second, actor, prepared.operationId, gateway)).status).toBe('expired');
    expect(gateway.getTransaction).not.toHaveBeenCalled(); expect(gateway.submit).not.toHaveBeenCalled();
    expect(await db.first.db.select().from(s.job).where(eq(s.job.entityId, prepared.operationId))).toHaveLength(0);
    const again = await prepareWallet(db.first, actor, { kind: 'registerDevice' }, gateway);
    expect(again.operationId).not.toBe(prepared.operationId);
  });
  it('status check never expires or resubmits a handoff after its time bound', async () => {
    const { actor, gateway, prepared } = await setup('registerDevice', true, 2);
    await db.first.db.execute(sql`SELECT pg_sleep(greatest(0,extract(epoch FROM (${prepared.expiresAt.toISOString()}::timestamptz-clock_timestamp()))) + 0.02)`);
    expect((await observeWallet(db.second, actor, prepared.operationId, gateway)).status).toBe('unknown');
    expect(gateway.submit).toHaveBeenCalledTimes(1);
    await expect(prepareWallet(db.first, actor, { kind: 'registerDevice' }, gateway)).rejects.toThrow('OPERATION_ACTIVE');
  });
  function included(tx: Transaction, failed: boolean): rpc.Api.GetTransactionResponse {
    const common = { txHash: tx.hash().toString('hex'), latestLedger: 3, latestLedgerCloseTime: 1, oldestLedger: 1, oldestLedgerCloseTime: 1,
      ledger: 2, createdAt: Math.floor(Date.now() / 1000), applicationOrder: 1, feeBump: false, envelopeXdr: tx.toEnvelope(),
      resultMetaXdr: new xdr.TransactionMeta(0, []), events: { transactionEventsXdr: [], contractEventsXdr: [] } };
    return { ...common, status: failed ? rpc.Api.GetTransactionStatus.FAILED : rpc.Api.GetTransactionStatus.SUCCESS,
      resultXdr: new xdr.TransactionResult({ feeCharged: xdr.Int64.fromString('100'),
        result: failed ? xdr.TransactionResultResult.txFailed([xdr.OperationResult.opInner(xdr.OperationResultTr.invokeHostFunction(xdr.InvokeHostFunctionResult.invokeHostFunctionTrapped()))]) : xdr.TransactionResultResult.txSuccess([]),
        ext: new xdr.TransactionResultExt(0) }) };
  }
  async function makeReady(id: string) {
    await db.first.db.update(s.job).set({ availableAt: sql`clock_timestamp() - interval '1 second'` }).where(eq(s.job.entityId, id));
  }
  for (const kind of ['registerDevice', 'claim'] as const) it(`included failed ${kind} unblocks only the human wallet and synchronizes claim state`, async () => {
    const { f, actor, gateway, prepared, tx } = await setup(kind);
    gateway.getTransaction = vi.fn(async () => included(tx, true));
    const consumer = walletConsumer({ store: db.second, gateway: async () => gateway });
    await consumer.wake(); await consumer.stop();
    expect((await observeWallet(db.first, actor, prepared.operationId, gateway)).status).toBe('failed');
    const [job] = await db.first.db.select().from(s.job).where(eq(s.job.entityId, prepared.operationId));
    expect(job!.status).toBe('done');
    expect(gateway.submit).toHaveBeenCalledTimes(1); expect(gateway.prepare).toHaveBeenCalledTimes(1);
    if (kind === 'claim') {
      const [claim] = await db.first.db.select().from(s.merchantClaim).where(eq(s.merchantClaim.walletOperationId, prepared.operationId));
      expect(claim!.status).toBe('failed'); expect(claim!.observedClaimAmountStroops).toBeNull(); expect(claim!.confirmedAt).toBeNull();
    }
    const [agent] = await db.first.db.select().from(s.agent).where(eq(s.agent.id, f.agent.id));
    expect(agent!.lastNonce).toBe('0');
    expect(await db.first.db.select().from(s.entitlement)).toHaveLength(0);
  });
  it('rejects malformed, foreign and contradictory failure evidence and never resubmits unknown', async () => {
    const { actor, gateway, prepared, tx } = await setup();
    const valid = included(tx, true);
    const unsigned = TransactionBuilder.fromXDR(prepared.unsignedXdr, Networks.TESTNET) as Transaction;
    const badSignature = TransactionBuilder.fromXDR(prepared.unsignedXdr, Networks.TESTNET) as Transaction; badSignature.sign(Keypair.random());
    for (const mutation of [
      { txHash: 'f'.repeat(64) }, { ledger: 0 }, { ledger: 99 }, { feeBump: true }, { createdAt: 0 },
      { applicationOrder: 0 }, { resultMetaXdr: undefined }, { envelopeXdr: unsigned.toEnvelope() }, { envelopeXdr: badSignature.toEnvelope() },
      { resultXdr: new xdr.TransactionResult({ feeCharged: xdr.Int64.fromString('100'), result: xdr.TransactionResultResult.txSuccess([]), ext: new xdr.TransactionResultExt(0) }) },
    ]) {
      gateway.getTransaction = async () => ({ ...valid, ...mutation }) as rpc.Api.GetTransactionResponse;
      expect((await observeWallet(db.second, actor, prepared.operationId, gateway)).status).toBe('unknown');
    }
    await expect(prepareWallet(db.first, actor, { kind: 'registerDevice' }, gateway)).rejects.toThrow('OPERATION_ACTIVE');
    gateway.getTransaction = async () => { throw new Error('SYNTHETIC_NETWORK_TIMEOUT'); };
    expect((await observeWallet(db.first, actor, prepared.operationId, gateway)).status).toBe('unknown');
    expect(gateway.submit).toHaveBeenCalledTimes(1);
  });
  it('restart observes the same saved hash after unknown and completes without another preparation or handoff', async () => {
    const { actor, gateway, prepared, tx } = await setup();
    const first = walletConsumer({ store: db.first, gateway: async () => gateway });
    await first.wake(); await first.stop();
    const [queued] = await db.first.db.select().from(s.job).where(eq(s.job.entityId, prepared.operationId));
    expect(queued!.status).toBe('queued'); expect(queued!.attemptCount).toBe(1);
    gateway.getTransaction = vi.fn(async () => included(tx, false));
    await makeReady(prepared.operationId);
    const restarted = walletConsumer({ store: db.second, gateway: async () => gateway });
    await Promise.all([restarted.wake(), restarted.wake()]); await restarted.stop();
    expect(gateway.getTransaction).toHaveBeenCalledWith(tx.hash().toString('hex'));
    expect((await observeWallet(db.first, actor, prepared.operationId, gateway)).status).toBe('confirmed');
    expect(gateway.submit).toHaveBeenCalledTimes(1); expect(gateway.prepare).toHaveBeenCalledTimes(1);
  });
  it('expired/stolen worker lease cannot mutate wallet state; a fresh lease can resolve included failure', async () => {
    const { actor, gateway, prepared, tx } = await setup();
    const job = await claimJob(db.first, ['wallet_observe']); expect(job).not.toBeNull();
    await db.first.db.update(s.job).set({ leaseUntil: sql`clock_timestamp() - interval '1 second'` }).where(eq(s.job.id, job!.id));
    gateway.getTransaction = async () => included(tx, true);
    await expect(processWalletObservation(db.second, job!, gateway)).rejects.toThrow('WALLET_LEASE_LOST');
    const [row] = await db.first.db.select().from(s.walletOperation).where(eq(s.walletOperation.id, prepared.operationId)); expect(row!.status).toBe('unknown');
    const fresh = await claimJob(db.second, ['wallet_observe']); expect(fresh!.leaseOwner).not.toBe(job!.leaseOwner);
    expect(await processWalletObservation(db.second, fresh!, gateway)).toBe(true);
    expect((await observeWallet(db.first, actor, prepared.operationId, gateway)).status).toBe('failed');
    expect(gateway.submit).toHaveBeenCalledTimes(1);
  });
  it('legacy claim_observe resolves its existing wallet operation without creating another claim', async () => {
    const { gateway, prepared, tx } = await setup('claim');
    const [claim] = await db.first.db.select().from(s.merchantClaim).where(eq(s.merchantClaim.walletOperationId, prepared.operationId));
    await db.first.db.update(s.job).set({ status: 'done' }).where(eq(s.job.entityId, prepared.operationId));
    await db.first.db.insert(s.job).values({ id: randomUUID(), kind: 'claim_observe', entityId: claim!.id });
    gateway.getTransaction = async () => included(tx, true);
    const consumer = walletConsumer({ store: db.second, gateway: async () => gateway }); await consumer.wake(); await consumer.stop();
    const claims = await db.first.db.select().from(s.merchantClaim).where(eq(s.merchantClaim.walletOperationId, prepared.operationId));
    expect(claims).toHaveLength(1); expect(claims[0]!.status).toBe('failed');
    expect(gateway.submit).toHaveBeenCalledTimes(1);
  });
  it('confirms a claim only with its exact successful embedded merchant event; no entitlement is created', async () => {
    const { actor, signer, gateway, prepared, tx } = await setup('claim');
    const claimEvent = new xdr.ContractEvent({ ext: new xdr.ExtensionPoint(0), type: xdr.ContractEventType.contract(),
      contractId: Address.fromString(gateway.config.network.contracts.paymentEscrow).toScAddress().contractId(),
      body: new xdr.ContractEventBody(0, new xdr.ContractEventV0({ topics: [nativeToScVal('claim', { type: 'symbol' }), Address.fromString(signer.publicKey()).toScVal()], data: nativeToScVal(300000n, { type: 'i128' }) })) });
    const success = included(tx, false);
    gateway.getTransaction = async () => success;
    expect((await observeWallet(db.first, actor, prepared.operationId, gateway)).status).toBe('unknown');
    gateway.getTransaction = async () => ({ ...success, events: { transactionEventsXdr: [], contractEventsXdr: [[claimEvent]] } });
    const consumer = walletConsumer({ store: db.second, gateway: async () => gateway }); await consumer.wake(); await consumer.stop();
    const [claim] = await db.first.db.select().from(s.merchantClaim).where(eq(s.merchantClaim.walletOperationId, prepared.operationId));
    expect(claim!.status).toBe('confirmed'); expect(claim!.observedClaimAmountStroops).toBe('300000');
    expect(await db.first.db.select().from(s.entitlement)).toHaveLength(0); expect(gateway.submit).toHaveBeenCalledTimes(1);
  });
  it('authenticated wallet routes wake only after durable handoff; failed wakes preserve single submission', async () => {
    const { f, gateway, prepared, tx } = await setup('registerDevice', false);
    const owner = await issueSession(db.first, { role: 'owner', ownerId: f.owner.id });
    const other = await fixture(db.first);
    const foreign = await issueSession(db.first, { role: 'owner', ownerId: other.owner.id });
    const wake = vi.fn(async () => {
      const [row] = await db.second.db.select().from(s.walletOperation).where(eq(s.walletOperation.id, prepared.operationId));
      const [job] = await db.second.db.select().from(s.job).where(eq(s.job.entityId, prepared.operationId));
      expect(row!.handoffCommittedAt).not.toBeNull(); expect(job!.kind).toBe('wallet_observe');
      throw new Error('SYNTHETIC_WAKE_TIMEOUT');
    });
    const app = createApplication({ store: db.first, env: { APP_ORIGIN: 'http://localhost:3000' }, wallet: async () => gateway, wake });
    const send = (method: string, token: string, signedXdr = tx.toXDR(), origin = 'http://localhost:3000') => app(new Request(`http://localhost:3000/api/v1/wallet-operations/${prepared.operationId}${method === 'POST' ? '/submit' : ''}`, {
      method, headers: { cookie: `aegispay_session=${token}`, origin, 'content-type': 'application/json' }, ...(method === 'POST' ? { body: JSON.stringify({ signedXdr }) } : {}),
    }));
    expect((await send('GET', '')).status).toBe(401);
    expect((await send('GET', foreign.token)).status).toBe(404);
    expect((await send('POST', owner.token, tx.toXDR(), 'https://foreign.example')).status).toBe(403);
    expect((await send('POST', owner.token, prepared.unsignedXdr)).status).toBe(400);
    expect((await send('GET', owner.token)).status).toBe(200); expect(wake).not.toHaveBeenCalled();
    expect((await send('POST', owner.token)).status).toBe(202); expect(wake).toHaveBeenCalledTimes(1);
    expect(gateway.submit).toHaveBeenCalledTimes(1);
    expect((await send('POST', owner.token)).status).toBe(202);
    expect((await send('GET', owner.token)).status).toBe(200); expect(wake).toHaveBeenCalledTimes(3);
    expect(gateway.submit).toHaveBeenCalledTimes(1);
  });
  for (const path of ['preparation', 'observation'] as const) it(`${path} waits for agent before taking any wallet-row lock`, async () => {
    const { f, actor, gateway, prepared, tx } = await setup('registerDevice', path !== 'preparation', path === 'preparation' ? 2 : 120);
    if (path === 'preparation') {
      // Only an unsigned local preparation expires. Never expire a handoff.
      await db.first.pool.query('SELECT pg_sleep(greatest(0, extract(epoch from $1::timestamptz - clock_timestamp())) + 0.02)', [prepared.expiresAt]);
    } else gateway.getTransaction = async () => included(tx, false);
    const blocker = await db.first.pool.connect(), probe = await db.second.pool.connect();
    let pending: Promise<unknown> | undefined;
    try {
      await blocker.query('BEGIN');
      const pid = (await blocker.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
      await blocker.query('SELECT id FROM agent WHERE id=$1 FOR UPDATE', [f.agent.id]);
      pending = path === 'preparation' ? prepareWallet(db.second, actor, { kind: 'registerDevice' }, gateway) : observeWallet(db.second, actor, prepared.operationId, gateway);
      let blocked = false;
      for (let check = 0; check < 100; check++) {
        const result = await probe.query<{ blocked: boolean }>('SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))) AS blocked', [pid]);
        if (result.rows[0]!.blocked) { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(blocked).toBe(true);
      await probe.query('BEGIN');
      // Fails immediately if the waiting operation inverted agent/wallet order.
      await probe.query('SELECT id FROM wallet_operation WHERE id=$1 FOR UPDATE NOWAIT', [prepared.operationId]);
      await probe.query('ROLLBACK');
    } finally {
      await probe.query('ROLLBACK'); await blocker.query('ROLLBACK');
      blocker.release(); probe.release(); await pending;
    }
  });
});
