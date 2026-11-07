import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { contract as stellarContract, rpc, scValToNative, xdr } from '@stellar/stellar-sdk';
import { TESTNET } from '@noirx402/agent-sdk';
import { readTestnetConfig, SpikeGuardError } from '../src/server/integrations/noir.js';

type Abi = { inputs: [string, string][]; outputs: string[] };
export const requiredAbi: Record<'deviceRegistry' | 'agentRegistry' | 'paymentEscrow', Record<string, Abi>> = {
  deviceRegistry: {
    register: { inputs: [['wallet', 'Address'], ['device_hash', 'BytesN32'], ['agent', 'Address']], outputs: [] },
    revoke: { inputs: [['wallet', 'Address'], ['device_hash', 'BytesN32']], outputs: [] },
    get_owner: { inputs: [['device_hash', 'BytesN32']], outputs: ['Address'] },
    get_agent: { inputs: [['device_hash', 'BytesN32']], outputs: ['Address'] },
  },
  agentRegistry: {
    register_agent: { inputs: [['wallet', 'Address'], ['device_hash', 'BytesN32'], ['agent', 'Address'], ['max_amount', 'I128'], ['asset', 'Address'], ['expires_at', 'U64']], outputs: [] },
    revoke_agent: { inputs: [['wallet', 'Address'], ['device_hash', 'BytesN32']], outputs: [] },
    check_payment: { inputs: [['device_hash', 'BytesN32'], ['agent', 'Address'], ['asset', 'Address'], ['amount', 'I128']], outputs: ['Bool'] },
    get_policy: { inputs: [['device_hash', 'BytesN32']], outputs: ['AgentPolicy'] },
  },
  paymentEscrow: {
    authorize: { inputs: [['agent', 'Address'], ['device_hash', 'BytesN32'], ['merchant', 'Address'], ['asset', 'Address'], ['amount', 'I128'], ['nonce', 'U64']], outputs: [] },
    claim: { inputs: [['token', 'Address'], ['merchant', 'Address']], outputs: [] },
    fund_escrow: { inputs: [['token', 'Address'], ['wallet', 'Address'], ['device_hash', 'BytesN32'], ['amount', 'I128']], outputs: [] },
    defund_escrow: { inputs: [['token', 'Address'], ['device_hash', 'BytesN32'], ['amount', 'I128']], outputs: [] },
    sweep_on_revoke: { inputs: [['token', 'Address'], ['device_hash', 'BytesN32'], ['agent', 'Address']], outputs: ['I128'] },
    balance_of: { inputs: [['device_hash', 'BytesN32']], outputs: ['I128'] },
    escrow_token: { inputs: [['device_hash', 'BytesN32']], outputs: ['Option<Address>'] },
    pending_balance: { inputs: [['merchant', 'Address']], outputs: ['I128'] },
  },
};
export function abiType(type: xdr.ScSpecTypeDef): string {
  const kind = type.switch().name;
  if (kind === 'scSpecTypeBytesN') return `BytesN${type.bytesN().n()}`;
  if (kind === 'scSpecTypeOption') return `Option<${abiType(type.option().valueType())}>`;
  if (kind === 'scSpecTypeUdt') return type.udt().name().toString();
  return kind.replace('scSpecType', '');
}
export function verifyAbi(role: keyof typeof requiredAbi, spec: stellarContract.Spec) {
  const methods = spec.funcs().map(fn => ({ name: fn.name().toString(),
    inputs: fn.inputs().map(input => [input.name().toString(), abiType(input.type())]), outputs: fn.outputs().map(abiType) }));
  for (const [name, expected] of Object.entries(requiredAbi[role])) {
    const matches = methods.filter(fn => fn.name === name);
    if (matches.length !== 1 || JSON.stringify(matches[0]!.inputs) !== JSON.stringify(expected.inputs) ||
        JSON.stringify(matches[0]!.outputs) !== JSON.stringify(expected.outputs)) throw new SpikeGuardError('CONTRACT_ABI_MISMATCH');
  }
  if (role === 'agentRegistry') {
    const policy = spec.entries.find(entry => entry.switch().name === 'scSpecEntryUdtStructV0' && entry.udtStructV0().name().toString() === 'AgentPolicy');
    const actual = policy?.udtStructV0().fields().map(field => [field.name().toString(), abiType(field.type())]).sort();
    const expected = [['owner', 'Address'], ['agent', 'Address'], ['asset', 'Address'], ['max_amount', 'I128'], ['expires_at', 'U64']].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new SpikeGuardError('POLICY_STRUCT_ABI_MISMATCH');
  }
  return methods;
}

