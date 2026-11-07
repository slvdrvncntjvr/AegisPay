// Synthetic transactions and temporary local journals only. Never live evidence.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { test, mock } from 'node:test';
import { Account, Address, Asset, BASE_FEE, Contract, Keypair, Networks, Transaction, TransactionBuilder, rpc, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { NoirAgentClient, NoirContractError, toCall, type NoirOperation, type NoirEvent, type NoirAgentPolicy } from '@noirx402/agent-sdk';
import { inspectWalletOperation, walletOperationOnce, type WalletClient } from '../../src/server/integrations/spike-runtime.js';
import { provisionSpike, executeSpike, type SpikeContext } from '../../src/server/integrations/spike-driver.js';
import type { GasApi, GasSubmitResult } from '@carts1024/velo-sdk';
import { safeFailure } from '../../scripts/verify-contracts.js';

function fixture() {
  const signer = Keypair.random();
  const asset = Asset.native().contractId(Networks.TESTNET);
  const config = { network: { rpcUrl: 'https://example.invalid', networkPassphrase: Networks.TESTNET,
    contracts: { deviceRegistry: asset, agentRegistry: asset, paymentEscrow: asset } }, asset };
  const operation: NoirOperation = { kind: 'registerDevice', deviceHash: 'ab'.repeat(32), agent: Keypair.random().publicKey() };
  const call = toCall(signer.publicKey(), operation);
  const tx = new TransactionBuilder(new Account(signer.publicKey(), '10'), { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(new Contract(asset).call(call.method, ...call.args)).setTimeout(300).build();
  return { signer, config, operation, tx };
}
function success(tx: ReturnType<typeof fixture>['tx']): rpc.Api.GetSuccessfulTransactionResponse {
  return { status: rpc.Api.GetTransactionStatus.SUCCESS, txHash: tx.hash().toString('hex'), latestLedger: 100,
    latestLedgerCloseTime: 1, oldestLedger: 1, oldestLedgerCloseTime: 1, ledger: 99, createdAt: Math.floor(Date.now() / 1000),
    applicationOrder: 1, feeBump: false, envelopeXdr: tx.toEnvelope(),
    resultXdr: new xdr.TransactionResult({ feeCharged: xdr.Int64.fromString('100'), result: xdr.TransactionResultResult.txSuccess([]), ext: new xdr.TransactionResultExt(0) }),
    resultMetaXdr: new xdr.TransactionMeta(0, []), events: { transactionEventsXdr: [], contractEventsXdr: [] } };
}
async function cleanup(directory: string) {
  assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
  assert.ok(basename(directory).startsWith('aegispay-driver-'));
  await rm(directory, { recursive: true, force: true });
}
test('TC-024: owner operation matches its prepared source, contract, arguments and auth root', () => {
  const f = fixture();
  assert.equal(inspectWalletOperation(f.tx.toXDR(), f.signer.publicKey(), f.operation, f.config).source, f.signer.publicKey());
  assert.throws(() => inspectWalletOperation(f.tx.toXDR(), f.signer.publicKey(), { ...f.operation, deviceHash: 'cd'.repeat(32) }, f.config), /WALLET_INVOCATION_MISMATCH/);
  assert.throws(() => inspectWalletOperation(f.tx.toXDR(), Keypair.random().publicKey(), f.operation, f.config), /WALLET_ENVELOPE_MISMATCH/);
});
test('TC-024: escrow funding permits only the exact nested token transfer', () => {
  const f = fixture();
  const operation: NoirOperation = { kind: 'fundEscrow', deviceHash: 'ab'.repeat(32), token: f.config.asset, amount: 10000000n };
  const call = toCall(f.signer.publicKey(), operation);
  const tx = new TransactionBuilder(new Account(f.signer.publicKey(), '10'), { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(new Contract(f.config.asset).call(call.method, ...call.args)).setTimeout(300).build();
  const envelope = tx.toEnvelope();
  const host = envelope.v1().tx().operations()[0]!.body().invokeHostFunctionOp();
  const transfer = new Contract(f.config.asset).call('transfer', Address.fromString(f.signer.publicKey()).toScVal(),
    Address.fromString(f.config.asset).toScVal(), nativeToScVal(10000000n, { type: 'i128' })).body().invokeHostFunctionOp().hostFunction().invokeContract();
  const child = new xdr.SorobanAuthorizedInvocation({ function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(transfer), subInvocations: [] });
  host.auth([new xdr.SorobanAuthorizationEntry({ credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
    rootInvocation: new xdr.SorobanAuthorizedInvocation({ function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(host.hostFunction().invokeContract()), subInvocations: [child] }) })]);
  assert.doesNotThrow(() => inspectWalletOperation(envelope.toXDR('base64'), f.signer.publicKey(), operation, f.config));
  transfer.args()[2] = nativeToScVal(10000001n, { type: 'i128' });
  assert.throws(() => inspectWalletOperation(envelope.toXDR('base64'), f.signer.publicKey(), operation, f.config), /UNEXPECTED_WALLET_AUTHORIZATION/);
});
test('TC-029: owner operation persists its hash before dispatch; restart observes without signing or submitting again', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aegispay-driver-'));
  try {
    const f = fixture();
    let prepares = 0, submits = 0;
    const client: WalletClient = {
      async prepare() { prepares++; return f.tx.toXDR(); },
      async submit(signed) { submits++; assert.equal(TransactionBuilder.fromXDR(signed, Networks.TESTNET).hash().toString('hex'), f.tx.hash().toString('hex'));
        throw new Error('synthetic-disconnect'); },
      async getTransaction() { const signed = TransactionBuilder.fromXDR(f.tx.toXDR(), Networks.TESTNET);
        assert.ok(signed instanceof Transaction); signed.sign(f.signer); return success(signed); },
    };
    const args = { directory, client, signer: f.signer, operation: f.operation, config: f.config };
    await assert.rejects(walletOperationOnce(args), /WALLET_HANDOFF_UNRESOLVED/);
    const proof = await walletOperationOnce(args);
    assert.equal(proof.hash, f.tx.hash().toString('hex'));
    assert.equal(prepares, 1); assert.equal(submits, 1);
  } finally { await cleanup(directory); }
});
test('TC-024: a saved wallet handoff cannot be reused for different intent', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aegispay-driver-'));
  try {
    const f = fixture();
    const client: WalletClient = { async prepare() { return f.tx.toXDR(); }, async submit() { throw new Error('synthetic-timeout'); },
      async getTransaction() { throw new Error('must not observe different intent'); } };
    const args = { directory, client, signer: f.signer, operation: f.operation, config: f.config };
    await assert.rejects(walletOperationOnce(args), /WALLET_HANDOFF_UNRESOLVED/);
    await assert.rejects(walletOperationOnce({ ...args, operation: { ...f.operation, deviceHash: 'cd'.repeat(32) } }), /WALLET_INTENT_MISMATCH/);
  } finally { await cleanup(directory); }
});

async function syntheticDriver(directory: string) {
  const f = fixture();
  const owner = f.signer, agent = Keypair.random(), merchant = Keypair.random();
  const noir = new NoirAgentClient({ network: f.config.network });
  let deviceOwner: string | null = null, policy: NoirAgentPolicy | null = null;
  let escrow = 0n, pending = 0n, sourceSequence = 10, submits = 0, gasSubmits = 0, signsPrepared = 0;
  let lastResult: GasSubmitResult;
  const transactions = new Map<string, rpc.Api.GetSuccessfulTransactionResponse>();
  const events: NoirEvent[] = [];
  const rawEvents: rpc.Api.EventResponse[] = [];
  function record(tx: Transaction, operation: NoirOperation) {
    const chain = success(tx);
    let event: NoirEvent | undefined;
    if (operation.kind === 'claim' || operation.kind === 'authorize') {
      const isClaim = operation.kind === 'claim';
      const amount = isClaim ? pending : operation.amount;
      const base = { id: `synthetic-event-${events.length}`, txHash: chain.txHash, contractId: f.config.asset, ledger: chain.ledger, ledgerClosedAt: new Date().toISOString() };
      event = isClaim ? { ...base, type: 'payment.claimed', merchant: merchant.publicKey(), amount } :
        { ...base, type: 'payment.authorized', deviceHash: operation.deviceHash, merchant: merchant.publicKey(), amount };
      const topics = [nativeToScVal(isClaim ? 'claim' : 'authorize', { type: 'symbol' }),
        ...(isClaim ? [] : [nativeToScVal(Buffer.from(operation.deviceHash, 'hex'))]), Address.fromString(merchant.publicKey()).toScVal()];
      const embedded = new xdr.ContractEvent({ ext: new xdr.ExtensionPoint(0), contractId: Address.fromString(f.config.asset).toScAddress().contractId(),
        type: xdr.ContractEventType.contract(), body: new xdr.ContractEventBody(0, new xdr.ContractEventV0({ topics, data: nativeToScVal(amount, { type: 'i128' }) })) });
      chain.events.contractEventsXdr = [[embedded]];
      events.push(event);
      const raw: rpc.Api.EventResponse = { ...base, type: 'contract', contractId: new Contract(f.config.asset), topic: topics,
        value: embedded.body().v0().data(), transactionIndex: 1, operationIndex: 0, inSuccessfulContractCall: true };
      Reflect.deleteProperty(raw, 'inSuccessfulContractCall');
      rawEvents.push(raw);
    }
    transactions.set(chain.txHash, chain);
    return chain;
  }
  mock.method(noir, 'prepare', async (source: string, operation: NoirOperation) => {
    if (operation.kind === 'authorize') {
      signsPrepared++;
      if (operation.amount > 1000000n) throw new NoirContractError('paymentEscrow', 3, 'AgentNotAuthorized', 'authorize');
    }
    const call = toCall(source, operation);
    return new TransactionBuilder(new Account(source, String(sourceSequence++)), { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
      .addOperation(new Contract(f.config.asset).call(call.method, ...call.args)).setTimeout(300).build().toXDR();
  });
  mock.method(noir, 'submit', async (signed: string, operation?: NoirOperation) => {
    assert.ok(operation); assert.notEqual(operation.kind, 'authorize', 'agent purchase must use Velo');
    submits++;
    const tx = TransactionBuilder.fromXDR(signed, Networks.TESTNET); assert.ok(tx instanceof Transaction);
    if (operation.kind === 'registerDevice') deviceOwner = owner.publicKey();
    if (operation.kind === 'registerAgent') policy = { agent: operation.agent, maxAmount: operation.maxAmount, asset: operation.asset, expiresAt: operation.expiresAt ?? null };
    if (operation.kind === 'fundEscrow') escrow += operation.amount;
    const chain = record(tx, operation);
    if (operation.kind === 'claim') pending = 0n;
    return chain.txHash;
  });
  mock.method(noir.server, 'getTransaction', async (hash: string) => {
    const result = transactions.get(hash); assert.ok(result, 'synthetic chain transaction must exist'); return result;
  });
  mock.method(noir, 'getDeviceOwner', async () => deviceOwner);
  mock.method(noir, 'getDeviceAgent', async () => deviceOwner ? agent.publicKey() : null);
  mock.method(noir, 'getPolicy', async () => policy);
  mock.method(noir, 'getEscrowToken', async () => escrow > 0n ? f.config.asset : null);
  mock.method(noir, 'getEscrowBalance', async () => escrow);
  mock.method(noir, 'getPendingBalance', async () => pending);
  mock.method(noir, 'checkPayment', async ({ amount }: { amount: bigint }) => amount > 1000000n ? { ok: false as const, reason: 'over_limit' as const } : { ok: true as const });
  mock.method(noir, 'getEvents', async () => ({ events, cursor: 'synthetic-cursor', latestLedger: 100 }));
  mock.method(noir.server, 'getEvents', async () => ({ events: rawEvents, cursor: 'synthetic-cursor', latestLedger: 100, oldestLedger: 1,
    latestLedgerCloseTime: 1, oldestLedgerCloseTime: 1 }));
  let signedForSponsor = '';
  const gas: GasApi = {
    async sponsor(signed) { signedForSponsor = signed; const tx = TransactionBuilder.fromXDR(signed, Networks.TESTNET);
      return { object: 'gas_sponsor_reservation', decision: 'reserved', requestId: 'synthetic-reservation', transactionHash: tx.hash().toString('hex'),
        sourceWallet: agent.publicKey(), targetContractIds: [f.config.asset], innerMaxFeeStroops: '100', reservedStroops: '100', replayed: false, expiresAt: new Date(Date.now() + 60000).toISOString() }; },
    async submit(params) {
      gasSubmits++;
      assert.equal(params.transactionXdr, signedForSponsor);
      const tx = TransactionBuilder.fromXDR(params.transactionXdr, Networks.TESTNET); assert.ok(tx instanceof Transaction);
      const invocation = tx.operations[0]; assert.equal(invocation?.type, 'invokeHostFunction');
      const op: NoirOperation = { kind: 'authorize', deviceHash: 'unused', merchant: merchant.publicKey(), asset: f.config.asset, amount: 300000n, nonce: 1n };
      if (invocation?.type === 'invokeHostFunction') op.deviceHash = Buffer.from(invocation.func.invokeContract().args()[1]!.bytes()).toString('hex');
      escrow -= op.amount; pending += op.amount;
      const chain = record(tx, op);
      lastResult = { object: 'gas_submit_result', requestId: params.requestId, transactionHash: params.transactionHash,
        outerTransactionHash: chain.txHash, status: 'succeeded', reservedStroops: '100', actualFeeStroops: null,
        expiresAt: new Date(Date.now() + 60000).toISOString(), reconciliationRequired: false };
      return lastResult;
    },
    async getStatus() { return lastResult; }, async waitForResult() { return lastResult; },
    async sponsorAndSubmit() { throw new Error('composed helper must not be used'); },
  };
  const ctx: SpikeContext = { directory, config: f.config, noir, gas, owner, agent, merchant, encryptionKey: Buffer.alloc(32, 7), bindingHash: 'cc'.repeat(32) };
  return { ctx, counts: () => ({ submits, gasSubmits, signsPrepared }), setPending: (value: bigint) => { pending = value; } };
}
test('TASK-002 synthetic driver: setup, live-shaped refusal, payment and separate claim resume without another handoff', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aegispay-driver-'));
  try {
    const f = await syntheticDriver(directory);
    await provisionSpike(f.ctx);
    const result = await executeSpike(f.ctx);
    assert.equal(result.authorization.amount, '300000'); assert.equal(result.claim.amountStroops, '300000');
    assert.equal(result.balances.afterAuthorization.escrow, '9700000'); assert.equal(result.balances.afterClaim.pending, '0');
    const repeated = await executeSpike(f.ctx);
    assert.equal(repeated.authorization.innerHash, result.authorization.innerHash);
    assert.deepEqual(f.counts(), { submits: 4, gasSubmits: 1, signsPrepared: 2 });
    await assert.rejects(provisionSpike(f.ctx), /SPIKE_FIXTURE_ALREADY_IN_USE/);
  } finally { await cleanup(directory); }
});
test('TASK-002 synthetic driver: disconnect after submit resumes the exact saved payment without a second signature or handoff', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aegispay-driver-'));
  try {
    const f = await syntheticDriver(directory); await provisionSpike(f.ctx);
    const submit = f.ctx.gas.submit;
    f.ctx.gas.submit = async (...args) => { await submit(...args); throw new Error('synthetic-secret-timeout-sentinel'); };
    await assert.rejects(executeSpike(f.ctx), /PAYMENT_OUTCOME_UNRESOLVED/);
    const result = await executeSpike(f.ctx);
    assert.equal(result.claim.amountStroops, '300000');
    assert.deepEqual(f.counts(), { submits: 4, gasSubmits: 1, signsPrepared: 2 });
  } finally { await cleanup(directory); }
});

test('TASK-002 synthetic driver: post-handoff RPC failure is unresolved and redacted, then recovers without replay', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aegispay-driver-'));
  try {
    const f = await syntheticDriver(directory); await provisionSpike(f.ctx);
    const observe = f.ctx.noir.server.getTransaction.bind(f.ctx.noir.server);
    let fail = true;
    mock.method(f.ctx.noir.server, 'getTransaction', async (hash: string) => {
      if (fail) { fail = false; throw new Error('synthetic-secret-rpc-sentinel'); }
      return observe(hash);
    });
    await assert.rejects(executeSpike(f.ctx), error => {
      assert.deepEqual(safeFailure(error), { status: 'unresolved', code: 'PAYMENT_OR_CLAIM_OBSERVATION_UNRESOLVED' }); return true;
    });
    await executeSpike(f.ctx);
    assert.deepEqual(f.counts(), { submits: 4, gasSubmits: 1, signsPrepared: 2 });
  } finally { await cleanup(directory); }
});

test('TASK-002 synthetic driver: an RPC claim event without its matching embedded chain event cannot pass', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aegispay-driver-'));
  try {
    const f = await syntheticDriver(directory); await provisionSpike(f.ctx);
    const observe = f.ctx.noir.server.getTransaction.bind(f.ctx.noir.server);
    const replacement = mock.method(f.ctx.noir.server, 'getTransaction', async (hash: string) => {
      const chain = await observe(hash);
      if (chain.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        const tx = TransactionBuilder.fromXDR(chain.envelopeXdr, Networks.TESTNET);
        assert.ok(tx instanceof Transaction);
        const op = tx.operations[0];
        if (op?.type === 'invokeHostFunction' && op.func.invokeContract().functionName().toString() === 'claim') return { ...chain, events: { transactionEventsXdr: [], contractEventsXdr: [] } };
      }
      return chain;
    });
    await assert.rejects(executeSpike(f.ctx), error => {
      assert.deepEqual(safeFailure(error), { status: 'unresolved', code: 'NOIR_EVENT_UNAVAILABLE' }); return true;
    });
    replacement.mock.restore();
    await executeSpike(f.ctx);
    assert.deepEqual(f.counts(), { submits: 4, gasSubmits: 1, signsPrepared: 2 });
  } finally { await cleanup(directory); }
});
