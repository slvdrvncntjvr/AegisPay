// Disposable Testnet fixture preparation for the CLI only. Normal web/worker
// startup never imports owner/merchant harness keys or this filesystem journal.
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { Keypair } from '@stellar/stellar-sdk';
import { eq } from 'drizzle-orm';
import { configuredStore } from '../src/server/db/connection.ts';
import { migrate } from '../src/server/db/migrate.ts';
import { seedDemo, seedConfigFromEnvironment } from '../src/server/db/seed.ts';
import * as s from '../src/server/db/schema.ts';
import { createNoir, deploymentVariables, SpikeGuardError } from '../src/server/integrations/noir.ts';
import { provisionSpike } from '../src/server/integrations/spike-driver.ts';
import { spikeDigest } from '../src/server/integrations/spike-runtime.ts';
import { readSpikeRecord } from '../src/server/integrations/spike-journal.ts';
import { inspectWalletOperation } from '../src/server/integrations/wallet-inspection.ts';
import { rpc } from '@stellar/stellar-sdk';
import { z } from 'zod';
import { createVelo } from '../src/server/integrations/velo.ts';
import { requireLiveInputs } from './spike-noir-velo.ts';
import { verifyContracts } from './verify-contracts.ts';

export const purchaseDirectory = '.aegispay-spike/finals-payment-005';
const local = (file: string): NodeJS.ProcessEnv => existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {};
export async function setupPurchase(env: NodeJS.ProcessEnv) {
  // Explicit setup is authorized only with the Testnet opt-in. Copy a named
  // allowlist, preserving existing worker config; never load spike into web.
  if (env.RUN_TESTNET !== '1') throw new SpikeGuardError('RUN_TESTNET_OPT_IN_REQUIRED', ['RUN_TESTNET']);
  const spike = local('.env.spike.local'), worker = local('.env.worker.local'), integration = local('.env.integration.local');
  const names = [...deploymentVariables, 'DEMO_OWNER_PUBLIC_KEY', 'DEMO_AGENT_PUBLIC_KEY', 'DEMO_MERCHANT_PUBLIC_KEY', 'AGENT_SECRET', 'VELO_GAS_API_KEY', 'VELO_GAS_BASE_URL', 'ENVELOPE_ENCRYPTION_KEY'];
  for (const name of names) worker[name] ??= env[name] ?? spike[name];
  worker.DATABASE_URL ??= integration.DATABASE_URL;
  worker.APP_ORIGIN ??= 'http://localhost:3000';
  worker.RECEIPT_SIGNING_KEY ??= randomBytes(32).toString('base64url');
  worker.WORKER_WAKE_TOKEN ??= randomBytes(32).toString('base64url');
  worker.RUN_TESTNET = '1';
  const setupEnv: NodeJS.ProcessEnv = { ...worker, SPIKE_OWNER_SECRET: spike.SPIKE_OWNER_SECRET, SPIKE_MERCHANT_SECRET: spike.SPIKE_MERCHANT_SECRET };
  requireLiveInputs(setupEnv);
  const { config, proof } = await verifyContracts(setupEnv);
  const owner = Keypair.fromSecret(setupEnv.SPIKE_OWNER_SECRET!), agent = Keypair.fromSecret(setupEnv.AGENT_SECRET!), merchant = Keypair.fromSecret(setupEnv.SPIKE_MERCHANT_SECRET!);
  const bindingHash = spikeDigest({ network: config.network, asset: config.asset, owner: owner.publicKey(), agent: agent.publicKey(), merchant: merchant.publicKey(), wasm: proof.contracts.map(item => ({ role: item.role, wasmSha256: item.wasmSha256 })) });
  const noir = createNoir(config), store = configuredStore(worker);
  try {
    await migrate(store);
    const [existing] = await store.db.select().from(s.agent).where(eq(s.agent.publicKey, agent.publicKey()));
    // A historical DB identity cannot be rebound to a new virtual device.
    if (existing && (!worker.DEMO_DEVICE_HASH || existing.deviceHash !== worker.DEMO_DEVICE_HASH)) throw new SpikeGuardError('EXISTING_DB_IDENTITY_REQUIRES_REVIEW');
    const setup = await provisionSpike({ directory: purchaseDirectory, config, noir, gas: createVelo(worker).gas, owner, agent, merchant, encryptionKey: Buffer.from(worker.ENVELOPE_ENCRYPTION_KEY!, 'base64'), bindingHash });
    if (worker.DEMO_DEVICE_HASH && worker.DEMO_DEVICE_HASH !== setup.deviceHash) throw new SpikeGuardError('WORKER_DEVICE_IDENTITY_CONFLICT');
    worker.DEMO_DEVICE_HASH = setup.deviceHash;
    await seedDemo(store, seedConfigFromEnvironment(worker));
    // Import only independently verified registration proof, never an asserted
    // nonce reset. The dedicated fixture was created by the guarded one-shot
    // setup; all later agent authorizations must use this persistent database.
    const marker = z.object({ at: z.number().int().positive(), hash: z.literal(setup.registration.hash) }).parse(await readSpikeRecord(`${purchaseDirectory}/register-device/wallet-handoff.json`));
    const chain = await noir.server.getTransaction(setup.registration.hash);
    if (chain.status !== rpc.Api.GetTransactionStatus.SUCCESS || chain.feeBump || chain.txHash !== marker.hash || chain.resultXdr.result().switch().name !== 'txSuccess') throw new SpikeGuardError('REGISTRATION_CHAIN_PROOF_UNAVAILABLE');
    const tx = inspectWalletOperation(chain.envelopeXdr.toXDR('base64'), owner.publicKey(), { kind: 'registerDevice', deviceHash: setup.deviceHash, agent: agent.publicKey() }, config, marker.at);
    if (tx.hash().toString('hex') !== marker.hash || tx.signatures.length !== 1 || !owner.verify(tx.hash(), tx.signatures[0]!.signature())) throw new SpikeGuardError('REGISTRATION_CHAIN_PROOF_MISMATCH');
    const [dbAgent] = await store.db.select().from(s.agent).where(eq(s.agent.publicKey, agent.publicKey()));
    await store.db.insert(s.walletOperation).values({ id: randomUUID(), actorAddress: owner.publicKey(), role: 'owner', agentId: dbAgent!.id, operationKind: 'registerDevice', operationPayload: { input: { kind: 'registerDevice' }, deviceHash: setup.deviceHash, agentPublicKey: agent.publicKey(), asset: config.asset }, unsignedBodyHash: marker.hash, txHash: marker.hash, handoffCommittedAt: new Date(marker.at), expiresAt: new Date(Number(tx.timeBounds!.maxTime) * 1000), status: 'confirmed' }).onConflictDoNothing();
    const policy = await noir.getPolicy(setup.deviceHash);
    if (!policy?.expiresAt || policy.agent !== agent.publicKey() || policy.asset !== config.asset || policy.expiresAt.getTime() <= Date.now()) throw new SpikeGuardError('POLICY_NOT_READY');
    await store.db.update(s.agent).set({ status: 'active', policyMaxStroops: policy.maxAmount.toString(), policyExpiresAt: policy.expiresAt, policyObservedLedger: BigInt((await noir.server.getLatestLedger()).sequence) }).where(eq(s.agent.publicKey, agent.publicKey()));
    writeFileSync('.env.worker.local', '# Worker-only local configuration. Never copy to web or evidence.\n' + Object.entries(worker).filter((entry): entry is [string, string] => entry[1] !== undefined).map(([name, value]) => `${name}=${JSON.stringify(value)}`).join('\n') + '\n', { mode: 0o600 });
    return { classification: 'actual-testnet-fixture-setup-no-purchase', setup, deploymentVerification: proof };
  } finally { await store.close(); }
}
