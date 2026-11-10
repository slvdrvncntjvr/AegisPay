import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Account, Contract, Keypair, Networks, TransactionBuilder, rpc, xdr } from '@stellar/stellar-sdk';
import { toCall } from '@noirx402/agent-sdk';
import { eq } from 'drizzle-orm';
import { createTestDatabase } from './support/database.js';
import { acceptInput, fixture } from './support/fixtures.js';
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
