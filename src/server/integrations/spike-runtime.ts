import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Address, Contract, Keypair, Networks, Transaction, TransactionBuilder, nativeToScVal, rpc, xdr } from '@stellar/stellar-sdk';
import { toCall, type NoirOperation } from '@noirx402/agent-sdk';
import { z } from 'zod';
import { SpikeGuardError, type readTestnetConfig } from './noir.ts';
import { readSpikeRecord, writeSpikeRecord } from './spike-journal.ts';

export type SpikeConfig = ReturnType<typeof readTestnetConfig>;
export type WalletOperation = Exclude<NoirOperation, { kind: 'authorize' }>;
export function spikeDigest(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value, (_key, item: unknown) => typeof item === 'bigint' ? item.toString() : item)).digest('hex');
}
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

export interface WalletClient {
  prepare(source: string, operation: NoirOperation): Promise<string>;
  submit(signed: string, operation?: NoirOperation): Promise<string>;
  getTransaction(hash: string): Promise<rpc.Api.GetTransactionResponse>;
}
const walletMarker = z.object({ source: z.string(), intentHash: z.string().regex(/^[a-f0-9]{64}$/),
  hash: z.string().regex(/^[a-f0-9]{64}$/), at: z.number().int().positive() }).strict();

export async function walletOperationOnce(params: {
  directory: string; client: WalletClient; signer: Keypair; operation: WalletOperation; config: SpikeConfig;
}) {
  await mkdir(params.directory, { recursive: true, mode: 0o700 });
  const file = join(params.directory, 'wallet-handoff.json');
  const source = params.signer.publicKey();
  const intentHash = spikeDigest({ source, operation: params.operation, network: params.config.network });
  let stored = await readSpikeRecord(file);
  if (stored === null) {
    const unsigned = await params.client.prepare(source, params.operation);
    const tx = inspectWalletOperation(unsigned, source, params.operation, params.config);
    if (tx.signatures.length !== 0) throw new SpikeGuardError('UNEXPECTED_PREPARED_SIGNATURE');
    tx.sign(params.signer);
    const marker = { source, intentHash, hash: tx.hash().toString('hex'), at: Date.now() };
    const claimed = await writeSpikeRecord(file, marker);
    if (claimed) {
      // Persist before submit; no exception after this point permits redispatch.
      try {
        inspectWalletOperation(tx.toXDR(), source, params.operation, params.config);
        const hash = await params.client.submit(tx.toXDR(), params.operation);
        if (hash !== marker.hash) throw new SpikeGuardError('WALLET_TRANSACTION_HASH_MISMATCH');
      } catch { throw new SpikeGuardError('WALLET_HANDOFF_UNRESOLVED'); }
    }
    stored = await readSpikeRecord(file);
  }
  const saved = walletMarker.safeParse(stored);
  if (!saved.success) throw new SpikeGuardError('WALLET_JOURNAL_INVALID');
  if (saved.data.intentHash !== intentHash || saved.data.source !== source) throw new SpikeGuardError('WALLET_INTENT_MISMATCH');
  let chain: rpc.Api.GetTransactionResponse;
  try { chain = await params.client.getTransaction(saved.data.hash); }
  catch { throw new SpikeGuardError('WALLET_CONFIRMATION_UNRESOLVED'); }
  if (chain.status !== rpc.Api.GetTransactionStatus.SUCCESS || chain.resultXdr.result().switch().name !== 'txSuccess' || chain.feeBump) throw new SpikeGuardError('WALLET_CONFIRMATION_UNRESOLVED');
  const tx = inspectWalletOperation(chain.envelopeXdr.toXDR('base64'), source, params.operation, params.config, saved.data.at);
  if (tx.hash().toString('hex') !== saved.data.hash || chain.txHash !== saved.data.hash || tx.signatures.length !== 1 ||
      !Keypair.fromPublicKey(source).verify(tx.hash(), tx.signatures[0]!.signature())) throw new SpikeGuardError('WALLET_EVIDENCE_MISMATCH', [], 'unresolved');
  return { hash: saved.data.hash, ledger: chain.ledger, source, operation: params.operation.kind };
}
