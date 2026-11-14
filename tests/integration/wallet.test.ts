import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Account, Contract, Keypair, Networks, TransactionBuilder, rpc, xdr } from '@stellar/stellar-sdk';
import { toCall } from '@noirx402/agent-sdk';
import { eq, sql } from 'drizzle-orm';
import { createTestDatabase } from './support/database.js';
import { acceptInput, fixture, observedProof } from './support/fixtures.js';
import { issueSession } from '../../src/server/auth/session.js';
import { prepareWallet, submitWallet, observeWallet, type WalletGateway } from '../../src/server/domain/wallet.js';
import { acceptQuote, createRun } from '../../src/server/domain/purchases.ts';
import { createApplication } from '../../src/server/http/application.ts';
import * as s from '../../src/server/db/schema.js';

describe('TC-024 exact human-wallet bodies and durable one-time handoff (synthetic SDK transport)', () => {
  let db: Awaited<ReturnType<typeof createTestDatabase>>;
  beforeAll(async () => { db = await createTestDatabase(); });
  afterAll(async () => { await db.cleanup(); });
  async function setup() {
    const f = await fixture(db.first), signer = Keypair.random();
    await db.first.db.update(s.owner).set({ walletAddress: signer.publicKey() }).where(eq(s.owner.id, f.owner.id));
    const actor = (await issueSession(db.first, { role: 'owner', ownerId: f.owner.id })).session;
    const config = { asset: f.agent.assetContractId, network: { rpcUrl: 'https://soroban-testnet.stellar.org', networkPassphrase: Networks.TESTNET, contracts: { deviceRegistry: f.agent.deviceContractId, agentRegistry: f.agent.agentContractId, paymentEscrow: f.agent.escrowContractId } } };
    const submit = vi.fn(async () => { throw new Error('synthetic timeout after dispatch'); });
    const gateway: WalletGateway = {
      config, prepare: async (source, operation) => { const call = toCall(source, operation); return new TransactionBuilder(new Account(source, '1'), { fee: '100', networkPassphrase: Networks.TESTNET }).addOperation(new Contract(config.network.contracts[call.contract]).call(call.method, ...call.args)).setTimeout(120).build().toXDR(); },
      submit, getTransaction: async hash => ({ status: rpc.Api.GetTransactionStatus.NOT_FOUND, txHash: hash, latestLedger: 1, latestLedgerCloseTime: 1, oldestLedger: 1, oldestLedgerCloseTime: 1 }),
      getPolicy: async () => null, getDeviceOwner: async () => null, getDeviceAgent: async () => f.agent.publicKey,
      getEscrowToken: async () => null, getEscrowBalance: async () => 0n, getPendingBalance: async () => 0n, latestLedger: async () => 1,
    };
    return { f, signer, actor, gateway, submit };
  }
  it('rejects missing/wrong signer, altered source/body and mainnet signature before dispatch', async () => {
    const { signer, actor, gateway, submit } = await setup();
    const p = await prepareWallet(db.first, actor, { kind: 'registerDevice' }, gateway);
    await expect(submitWallet(db.first, actor, p.operationId, p.unsignedXdr, gateway)).rejects.toThrow();
    const bad = TransactionBuilder.fromXDR(p.unsignedXdr, Networks.TESTNET); bad.sign(Keypair.random());
    await expect(submitWallet(db.first, actor, p.operationId, bad.toXDR(), gateway)).rejects.toThrow('INVALID_INPUT');
    const wrongNetwork = TransactionBuilder.fromXDR(p.unsignedXdr, Networks.PUBLIC); wrongNetwork.sign(signer);
    await expect(submitWallet(db.first, actor, p.operationId, wrongNetwork.toXDR(), gateway)).rejects.toThrow('INVALID_INPUT');
    const tx = TransactionBuilder.fromXDR(p.unsignedXdr, Networks.TESTNET);
    if (!('source' in tx)) throw new Error('expected transaction');
    const changed = new TransactionBuilder(new Account(signer.publicKey(), '2'), { fee: '200', networkPassphrase: Networks.TESTNET }).addOperation(tx.operations[0]!.type === 'invokeHostFunction' ? Contract.prototype.call.call(new Contract(gateway.config.network.contracts.deviceRegistry), 'unrelated') : new Contract(gateway.config.network.contracts.deviceRegistry).call('unrelated')).setTimeout(120).build();
    changed.sign(signer);
    await expect(submitWallet(db.first, actor, p.operationId, changed.toXDR(), gateway)).rejects.toThrow();
    expect(submit).not.toHaveBeenCalled();
  });
  it('commits one handoff across independent connections and observes only after restart', async () => {
    const { signer, actor, gateway, submit } = await setup();
    const p = await prepareWallet(db.first, actor, { kind: 'registerDevice' }, gateway);
    const tx = TransactionBuilder.fromXDR(p.unsignedXdr, Networks.TESTNET); tx.sign(signer);
    const results = await Promise.all(Array.from({ length: 6 }, (_, i) => submitWallet(i % 2 ? db.first : db.second, actor, p.operationId, tx.toXDR(), gateway)));
    expect(submit).toHaveBeenCalledTimes(1);
    expect(results.every(r => ['submitting', 'unknown'].includes(r.status))).toBe(true);
    const [row] = await db.first.db.select().from(s.walletOperation).where(eq(s.walletOperation.id, p.operationId));
    expect(row!.handoffCommittedAt).not.toBeNull(); expect(row!.txHash).toBe(row!.unsignedBodyHash);
    await observeWallet(db.second, actor, p.operationId, gateway);
    await submitWallet(db.second, actor, p.operationId, tx.toXDR(), gateway);
    expect(submit).toHaveBeenCalledTimes(1);
  });
  it('denies worker signing and unsafe reclaim while a policy still exists', async () => {
    const { f, actor, gateway } = await setup();
    const worker = (await issueSession(db.first, { role: 'worker', ownerId: f.owner.id, runId: f.run.id })).session;
    await expect(prepareWallet(db.first, worker, { kind: 'registerDevice' }, gateway)).rejects.toThrow('FORBIDDEN');
    gateway.getDeviceOwner = async () => (await db.first.db.select().from(s.owner).where(eq(s.owner.id, f.owner.id)))[0]!.walletAddress;
    gateway.getPolicy = async () => ({ agent: f.agent.publicKey, maxAmount: 1000000n, asset: gateway.config.asset, expiresAt: new Date(Date.now() + 60000) });
    await expect(prepareWallet(db.first, actor, { kind: 'sweepOnRevoke' }, gateway)).rejects.toThrow('POLICY_NOT_READY');
  });
  async function cappedFunding() {
    const context = await setup();
    context.gateway.getDeviceOwner = async () => context.signer.publicKey();
    context.gateway.fundingCeilingStroops = '1000000';
    context.gateway.fundingDeviceHash = context.f.agent.deviceHash;
    context.gateway.fundingAgentPublicKey = context.f.agent.publicKey;
    return context;
  }
  it('concurrent repeat funding submissions return the saved identity after the winner funds', async () => {
    const { f, actor, gateway, signer, submit } = await cappedFunding();
    const prepared = await prepareWallet(db.first, actor, { kind: 'fundEscrow', amountStroops: '1000000' }, gateway);
    const tx = TransactionBuilder.fromXDR(prepared.unsignedXdr, Networks.TESTNET); tx.sign(signer);
    let balance = 0n;
    // Synthetic external state changes as soon as the first guarded handoff
    // checks it. A stale contender must return identity, never recheck funding.
    gateway.getEscrowBalance = async () => { const observed = balance; balance = 1000000n; return observed; };
    let release!: () => void, locked!: () => void;
    const blocker = db.first.transaction(async connection => {
      await connection.select().from(s.agent).where(eq(s.agent.id, f.agent.id)).for('update');
      locked(); await new Promise<void>(resolve => { release = resolve; });
    });
    // Install the notifier synchronously before the first query resolves.
    const ready = new Promise<void>(resolve => { locked = resolve; });
    await ready;
    const submissions = [db.first, db.second].map(store => submitWallet(store, actor, prepared.operationId, tx.toXDR(), gateway));
    const settled = Promise.allSettled(submissions);
    try {
      const deadline = Date.now() + 5000;
      let waiting = 0;
      while (Date.now() < deadline) {
        const result = await db.second.db.execute(sql`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%"agent"%' AND pid <> pg_backend_pid()`);
        waiting = Number(result.rows[0]?.n ?? 0);
        if (waiting >= 2) break;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(waiting).toBeGreaterThanOrEqual(2);
    } finally { release(); await blocker; }
    const results = await settled;
    expect(results.map(result => result.status)).toEqual(['fulfilled', 'fulfilled']);
    for (const result of results) if (result.status === 'fulfilled') expect(result.value).toMatchObject({ operationId: prepared.operationId, txHash: tx.hash().toString('hex') });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(await db.first.db.select().from(s.job).where(eq(s.job.entityId, prepared.operationId))).toHaveLength(1);
  });
  it('lifetime funding cannot replenish spent/reclaimed confirmed funding and is context bound', async () => {
    const { actor, gateway, submit } = await cappedFunding();
    const first = await prepareWallet(db.first, actor, { kind: 'fundEscrow', amountStroops: '600000' }, gateway);
    // Explicitly synthetic ledger fixture: no actual wallet/chain handoff.
    await db.first.db.update(s.walletOperation).set({ status: 'confirmed' }).where(eq(s.walletOperation.id, first.operationId));
    gateway.getEscrowBalance = async () => 0n;
    await expect(prepareWallet(db.second, actor, { kind: 'fundEscrow', amountStroops: '500000' }, gateway)).rejects.toThrow('FUNDING_CEILING_EXCEEDED');
    gateway.fundingDeviceHash = '0'.repeat(64);
    await expect(prepareWallet(db.second, actor, { kind: 'fundEscrow', amountStroops: '400000' }, gateway)).rejects.toThrow('CONTRACT_MISMATCH');
    expect(submit).not.toHaveBeenCalled();
  });
  it('HTTP ignores client funding authority and returns the trusted ceiling error', async () => {
    const { f, actor, gateway, submit } = await cappedFunding();
    const session = await issueSession(db.first, { role: 'owner', ownerId: f.owner.id });
    const origin = 'http://localhost:3000';
    const app = createApplication({ store: db.first, env: { APP_ORIGIN: origin, DEMO_ESCROW_FUNDING_CEILING_STROOPS: '1000000' }, wallet: async () => gateway });
    const headers = { cookie: `aegispay_session=${session.token}`, origin, 'content-type': 'application/json' };
    const state = await app(new Request(origin + '/api/v1/state', { headers }));
    expect((await state.json()).walletFundingCeilingStroops).toBe('1000000');
    const changedAuthority = await app(new Request(origin + '/api/v1/wallet-operations', { method: 'POST', headers,
      body: JSON.stringify({ kind: 'fundEscrow', amountStroops: '1000001', fundingCeilingStroops: '10000000' }) }));
    expect(changedAuthority.status).toBe(400);
    const over = await app(new Request(origin + '/api/v1/wallet-operations', { method: 'POST', headers,
      body: JSON.stringify({ kind: 'fundEscrow', amountStroops: '1000001' }) }));
    expect(over.status).toBe(422); expect((await over.json()).error.code).toBe('FUNDING_CEILING_EXCEEDED');
    expect(submit).not.toHaveBeenCalled();
    expect(await db.first.db.select().from(s.walletOperation).where(eq(s.walletOperation.agentId, f.agent.id))).toHaveLength(0);
    // An ordinary within-ceiling request still prepares, without dispatch.
    expect((await prepareWallet(db.first, actor, { kind: 'fundEscrow', amountStroops: '1000000' }, gateway)).operationId).toBeTruthy();
  });
  it('unconfigured contexts keep their existing per-operation funding limit', async () => {
    const { f, actor, gateway, signer, submit } = await setup();
    gateway.getDeviceOwner = async () => signer.publicKey();
    const first = await prepareWallet(db.first, actor, { kind: 'fundEscrow', amountStroops: '10000000' }, gateway);
    await db.first.db.update(s.walletOperation).set({ status: 'confirmed' }).where(eq(s.walletOperation.id, first.operationId));
    const second = await prepareWallet(db.second, actor, { kind: 'fundEscrow', amountStroops: '10000000' }, gateway);
    expect(second.operationId).not.toBe(first.operationId);
    expect(await db.first.db.select().from(s.walletOperation).where(eq(s.walletOperation.agentId, f.agent.id))).toHaveLength(2);
    expect(submit).not.toHaveBeenCalled();
  });
  it('funding races serialize reservations across independent connections and unknown keeps authority', async () => {
    const { actor, gateway, signer, submit } = await cappedFunding();
    const results = await Promise.allSettled([db.first, db.second].map(store => prepareWallet(store, actor, { kind: 'fundEscrow', amountStroops: '600000' }, gateway)));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find(result => result.status === 'rejected')).toMatchObject({ reason: { code: 'OPERATION_ACTIVE' } });
    const p = (results.find(result => result.status === 'fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<typeof prepareWallet>>>).value;
    const tx = TransactionBuilder.fromXDR(p.unsignedXdr, Networks.TESTNET); tx.sign(signer);
    expect((await submitWallet(db.first, actor, p.operationId, tx.toXDR(), gateway)).status).toBe('unknown');
    await expect(prepareWallet(db.second, actor, { kind: 'fundEscrow', amountStroops: '600000' }, gateway)).rejects.toThrow('OPERATION_ACTIVE');
    expect(submit).toHaveBeenCalledTimes(1);
  });
  it('handoff rechecks cumulative authority and excludes its own saved preparation exactly once', async () => {
    const { actor, gateway, signer, submit } = await cappedFunding();
    const first = await prepareWallet(db.first, actor, { kind: 'fundEscrow', amountStroops: '600000' }, gateway);
    await db.first.db.update(s.walletOperation).set({ status: 'confirmed' }).where(eq(s.walletOperation.id, first.operationId));
    const p = await prepareWallet(db.second, actor, { kind: 'fundEscrow', amountStroops: '400000' }, gateway);
    const tx = TransactionBuilder.fromXDR(p.unsignedXdr, Networks.TESTNET); tx.sign(signer);
    gateway.fundingCeilingStroops = '999999';
    await expect(submitWallet(db.first, actor, p.operationId, tx.toXDR(), gateway)).rejects.toThrow('FUNDING_CEILING_EXCEEDED');
    expect(submit).not.toHaveBeenCalled();
    const [saved] = await db.first.db.select().from(s.walletOperation).where(eq(s.walletOperation.id, p.operationId));
    expect(saved!.handoffCommittedAt).toBeNull();
    gateway.fundingCeilingStroops = '1000000';
    expect((await submitWallet(db.second, actor, p.operationId, tx.toXDR(), gateway)).status).toBe('unknown');
    expect(submit).toHaveBeenCalledTimes(1);
  });
  it('only unhanded expiry or independently failed funding frees reserved lifetime authority', async () => {
    const { actor, gateway, signer } = await cappedFunding();
    const first = await prepareWallet(db.first, actor, { kind: 'fundEscrow', amountStroops: '1000000' }, gateway);
    // Synthetic terminal failure here tests accounting, not chain verification;
    // included-failure verifier cases are covered by wallet-worker regressions.
    await db.first.db.update(s.walletOperation).set({ status: 'failed' }).where(eq(s.walletOperation.id, first.operationId));
    const second = await prepareWallet(db.second, actor, { kind: 'fundEscrow', amountStroops: '1000000' }, gateway);
    await db.first.db.update(s.walletOperation).set({ status: 'expired' }).where(eq(s.walletOperation.id, second.operationId));
    const third = await prepareWallet(db.second, actor, { kind: 'fundEscrow', amountStroops: '1000000' }, gateway);
    const [saved] = await db.first.db.select().from(s.walletOperation).where(eq(s.walletOperation.id, third.operationId));
    await expect(db.first.db.update(s.walletOperation).set({ status: 'expired', handoffCommittedAt: new Date(), txHash: saved!.unsignedBodyHash }).where(eq(s.walletOperation.id, third.operationId))).rejects.toThrow();
    const tx = TransactionBuilder.fromXDR(third.unsignedXdr, Networks.TESTNET); tx.sign(signer);
    expect((await submitWallet(db.first, actor, third.operationId, tx.toXDR(), gateway)).status).toBe('unknown');
    await expect(prepareWallet(db.second, actor, { kind: 'fundEscrow', amountStroops: '1' }, gateway)).rejects.toThrow('OPERATION_ACTIVE');
  });
  for (const kind of ['sweepOnRevoke', 'defundEscrow'] as const) {
    const input = kind === 'defundEscrow' ? { kind, amountStroops: '300000' } : { kind };
    it(`TC-022 ${kind} preserves an unknown purchase, nonce and held budget`, async () => {
      const { f, signer, actor, gateway, submit } = await setup();
      gateway.getDeviceOwner = async () => signer.publicKey();
      const attempt = await acceptQuote(db.first, acceptInput(f));
      await observedProof(db.first, f, attempt);
      await db.first.db.update(s.paymentAttempt).set({ status: 'unknown' }).where(eq(s.paymentAttempt.id, attempt.id));
      const prepare = vi.spyOn(gateway, 'prepare');
      await expect(prepareWallet(db.second, actor, input, gateway)).rejects.toThrow('OPERATION_ACTIVE');
      expect(prepare).not.toHaveBeenCalled(); expect(submit).not.toHaveBeenCalled();
      const [agent] = await db.first.db.select().from(s.agent).where(eq(s.agent.id, f.agent.id));
      const [run] = await db.first.db.select().from(s.agentRun).where(eq(s.agentRun.id, f.run.id));
      const [saved] = await db.first.db.select().from(s.paymentAttempt).where(eq(s.paymentAttempt.id, attempt.id));
      expect(agent!.lastNonce).toBe('1'); expect(run!.reservedStroops).toBe('300000'); expect(run!.spentStroops).toBe('0');
      expect(saved!.status).toBe('unknown'); expect(saved!.veloRequestId).not.toBeNull();
      expect(await db.first.db.select().from(s.entitlement)).toHaveLength(0);
    });
    it(`TC-022 ${kind} preparation serializes against quote acceptance on independent connections`, async () => {
      const { f, signer, actor, gateway, submit } = await setup();
      gateway.getDeviceOwner = async () => signer.publicKey();
      const results = await Promise.allSettled([
        prepareWallet(db.first, actor, input, gateway), acceptQuote(db.second, acceptInput(f)),
      ]);
      expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.find(r => r.status === 'rejected') as PromiseRejectedResult;
      expect(rejected.reason).toMatchObject({ code: 'OPERATION_ACTIVE' });
      expect(submit).not.toHaveBeenCalled();
    });
    it(`TC-022 ${kind} rechecks policy at signed submission without a handoff`, async () => {
      const { f, signer, actor, gateway, submit } = await setup();
      gateway.getDeviceOwner = async () => signer.publicKey();
      const prepared = await prepareWallet(db.first, actor, input, gateway);
      // A separately refreshed active cache cannot authorize a purchase while
      // the saved reclaim is prepared, nor once its handoff becomes unknown.
      await expect(acceptQuote(db.second, acceptInput(f))).rejects.toThrow('OPERATION_ACTIVE');
      gateway.getPolicy = async () => ({ agent: f.agent.publicKey, maxAmount: 1000000n, asset: gateway.config.asset, expiresAt: new Date(Date.now() + 60000) });
      const tx = TransactionBuilder.fromXDR(prepared.unsignedXdr, Networks.TESTNET); tx.sign(signer);
      await expect(submitWallet(db.second, actor, prepared.operationId, tx.toXDR(), gateway)).rejects.toThrow('POLICY_NOT_READY');
      expect(submit).not.toHaveBeenCalled();
      gateway.getPolicy = async () => null;
      expect((await submitWallet(db.first, actor, prepared.operationId, tx.toXDR(), gateway)).status).toBe('unknown');
      expect(submit).toHaveBeenCalledTimes(1);
      await expect(acceptQuote(db.second, acceptInput(f))).rejects.toThrow('OPERATION_ACTIVE');
      await observeWallet(db.second, actor, prepared.operationId, gateway);
      await submitWallet(db.second, actor, prepared.operationId, tx.toXDR(), gateway);
      expect(submit).toHaveBeenCalledTimes(1);
    });
  }
  for (const path of ['refresh', 'confirmation'] as const) for (const when of ['before', 'during_rpc'] as const) {
    it(`R1 preserves operator suspension ${when} ${path} and refuses new spending`, async () => {
      const { f, signer, actor, gateway } = await setup();
      let operationId: string | undefined;
      if (path === 'confirmation') {
        const prepared = await prepareWallet(db.first, actor, { kind: 'registerDevice' }, gateway);
        operationId = prepared.operationId;
        const tx = TransactionBuilder.fromXDR(prepared.unsignedXdr, Networks.TESTNET); tx.sign(signer);
        await submitWallet(db.first, actor, operationId, tx.toXDR(), gateway);
        gateway.getTransaction = async hash => ({ status: rpc.Api.GetTransactionStatus.SUCCESS, txHash: hash,
          latestLedger: 2, latestLedgerCloseTime: 1, oldestLedger: 1, oldestLedgerCloseTime: 1, ledger: 2,
          createdAt: Math.floor(Date.now() / 1000), applicationOrder: 1, feeBump: false, envelopeXdr: tx.toEnvelope(),
          resultXdr: new xdr.TransactionResult({ feeCharged: xdr.Int64.fromString('100'), result: xdr.TransactionResultResult.txSuccess([]), ext: new xdr.TransactionResultExt(0) }),
          resultMetaXdr: new xdr.TransactionMeta(0, []), events: { transactionEventsXdr: [], contractEventsXdr: [] } });
      }
      gateway.getDeviceOwner = async () => signer.publicKey();
      gateway.getEscrowToken = async () => gateway.config.asset;
      const disable = () => db.second.db.update(s.agent).set({ status: 'disabled' }).where(eq(s.agent.id, f.agent.id));
      if (when === 'before') await disable();
      gateway.getPolicy = async () => {
        // The HTTP/domain path has already read an active snapshot. Commit a
        // separate connection's operator action before the RPC promise resolves.
        if (when === 'during_rpc') await disable();
        return { agent: f.agent.publicKey, maxAmount: 750000n, asset: gateway.config.asset, expiresAt: new Date(Date.now() + 60000) };
      };
      if (path === 'confirmation') {
        expect((await observeWallet(db.first, actor, operationId!, gateway)).status).toBe('confirmed');
      } else {
        const session = await issueSession(db.first, { role: 'owner', ownerId: f.owner.id });
        const app = createApplication({ store: db.first, env: { APP_ORIGIN: 'http://localhost:3000' }, wallet: async () => gateway });
        const response = await app(new Request('http://localhost:3000/api/v1/wallet-state', { headers: { cookie: `aegispay_session=${session.token}` } }));
        expect(response.status).toBe(200);
      }
      const [agent] = await db.first.db.select().from(s.agent).where(eq(s.agent.id, f.agent.id));
      expect(agent!.status).toBe('disabled'); expect(agent!.policyMaxStroops).toBe('750000');
      await expect(createRun(db.first, { ownerId: f.owner.id, agentId: f.agent.id, runStartKey: randomUUID(), task: 'Blocked while suspended', modelId: 'synthetic' })).rejects.toThrow('POLICY_NOT_READY');
      await expect(acceptQuote(db.first, acceptInput(f))).rejects.toThrow('POLICY_NOT_READY');
    });
  }
});
