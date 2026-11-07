import { randomBytes } from 'node:crypto';
import { open, readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';
import { Asset, Keypair, Networks, StrKey, rpc } from '@stellar/stellar-sdk';
import { SpikeGuardError } from '../src/server/integrations/noir.ts';
import { safeFailure } from './verify-contracts.ts';

export async function createSpikeEnvironment(file = '.env.spike.local') {
  let handle;
  try { handle = await open(file, 'wx', 0o600); }
  catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'EEXIST') return { status: 'existing_preserved', file };
    throw new SpikeGuardError('ENVIRONMENT_CREATE_FAILED');
  }
  try {
    const owner = Keypair.random(), agent = Keypair.random(), merchant = Keypair.random();
    const env = { STELLAR_NETWORK: 'testnet', STELLAR_RPC_URL: 'https://soroban-testnet.stellar.org',
      STELLAR_NETWORK_PASSPHRASE: Networks.TESTNET, NOIR_DEVICE_REGISTRY_ID: '', NOIR_AGENT_REGISTRY_ID: '', NOIR_PAYMENT_ESCROW_ID: '',
      NOIR_XLM_SAC_ID: Asset.native().contractId(Networks.TESTNET), DEMO_OWNER_PUBLIC_KEY: owner.publicKey(),
      DEMO_AGENT_PUBLIC_KEY: agent.publicKey(), DEMO_MERCHANT_PUBLIC_KEY: merchant.publicKey(),
      AGENT_SECRET: agent.secret(), SPIKE_OWNER_SECRET: owner.secret(), SPIKE_MERCHANT_SECRET: merchant.secret(),
      VELO_GAS_API_KEY: '', VELO_GAS_BASE_URL: 'https://www.velo-build.dev',
      ENVELOPE_ENCRYPTION_KEY: randomBytes(32).toString('base64'), RUN_TESTNET: '0' };
    await handle.writeFile('# Local disposable Testnet harness credentials. Never copy into web env or commit.\n' +
      '# Contract IDs and Gas access require verification; live spending stays disabled.\n' +
      Object.entries(env).map(([name, value]) => `${name}=${JSON.stringify(value)}`).join('\n') + '\n');
    await handle.sync();
  } finally { await handle.close(); }
  return { status: 'created', file };
}

// Friendbot receives public account addresses only. This creates Testnet account
// balances; it never configures Noir policy, escrow or a Velo relayer.
export async function fundSpikeAccounts(env: NodeJS.ProcessEnv) {
  if (env.STELLAR_NETWORK !== 'testnet' || env.STELLAR_NETWORK_PASSPHRASE !== Networks.TESTNET ||
      env.STELLAR_RPC_URL !== 'https://soroban-testnet.stellar.org') throw new SpikeGuardError('TESTNET_ONLY');
  const server = new rpc.Server('https://soroban-testnet.stellar.org', { timeout: 15000 });
  if ((await server.getNetwork()).passphrase !== Networks.TESTNET) throw new SpikeGuardError('RPC_NETWORK_MISMATCH');
  const results: { role: string; status: string }[] = [];
  for (const [role, name] of [['owner', 'DEMO_OWNER_PUBLIC_KEY'], ['agent', 'DEMO_AGENT_PUBLIC_KEY'],
    ['merchant', 'DEMO_MERCHANT_PUBLIC_KEY']] as const) {
    const address = env[name];
    if (!address || !StrKey.isValidEd25519PublicKey(address)) throw new SpikeGuardError('INVALID_FUNDING_ADDRESS');
    const accountUrl = `https://horizon-testnet.stellar.org/accounts/${address}`;
    const account = await fetch(accountUrl, { signal: AbortSignal.timeout(15000), redirect: 'error' });
    await account.body?.cancel();
    if (account.status === 200) { results.push({ role, status: 'already_exists' }); continue; }
    if (account.status !== 404) throw new SpikeGuardError('TESTNET_ACCOUNT_CHECK_FAILED');
    const funding = await fetch(`https://friendbot.stellar.org/?addr=${encodeURIComponent(address)}`, {
      signal: AbortSignal.timeout(20000), redirect: 'error',
    });
    await funding.body?.cancel();
    if (!funding.ok) throw new SpikeGuardError('FRIENDBOT_REQUEST_FAILED');
    await server.getAccount(address);
    results.push({ role, status: 'account_created_and_observed' });
  }
  return results;
}

async function main() {
  try {
    if (process.argv.slice(2).some(arg => arg !== '--fund')) throw new SpikeGuardError('UNSUPPORTED_SETUP_ARGUMENT');
    console.info(JSON.stringify(await createSpikeEnvironment()));
    if (process.argv.includes('--fund')) {
      const env = parseEnv(await readFile('.env.spike.local', 'utf8'));
      console.info(JSON.stringify({ classification: 'testnet_account_funding_only', accounts: await fundSpikeAccounts(env) }));
    }
  } catch (error) { console.error(JSON.stringify(safeFailure(error))); process.exitCode = 1; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
