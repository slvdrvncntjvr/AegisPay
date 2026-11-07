import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Account, Address, Asset, BASE_FEE, Contract, Keypair, Networks, TransactionBuilder, nativeToScVal, rpc, xdr } from '@stellar/stellar-sdk';
import { toCall } from '@noirx402/agent-sdk';
import { verifyAuthorizationEvidence, decodeMatchedNoirEvent } from '../../src/server/integrations/stellar-evidence.js';

function syntheticFixture(feeBump = false, outerFee = feeBump ? '200' : '100', innerFee = '0') {
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
  const operationResults = [xdr.OperationResult.opInner(xdr.OperationResultTr.invokeHostFunction(
    xdr.InvokeHostFunctionResult.invokeHostFunctionSuccess(Buffer.alloc(32, 1)),
  ))];
  const transaction: rpc.Api.GetSuccessfulTransactionResponse = {
    status: rpc.Api.GetTransactionStatus.SUCCESS, txHash: outerHash, latestLedger: 100, latestLedgerCloseTime: 1,
    oldestLedger: 1, oldestLedgerCloseTime: 1, ledger: 99, createdAt: Math.floor(Date.now() / 1000), applicationOrder: 1,
    feeBump, envelopeXdr: envelope.toEnvelope(),
    resultXdr: new xdr.TransactionResult({ feeCharged: xdr.Int64.fromString(outerFee),
      result: feeBump ? xdr.TransactionResultResult.txFeeBumpInnerSuccess(new xdr.InnerTransactionResultPair({
        transactionHash: inner.hash(), result: new xdr.InnerTransactionResult({ feeCharged: xdr.Int64.fromString(innerFee),
          result: xdr.InnerTransactionResultResult.txSuccess(operationResults), ext: new xdr.InnerTransactionResultExt(0) }),
      })) : xdr.TransactionResultResult.txSuccess(operationResults), ext: new xdr.TransactionResultExt(0) }),
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

test('TC-027/EQ-004: actual fee requires matching outer ledger and Velo provenance', () => {
  for (const feeBump of [false, true]) {
    const f = syntheticFixture(feeBump);
    // Round-trip the result through the pinned SDK XDR codec, with a distinct
    // inner-result fee for fee bumps (the outer result is the charged fee).
    f.transaction.resultXdr = xdr.TransactionResult.fromXDR(f.transaction.resultXdr.toXDR());
    const outerFee = feeBump ? '200' : '100';
    for (const [veloFee, expectedFee, status] of [
      ['99', null, 'conflict'],
      [outerFee, outerFee, 'matched'],
      [null, null, 'velo_unavailable'],
      ...(feeBump ? [['0', null, 'conflict']] : []),
    ] as const) {
      const verified = verifyAuthorizationEvidence({ ...f, velo: { ...f.velo, actualFeeStroops: veloFee } });
      assert.equal(verified.actualFeeStroops, expectedFee);
      assert.equal(verified.outerLedgerFeeChargedStroops, outerFee);
      assert.equal(verified.veloActualFeeStroops, veloFee);
      assert.equal(verified.actualFeeStatus, status);
      assert.equal(verified.amount, f.intent.amount.toString(), 'fee conflict must not remove verified entitlement');
    }
  }
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

test('TC-011: omitted RPC success flag is accepted only with the identical embedded event in independently successful transaction evidence', () => {
  const f = syntheticFixture(true);
  const embedded = f.transaction.events.contractEventsXdr[0]![0]!;
  const raw = { type: 'contract', id: f.event.id, ledger: f.event.ledger, ledgerClosedAt: f.event.ledgerClosedAt,
    txHash: f.event.txHash, contractId: new Contract(f.intent.escrow), topic: embedded.body().v0().topics(), value: embedded.body().v0().data() };
  const decoded = decodeMatchedNoirEvent(raw, f.transaction, f.intent.escrow);
  assert.equal(decoded?.type, 'payment.authorized');
  assert.equal(verifyAuthorizationEvidence({ ...f, event: decoded! }).nonce, '17');
  assert.equal(decodeMatchedNoirEvent({ ...raw, inSuccessfulContractCall: false }, f.transaction, f.intent.escrow), null);
  assert.equal(decodeMatchedNoirEvent(raw, { ...f.transaction, status: rpc.Api.GetTransactionStatus.FAILED }, f.intent.escrow), null);
  assert.equal(decodeMatchedNoirEvent({ ...raw, txHash: 'ff'.repeat(32) }, f.transaction, f.intent.escrow), null);
  assert.equal(decodeMatchedNoirEvent({ ...raw, value: nativeToScVal(1n, { type: 'i128' }) }, f.transaction, f.intent.escrow), null);
  assert.equal(decodeMatchedNoirEvent(raw, { ...f.transaction, events: { transactionEventsXdr: [], contractEventsXdr: [] } }, f.intent.escrow), null);
});