export async function verifyContracts(env: NodeJS.ProcessEnv = process.env) {
  const config = readTestnetConfig(env);
  const server = new rpc.Server(config.network.rpcUrl, { timeout: 15000 });
  const network = await server.getNetwork();
  if (network.passphrase !== config.network.networkPassphrase) throw new SpikeGuardError('RPC_NETWORK_MISMATCH');
  const contracts = config.network.contracts;
  const checked = [];
  for (const which of ['deviceRegistry', 'agentRegistry', 'paymentEscrow'] as const) {
    const id = contracts[which];
    const instance = await server.getContractInstance(id);
    if (instance.executable().switch().name !== 'contractExecutableWasm') throw new SpikeGuardError('UNEXPECTED_CONTRACT_EXECUTABLE');
    const wasm = await server.getContractWasmByContractId(id);
    const hash = createHash('sha256').update(wasm).digest('hex');
    if (hash !== instance.executable().wasmHash().toString('hex')) throw new SpikeGuardError('CONTRACT_WASM_HASH_MISMATCH');
    // Read raw Wasm spec: getContractMethods flattens BytesN and loses its size.
    const methods = verifyAbi(which, stellarContract.Spec.fromWasm(wasm));
    checked.push({ role: which, id, wasmSha256: hash, methods });
  }
  for (const [contract, key, expected] of [
    [contracts.paymentEscrow, 'AgentRegistry', contracts.agentRegistry],
    [contracts.paymentEscrow, 'DeviceRegistry', contracts.deviceRegistry],
    [contracts.agentRegistry, 'DeviceRegistry', contracts.deviceRegistry],
  ] as const) {
    const entry = await server.getContractData(contract, xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(key)]), rpc.Durability.Persistent);
    if (String(scValToNative(entry.val.contractData().val())) !== expected) throw new SpikeGuardError('REGISTRY_LINK_MISMATCH');
  }
  const sac = await server.getContractInstance(config.asset);
  if (sac.executable().switch().name !== 'contractExecutableStellarAsset') throw new SpikeGuardError('NATIVE_SAC_NOT_DEPLOYED');
  return { config, proof: { classification: 'live-read-only-contract-verification', observedAt: new Date().toISOString(),
    network: 'testnet', networkPassphrase: network.passphrase, contracts: checked, asset: config.asset,
    registryLinksVerified: true, sdkDefaultsMatch: JSON.stringify(TESTNET.contracts) === JSON.stringify(contracts),
    latestLedger: (await server.getLatestLedger()).sequence,
    limits: 'Ledger identity, Wasm integrity, exact required lifecycle ABI including BytesN32 and policy fields, and registry links; not organizer eligibility, full behavioral audit or payment evidence.' } };
}
export function safeFailure(error: unknown) {
  const guard = error instanceof SpikeGuardError;
  return { status: guard && (error.status === 'unresolved' || error.code.includes('UNRESOLVED')) ? 'unresolved' : 'not_run', code: guard ? error.code : 'RPC_OR_PROVIDER_VERIFICATION_FAILED',
    ...(guard && error.missing.length ? { missing: error.missing } : {}) };
}
async function main() {
  try {
    const { proof } = await verifyContracts();
    await mkdir('docs/evidence/testnet', { recursive: true });
    const file = `docs/evidence/testnet/contracts-${Date.now()}.json`;
    await writeFile(file, JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
    console.info(JSON.stringify({ status: 'passed', artifact: file, classification: proof.classification }));
  } catch (error) { console.error(JSON.stringify(safeFailure(error))); process.exitCode = 1; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
