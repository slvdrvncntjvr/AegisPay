// Pure synthetic fixtures. These never produce ledger/payment artifacts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Account, Asset, Contract, Keypair, Networks, TransactionBuilder, nativeToScVal, BASE_FEE, xdr } from '@stellar/stellar-sdk';
import { toCall } from '@noirx402/agent-sdk';
import { readTestnetConfig, inspectAuthorization } from '../../src/server/integrations/noir.js';
import { validateReservation, validateExecution } from '../../src/server/integrations/velo.js';

const agent = Keypair.random();
const merchant = Keypair.random().publicKey();
const asset = Asset.native().contractId(Networks.TESTNET);
const escrow = new Contract(asset).contractId();
const intent = { agent: agent.publicKey(), deviceHash: 'ab'.repeat(32), merchant, asset,
  amount: 300000n, nonce: 1n, escrow, expiresAt: Date.now() + 120000 };
function envelope(overrides: Partial<typeof intent> = {}, extra = false) {
  const i = { ...intent, ...overrides };
  const call = toCall(i.agent, { kind: 'authorize', ...i });
  const builder = new TransactionBuilder(new Account(i.agent, '10'), { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(new Contract(i.escrow).call(call.method, ...call.args)).setTimeout(60);
  if (extra) builder.addOperation(new Contract(i.escrow).call('claim', nativeToScVal('synthetic')));
  return builder.build().toXDR();
}
test('TC-013: missing configuration is explicit and mainnet is refused', () => {
  assert.throws(() => readTestnetConfig({}), /MISSING_CONFIGURATION/);
  assert.throws(() => readTestnetConfig({ STELLAR_NETWORK: 'mainnet' }), /TESTNET_ONLY/);
});
test('TC-006: exact invocation matches, all financial substitutions fail', () => {
  assert.equal(inspectAuthorization(envelope(), intent).source, intent.agent);
  for (const altered of [
    { amount: 300001n }, { nonce: 2n }, { merchant: agent.publicKey() },
    { agent: merchant }, { deviceHash: 'cd'.repeat(32) },
    { asset: Keypair.random().publicKey() },
  ]) assert.throws(() => inspectAuthorization(envelope(altered), intent));
  assert.throws(() => inspectAuthorization(envelope({}, true), intent));
  assert.throws(() => inspectAuthorization(envelope(), { ...intent, expiresAt: Date.now() - 1 }));
});
test('TC-006: unexpected authorization root and nested calls are refused before signing', () => {
  const raw = xdr.TransactionEnvelope.fromXDR(envelope(), 'base64');
  const host = raw.v1().tx().operations()[0]!.body().invokeHostFunctionOp();
  const expected = host.hostFunction().invokeContract();
  const nested = new xdr.SorobanAuthorizedInvocation({
    function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(expected), subInvocations: [],
  });
  host.auth([new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
    rootInvocation: new xdr.SorobanAuthorizedInvocation({
      function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(expected), subInvocations: [nested],
    }),
  })]);
  assert.throws(() => inspectAuthorization(raw.toXDR('base64'), intent), /UNEXPECTED_AUTHORIZATION/);
});
test('TC-017: reservation must match local identity, target, source and expiry', () => {
  const transactionHash = inspectAuthorization(envelope(), intent).innerHash;
  const reservation = { object: 'gas_sponsor_reservation' as const, requestId: 'synthetic-request', replayed: false,
    decision: 'reserved' as const, transactionHash, sourceWallet: intent.agent,
    targetContractIds: [intent.escrow], innerMaxFeeStroops: '100', reservedStroops: '100',
    expiresAt: new Date(Date.now() + 60000).toISOString() };
  assert.equal(validateReservation(reservation, { ...intent, innerHash: transactionHash }).requestId, reservation.requestId);
  for (const altered of [ { transactionHash: '00'.repeat(32) }, { sourceWallet: merchant },
    { targetContractIds: [intent.escrow, merchant] }, { expiresAt: new Date(0).toISOString() } ]) {
    assert.throws(() => validateReservation({ ...reservation, ...altered }, { ...intent, innerHash: transactionHash }));
  }
});

test('TC-006: multiple auth roots, foreign root and address credentials are rejected', () => {
  for (const mode of ['multiple', 'foreign', 'address'] as const) {
    const raw = xdr.TransactionEnvelope.fromXDR(envelope(), 'base64');
    const host = raw.v1().tx().operations()[0]!.body().invokeHostFunctionOp();
    const root = new xdr.SorobanAuthorizedInvocation({
      function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
        xdr.InvokeContractArgs.fromXDR(host.hostFunction().invokeContract().toXDR())), subInvocations: [],
    });
    if (mode === 'foreign') root.function().contractFn().functionName('claim');
    const credentials = mode === 'address' ? xdr.SorobanCredentials.sorobanCredentialsAddress(new xdr.SorobanAddressCredentials({
      address: new Contract(intent.escrow).address().toScAddress(), nonce: xdr.Int64.fromString('1'), signatureExpirationLedger: 100,
      signature: xdr.ScVal.scvVoid(),
    })) : xdr.SorobanCredentials.sorobanCredentialsSourceAccount();
    const entry = new xdr.SorobanAuthorizationEntry({ credentials, rootInvocation: root });
    host.auth(mode === 'multiple' ? [entry, entry] : [entry]);
    assert.throws(() => inspectAuthorization(raw.toXDR('base64'), intent), /UNEXPECTED_AUTHORIZATION/);
  }
});

test('TC-006: an operation source override cannot select a different signer', () => {
  const raw = xdr.TransactionEnvelope.fromXDR(envelope(), 'base64');
  raw.v1().tx().operations()[0]!.sourceAccount(Keypair.random().xdrMuxedAccount());
  assert.throws(() => inspectAuthorization(raw.toXDR('base64'), intent), /UNEXPECTED_OPERATION/);
});
test('TC-011: only matching Velo success qualifies; unresolved and null fee remain explicit', () => {
  const identity = { requestId: 'synthetic-request', transactionHash: 'aa'.repeat(32) };
  const result = { ...identity, object: 'gas_submit_result' as const, outerTransactionHash: 'bb'.repeat(32),
    status: 'succeeded' as const, reservedStroops: '100', actualFeeStroops: null,
    expiresAt: new Date(Date.now() + 60000).toISOString(), reconciliationRequired: false };
  assert.equal(validateExecution(result, identity).actualFeeStroops, null);
  for (const status of ['claimed', 'submission_unknown', 'submitted', 'failed', 'cancelled'] as const) {
    assert.throws(() => validateExecution({ ...result, status }, identity));
  }
  assert.throws(() => validateExecution({ ...result, transactionHash: 'cc'.repeat(32) }, identity));
});
