// Identity-only recovery of the user's existing registration; never prepare or submit.
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { localCustody, privateEnv, publicContext } from './context.mjs';
import { createStore } from '../../../src/server/db/connection.ts';
import { createWalletGateway } from '../../../src/server/integrations/wallet-gateway.ts';
import { observeWallet } from '../../../src/server/domain/wallet.ts';

if (process.argv.length !== 3 || process.argv[2] !== '--observe-existing-registration') {
  console.log(JSON.stringify({ status: 'not_run', code: 'EXPLICIT_IDENTITY_OBSERVATION_REQUIRED' }));
  process.exitCode = 2;
} else {
  let local, store;
  try {
    local = await localCustody();
    const env = privateEnv('.env.release.web.local'), context = publicContext();
    assert.equal(env.DATABASE_URL, local.custody.DATABASE_URL);
    assert.equal(env.DEMO_OWNER_PUBLIC_KEY, context.ownerPublicKey);
    const id = '82cf8f8a-473f-4c3f-859b-a43d79e0d2b6';
    const hash = '1a90bea9260d2043fb62a5b26ded7ac4dd8a6426f51955d3767cfe44ce19b288';
    const [saved] = (await local.pool.query(`SELECT w.id,w.status,w.actor_address,w.tx_hash,w.unsigned_body_hash,w.operation_kind,
      w.handoff_committed_at,w.expires_at,a.public_key,a.device_hash,a.owner_id,a.last_nonce::text
      FROM wallet_operation w JOIN agent a ON a.id=w.agent_id WHERE w.id=$1`, [id])).rows;
    assert(saved && ['unknown', 'submitting', 'confirmed'].includes(saved.status));
    assert.equal(saved.operation_kind, 'registerDevice');
    assert.equal(saved.tx_hash, hash); assert.equal(saved.unsigned_body_hash, hash);
    assert.equal(saved.actor_address, context.ownerPublicKey);
    assert.equal(saved.public_key, context.agentPublicKey); assert.equal(saved.device_hash, context.deviceHash);
    assert.equal(saved.last_nonce, '0'); assert(saved.handoff_committed_at < saved.expires_at);
    const gateway = await createWalletGateway(env);
    // Defense in depth: recovery cannot use either mutation method.
    gateway.prepare = async () => { throw Error('IDENTITY_OBSERVATION_ONLY'); };
    gateway.submit = async () => { throw Error('IDENTITY_OBSERVATION_ONLY'); };
    const chain = await gateway.getTransaction(hash);
    assert.equal(chain.status, 'SUCCESS'); assert.equal(chain.txHash, hash);
    const response = await fetch('https://horizon-testnet.stellar.org/transactions/' + hash,
      { redirect: 'error', signal: AbortSignal.timeout(20000) });
    assert.equal(response.status, 200);
    const horizon = await response.json();
    assert.equal(horizon.hash, hash); assert.equal(horizon.successful, true); assert.equal(horizon.ledger, chain.ledger);
    assert.equal(await gateway.getDeviceOwner(context.deviceHash), context.ownerPublicKey);
    assert.equal(await gateway.getDeviceAgent(context.deviceHash), context.agentPublicKey);
    store = createStore(env.DATABASE_URL);
    const observed = await observeWallet(store, { role: 'owner', ownerId: saved.owner_id, merchantId: null }, id, gateway);
    assert.equal(observed.status, 'confirmed');
    const result = { status: 'passed', observedAt: new Date().toISOString(), scope: 'actual-identity-only-human-registration-recovery',
      operationId: id, transactionHash: hash, ledger: chain.ledger, includedAt: horizon.created_at,
      rpcTimestampType: typeof chain.createdAt, rpcTimestampValue: String(chain.createdAt),
      rpcAndHorizonAgree: true, ownerAndAgentMatch: true, exactEnvelopeSignatureBodyAndInvocationVerified: true,
      before: saved.status, after: observed.status, newPreparations: 0, newSubmissions: 0, agentNonce: '0',
      policyFundingAndPurchasesComplete: false, fullLiveRelease: false };
    mkdirSync('docs/evidence/wallet-inclusion-2026-11-14', { recursive: true });
    writeFileSync('docs/evidence/wallet-inclusion-2026-11-14/registration-observed.json', JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify(result));
  } catch { console.log(JSON.stringify({ status: 'failed', code: 'EXACT_REGISTRATION_OBSERVATION_INCOMPLETE', newSubmissions: 0 })); process.exitCode = 1; }
  finally { await store?.close(); await local?.pool.end(); }
}
