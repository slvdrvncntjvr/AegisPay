// Real authenticated page and existing-operation status checks; no wallet signing.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { localCustody, privateEnv, publicContext } from './context.mjs';

if (process.argv.length !== 3 || process.argv[2] !== '--check-existing-registration') {
  console.log(JSON.stringify({ status: 'not_run', code: 'EXPLICIT_REGISTRATION_CHECK_REQUIRED' })); process.exitCode = 2;
} else {
  let local, browser, sessionHash;
  let passed = false;
  const checks = [];
  try {
    local = await localCustody();
    const env = privateEnv('.env.release.web.local'), context = publicContext();
    assert.equal(env.DATABASE_URL, local.custody.DATABASE_URL); assert.equal(env.APP_ORIGIN, 'http://127.0.0.1:3019');
    const counts = async () => {
      const result = {};
      for (const table of ['agent_run','quote','payment_attempt','payment_evidence','entitlement','merchant_claim','wallet_operation','job'])
        result[table] = (await local.pool.query(`SELECT count(*)::int AS n FROM "${table}"`)).rows[0].n;
      assert.equal(result.wallet_operation, 3); assert.equal(result.job, 1);
      for (const table of ['agent_run','quote','payment_attempt','payment_evidence','entitlement','merchant_claim']) assert.equal(result[table], 0);
      return result;
    };
    const before = await counts();
    const login = await fetch(env.APP_ORIGIN + '/api/session', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { origin: env.APP_ORIGIN, 'content-type': 'application/json' }, body: JSON.stringify({ role: 'owner', token: env.DEMO_OWNER_LOGIN_TOKEN }) });
    const cookie = login.headers.get('set-cookie')?.split(';')[0];
    const token = cookie?.slice(cookie.indexOf('=') + 1);
    if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) sessionHash = createHash('sha256').update(token).digest('hex');
    assert.equal(login.status, 204); assert(sessionHash && cookie); checks.push('actual-owner-login');
    const stateResponse = await fetch(env.APP_ORIGIN + '/api/v1/state', { headers: { cookie }, signal: AbortSignal.timeout(10000) });
    assert.equal(stateResponse.status, 200); const state = await stateResponse.json();
    assert.equal(state.walletAddress, context.ownerPublicKey);
    assert.equal(state.agent.publicKey, context.agentPublicKey); assert.equal(state.agent.status, 'unprovisioned');
    assert.equal(state.agent.policyMaxStroops, '0'); assert.equal(state.walletFundingCeilingStroops, '1000000');
    const id = '82cf8f8a-473f-4c3f-859b-a43d79e0d2b6';
    assert.equal(state.walletOperations.find(row => row.operationId === id)?.status, 'confirmed'); checks.push('actual-state-confirmed-registration-no-policy');
    browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/Vincent/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe' });
    const browserContext = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
    await browserContext.addCookies([{ name: cookie.slice(0, cookie.indexOf('=')), value: token, url: env.APP_ORIGIN, httpOnly: true, sameSite: 'Strict' }]);
    const page = await browserContext.newPage();
    await page.goto(env.APP_ORIGIN + '/app', { waitUntil: 'networkidle' });
    const registration = page.locator('.pc-wallet-op').filter({ hasText: id });
    await registration.getByText('Confirmed on chain', { exact: true }).waitFor(); checks.push('actual-browser-confirmed-badge');
    await registration.getByRole('button', { name: 'Check wallet status', exact: true }).click();
    await registration.getByText('Confirmed on chain', { exact: true }).waitFor(); checks.push('actual-existing-status-check-remains-confirmed');
    await page.getByRole('button', { name: 'Refresh chain observation', exact: true }).click();
    await page.getByText('No active policy observed', { exact: true }).waitFor(); checks.push('actual-chain-refresh-without-policy');
    await page.getByRole('region', { name: 'Saved human wallet operations' }).screenshot({ path: 'docs/evidence/wallet-inclusion-2026-11-14/registration-confirmed.png' });
    assert.deepEqual(await counts(), before); checks.push('no-new-wallet-payment-or-job');
    const logout = await fetch(env.APP_ORIGIN + '/api/session', { method: 'DELETE', headers: { cookie, origin: env.APP_ORIGIN }, signal: AbortSignal.timeout(10000) });
    assert.equal(logout.status, 204); checks.push('actual-owner-logout');
    passed = true;
  } catch { /* Fixed bounded result; never print private API/native errors. */ }
  finally {
    await browser?.close();
    let sessionRevoked = false;
    if (local) {
      try {
        if (sessionHash) {
          await local.pool.query('UPDATE session SET revoked_at=coalesce(revoked_at,clock_timestamp()) WHERE token_hash=$1', [sessionHash]);
          sessionRevoked = (await local.pool.query('SELECT count(*)::int AS n FROM session WHERE token_hash=$1 AND revoked_at IS NOT NULL', [sessionHash])).rows[0].n === 1;
        }
      } finally { await local.pool.end(); }
    }
    const result = { status: passed && sessionRevoked ? 'passed' : 'failed', observedAt: new Date().toISOString(), checks, sessionRevoked,
      scope: 'actual-authenticated-loopback-browser-existing-registration', newWalletPreparations: 0, newSubmissions: 0, fullLiveRelease: false };
    writeFileSync('docs/evidence/wallet-inclusion-2026-11-14/authenticated-readback.json', JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify(result)); if (result.status !== 'passed') process.exitCode = 1;
  }
}
