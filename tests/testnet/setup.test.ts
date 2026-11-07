import assert from 'node:assert/strict';
import { mkdtemp, readFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { test } from 'node:test';
import { Asset, Keypair, Networks } from '@stellar/stellar-sdk';
import { createSpikeEnvironment, fundSpikeAccounts } from '../../scripts/setup-spike.js';

test('TC-026: setup creates distinct disposable signers and safe Testnet defaults without overwriting', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aegispay-setup-'));
  const file = join(dir, '.env.spike.local');
  try {
    assert.deepEqual(await createSpikeEnvironment(file), { status: 'created', file });
    const before = await readFile(file, 'utf8');
    const env = parseEnv(before);
    assert.equal(env.STELLAR_NETWORK, 'testnet');
    assert.equal(env.STELLAR_NETWORK_PASSPHRASE, Networks.TESTNET);
    assert.equal(env.NOIR_XLM_SAC_ID, Asset.native().contractId(Networks.TESTNET));
    assert.equal(env.RUN_TESTNET, '0');
    assert.equal(env.VELO_GAS_API_KEY, '');
    assert.equal(env.NOIR_DEVICE_REGISTRY_ID, '');
    assert.equal(Buffer.from(env.ENVELOPE_ENCRYPTION_KEY!, 'base64').length, 32);
    const wallets = [['DEMO_OWNER_PUBLIC_KEY', 'SPIKE_OWNER_SECRET'], ['DEMO_AGENT_PUBLIC_KEY', 'AGENT_SECRET'],
      ['DEMO_MERCHANT_PUBLIC_KEY', 'SPIKE_MERCHANT_SECRET']] as const;
    for (const [address, secret] of wallets) assert.equal(env[address], Keypair.fromSecret(env[secret]!).publicKey());
    assert.equal(new Set(wallets.map(([address]) => env[address])).size, 3);
    assert.deepEqual(await createSpikeEnvironment(file), { status: 'existing_preserved', file });
    assert.equal(await readFile(file, 'utf8'), before);
  } finally { await unlink(file).catch(() => {}); await rmdir(dir); }
});

test('TC-013: account funding rejects non-Testnet configuration before any HTTP request', async () => {
  await assert.rejects(fundSpikeAccounts({ STELLAR_NETWORK: 'mainnet' }), /TESTNET_ONLY/);
  await assert.rejects(fundSpikeAccounts({ STELLAR_NETWORK: 'testnet', STELLAR_NETWORK_PASSPHRASE: Networks.TESTNET,
    STELLAR_RPC_URL: 'https://unapproved.example.invalid' }), /TESTNET_ONLY/);
});
