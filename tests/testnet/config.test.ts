import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Asset, Keypair, Networks, StrKey } from '@stellar/stellar-sdk';
import { requireLiveInputs, liveVariables } from '../../scripts/spike-noir-velo.js';
import { safeFailure } from '../../scripts/verify-contracts.js';

function config(): NodeJS.ProcessEnv {
  const owner = Keypair.random(), agent = Keypair.random(), merchant = Keypair.random();
  return { STELLAR_NETWORK: 'testnet', STELLAR_RPC_URL: 'https://example.invalid', STELLAR_NETWORK_PASSPHRASE: Networks.TESTNET,
    NOIR_DEVICE_REGISTRY_ID: StrKey.encodeContract(Buffer.alloc(32, 1)), NOIR_AGENT_REGISTRY_ID: StrKey.encodeContract(Buffer.alloc(32, 2)),
    NOIR_PAYMENT_ESCROW_ID: StrKey.encodeContract(Buffer.alloc(32, 3)), NOIR_XLM_SAC_ID: Asset.native().contractId(Networks.TESTNET),
    DEMO_OWNER_PUBLIC_KEY: owner.publicKey(), DEMO_AGENT_PUBLIC_KEY: agent.publicKey(), DEMO_MERCHANT_PUBLIC_KEY: merchant.publicKey(),
    SPIKE_OWNER_SECRET: owner.secret(), AGENT_SECRET: agent.secret(), SPIKE_MERCHANT_SECRET: merchant.secret(),
    VELO_GAS_API_KEY: 'synthetic-key-sentinel', VELO_GAS_BASE_URL: 'https://example.invalid',
    ENVELOPE_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'), RUN_TESTNET: '1' };
}
test('TC-013: live input guard accepts structurally valid disposable config without making network calls', () => {
  assert.doesNotThrow(() => requireLiveInputs(config()));
});
test('TC-013: missing input response lists names, never values', () => {
  for (const name of liveVariables) {
    const env = config(); delete env[name];
    assert.throws(() => requireLiveInputs(env), error => {
      const output = safeFailure(error);
      assert.equal(output.code, 'MISSING_CONFIGURATION');
      assert.deepEqual(output.missing, [name]);
      assert.equal(JSON.stringify(output).includes('sentinel'), false);
      return true;
    });
  }
});
test('TC-013: mainnet, missing opt-in, mismatched signers and malformed encryption keys fail closed', () => {
  for (const RUN_TESTNET of [undefined, '0', 'true']) {
    const env = config(); if (RUN_TESTNET === undefined) delete env.RUN_TESTNET; else env.RUN_TESTNET = RUN_TESTNET;
    assert.throws(() => requireLiveInputs(env), /RUN_TESTNET_OPT_IN_REQUIRED/);
  }
  assert.throws(() => requireLiveInputs({ ...config(), STELLAR_NETWORK: 'mainnet' }), /TESTNET_ONLY/);
  assert.throws(() => requireLiveInputs({ ...config(), STELLAR_NETWORK_PASSPHRASE: Networks.PUBLIC }), /TESTNET_ONLY/);
  assert.throws(() => requireLiveInputs({ ...config(), AGENT_SECRET: Keypair.random().secret() }), /SIGNER_CONFIGURATION_MISMATCH/);
  assert.throws(() => requireLiveInputs({ ...config(), ENVELOPE_ENCRYPTION_KEY: Buffer.alloc(31).toString('base64') }), /INVALID_ENVELOPE_ENCRYPTION_KEY/);
  const env = config(); env.DEMO_MERCHANT_PUBLIC_KEY = env.DEMO_OWNER_PUBLIC_KEY; env.SPIKE_MERCHANT_SECRET = env.SPIKE_OWNER_SECRET;
  assert.throws(() => requireLiveInputs(env), /DISTINCT_WALLETS_REQUIRED/);
});
