// Exact saved human claim only. No preparation, signing, submission or DB write.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Address, Keypair, scValToNative } from '@stellar/stellar-sdk';
import { localCustody, privateEnv, publicContext } from './context.mjs';
import { createNoir, readTestnetConfig } from '../../../src/server/integrations/noir.ts';
import { inspectWalletOperation } from '../../../src/server/integrations/wallet-inspection.ts';

if (process.argv.length !== 3 || process.argv[2] !== '--verify-existing-claim') {
  console.log(JSON.stringify({ status: 'not_run', code: 'EXPLICIT_CLAIM_OBSERVATION_REQUIRED' })); process.exitCode = 2;
} else {
  let local;
  try {
    local = await localCustody(); const env = privateEnv('.env.release.web.local'), ctx = publicContext();
    assert.equal(env.DATABASE_URL, local.custody.DATABASE_URL);
    const id = '7eb577a1-1140-414e-bacf-3be735c02cf7';
    const hash = 'ccebd961e44e4b8550688a43d0e6938bb97385fade73bb47a2d7016407eb9a96';
    const [row] = (await local.pool.query(`SELECT w.actor_address,w.operation_kind,w.status,w.tx_hash,w.unsigned_body_hash,w.handoff_committed_at,
      c.id AS claim_id,c.status AS claim_status,c.observed_claim_amount_stroops::text AS amount,c.confirmed_at
      FROM wallet_operation w JOIN merchant_claim c ON c.wallet_operation_id=w.id WHERE w.id=$1`, [id])).rows;
    assert(row); assert.equal(row.actor_address, ctx.merchantPublicKey); assert.equal(row.operation_kind, 'claim');
    assert.equal(row.status, 'confirmed'); assert.equal(row.claim_status, 'confirmed'); assert.equal(row.amount, '300000');
    assert.equal(row.tx_hash, hash); assert.equal(row.unsigned_body_hash, hash); assert(row.handoff_committed_at && row.confirmed_at);
    const config = readTestnetConfig(env), noir = createNoir(config), chain = await noir.server.getTransaction(hash);
    assert.equal(chain.status, 'SUCCESS'); assert.equal(chain.txHash, hash); assert.equal(chain.feeBump, false);
    assert.equal(chain.resultXdr.result().switch().name, 'txSuccess');
    const tx = inspectWalletOperation(chain.envelopeXdr.toXDR('base64'), ctx.merchantPublicKey, { kind: 'claim', token: config.asset }, config, row.handoff_committed_at.getTime());
    assert.equal(tx.hash().toString('hex'), hash); assert.equal(tx.signatures.length, 1);
    const signer = Keypair.fromPublicKey(ctx.merchantPublicKey);
    assert(tx.signatures[0].hint().equals(signer.signatureHint())); assert(signer.verify(tx.hash(), tx.signatures[0].signature()));
    const events = chain.events.contractEventsXdr.flat().map(e => ({
      contract: e.contractId() ? Address.contract(Buffer.from(e.contractId())).toString() : null,
      topics: e.body().v0().topics().map(scValToNative), data: scValToNative(e.body().v0().data()),
    }));
    const claims = events.filter(e => e.contract === config.network.contracts.paymentEscrow && e.topics.length === 2 && e.topics[0] === 'claim' && e.topics[1] === ctx.merchantPublicKey);
    assert.equal(claims.length, 1); assert.equal(claims[0].data, 300000n);
    const transfers = events.filter(e => e.contract === config.asset && e.topics.length === 4 && e.topics[0] === 'transfer' && e.topics[1] === config.network.contracts.paymentEscrow && e.topics[2] === ctx.merchantPublicKey && e.topics[3] === 'native');
    assert.equal(transfers.length, 1); assert.equal(transfers[0].data, 300000n);
    const horizonResponse = await fetch('https://horizon-testnet.stellar.org/transactions/' + hash, { redirect: 'error', signal: AbortSignal.timeout(10000) });
    assert.equal(horizonResponse.status, 200); const horizon = await horizonResponse.json();
    assert.equal(horizon.hash, hash); assert.equal(horizon.successful, true); assert.equal(horizon.ledger, chain.ledger);
    assert.equal(String(horizon.fee_charged), chain.resultXdr.feeCharged().toString());
    const [pending, escrow] = await Promise.all([noir.getPendingBalance(ctx.merchantPublicKey), noir.getEscrowBalance(ctx.deviceHash)]);
    assert.equal(pending, 0n); assert.equal(escrow, 700000n);
    const counts = (await local.pool.query('SELECT (SELECT count(*)::int FROM merchant_claim) AS claims,(SELECT count(*)::int FROM payment_attempt) AS attempts,(SELECT count(*)::int FROM entitlement) AS entitlements')).rows[0];
    assert.deepEqual(counts, { claims: 1, attempts: 1, entitlements: 1 });
    const result = { status: 'passed', observedAt: new Date().toISOString(), scope: 'actual-existing-human-merchant-claim', walletOperationId: id,
      claimId: row.claim_id, transactionHash: hash, ledger: chain.ledger, includedAt: horizon.created_at, merchantPublicKey: ctx.merchantPublicKey,
      claimAmountStroops: '300000', nativeTransferStroops: '300000', actualFeeStroops: chain.resultXdr.feeCharged().toString(),
      exactEnvelopeInvocationSignatureVerified: true, matchingClaimAndNativeTransferEvents: true, rpcAndHorizonAgree: true,
      merchantPendingBeforeStroops: '300000', pendingBeforeSource: 'first-app-purchase verification receipt', merchantPendingNowStroops: '0', escrowNowStroops: '700000',
      counts, newPreparations: 0, newSignatures: 0, newSubmissions: 0, fullLiveRelease: false };
    mkdirSync('docs/evidence/merchant-claim-2026-11-14', { recursive: true });
    writeFileSync('docs/evidence/merchant-claim-2026-11-14/verification.json', JSON.stringify(result, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify(result));
  } catch { console.log(JSON.stringify({ status: 'failed', code: 'EXACT_CLAIM_VERIFICATION_INCOMPLETE', newSubmissions: 0 })); process.exitCode = 1; }
  finally { await local?.pool.end(); }
}
