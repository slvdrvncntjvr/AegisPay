// One authenticated future-offer edit; preserve paid terms and all financial state.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { localCustody, privateEnv, publicContext, writePrivate } from './context.mjs';

if (process.argv.length !== 3 || process.argv[2] !== '--set-next-quicksignal-400000') {
  console.log(JSON.stringify({ status: 'not_run', code: 'EXPLICIT_FUTURE_PRICE_CHANGE_REQUIRED' })); process.exitCode = 2;
} else {
  let local, sessionHash; let passed = false;
  const report = { scope: 'actual-merchant-future-price-change-no-purchase', observedAt: new Date().toISOString(), newRuns: 0, newQuotes: 0, newPaymentHandoffs: 0, fullLiveRelease: false };
  try {
    local = await localCustody(); const env = privateEnv('.env.release.web.local'), ctx = publicContext();
    assert.equal(env.DATABASE_URL, local.custody.DATABASE_URL); assert.equal(env.APP_ORIGIN, 'http://127.0.0.1:3019');
    const fingerprint = async () => {
      const snapshot = {};
      for (const table of ['agent_run','quote','payment_attempt','payment_evidence','entitlement','merchant_claim','wallet_operation']) {
        // Private memory only: hash comparison avoids exporting task/report/token columns.
        const rows = (await local.pool.query(`SELECT to_jsonb(t) AS row FROM "${table}" t ORDER BY id`)).rows;
        snapshot[table] = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
      }
      return snapshot;
    };
    assert.equal((await local.pool.query("SELECT count(*)::int AS n FROM agent_run WHERE status NOT IN ('completed','failed')")).rows[0].n, 0);
    assert.equal((await local.pool.query("SELECT count(*)::int AS n FROM merchant_claim WHERE status='confirmed' AND observed_claim_amount_stroops=300000")).rows[0].n, 1);
    const before = await fingerprint();
    const quote = (await local.pool.query('SELECT id,amount_stroops::text,terms_hash FROM quote WHERE id=$1', ['9be17111-16aa-4d75-9c8f-98cee5aa3e2e'])).rows[0];
    assert.equal(quote?.amount_stroops, '300000');
    const login = await fetch(env.APP_ORIGIN + '/api/session', { method: 'POST', headers: { origin: env.APP_ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'merchant', token: env.DEMO_MERCHANT_LOGIN_TOKEN }), signal: AbortSignal.timeout(10000) });
    const cookie = login.headers.get('set-cookie')?.split(';')[0], token = cookie?.slice(cookie.indexOf('=') + 1);
    if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) sessionHash = createHash('sha256').update(token).digest('hex');
    assert.equal(login.status, 204); assert(cookie && sessionHash);
    const stateResponse = await fetch(env.APP_ORIGIN + '/api/v1/state', { headers: { cookie }, signal: AbortSignal.timeout(10000) });
    assert.equal(stateResponse.status, 200); const state = await stateResponse.json();
    assert.equal(state.role, 'merchant'); assert.equal(state.walletAddress, ctx.merchantPublicKey);
    const offer = state.offers.find(row => row.resourceKey === 'quick-signal:demo-parser:v1');
    assert.equal(offer?.priceStroops, '300000'); assert.equal(offer.enabled, true);
    const marker = '.fmd-work/release-setup/future-price-change.json'; assert(!existsSync(marker));
    writePrivate(marker, JSON.stringify({ state: 'request-may-be-sent', recordedAt: new Date().toISOString(), resourceId: offer.id, targetPriceStroops: '400000' }) + '\n', true);
    const changed = await fetch(env.APP_ORIGIN + '/api/v1/merchant/resources/' + offer.id, { method: 'PATCH',
      headers: { cookie, origin: env.APP_ORIGIN, 'content-type': 'application/json' }, body: JSON.stringify({ priceStroops: '400000' }), signal: AbortSignal.timeout(10000) });
    assert.equal(changed.status, 200); const updated = await changed.json(); assert.equal(updated.priceStroops, '400000');
    const afterResponse = await fetch(env.APP_ORIGIN + '/api/v1/state', { headers: { cookie }, signal: AbortSignal.timeout(10000) });
    assert.equal(afterResponse.status, 200); const afterState = await afterResponse.json();
    assert.equal(afterState.offers.find(row => row.id === offer.id)?.priceStroops, '400000');
    assert.deepEqual(await fingerprint(), before);
    Object.assign(report, { resourceKey: offer.resourceKey, beforePriceStroops: '300000', futurePriceStroops: '400000', pricePatchStatus: 200,
      authenticatedReadbackStatus: 200, paidQuoteId: quote.id, paidQuoteAmountStroops: quote.amount_stroops, paidTermsHash: quote.terms_hash,
      priorFinancialStateUnchanged: true, merchantClaimAlreadyConfirmed: true });
    writePrivate(marker, JSON.stringify({ state: 'confirmed', recordedAt: new Date().toISOString(), resourceId: offer.id, targetPriceStroops: '400000' }) + '\n');
    passed = true;
  } catch { /* No native/session/provider material in output. */ }
  finally {
    if (local) {
      try {
        if (sessionHash) {
          await local.pool.query('UPDATE session SET revoked_at=coalesce(revoked_at,clock_timestamp()) WHERE token_hash=$1', [sessionHash]);
          report.sessionRevoked = (await local.pool.query('SELECT count(*)::int AS n FROM session WHERE token_hash=$1 AND revoked_at IS NOT NULL', [sessionHash])).rows[0].n === 1;
        }
      } finally { await local.pool.end(); }
    }
    report.status = passed && report.sessionRevoked ? 'passed' : 'failed';
    mkdirSync('docs/evidence/merchant-claim-2026-11-14', { recursive: true });
    writeFileSync('docs/evidence/merchant-claim-2026-11-14/future-price.json', JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify(report)); if (report.status !== 'passed') process.exitCode = 1;
  }
}
