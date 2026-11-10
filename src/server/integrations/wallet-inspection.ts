// Pure server-safe wallet envelope inspection; no filesystem journal or signer.
import { Address, Contract, Networks, Transaction, TransactionBuilder, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { toCall, type NoirOperation } from '@noirx402/agent-sdk';
import { SpikeGuardError, type readTestnetConfig } from './noir.ts';

export type SpikeConfig = ReturnType<typeof readTestnetConfig>;
export type WalletOperation = Exclude<NoirOperation, { kind: 'authorize' }>;
export function inspectWalletOperation(envelope: string, source: string, operation: WalletOperation, config: SpikeConfig, now = Date.now()) {
  let tx;
  try { tx = TransactionBuilder.fromXDR(envelope, Networks.TESTNET); } catch { throw new SpikeGuardError('INVALID_ENVELOPE'); }
  if (!(tx instanceof Transaction) || tx.source !== source || tx.operations.length !== 1) throw new SpikeGuardError('WALLET_ENVELOPE_MISMATCH');
  if (!tx.timeBounds || BigInt(tx.timeBounds.minTime) * 1000n > BigInt(now) || BigInt(tx.timeBounds.maxTime) === 0n || BigInt(tx.timeBounds.maxTime) * 1000n <= BigInt(now)) throw new SpikeGuardError('TRANSACTION_EXPIRED');
  const op = tx.operations[0]!;
  if (op.type !== 'invokeHostFunction' || (op.source && op.source !== source) || op.func.switch().name !== 'hostFunctionTypeInvokeContract') throw new SpikeGuardError('WALLET_OPERATION_MISMATCH');
  const call = toCall(source, operation);
  const expected = new Contract(config.network.contracts[call.contract]).call(call.method, ...call.args).body().invokeHostFunctionOp().hostFunction().invokeContract();
  const invocation = op.func.invokeContract();
  if (!expected.toXDR().equals(invocation.toXDR())) throw new SpikeGuardError('WALLET_INVOCATION_MISMATCH');
  // Only a deposit may ask the wallet to authorize a nested native-token
  // transfer, with precisely the expected source, escrow destination and amount.
  let transfer: xdr.InvokeContractArgs | undefined;
  if (operation.kind === 'fundEscrow') {
    if (operation.token !== config.asset || operation.amount <= 0n || operation.amount > 10000000n) throw new SpikeGuardError('SPIKE_FUNDING_LIMIT');
    transfer = new Contract(config.asset).call('transfer', Address.fromString(source).toScVal(),
      Address.fromString(config.network.contracts.paymentEscrow).toScVal(), nativeToScVal(operation.amount, { type: 'i128' })).body().invokeHostFunctionOp().hostFunction().invokeContract();
  }
  const auth = op.auth ?? [];
  if (auth.length > 1 || auth.some(entry => {
    const root = entry.rootInvocation();
    if (entry.credentials().switch().name !== 'sorobanCredentialsSourceAccount' ||
        root.function().switch().name !== 'sorobanAuthorizedFunctionTypeContractFn' ||
        !root.function().contractFn().toXDR().equals(expected.toXDR())) return true;
    const children = root.subInvocations();
    return children.length > 1 || children.some(child => !transfer || child.subInvocations().length !== 0 ||
      child.function().switch().name !== 'sorobanAuthorizedFunctionTypeContractFn' || !child.function().contractFn().toXDR().equals(transfer.toXDR()));
  })) throw new SpikeGuardError('UNEXPECTED_WALLET_AUTHORIZATION');
  return tx;
}

