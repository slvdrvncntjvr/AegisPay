import { Asset, Networks, StrKey, Transaction, TransactionBuilder, Address } from '@stellar/stellar-sdk';
import { NoirAgentClient, toCall, type NoirNetworkConfig } from '@noirx402/agent-sdk';

export class SpikeGuardError extends Error {
  constructor(readonly code: string, readonly missing: string[] = []) { super(code); }
}
export const deploymentVariables = ['STELLAR_NETWORK', 'STELLAR_RPC_URL', 'STELLAR_NETWORK_PASSPHRASE',
  'NOIR_DEVICE_REGISTRY_ID', 'NOIR_AGENT_REGISTRY_ID', 'NOIR_PAYMENT_ESCROW_ID', 'NOIR_XLM_SAC_ID'] as const;
export function readTestnetConfig(env: NodeJS.ProcessEnv = process.env) {
  if (env.STELLAR_NETWORK && env.STELLAR_NETWORK !== 'testnet') throw new SpikeGuardError('TESTNET_ONLY');
  const missing = deploymentVariables.filter(key => !env[key]?.trim());
  if (missing.length) throw new SpikeGuardError('MISSING_CONFIGURATION', missing);
  if (env.STELLAR_NETWORK_PASSPHRASE !== Networks.TESTNET) throw new SpikeGuardError('TESTNET_ONLY');
  let url: URL;
  try { url = new URL(env.STELLAR_RPC_URL!); } catch { throw new SpikeGuardError('INVALID_RPC_URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new SpikeGuardError('INVALID_RPC_URL');
  for (const key of ['NOIR_DEVICE_REGISTRY_ID', 'NOIR_AGENT_REGISTRY_ID', 'NOIR_PAYMENT_ESCROW_ID', 'NOIR_XLM_SAC_ID']) {
    if (!StrKey.isValidContract(env[key]!)) throw new SpikeGuardError('INVALID_CONTRACT_ID');
  }
  const network: NoirNetworkConfig = { rpcUrl: url.href, networkPassphrase: Networks.TESTNET,
    contracts: { deviceRegistry: env.NOIR_DEVICE_REGISTRY_ID!, agentRegistry: env.NOIR_AGENT_REGISTRY_ID!, paymentEscrow: env.NOIR_PAYMENT_ESCROW_ID! } };
  if (new Set(Object.values(network.contracts)).size !== 3) throw new SpikeGuardError('DUPLICATE_CONTRACT_IDS');
  const asset = Asset.native().contractId(Networks.TESTNET);
  if (asset !== env.NOIR_XLM_SAC_ID) throw new SpikeGuardError('NATIVE_SAC_MISMATCH');
  return { network, asset };
}
export function createNoir(config: ReturnType<typeof readTestnetConfig>) {
  return new NoirAgentClient({ network: config.network });
}
export interface AuthorizationIntent {
  agent: string; deviceHash: string; merchant: string; asset: string; escrow: string;
  amount: bigint; nonce: bigint; expiresAt: number;
}
export function inspectAuthorization(envelope: string, intent: AuthorizationIntent, now = Date.now()) {
  if (now >= intent.expiresAt) throw new SpikeGuardError('QUOTE_EXPIRED');
  if (intent.amount <= 0n || intent.amount > (1n << 127n) - 1n || intent.nonce <= 0n || intent.nonce >= 1n << 64n) {
    throw new SpikeGuardError('INVALID_FINANCIAL_INTEGER');
  }
  let parsed;
  try { parsed = TransactionBuilder.fromXDR(envelope, Networks.TESTNET); } catch { throw new SpikeGuardError('INVALID_ENVELOPE'); }
  if (!(parsed instanceof Transaction) || parsed.source !== intent.agent || parsed.operations.length !== 1) {
    throw new SpikeGuardError('UNEXPECTED_ENVELOPE');
  }
  if (parsed.timeBounds && (BigInt(parsed.timeBounds.maxTime) === 0n || BigInt(parsed.timeBounds.maxTime) * 1000n <= BigInt(now))) {
    throw new SpikeGuardError('TRANSACTION_EXPIRED');
  }
  const operation = parsed.operations[0]!;
  if (operation.type !== 'invokeHostFunction' || (operation.source && operation.source !== intent.agent) ||
      operation.func.switch().name !== 'hostFunctionTypeInvokeContract') throw new SpikeGuardError('UNEXPECTED_OPERATION');
  const invocation = operation.func.invokeContract();
  const expected = toCall(intent.agent, { kind: 'authorize', deviceHash: intent.deviceHash,
    merchant: intent.merchant, asset: intent.asset, amount: intent.amount, nonce: intent.nonce });
  if (Address.fromScAddress(invocation.contractAddress()).toString() !== intent.escrow ||
      invocation.functionName().toString() !== expected.method || invocation.args().length !== expected.args.length ||
      invocation.args().some((arg, i) => !arg.toXDR().equals(expected.args[i]!.toXDR()))) throw new SpikeGuardError('INVOCATION_MISMATCH');
  // This authorize path requires only the source agent. Registry reads do not
  // justify an additional signed call. Reject unknown address auth or children.
  const authorizations = operation.auth ?? [];
  if (authorizations.length > 1 || authorizations.some(entry => {
    const root = entry.rootInvocation();
    return entry.credentials().switch().name !== 'sorobanCredentialsSourceAccount' ||
      root.subInvocations().length !== 0 || root.function().switch().name !== 'sorobanAuthorizedFunctionTypeContractFn' ||
      !root.function().contractFn().toXDR().equals(invocation.toXDR());
  })) throw new SpikeGuardError('UNEXPECTED_AUTHORIZATION');
  return { source: parsed.source, innerHash: parsed.hash().toString('hex'), transaction: parsed };
}
