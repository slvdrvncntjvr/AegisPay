import { pathToFileURL } from 'node:url';
import { Keypair, StrKey } from '@stellar/stellar-sdk';
import { deploymentVariables, SpikeGuardError, createNoir, readTestnetConfig } from '../src/server/integrations/noir.ts';
import { safeFailure, verifyContracts } from './verify-contracts.ts';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createVelo } from '../src/server/integrations/velo.ts';
import { executeSpike, provisionSpike, type SpikeContext } from '../src/server/integrations/spike-driver.ts';
import { spikeDigest } from '../src/server/integrations/spike-runtime.ts';
import { writeSpikeRecord } from '../src/server/integrations/spike-journal.ts';

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
async function main() {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || args.some(arg => arg !== '--setup')) throw new SpikeGuardError('UNSUPPORTED_SPIKE_ARGUMENT');
    const result = await runLiveSpike(process.env, args[0] === '--setup');
    console.info(JSON.stringify({ status: 'passed', artifact: result.artifact, classification: result.classification }));
  } catch (error) { console.error(JSON.stringify(safeFailure(error))); process.exitCode = 1; }
}
export async function runLiveSpike(env: NodeJS.ProcessEnv = process.env, setupOnly = false) {
  requireLiveInputs(env);
  const { config, proof } = await verifyContracts(env);
  const owner = Keypair.fromSecret(env.SPIKE_OWNER_SECRET!), agent = Keypair.fromSecret(env.AGENT_SECRET!), merchant = Keypair.fromSecret(env.SPIKE_MERCHANT_SECRET!);
  const bindingHash = spikeDigest({ network: config.network, asset: config.asset, owner: owner.publicKey(), agent: agent.publicKey(),
    merchant: merchant.publicKey(), wasm: proof.contracts.map(item => ({ role: item.role, wasmSha256: item.wasmSha256 })) });
  const ctx: SpikeContext = { directory: '.aegispay-spike', config, noir: createNoir(config), gas: createVelo(env).gas, owner, agent, merchant,
    encryptionKey: Buffer.from(env.ENVELOPE_ENCRYPTION_KEY!, 'base64'), bindingHash };
  const report = setupOnly ? await provisionSpike(ctx) : await executeSpike(ctx);
  try {
    await mkdir('docs/evidence/testnet', { recursive: true });
    const artifact = join('docs/evidence/testnet', `${setupOnly ? 'fixture' : 'spike'}-${'operationId' in report ? report.operationId : report.deviceHash}-${Date.now()}.json`);
    if (!(await writeSpikeRecord(artifact, { ...report, deploymentVerification: proof, sdkVersions: { noir: '0.3.0', stellar: '16.4.1', velo: '1.0.0' } }))) throw new SpikeGuardError('EVIDENCE_ARTIFACT_ALREADY_EXISTS', [], 'unresolved');
    return { artifact, classification: report.classification };
  } catch (error) {
    if (error instanceof SpikeGuardError) throw error;
    throw new SpikeGuardError('EVIDENCE_EXPORT_UNRESOLVED');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
