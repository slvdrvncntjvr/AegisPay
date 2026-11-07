import { Address, type Contract, FeeBumpTransaction, Keypair, Transaction, TransactionBuilder, rpc, Networks, scValToNative, type xdr } from '@stellar/stellar-sdk';
import { type NoirEvent } from '@noirx402/agent-sdk';
import { type GasExecutionIdentity, type GasSubmitResult } from '@carts1024/velo-sdk';
import { inspectAuthorization, SpikeGuardError, type AuthorizationIntent } from './noir.ts';
import { validateExecution } from './velo.ts';

export interface ObservedNoirRpcEvent {
  id: string; type: string; ledger: number; ledgerClosedAt: string; txHash: string;
  contractId?: Contract; topic: xdr.ScVal[]; value: xdr.ScVal; inSuccessfulContractCall?: boolean;
}
// Some RPC deployments omit the legacy flag consumed by Noir SDK 0.3.0.
// Do not synthesize it: require the independently successful transaction and
// byte-identical embedded contract event before decoding any payment event.
export function decodeMatchedNoirEvent(raw: ObservedNoirRpcEvent, chain: rpc.Api.GetTransactionResponse, escrow: string): NoirEvent | null {
  try {
    if (raw.inSuccessfulContractCall === false || raw.type !== 'contract' || !raw.id || raw.contractId?.contractId() !== escrow ||
        chain.status !== rpc.Api.GetTransactionStatus.SUCCESS || raw.ledger !== chain.ledger ||
        !['txSuccess', 'txFeeBumpInnerSuccess'].includes(chain.resultXdr.result().switch().name)) return null;
    const envelope = TransactionBuilder.fromXDR(chain.envelopeXdr, Networks.TESTNET);
    const inner = envelope instanceof FeeBumpTransaction ? envelope.innerTransaction : envelope;
    if (raw.txHash !== envelope.hash().toString('hex') && raw.txHash !== inner.hash().toString('hex')) return null;
    const matches = chain.events.contractEventsXdr.flat().filter(embedded => {
      if (embedded.type().name !== 'contract' || !embedded.contractId() ||
          Address.contract(Buffer.from(embedded.contractId()! as unknown as Uint8Array)).toString() !== escrow) return false;
      const body = embedded.body().v0();
      return body.topics().length === raw.topic.length && body.topics().every((topic, i) => topic.toXDR().equals(raw.topic[i]!.toXDR())) && body.data().toXDR().equals(raw.value.toXDR());
    });
    if (matches.length !== 1 || raw.topic[0]?.switch().name !== 'scvSymbol' || raw.value.switch().name !== 'scvI128') return null;
    const amount: unknown = scValToNative(raw.value);
    if (typeof amount !== 'bigint' || amount <= 0n) return null;
    const name: unknown = scValToNative(raw.topic[0]!);
    const base = { id: raw.id, contractId: escrow, ledger: raw.ledger, ledgerClosedAt: raw.ledgerClosedAt, txHash: raw.txHash };
    if (name === 'authorize' && raw.topic.length === 3 && raw.topic[1]?.switch().name === 'scvBytes' && raw.topic[2]?.switch().name === 'scvAddress') {
      const device = Buffer.from(raw.topic[1]!.bytes());
      if (device.length !== 32) return null;
      return { ...base, type: 'payment.authorized', deviceHash: device.toString('hex'), merchant: String(scValToNative(raw.topic[2]!)), amount };
    }
    if (name === 'claim' && raw.topic.length === 2 && raw.topic[1]?.switch().name === 'scvAddress') {
      return { ...base, type: 'payment.claimed', merchant: String(scValToNative(raw.topic[1]!)), amount };
    }
    return null;
  } catch { return null; }
}

