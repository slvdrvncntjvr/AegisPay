import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Keypair, rpc } from '@stellar/stellar-sdk';
import { type NoirOperation } from '@noirx402/agent-sdk';
import { z } from 'zod';
import { SpikeGuardError } from './noir.ts';
import { readSpikeRecord, writeSpikeRecord } from './spike-journal.ts';

export { inspectWalletOperation, type SpikeConfig, type WalletOperation } from './wallet-inspection.ts';
import { inspectWalletOperation, type SpikeConfig, type WalletOperation } from './wallet-inspection.ts';
export function spikeDigest(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value, (_key, item: unknown) => typeof item === 'bigint' ? item.toString() : item)).digest('hex');
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
