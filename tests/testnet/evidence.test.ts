import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Account, Address, Asset, BASE_FEE, Contract, Keypair, Networks, TransactionBuilder, nativeToScVal, rpc, xdr } from '@stellar/stellar-sdk';
import { toCall } from '@noirx402/agent-sdk';
import { verifyAuthorizationEvidence } from '../../src/server/integrations/stellar-evidence.js';

function syntheticFixture(feeBump = false) {
  const agent = Keypair.random();
  const asset = Asset.native().contractId(Networks.TESTNET);
  const intent = { agent: agent.publicKey(), merchant: Keypair.random().publicKey(), deviceHash: 'ab'.repeat(32),
    asset, escrow: asset, amount: 300000n, nonce: 17n, expiresAt: Date.now() + 60000 };
  const call = toCall(intent.agent, { kind: 'authorize', ...intent });
  const inner = new TransactionBuilder(new Account(intent.agent, '10'), { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(new Contract(intent.escrow).call(call.method, ...call.args)).setTimeout(60).build();
  inner.sign(agent);
  const innerHash = inner.hash().toString('hex');
  const relayer = Keypair.random();
  const envelope = feeBump ? TransactionBuilder.buildFeeBumpTransaction(relayer, BASE_FEE, inner, Networks.TESTNET) : inner;
  if (feeBump) envelope.sign(relayer);
  const outerHash = envelope.hash().toString('hex');
  const identity = { requestId: 'synthetic-request', transactionHash: innerHash };
  const contractEvent = new xdr.ContractEvent({ ext: new xdr.ExtensionPoint(0),
    contractId: Address.fromString(intent.escrow).toScAddress().contractId(), type: xdr.ContractEventType.contract(),
    body: new xdr.ContractEventBody(0, new xdr.ContractEventV0({
      topics: [nativeToScVal('authorize', { type: 'symbol' }), nativeToScVal(Buffer.from(intent.deviceHash, 'hex')),
        Address.fromString(intent.merchant).toScVal()], data: nativeToScVal(intent.amount, { type: 'i128' }),
    })),
  });
  const transaction: rpc.Api.GetSuccessfulTransactionResponse = {
    status: rpc.Api.GetTransactionStatus.SUCCESS, txHash: outerHash, latestLedger: 100, latestLedgerCloseTime: 1,
    oldestLedger: 1, oldestLedgerCloseTime: 1, ledger: 99, createdAt: Math.floor(Date.now() / 1000), applicationOrder: 1,
    feeBump, envelopeXdr: envelope.toEnvelope(),
    resultXdr: new xdr.TransactionResult({ feeCharged: xdr.Int64.fromString('100'),
      result: feeBump ? xdr.TransactionResultResult.txFeeBumpInnerSuccess(new xdr.InnerTransactionResultPair({
        transactionHash: inner.hash(), result: new xdr.InnerTransactionResult({ feeCharged: xdr.Int64.fromString('100'),
          result: xdr.InnerTransactionResultResult.txSuccess([]), ext: new xdr.InnerTransactionResultExt(0) }),
      })) : xdr.TransactionResultResult.txSuccess([]), ext: new xdr.TransactionResultExt(0) }),
    resultMetaXdr: new xdr.TransactionMeta(0, []), events: { transactionEventsXdr: [], contractEventsXdr: [[contractEvent]] },
  };
  const event = { type: 'payment.authorized' as const, id: 'synthetic-event', contractId: intent.escrow, ledger: 99,
    ledgerClosedAt: new Date().toISOString(), txHash: innerHash, deviceHash: intent.deviceHash, merchant: intent.merchant, amount: intent.amount };
  const velo = { ...identity, object: 'gas_submit_result' as const, outerTransactionHash: outerHash, status: 'succeeded' as const,
    reservedStroops: '100', actualFeeStroops: null, expiresAt: new Date(intent.expiresAt).toISOString(), reconciliationRequired: false };
  return { transaction, event, velo, identity, intent, handoffCommittedAt: Date.now() - 1000 };
}
test('TC-011: independent matching envelope and event qualify only with Velo success', () => {
  const f = syntheticFixture();
  assert.equal(verifyAuthorizationEvidence(f).nonce, '17');
  assert.throws(() => verifyAuthorizationEvidence({ ...f, velo: { ...f.velo, status: 'submitted' } }));
  assert.throws(() => verifyAuthorizationEvidence({ ...f, event: { ...f.event, amount: 1n } }));
  assert.throws(() => verifyAuthorizationEvidence({ ...f, intent: { ...f.intent, nonce: 18n } }));
  assert.throws(() => verifyAuthorizationEvidence({ ...f, velo: { ...f.velo, outerTransactionHash: 'ff'.repeat(32) } }));
});
test('TC-011: fee-bump inner/outer/event hashes are mapped independently', () => {
  const f = syntheticFixture(true);
  const verified = verifyAuthorizationEvidence(f);
  assert.notEqual(verified.innerHash, verified.outerHash);
  assert.equal(verified.observedEventTransactionHash, verified.innerHash);
  assert.equal(verifyAuthorizationEvidence({ ...f, event: { ...f.event, txHash: verified.outerHash } }).outerHash, verified.outerHash);
  const pair = f.transaction.resultXdr.result().innerResultPair();
  pair.transactionHash(Buffer.alloc(32));
  assert.throws(() => verifyAuthorizationEvidence(f), /FEE_BUMP_RESULT_MISMATCH/);
});
test('TC-010: a matching decoded event without an event in successful transaction meta is insufficient', () => {
  const f = syntheticFixture();
  assert.throws(() => verifyAuthorizationEvidence({ ...f,
    transaction: { ...f.transaction, events: { transactionEventsXdr: [], contractEventsXdr: [] } },
  }), /AUTHORIZATION_EVENT_NOT_IN_TRANSACTION/);
});
test('TC-019: post-expiry handoff cannot be turned into timely evidence', () => {
  const f = syntheticFixture();
  assert.throws(() => verifyAuthorizationEvidence({ ...f, handoffCommittedAt: f.intent.expiresAt + 1 }), /INVALID_HANDOFF_TIME/);
});

test('TC-006: missing, extra and invalid agent signatures cannot authorize evidence', () => {
  for (const mode of ['missing', 'extra', 'invalid'] as const) {
    const f = syntheticFixture();
    const envelope = f.transaction.envelopeXdr.v1();
    const signatures = envelope.signatures();
    if (mode === 'missing') envelope.signatures([]);
    if (mode === 'extra') envelope.signatures([...signatures, signatures[0]!]);
    if (mode === 'invalid') signatures[0]!.signature(Buffer.alloc(64));
    assert.throws(() => verifyAuthorizationEvidence(f), /AGENT_SIGNATURE_MISMATCH/);
  }
});
