import { Address, FeeBumpTransaction, Keypair, Transaction, TransactionBuilder, rpc, Networks, scValToNative } from '@stellar/stellar-sdk';
import { type NoirEvent } from '@noirx402/agent-sdk';
import { type GasExecutionIdentity, type GasSubmitResult } from '@carts1024/velo-sdk';
import { inspectAuthorization, SpikeGuardError, type AuthorizationIntent } from './noir.js';
import { validateExecution } from './velo.js';

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
  return { innerHash, outerHash, observedEventTransactionHash: event.txHash, eventId: event.id,
    ledger: chain.ledger, agent: input.intent.agent, asset: input.intent.asset, nonce: input.intent.nonce.toString(),
    amount: input.intent.amount.toString(), merchant: event.merchant, deviceHash: event.deviceHash,
    actualFeeStroops: execution.actualFeeStroops };
}
