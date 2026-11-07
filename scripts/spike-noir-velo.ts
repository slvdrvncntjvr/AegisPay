import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { Keypair, StrKey } from '@stellar/stellar-sdk';
import { deploymentVariables, SpikeGuardError, createNoir, inspectAuthorization, readTestnetConfig } from '../src/server/integrations/noir.js';
import { safeFailure, verifyContracts } from './verify-contracts.js';

export const liveVariables = [...deploymentVariables, 'DEMO_OWNER_PUBLIC_KEY', 'DEMO_AGENT_PUBLIC_KEY',
  'DEMO_MERCHANT_PUBLIC_KEY', 'AGENT_SECRET', 'VELO_GAS_API_KEY', 'VELO_GAS_BASE_URL',
  'ENVELOPE_ENCRYPTION_KEY', 'SPIKE_OWNER_SECRET', 'SPIKE_MERCHANT_SECRET'] as const;
export function requireLiveInputs(env: NodeJS.ProcessEnv = process.env) {
  if (env.STELLAR_NETWORK && env.STELLAR_NETWORK !== 'testnet') throw new SpikeGuardError('TESTNET_ONLY');
  const missing = liveVariables.filter(key => !env[key]?.trim());
  if (missing.length) throw new SpikeGuardError('MISSING_CONFIGURATION', missing);
  if (env.RUN_TESTNET !== '1') throw new SpikeGuardError('RUN_TESTNET_OPT_IN_REQUIRED', ['RUN_TESTNET']);
  readTestnetConfig(env);
  for (const [publicKey, secret] of [['DEMO_OWNER_PUBLIC_KEY', 'SPIKE_OWNER_SECRET'],
    ['DEMO_AGENT_PUBLIC_KEY', 'AGENT_SECRET'], ['DEMO_MERCHANT_PUBLIC_KEY', 'SPIKE_MERCHANT_SECRET']] as const) {
    try {
      if (!StrKey.isValidEd25519PublicKey(env[publicKey]!) || Keypair.fromSecret(env[secret]!).publicKey() !== env[publicKey]) throw new Error('mismatch');
    } catch { throw new SpikeGuardError('SIGNER_CONFIGURATION_MISMATCH'); }
  }
  if (new Set([env.DEMO_OWNER_PUBLIC_KEY, env.DEMO_AGENT_PUBLIC_KEY, env.DEMO_MERCHANT_PUBLIC_KEY]).size !== 3) throw new SpikeGuardError('DISTINCT_WALLETS_REQUIRED');
  if (!/^[A-Za-z0-9+/]{43}=$/.test(env.ENVELOPE_ENCRYPTION_KEY!) || Buffer.from(env.ENVELOPE_ENCRYPTION_KEY!, 'base64').length !== 32) throw new SpikeGuardError('INVALID_ENVELOPE_ENCRYPTION_KEY');
}
// Non-spending initial stage. Completing the live handoff, actual contract
// refusal and separate merchant claim remains TASK-002 work after setup.
export async function runSpikePreflight(env: NodeJS.ProcessEnv = process.env) {
  requireLiveInputs(env);
  const { config } = await verifyContracts(env);
  const noir = createNoir(config);
  const deviceHash = createHash('sha256').update(`aegispay-spike:${env.DEMO_OWNER_PUBLIC_KEY}:${env.DEMO_AGENT_PUBLIC_KEY}`).digest('hex');
  const [owner, policy, token, balance] = await Promise.all([noir.getDeviceOwner(deviceHash), noir.getPolicy(deviceHash), noir.getEscrowToken(deviceHash), noir.getEscrowBalance(deviceHash)]);
  if (owner !== env.DEMO_OWNER_PUBLIC_KEY || !policy || policy.agent !== env.DEMO_AGENT_PUBLIC_KEY || token !== config.asset || balance < 300000n ||
      policy.asset !== config.asset || policy.maxAmount !== 1000000n || !policy.expiresAt || policy.expiresAt.getTime() <= Date.now()) throw new SpikeGuardError('LIVE_SPIKE_FIXTURE_NOT_PROVISIONED');
  // No nonce is allocated for dispatch or signed while durable journaling and
  // the verified deployed call tree are pending. This is prepare/simulation only.
  const intent = { agent: env.DEMO_AGENT_PUBLIC_KEY!, merchant: env.DEMO_MERCHANT_PUBLIC_KEY!, deviceHash,
    asset: config.asset, escrow: config.network.contracts.paymentEscrow, amount: 300000n, nonce: 1n, expiresAt: Date.now() + 120000 };
  const unsigned = await noir.prepare(intent.agent, { kind: 'authorize', ...intent });
  inspectAuthorization(unsigned, intent);
  throw new SpikeGuardError('LIVE_HANDOFF_REFUSAL_AND_CLAIM_GATE_PENDING');
}
async function main() {
  try { await runSpikePreflight(); } catch (error) { console.error(JSON.stringify(safeFailure(error))); process.exitCode = 1; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
