import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Keypair } from '@stellar/stellar-sdk';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';
import { serializeWorkerConfiguration } from '../../scripts/purchase-setup.ts';
import { QUARANTINED_ATTEMPT, manifestDigest, rehearse, releaseManifest, validateConsent } from '../../scripts/release-rehearsal.ts';

const manifest = () => releaseManifest.parse({ network: 'testnet', agentId: randomUUID(), ownerPublicKey: Keypair.random().publicKey(),
  agentPublicKey: Keypair.random().publicKey(), merchantPublicKey: Keypair.random().publicKey(), deviceHash: 'a'.repeat(64),
  runStartKey: randomUUID(), task: 'Fictional test instruction only', maxPaymentStroops: '300000',
  expectedPrices: { 'quick-signal:demo-parser:v1': '300000', 'deep-trace:demo-parser:v1': '1200000' }, attemptIds: [] });
describe('release rehearsal refuses unreviewed intent before any DB/provider/financial access', () => {
  it('disabled purchase CLI refuses before opening a nonexistent manifest or release environment', () => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/release-rehearsal.ts', '--phase', 'purchase',
      '--manifest', 'nonexistent-release-manifest-do-not-create.json', '--worker-env-file', '.env.release.worker.local'],
    { encoding: 'utf8', windowsHide: true, timeout: 10000, env: { NODE_ENV: 'test' } });
    expect(result.status).toBe(2); expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({ status: 'not_run', code: 'PURCHASE_PHASE_DISABLED_EXACT_DURABLE_AUTHORITY_REQUIRED', financialActions: 0 });
  });
  it('persists execution disabled even when explicitly enabled for a setup process', () => {
    const processOnly = { RUN_TESTNET: '1', APP_ORIGIN: 'http://localhost:3000', GEMINI_API_KEY: 'SYNTHETIC_TEST_VALUE', OPTIONAL_VALUE: undefined };
    const persisted = parseEnv(serializeWorkerConfiguration(processOnly));
    expect(persisted.RUN_TESTNET).toBe('0'); expect(persisted.GEMINI_API_KEY).toBe('SYNTHETIC_TEST_VALUE');
    expect(persisted.OPTIONAL_VALUE).toBeUndefined(); expect(processOnly.RUN_TESTNET).toBe('1');
  });
  it('rejects mainnet, duplicate/historical attempt identity, overflow and extra proof claims', () => {
    const m = manifest(), id = randomUUID();
    for (const edit of [{ network: 'mainnet' }, { agentId: 'e901976a-7ef3-4784-b510-bc1632935d35' },
      { deviceHash: '790905edd7c6d36e300d0149ed6d73ef60db6bcc6635c50fa2b7312dc7bbeb7c' }, { attemptIds: [id, id] }, { attemptIds: [QUARANTINED_ATTEMPT] },
      { maxPaymentStroops: '1000001' }, { maxPaymentStroops: '0' }, { success: true }]) {
      expect(() => releaseManifest.parse({ ...m, ...edit })).toThrow();
    }
  });
  it('binds one fresh consent to exact task, prices, actor, run key and finite budget', () => {
    const m = manifest(), now = Date.now();
    const consent = { manifestSha256: manifestDigest(m), purchaseCount: 1, network: 'testnet',
      userStatement: 'I authorize one fresh independent Testnet model purchase within this exact manifest.',
      approvedAt: new Date(now - 1000).toISOString(), expiresAt: new Date(now + 60000).toISOString() };
    expect(() => validateConsent(consent, m, now)).not.toThrow();
    for (const edit of [{ task: 'Another intent' }, { maxPaymentStroops: '600000' }, { runStartKey: randomUUID() },
      { expectedPrices: { ...m.expectedPrices, 'quick-signal:demo-parser:v1': '400000' } }]) {
      expect(() => validateConsent(consent, { ...m, ...edit }, now)).toThrow('FRESH_EXACT_PURCHASE_CONSENT_REQUIRED');
    }
    expect(() => validateConsent({ ...consent, expiresAt: new Date(now - 1).toISOString() }, m, now)).toThrow();
    expect(() => validateConsent({ ...consent, approvedAt: new Date(now + 1).toISOString() }, m, now)).toThrow();
    expect(() => validateConsent({ ...consent, purchaseCount: 2 }, m, now)).toThrow();
  });
  it('has no permissive default phase, Testnet opt-in, original context or purchase consent', async () => {
    const m = manifest();
    await expect(rehearse('', m, {})).rejects.toThrow('RELEASE_PHASE_REQUIRED');
    await expect(rehearse('preflight', m, {})).rejects.toThrow('EXPLICIT_TESTNET_OPT_IN_REQUIRED');
    await expect(rehearse('preflight', m, { RUN_TESTNET: '1' })).rejects.toThrow('RELEASE_CONTEXT_MISMATCH');
    const env = { RUN_TESTNET: '1', DEMO_OWNER_PUBLIC_KEY: m.ownerPublicKey, DEMO_AGENT_PUBLIC_KEY: m.agentPublicKey,
      DEMO_MERCHANT_PUBLIC_KEY: m.merchantPublicKey, DEMO_DEVICE_HASH: m.deviceHash };
    await expect(rehearse('purchase', m, env)).rejects.toThrow('PURCHASE_PHASE_DISABLED_EXACT_DURABLE_AUTHORITY_REQUIRED');
  });
});
