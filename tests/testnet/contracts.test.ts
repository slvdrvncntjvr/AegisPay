// Synthetic ABI mutations only. No RPC calls or live evidence artifacts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contract, xdr } from '@stellar/stellar-sdk';
import { requiredAbi, verifyAbi, safeFailure } from '../../scripts/verify-contracts.js';

type Role = keyof typeof requiredAbi;
function type(name: string): xdr.ScSpecTypeDef {
  switch (name) {
    case 'Address': return xdr.ScSpecTypeDef.scSpecTypeAddress();
    case 'I128': return xdr.ScSpecTypeDef.scSpecTypeI128();
    case 'U64': return xdr.ScSpecTypeDef.scSpecTypeU64();
    case 'Bool': return xdr.ScSpecTypeDef.scSpecTypeBool();
    case 'BytesN32': return xdr.ScSpecTypeDef.scSpecTypeBytesN(new xdr.ScSpecTypeBytesN({ n: 32 }));
    case 'Option<Address>': return xdr.ScSpecTypeDef.scSpecTypeOption(new xdr.ScSpecTypeOption({ valueType: type('Address') }));
    case 'AgentPolicy': return xdr.ScSpecTypeDef.scSpecTypeUdt(new xdr.ScSpecTypeUdt({ name: 'AgentPolicy' }));
    default: throw new Error('Unsupported synthetic fixture type');
  }
}
function entries(role: Role) {
  const functions = Object.entries(requiredAbi[role]).map(([name, abi]) =>
    xdr.ScSpecEntry.scSpecEntryFunctionV0(new xdr.ScSpecFunctionV0({ doc: '', name,
      inputs: abi.inputs.map(([field, kind]) => new xdr.ScSpecFunctionInputV0({ doc: '', name: field, type: type(kind) })),
      outputs: abi.outputs.map(type),
    })));
  if (role === 'agentRegistry') functions.push(xdr.ScSpecEntry.scSpecEntryUdtStructV0(new xdr.ScSpecUdtStructV0({
    doc: '', lib: '', name: 'AgentPolicy', fields: [
      ['agent', 'Address'], ['asset', 'Address'], ['expires_at', 'U64'], ['max_amount', 'I128'], ['owner', 'Address'],
    ].map(([name, kind]) => new xdr.ScSpecUdtStructFieldV0({ doc: '', name: name!, type: type(kind!) })),
  })));
  return functions;
}
test('TC-013: required lifecycle ABI accepts exact types and rejects absent and duplicate methods', () => {
  for (const role of ['deviceRegistry', 'agentRegistry', 'paymentEscrow'] as const) {
    const source = entries(role);
    assert.doesNotThrow(() => verifyAbi(role, new contract.Spec(source)));
    for (const method of Object.keys(requiredAbi[role])) {
      assert.throws(() => verifyAbi(role, new contract.Spec(source.filter(entry =>
        entry.switch().name !== 'scSpecEntryFunctionV0' || entry.functionV0().name().toString() !== method))), /CONTRACT_ABI_MISMATCH/);
    }
    assert.throws(() => verifyAbi(role, new contract.Spec([...source, source[0]!])), /CONTRACT_ABI_MISMATCH/);
  }
});
test('TC-013: matching method names cannot hide wrong amount, nonce, address or device types', () => {
  for (const index of [0, 1, 2, 3, 4, 5]) {
    const source = entries('paymentEscrow');
    source[0]!.functionV0().inputs()[index]!.type(xdr.ScSpecTypeDef.scSpecTypeString());
    assert.throws(() => verifyAbi('paymentEscrow', new contract.Spec(source)), /CONTRACT_ABI_MISMATCH/);
  }
  const shortDevice = entries('deviceRegistry');
  shortDevice[0]!.functionV0().inputs()[1]!.type(xdr.ScSpecTypeDef.scSpecTypeBytesN(new xdr.ScSpecTypeBytesN({ n: 16 })));
  assert.throws(() => verifyAbi('deviceRegistry', new contract.Spec(shortDevice)), /CONTRACT_ABI_MISMATCH/);
  const returnType = entries('paymentEscrow');
  returnType[0]!.functionV0().outputs([xdr.ScSpecTypeDef.scSpecTypeString()]);
  assert.throws(() => verifyAbi('paymentEscrow', new contract.Spec(returnType)), /CONTRACT_ABI_MISMATCH/);
});
test('TC-013: policy struct fields and their types are part of deployment compatibility', () => {
  const source = entries('agentRegistry');
  const policy = source.at(-1)!.udtStructV0();
  policy.fields(policy.fields().filter(field => field.name().toString() !== 'owner'));
  assert.throws(() => verifyAbi('agentRegistry', new contract.Spec(source)), /POLICY_STRUCT_ABI_MISMATCH/);
});
test('TC-015: provider errors cannot expose credentials or XDR through the safe failure response', () => {
  const failure = safeFailure(new Error('synthetic-secret-and-signed-xdr-sentinel'));
  assert.deepEqual(failure, { status: 'not_run', code: 'RPC_OR_PROVIDER_VERIFICATION_FAILED' });
  assert.equal(JSON.stringify(failure).includes('sentinel'), false);
});
