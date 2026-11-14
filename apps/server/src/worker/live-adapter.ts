import { Keypair, StrKey } from '@stellar/stellar-sdk';
import { createNoir, inspectAuthorization, readTestnetConfig, SpikeGuardError } from '../../../../src/server/integrations/noir.ts';
import { createVelo } from '../../../../src/server/integrations/velo.ts';
import { authorizationVerifier } from '../../../../src/server/integrations/payment-verifier.ts';
import { verifyContracts } from '../../../../scripts/verify-contracts.ts';
import type { PaymentAdapter } from './payment.ts';
import { quoteTermsHash } from '../../../../src/server/domain/purchases.ts';
import type { Store } from '../../../../src/server/db/connection.ts';
import { assertNonceContinuity } from './continuity.ts';

export async function createLivePaymentAdapter(env: NodeJS.ProcessEnv, store: Store): Promise<PaymentAdapter> {
  const config = readTestnetConfig(env);
  if (env.RUN_TESTNET !== '1') throw new SpikeGuardError('LIVE_PAYMENT_OPT_IN_REQUIRED');
  if (!env.AGENT_SECRET) throw new SpikeGuardError('MISSING_CONFIGURATION', ['AGENT_SECRET']);
  if (!env.DEMO_OWNER_PUBLIC_KEY || !StrKey.isValidEd25519PublicKey(env.DEMO_OWNER_PUBLIC_KEY)) throw new SpikeGuardError('MISSING_CONFIGURATION', ['DEMO_OWNER_PUBLIC_KEY']);
  const signer = Keypair.fromSecret(env.AGENT_SECRET);
  if (signer.publicKey() !== env.DEMO_AGENT_PUBLIC_KEY) throw new SpikeGuardError('AGENT_KEY_MISMATCH');
  await verifyContracts(env);
  const noir = createNoir(config), velo = createVelo(env);
  return {
    gas: velo.gas,
    async prepare({ quote, attempt, agent }) {
      await assertNonceContinuity(store, agent);
      if (quote.termsHash !== quoteTermsHash(quote) || quote.network !== 'testnet' || agent.network !== 'testnet' || quote.agentPublicKey !== agent.publicKey || quote.deviceHash !== agent.deviceHash || quote.assetContractId !== agent.assetContractId || quote.agentId !== agent.id || attempt.agentId !== agent.id || attempt.quoteId !== quote.id || attempt.nonce !== agent.lastNonce || agent.publicKey !== signer.publicKey() || agent.deviceContractId !== config.network.contracts.deviceRegistry || agent.agentContractId !== config.network.contracts.agentRegistry || agent.escrowContractId !== config.network.contracts.paymentEscrow || quote.assetContractId !== config.asset) throw new SpikeGuardError('DEPLOYMENT_MISMATCH');
      const [policy, owner, deviceAgent, token] = await Promise.all([noir.getPolicy(quote.deviceHash), noir.getDeviceOwner(quote.deviceHash), noir.getDeviceAgent(quote.deviceHash), noir.getEscrowToken(quote.deviceHash)]);
      if (owner !== env.DEMO_OWNER_PUBLIC_KEY || deviceAgent !== signer.publicKey() || token !== config.asset) throw new SpikeGuardError('DEPLOYMENT_MISMATCH');
      if (!policy || policy.agent !== quote.agentPublicKey || policy.asset !== quote.assetContractId || policy.maxAmount <= 0n || !policy.expiresAt || policy.expiresAt.getTime() <= Date.now()) throw new SpikeGuardError('POLICY_NOT_READY');
      const check = await noir.checkPayment({ deviceHash: quote.deviceHash, agent: quote.agentPublicKey, asset: quote.assetContractId, amount: BigInt(quote.amountStroops), requireEscrow: true });
      if (!check.ok) throw new SpikeGuardError('POLICY_REFUSED');
      if (Date.now() >= quote.expiresAt.getTime()) throw new SpikeGuardError('QUOTE_EXPIRED');
      const unsigned = await noir.prepare(signer.publicKey(), { kind: 'authorize', deviceHash: quote.deviceHash, merchant: quote.merchantAddress, asset: quote.assetContractId, amount: BigInt(quote.amountStroops), nonce: BigInt(attempt.nonce) });
      const inspected = inspectAuthorization(unsigned, { agent: quote.agentPublicKey, deviceHash: quote.deviceHash, merchant: quote.merchantAddress, asset: quote.assetContractId, escrow: agent.escrowContractId, amount: BigInt(quote.amountStroops), nonce: BigInt(attempt.nonce), expiresAt: quote.expiresAt.getTime() });
      if (inspected.transaction.signatures.length !== 0) throw new SpikeGuardError('UNEXPECTED_PREPARED_SIGNATURE');
      inspected.transaction.sign(signer);
      return { signedEnvelope: inspected.transaction.toXDR(), innerHash: inspected.innerHash };
    },
    verify: authorizationVerifier(noir, config),
  };
}
