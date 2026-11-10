// Explicit synthetic provider transport for recovery tests. Never used by the
// worker entrypoint and never exported into the live Testnet evidence namespace.
import { randomBytes, randomUUID } from 'node:crypto';
import type { GasSubmitResult } from '@carts1024/velo-sdk';
import type { PaymentAdapter } from '../../../apps/server/src/worker/payment.ts';

export function syntheticAdapter(options: { unknown?: boolean; unavailableChain?: boolean } = {}) {
  const counts = { sign: 0, sponsor: 0, submit: 0, observe: 0, verify: 0 };
  const reservations = new Map<string, { requestId: string; innerHash: string }>();
  const outers = new Map<string, string>();
  const result = (requestId: string, transactionHash: string): GasSubmitResult => ({ object: 'gas_submit_result', requestId, transactionHash,
    outerTransactionHash: outers.get(requestId) ?? null, status: options.unknown ? 'submission_unknown' : outers.has(requestId) ? 'succeeded' : 'claimed', reservedStroops: '100', actualFeeStroops: null, expiresAt: new Date(Date.now() + 120000).toISOString(), reconciliationRequired: options.unknown ?? false });
  const adapter: PaymentAdapter = {
    async prepare() { counts.sign++; return { signedEnvelope: `SYNTHETIC-TEST-ONLY-${randomUUID()}`, innerHash: randomBytes(32).toString('hex') }; },
    gas: {
      async sponsor(envelope, input) {
        counts.sponsor++;
        const identity = reservations.get(input.idempotencyKey) ?? { requestId: `synthetic-${randomUUID()}`, innerHash: '' };
        // The test wraps this method with the exact saved durable fingerprint.
        reservations.set(input.idempotencyKey, identity);
        return { object: 'gas_sponsor_reservation', requestId: identity.requestId, replayed: false, decision: 'reserved', transactionHash: identity.innerHash, sourceWallet: '', targetContractIds: [], innerMaxFeeStroops: '100', reservedStroops: '100', expiresAt: new Date(Date.now() + 120000).toISOString(), envelope };
      },
      async submit(input) { counts.submit++; outers.set(input.requestId, randomBytes(32).toString('hex')); return result(input.requestId, input.transactionHash); },
      async getStatus(identity) { counts.observe++; return result(identity.requestId, identity.transactionHash); },
    },
    async verify({ quote, attempt, agent, execution }) {
      counts.verify++;
      if (options.unavailableChain) throw new Error('SYNTHETIC_CHAIN_UNAVAILABLE');
      return { ownerId: quote.ownerId, agentId: agent.id, runId: quote.runId, quoteId: quote.id, attemptId: attempt.id, operationId: attempt.operationId,
        veloRequestId: attempt.veloRequestId!, veloStatus: 'succeeded', chainSucceeded: true, innerHash: attempt.innerHash!, outerHash: execution.outerTransactionHash,
        observedEventTxHash: execution.outerTransactionHash!, noirEventId: `synthetic-event-${attempt.id}`, network: 'testnet', contractId: agent.escrowContractId,
        ledgerSequence: '1', ledgerClosedAt: new Date(), agentPublicKey: agent.publicKey, deviceHash: quote.deviceHash,
        merchantAddress: quote.merchantAddress, assetContractId: quote.assetContractId, amountStroops: quote.amountStroops, nonce: attempt.nonce, outerLedgerFeeStroops: null, veloActualFeeStroops: null };
    },
  };
  return { adapter, counts, reservations, options };
}
