// Identity-only diagnostics: this module has no signer, sponsor or submit path.
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { VeloError } from '@carts1024/velo-sdk';
import { configuredStore } from '../src/server/db/connection.ts';
import { createNoir, readTestnetConfig } from '../src/server/integrations/noir.ts';
import { createVelo } from '../src/server/integrations/velo.ts';

const checkpoint = z.strictObject({ id: z.uuid() });
export async function observePurchase(env: NodeJS.ProcessEnv) {
  const saved = checkpoint.parse(JSON.parse(await readFile('.aegispay-spike/finals-payment-005/cli-attempt.json', 'utf8')));
  const store = configuredStore(env);
  try {
    const result = await store.pool.query<{
      attempt_id: string; quote_id: string; operation_id: string; status: string; nonce: string;
      velo_request_id: string | null; velo_status: string | null; inner_hash: string | null; outer_hash: string | null;
      handoff_committed_at: Date | null; reserved_stroops: string; spent_stroops: string; entitlement_count: string;
      last_nonce: string; device_hash: string; merchant_address: string; ciphertext_present: boolean;
      agent_lease_active: boolean; attempt_count: string;
    }>(`SELECT a.id AS attempt_id, a.quote_id, a.operation_id, a.status, a.nonce::text,
      a.velo_request_id, a.velo_status, a.inner_hash, a.outer_hash, a.handoff_committed_at,
      r.reserved_stroops::text, r.spent_stroops::text, g.last_nonce::text, g.device_hash,
      q.merchant_address, a.signed_xdr_ciphertext IS NOT NULL AS ciphertext_present,
      coalesce(g.lease_until > clock_timestamp(), false) AS agent_lease_active,
      (SELECT count(*)::text FROM entitlement e WHERE e.quote_id = q.id) AS entitlement_count,
      (SELECT count(*)::text FROM payment_attempt p WHERE p.agent_id = g.id) AS attempt_count
      FROM payment_attempt a JOIN quote q ON q.id = a.quote_id JOIN agent g ON g.id = a.agent_id
      JOIN agent_run r ON r.id = q.run_id WHERE a.id = $1`, [saved.id]);
    const row = result.rows[0];
    if (!row?.handoff_committed_at || !row.velo_request_id || !row.inner_hash) throw new Error('SAVED_HANDOFF_IDENTITY_REQUIRED');
    if (row.device_hash !== env.DEMO_DEVICE_HASH || row.merchant_address !== env.DEMO_MERCHANT_PUBLIC_KEY) throw new Error('SAVED_CONFIGURATION_IDENTITY_MISMATCH');
    const identity = { requestId: row.velo_request_id, transactionHash: row.inner_hash };
    const noir = createNoir(readTestnetConfig(env));
    const gas = createVelo(env).gas;
    const observations = await Promise.allSettled([
      gas.getStatus(identity), noir.server.getTransaction(identity.transactionHash),
      noir.getEscrowBalance(row.device_hash), noir.getPendingBalance(row.merchant_address),
    ]);
    const [velo, chain, escrow, pending] = observations;
    // Provider objects/errors are never serialized. Even codes are allowlisted.
    const veloObservation = velo.status === 'fulfilled' ? {
      status: velo.value.status, requestId: velo.value.requestId, innerHash: velo.value.transactionHash,
      outerHash: velo.value.outerTransactionHash, reconciliationRequired: velo.value.reconciliationRequired,
      actualFeeStroops: velo.value.actualFeeStroops,
    } : { code: 'VELO_STATUS_OBSERVATION_UNAVAILABLE', httpStatus: velo.reason instanceof VeloError ? velo.reason.status ?? null : null };
    return {
      classification: 'actual-testnet-identity-only-observation', observedAt: new Date().toISOString(),
      persisted: row, identity, velo: veloObservation,
      chain: chain.status === 'fulfilled' ? { status: chain.value.status, queriedInnerHash: identity.transactionHash, ledger: 'ledger' in chain.value ? chain.value.ledger : null } : { code: 'RPC_OBSERVATION_UNAVAILABLE' },
      escrowStroops: escrow.status === 'fulfilled' ? escrow.value.toString() : null,
      pendingStroops: pending.status === 'fulfilled' ? pending.value.toString() : null,
      financialDispatch: false, entitlementGranted: false,
      resolution: 'observation-only; missing RPC data or provider conflict never establishes terminal failure',
    };
  } finally { await store.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = await observePurchase(process.env);
    const artifact = `docs/evidence/finals-payment/actual-identity-only-observation-${Date.now()}.json`;
    await writeFile(artifact, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.info(JSON.stringify({ gate: 'purchase-observe', artifact, ...report }));
  } catch {
    console.error(JSON.stringify({ gate: 'purchase-observe', code: 'IDENTITY_OBSERVATION_UNAVAILABLE' }));
    process.exitCode = 1;
  }
}
