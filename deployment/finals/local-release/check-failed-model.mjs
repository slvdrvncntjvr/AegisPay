// Real page/read-only failed-run check; never click Start task or mutate a run.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { localCustody, privateEnv } from './context.mjs';

if (process.argv.length !== 3 || process.argv[2] !== '--check-failed-run') {
  console.log(JSON.stringify({ status: 'not_run', code: 'EXPLICIT_READ_ONLY_CHECK_REQUIRED' })); process.exitCode = 2;
} else {
  let local, browser, sessionHash; let passed = false;
  const result = { scope: 'actual-authenticated-failed-model-run-readback', checks: [], newRuns: 0, newPaymentHandoffs: 0, fullLiveRelease: false };
  try {
    local = await localCustody(); const env = privateEnv('.env.release.web.local');
    assert.equal(env.DATABASE_URL, local.custody.DATABASE_URL); assert.equal(env.APP_ORIGIN, 'http://127.0.0.1:3019');
    const login = await fetch(env.APP_ORIGIN + '/api/session', { method: 'POST', headers: { origin: env.APP_ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'owner', token: env.DEMO_OWNER_LOGIN_TOKEN }), signal: AbortSignal.timeout(10000) });
    const cookie = login.headers.get('set-cookie')?.split(';')[0], token = cookie?.slice(cookie.indexOf('=') + 1);
    if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) sessionHash = createHash('sha256').update(token).digest('hex');
    assert.equal(login.status, 204); assert(sessionHash && cookie); result.checks.push('actual-login');
    const before = (await local.pool.query('SELECT id,status,error_code,reserved_stroops::text,spent_stroops::text FROM agent_run')).rows;
    assert.equal(before.length, 1); assert.equal(before[0].id, '3c80396e-2575-4f9a-8e1f-76321c5c9542');
    assert.equal(before[0].status, 'failed'); assert.equal(before[0].error_code, 'MODEL_UNAVAILABLE');
    assert.equal(before[0].reserved_stroops, '0'); assert.equal(before[0].spent_stroops, '0');
    browser = await chromium.launch({ executablePath: 'C:/Users/Vincent/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe', headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
    await context.addCookies([{ name: cookie.slice(0, cookie.indexOf('=')), value: token, url: env.APP_ORIGIN, httpOnly: true, sameSite: 'Strict' }]);
    const page = await context.newPage(); await page.goto(env.APP_ORIGIN + '/app', { waitUntil: 'networkidle' });
    await page.locator('.pc-run-observation').getByText('Run stopped · MODEL_UNAVAILABLE', { exact: true }).waitFor(); result.checks.push('failed-run-preserved');
    assert.equal(await page.getByLabel('Saved run').locator('option:checked').textContent(), 'failed · ' + before[0].id); result.checks.push('saved-list-agrees-with-detail');
    assert.equal(await page.getByText('An active run is already saved. Observe it before starting a separate task.').count(), 0); result.checks.push('no-false-active-notice');
    await page.getByLabel('Task for the demo dependency').fill('Assess demo-parser using QuickSignal only. Buy its report once at 0.03 Testnet XLM, then summarize it. Do not buy DeepTrace or additional reports.');
    assert(await page.getByRole('button', { name: 'Start task', exact: true }).isEnabled()); result.checks.push('fresh-task-composer-enabled-not-submitted');
    await page.locator('#run').screenshot({ path: 'docs/evidence/model-run-2026-11-14/failed-run-preserved.png' });
    assert.deepEqual((await local.pool.query('SELECT id,status,error_code,reserved_stroops::text,spent_stroops::text FROM agent_run')).rows, before);
    for (const table of ['quote','payment_attempt','entitlement']) assert.equal((await local.pool.query(`SELECT count(*)::int AS n FROM "${table}"`)).rows[0].n, 0);
    result.checks.push('no-new-run-quote-payment-entitlement'); result.failedRun = before[0];
    passed = true;
  } catch { /* Fixed result only; no native/provider/session error output. */ }
  finally {
    await browser?.close();
    if (local) {
      try {
        if (sessionHash) {
          await local.pool.query('UPDATE session SET revoked_at=coalesce(revoked_at,clock_timestamp()) WHERE token_hash=$1', [sessionHash]);
          result.sessionRevoked = (await local.pool.query('SELECT count(*)::int AS n FROM session WHERE token_hash=$1 AND revoked_at IS NOT NULL', [sessionHash])).rows[0].n === 1;
        }
      } finally { await local.pool.end(); }
    }
    result.status = passed && result.sessionRevoked ? 'passed' : 'failed'; result.observedAt = new Date().toISOString();
    writeFileSync('docs/evidence/model-run-2026-11-14/actual-readback.json', JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify(result)); if (result.status !== 'passed') process.exitCode = 1;
  }
}