// Inputs must be fetched independently from configured RPC, never client proof.
export function verifyAuthorizationEvidence(input: {
  transaction: rpc.Api.GetTransactionResponse; event: NoirEvent; velo: GasSubmitResult;
  identity: GasExecutionIdentity; intent: AuthorizationIntent; handoffCommittedAt: number;
}) {
  const execution = validateExecution(input.velo, input.identity);
  const chain = input.transaction;
  if (chain.status !== rpc.Api.GetTransactionStatus.SUCCESS ||
      !['txSuccess', 'txFeeBumpInnerSuccess'].includes(chain.resultXdr.result().switch().name)) throw new SpikeGuardError('CHAIN_SUCCESS_NOT_VERIFIED');
  const envelope = TransactionBuilder.fromXDR(chain.envelopeXdr, Networks.TESTNET);
  const inner = envelope instanceof FeeBumpTransaction ? envelope.innerTransaction : envelope;
  if (!(inner instanceof Transaction)) throw new SpikeGuardError('UNEXPECTED_ENVELOPE');
  if (!Number.isSafeInteger(input.handoffCommittedAt) || input.handoffCommittedAt <= 0 || input.handoffCommittedAt >= input.intent.expiresAt) throw new SpikeGuardError('INVALID_HANDOFF_TIME');
  // A timely persisted handoff may confirm after the quote deadline.
  const inspected = inspectAuthorization(inner.toXDR(), input.intent, input.handoffCommittedAt);
  const innerHash = inspected.innerHash;
  const outerHash = envelope.hash().toString('hex');
  if (envelope instanceof FeeBumpTransaction) {
    if (!chain.feeBump || chain.resultXdr.result().switch().name !== 'txFeeBumpInnerSuccess') throw new SpikeGuardError('FEE_BUMP_RESULT_MISMATCH');
    const pair = chain.resultXdr.result().innerResultPair();
    if (pair.transactionHash().toString('hex') !== innerHash || pair.result().result().switch().name !== 'txSuccess') throw new SpikeGuardError('FEE_BUMP_RESULT_MISMATCH');
  } else if (chain.feeBump || chain.resultXdr.result().switch().name !== 'txSuccess') throw new SpikeGuardError('FEE_BUMP_RESULT_MISMATCH');
  if (innerHash !== input.identity.transactionHash || outerHash !== execution.outerTransactionHash ||
      (chain.txHash !== innerHash && chain.txHash !== outerHash)) throw new SpikeGuardError('TRANSACTION_HASH_MISMATCH');
  const signer = Keypair.fromPublicKey(input.intent.agent);
  if (inner.signatures.length !== 1 || !signer.verify(inner.hash(), inner.signatures[0]!.signature())) throw new SpikeGuardError('AGENT_SIGNATURE_MISMATCH');
  const event = input.event;
  if (event.type !== 'payment.authorized' || event.contractId !== input.intent.escrow ||
      event.deviceHash !== input.intent.deviceHash || event.merchant !== input.intent.merchant || event.amount !== input.intent.amount ||
      event.ledger !== chain.ledger || (event.txHash !== innerHash && event.txHash !== outerHash)) throw new SpikeGuardError('AUTHORIZATION_EVENT_MISMATCH');
  const matches = chain.events.contractEventsXdr.flat().filter(embedded => {
    try {
      if (embedded.type().name !== 'contract' || !embedded.contractId() ||
          Address.contract(Buffer.from(embedded.contractId()! as unknown as Uint8Array)).toString() !== input.intent.escrow) return false;
      const body = embedded.body().v0();
      const topics = body.topics();
      return topics.length === 3 && scValToNative(topics[0]!) === 'authorize' &&
        Buffer.from(scValToNative(topics[1]!) as Uint8Array).toString('hex') === input.intent.deviceHash &&
        scValToNative(topics[2]!) === input.intent.merchant && scValToNative(body.data()) === input.intent.amount;
    } catch { return false; }
  });
  if (matches.length !== 1) throw new SpikeGuardError('AUTHORIZATION_EVENT_NOT_IN_TRANSACTION');
  // EQ-004 uses the independently observed outer charged fee, including for
  // fee bumps. The inner result's fee is not the relayer's charged fee.
  const outerLedgerFeeChargedStroops = chain.resultXdr.feeCharged().toString();
  const veloActualFeeStroops = execution.actualFeeStroops;
  const actualFeeStatus = veloActualFeeStroops === null ? 'velo_unavailable' :
    veloActualFeeStroops === outerLedgerFeeChargedStroops ? 'matched' : 'conflict';
  return { innerHash, outerHash, observedEventTransactionHash: event.txHash, eventId: event.id,
    ledger: chain.ledger, agent: input.intent.agent, asset: input.intent.asset, nonce: input.intent.nonce.toString(),
    amount: input.intent.amount.toString(), merchant: event.merchant, deviceHash: event.deviceHash,
    // Fee availability is separate from the verified payment entitlement.
    actualFeeStroops: actualFeeStatus === 'matched' ? outerLedgerFeeChargedStroops : null,
    outerLedgerFeeChargedStroops, veloActualFeeStroops, actualFeeStatus };
}

// The caller separately verifies the merchant signature and exact claim(token,
// merchant) invocation with walletOperationOnce. Claim is never authorization.
export function verifyClaimEvent(chain: rpc.Api.GetSuccessfulTransactionResponse, event: NoirEvent,
  expected: { hash: string; escrow: string; merchant: string; amount: bigint }) {
  if (chain.txHash !== expected.hash || chain.status !== rpc.Api.GetTransactionStatus.SUCCESS ||
      chain.resultXdr.result().switch().name !== 'txSuccess' || event.type !== 'payment.claimed' ||
      event.txHash !== expected.hash || event.ledger !== chain.ledger || event.contractId !== expected.escrow ||
      event.merchant !== expected.merchant || event.amount !== expected.amount || expected.amount <= 0n) throw new SpikeGuardError('CLAIM_EVENT_MISMATCH');
  const matches = chain.events.contractEventsXdr.flat().filter(embedded => {
    try {
      if (embedded.type().name !== 'contract' || !embedded.contractId() ||
          Address.contract(Buffer.from(embedded.contractId()! as unknown as Uint8Array)).toString() !== expected.escrow) return false;
      const body = embedded.body().v0();
      const topics = body.topics();
      return topics.length === 2 && scValToNative(topics[0]!) === 'claim' && scValToNative(topics[1]!) === expected.merchant && scValToNative(body.data()) === expected.amount;
    } catch { return false; }
  });
  if (matches.length !== 1) throw new SpikeGuardError('CLAIM_EVENT_NOT_IN_TRANSACTION');
  return { eventId: event.id, ledger: chain.ledger, amountStroops: expected.amount.toString(), merchant: expected.merchant };
}
