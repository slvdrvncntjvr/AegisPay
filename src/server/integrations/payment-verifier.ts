// Shared independent RPC verification. This module has no signer or dispatch.
import { rpc } from '@stellar/stellar-sdk';
import type { NoirEvent } from '@noirx402/agent-sdk';
import { SpikeGuardError, type createNoir, type readTestnetConfig } from './noir.ts';
import { decodeMatchedNoirEvent, verifyAuthorizationEvidence } from './stellar-evidence.ts';
import type { PaymentAdapter } from '../../../apps/server/src/worker/payment.ts';

export function authorizationVerifier(noir: ReturnType<typeof createNoir>, config: ReturnType<typeof readTestnetConfig>): PaymentAdapter['verify'] {
  return async ({ quote, attempt, agent, execution }) => {
      if (!attempt.handoffCommittedAt || !attempt.veloRequestId || !attempt.innerHash || !execution.outerTransactionHash) throw new SpikeGuardError('HANDOFF_IDENTITY_MISSING');
      const chain = await noir.server.getTransaction(execution.outerTransactionHash);
      if (chain.status !== rpc.Api.GetTransactionStatus.SUCCESS) throw new SpikeGuardError('CHAIN_SUCCESS_NOT_VERIFIED');
      const filters = [{ type: 'contract' as const, contractIds: [config.network.contracts.paymentEscrow] }];
      let page = await noir.server.getEvents({ startLedger: chain.ledger, limit: 100, filters });
      let matched: NoirEvent | undefined;
      for (let count = 0; count < 5; count++) {
        const matches = page.events.map(raw => decodeMatchedNoirEvent(raw, chain, agent.escrowContractId)).filter((e): e is NoirEvent => e !== null && e.type === 'payment.authorized' && [attempt.innerHash, execution.outerTransactionHash].includes(e.txHash));
        if (matches.length > 1 || matched && matches.length) throw new SpikeGuardError('AMBIGUOUS_NOIR_EVENT');
        if (matches.length) matched = matches[0];
        if (page.events.length < 100) break;
        page = await noir.server.getEvents({ cursor: page.cursor, limit: 100, filters });
      }
      if (!matched) throw new SpikeGuardError('NOIR_EVENT_UNAVAILABLE');
      const verified = verifyAuthorizationEvidence({ transaction: chain, event: matched, velo: execution,
        identity: { requestId: attempt.veloRequestId, transactionHash: attempt.innerHash }, handoffCommittedAt: attempt.handoffCommittedAt.getTime(),
        intent: { agent: quote.agentPublicKey, deviceHash: quote.deviceHash, merchant: quote.merchantAddress, asset: quote.assetContractId, escrow: agent.escrowContractId, amount: BigInt(quote.amountStroops), nonce: BigInt(attempt.nonce), expiresAt: quote.expiresAt.getTime() } });
      return { ownerId: quote.ownerId, agentId: quote.agentId, runId: quote.runId, quoteId: quote.id, attemptId: attempt.id, operationId: attempt.operationId,
        veloRequestId: attempt.veloRequestId, veloStatus: 'succeeded', chainSucceeded: true, innerHash: verified.innerHash, outerHash: verified.outerHash,
        observedEventTxHash: verified.observedEventTransactionHash, noirEventId: verified.eventId, network: 'testnet', contractId: agent.escrowContractId,
        ledgerSequence: verified.ledger.toString(), ledgerClosedAt: new Date(chain.createdAt * 1000), agentPublicKey: quote.agentPublicKey, deviceHash: quote.deviceHash,
        merchantAddress: quote.merchantAddress, assetContractId: quote.assetContractId, amountStroops: quote.amountStroops, nonce: attempt.nonce,
        outerLedgerFeeStroops: verified.outerLedgerFeeChargedStroops, veloActualFeeStroops: verified.veloActualFeeStroops };

  };
}
