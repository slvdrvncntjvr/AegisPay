// Existing purchase only: no signer, prepare, sponsor, submit or run mutation.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { localCustody, privateEnv, selectedEnv, publicContext } from './context.mjs';
import { createStore } from '../../../src/server/db/connection.ts';
import { createNoir, readTestnetConfig } from '../../../src/server/integrations/noir.ts';
import { createVelo, validateExecution } from '../../../src/server/integrations/velo.ts';
import { authorizationVerifier } from '../../../src/server/integrations/payment-verifier.ts';
import { paymentSnapshot } from '../../../apps/server/src/worker/payment.ts';

if (process.argv.length !== 3 || process.argv[2] !== '--verify-saved-purchase') {
  console.log(JSON.stringify({ status: 'not_run', code: 'EXPLICIT_SAVED_PURCHASE_CHECK_REQUIRED' })); process.exitCode = 2;
} else {
  let local, store, sessionHash; let passed = false;
  const report = { scope: 'actual-existing-model-purchase-independent-verification', observedAt: new Date().toISOString(), newPaymentHandoffs: 0, fullLiveRelease: false };
  try {
    local = await localCustody(); const env = privateEnv('.env.release.web.local'), ctx = publicContext();
    assert.equal(env.DATABASE_URL, local.custody.DATABASE_URL); assert.equal(env.APP_ORIGIN, 'http://127.0.0.1:3019');
    store = createStore(env.DATABASE_URL);
    const id = 'baeaf3b8-a857-4f75-a0c7-332889c0777a';
    const snapshot = await paymentSnapshot(store, id), { agent, quote, attempt } = snapshot;
    assert.equal(agent.id, ctx.agentId); assert.equal(quote.merchantAddress, ctx.merchantPublicKey);
    assert.equal(quote.amountStroops, '300000'); assert.equal(quote.resourceKey, 'quick-signal:demo-parser:v1');
    assert.equal(attempt.status, 'authorized'); assert.equal(attempt.nonce, '1');
    assert.equal(attempt.operationId, '522f6059-6604-49f4-ba5f-31523a6cce90');
    assert.equal(attempt.innerHash, 'b2eee1f4e835a5bd2409cb3189c2a0980cef29555e2e0ce2f9896cbba1e581dd');
    assert(attempt.handoffCommittedAt && attempt.veloRequestId && !attempt.signedXdrCiphertext);
    const veloEnv = selectedEnv('.env.release.worker.local', ['VELO_GAS_API_KEY','VELO_GAS_BASE_URL']);
    const execution = validateExecution(await createVelo(veloEnv).gas.getStatus({ requestId: attempt.veloRequestId, transactionHash: attempt.innerHash }),
      { requestId: attempt.veloRequestId, transactionHash: attempt.innerHash });
    const config = readTestnetConfig(env), noir = createNoir(config);
    const proof = await authorizationVerifier(noir, config)({ ...snapshot, execution });
    assert.equal(proof.outerHash, attempt.outerHash); assert.equal(proof.nonce, '1'); assert.equal(proof.amountStroops, '300000');
    const [escrow, pending] = await Promise.all([noir.getEscrowBalance(ctx.deviceHash), noir.getPendingBalance(ctx.merchantPublicKey)]);
    assert.equal(escrow, 700000n); assert.equal(pending, 300000n);
    const run = (await local.pool.query('SELECT id,status,error_code,model_turns,tool_steps,reserved_stroops::text,spent_stroops::text,finished_at,final_answer FROM agent_run WHERE id=$1', [quote.runId])).rows[0];
    assert.equal(run.id, '8b0bd3bc-6276-40df-bfe3-3fbb2b9e5d20'); assert.equal(run.status, 'completed'); assert.equal(run.error_code, null);
    assert.equal(run.reserved_stroops, '0'); assert.equal(run.spent_stroops, '300000'); assert(run.final_answer?.length);
    const grant = (await local.pool.query('SELECT id,quote_id,resource_key,valid_until,first_delivered_at FROM entitlement WHERE quote_id=$1', [quote.id])).rows[0];
    assert(grant?.first_delivered_at && grant.valid_until > new Date());
    const events = (await local.pool.query('SELECT kind FROM run_event WHERE run_id=$1 ORDER BY id', [run.id])).rows.map(row => row.kind);
    assert(events.includes('resource_delivered') && events.includes('run_completed'));
    const login = await fetch(env.APP_ORIGIN + '/api/session', { method: 'POST', headers: { origin: env.APP_ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'owner', token: env.DEMO_OWNER_LOGIN_TOKEN }), signal: AbortSignal.timeout(10000) });
    const cookie = login.headers.get('set-cookie')?.split(';')[0], token = cookie?.slice(cookie.indexOf('=') + 1);
    if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) sessionHash = createHash('sha256').update(token).digest('hex');
    assert.equal(login.status, 204); assert(cookie && sessionHash);
    const metaResponse = await fetch(env.APP_ORIGIN + '/api/v1/receipts/' + grant.id, { headers: { cookie }, signal: AbortSignal.timeout(10000) });
    assert.equal(metaResponse.status, 200); const meta = await metaResponse.json();
    assert.equal(meta.receiptId, grant.id); assert.equal(meta.evidence.innerHash, proof.innerHash); assert.equal(meta.evidence.outerHash, proof.outerHash);
    const resourceResponse = await fetch(env.APP_ORIGIN + '/api/v1/receipts/' + grant.id + '/resource', { headers: { cookie }, signal: AbortSignal.timeout(10000) });
    assert.equal(resourceResponse.status, 200); const resource = await resourceResponse.json();
    assert.equal(resource.receiptId, grant.id); assert.equal(resource.resourceKey, quote.resourceKey); assert.equal(resource.isDemo, true); assert(resource.report.findings.length > 0);
    const denied = await fetch(env.APP_ORIGIN + '/api/v1/receipts/' + grant.id + '/resource', { signal: AbortSignal.timeout(10000) });
    assert.equal(denied.status, 401); await denied.body?.cancel();
    assert.equal((await local.pool.query('SELECT count(*)::int AS n FROM payment_attempt')).rows[0].n, 1);
    assert.equal((await local.pool.query('SELECT count(*)::int AS n FROM entitlement')).rows[0].n, 1);
    Object.assign(report, { runId: run.id, runStatus: run.status, completedAt: run.finished_at, modelTurns: run.model_turns, toolSteps: run.tool_steps,
      publicEventKinds: events, quoteId: quote.id, attemptId: attempt.id, operationId: attempt.operationId, reservationId: attempt.veloRequestId,
      innerHash: proof.innerHash, outerHash: proof.outerHash, observedEventTxHash: proof.observedEventTxHash, noirEventId: proof.noirEventId,
      ledger: proof.ledgerSequence, amountStroops: proof.amountStroops, nonce: proof.nonce, actualFeeStroops: proof.outerLedgerFeeStroops,
      veloActualFeeStroops: proof.veloActualFeeStroops, veloSuccessAndIndependentNoirProof: true, escrowStroops: escrow.toString(), merchantPendingStroops: pending.toString(),
      receiptId: grant.id, validUntil: grant.valid_until, firstDeliveredAt: grant.first_delivered_at, receiptHttpStatus: 200, reportHttpStatus: 200, anonymousReportStatus: 401,
      protectedReportContentSaved: false, receiptTokenSaved: false, attemptCount: 1, entitlementCount: 1 });
    passed = true;
  } catch { /* Fixed bounded result; no native/provider/token material. */ }
  finally {
    if (local) {
      try {
        if (sessionHash) {
          await local.pool.query('UPDATE session SET revoked_at=coalesce(revoked_at,clock_timestamp()) WHERE token_hash=$1', [sessionHash]);
          report.sessionRevoked = (await local.pool.query('SELECT count(*)::int AS n FROM session WHERE token_hash=$1 AND revoked_at IS NOT NULL', [sessionHash])).rows[0].n === 1;
        }
      } finally { await store?.close(); await local.pool.end(); }
    }
    report.status = passed && report.sessionRevoked ? 'passed' : 'failed'; report.completedAtCheck = new Date().toISOString();
    mkdirSync('docs/evidence/first-app-purchase-2026-11-14', { recursive: true });
    writeFileSync('docs/evidence/first-app-purchase-2026-11-14/verification.json', JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify(report)); if (report.status !== 'passed') process.exitCode = 1;
  }
}
