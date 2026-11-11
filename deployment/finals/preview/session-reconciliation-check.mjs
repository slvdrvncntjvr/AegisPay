/** Synthetic cookies and owned loopback HTTP only. No DB or provider access. */
import assert from 'node:assert/strict';
import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {readFile, mkdir} from 'node:fs/promises';
import {SessionTracking} from './session-tracking.mjs';
import {OriginalResponses} from './original-responses.mjs';
import {launchReviewedBrowser} from './browser.mjs';
import {exclusive, sha} from './common.mjs';

const output = 'docs/evidence/finals-preview/application-2026-11-11/session-reconciliation';
const report = {outcome: 'failed', scope: 'synthetic session identity reconciliation', cases: [], contexts: []};
const hashes = new Set();
const secrets = new Set();
class OmittedCookieHeaders extends SessionTracking {
  headers(attempt, status) {
    // Reproduce the observed path where paused response headers omit cookies.
    super.headers(attempt, status, []);
  }
}
const tracking = new OmittedCookieHeaders(hashes, secrets);
const server = http.createServer((request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  if (request.url === '/api/session' && request.method === 'POST') {
    response.setHeader('Set-Cookie', `aegispay_session=${randomBytes(32).toString('base64url')}; HttpOnly; SameSite=Strict; Path=/`);
    response.writeHead(204);
    response.end();
    return;
  }
  const page = '<!doctype html><link rel="icon" href="data:,"><p>Owned synthetic fixture</p>';
  response.writeHead(200, {'Content-Type': 'text/html', 'Content-Length': Buffer.byteLength(page)});
  response.end(page);
});
let browser;
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const launched = await launchReviewedBrowser();
  browser = launched.browser;
  report.browser = launched.identity;
  for (let index = 0; index < 2; index++) {
    const context = await browser.newContext({serviceWorkers: 'block'});
    const page = await context.newPage();
    const capture = new OriginalResponses(origin, () => {}, tracking, request => new URL(request.url).origin === origin);
    await capture.attach(context, page);
    try {
      await page.goto(origin);
      assert.equal(await page.evaluate(async () => (await fetch('/api/session', {method: 'POST'})).status), 204);
      await capture.drain();
      assert.equal(tracking.summary().uncertain_commits, 1);
      const cookie = (await context.cookies([origin])).find(value => value.name === 'aegispay_session');
      assert.ok(cookie?.httpOnly);
      capture.trackSessionCookie(cookie.value);
      assert.equal(tracking.summary().uncertain_commits, 0);
      assert.equal(hashes.size, index + 1);
      const summary = capture.summary();
      assert.equal(summary.missing_entities, 0);
      assert.equal(summary.exact_request_maps, true);
      report.contexts.push({requests: summary.requests, covered: summary.covered, uncertainty_resolved: true});
      const login = [...capture.records.values()].find(record => record.login);
      capture.records.set('synthetic-ambiguous-login', {...login});
      assert.throws(() => capture.trackSessionCookie(cookie.value), /AMBIGUOUS_BROWSER_LOGIN/);
      capture.records.delete('synthetic-ambiguous-login');
    } finally {
      await context.close();
      await capture.settleAfterClose();
    }
  }
  report.cases.push('two actual browser contexts resolve omitted login headers independently', 'ambiguous context login is rejected');
  const isolated = new SessionTracking(new Set(), new Set());
  const unknown = isolated.begin();
  assert.throws(() => isolated.browserCookie(unknown, 'A'.repeat(43)), /LOGIN_RESPONSE_REQUIRED/);
  assert.equal(isolated.summary().uncertain_commits, 1);
  report.cases.push('lost login response remains unresolved');
  const rejected = isolated.begin();
  isolated.headers(rejected, 403, []);
  assert.throws(() => isolated.browserCookie(rejected, 'A'.repeat(43)), /LOGIN_RESPONSE_REQUIRED/);
  report.cases.push('rejected login cannot acquire a cookie identity');
  const conflict = isolated.begin();
  isolated.headers(conflict, 204, [`aegispay_session=${'B'.repeat(43)}; Path=/`]);
  assert.throws(() => isolated.browserCookie(conflict, 'C'.repeat(43)), /CONFLICTING_LOGIN_IDENTITIES/);
  assert.equal(isolated.summary().conflicting_identities, 1);
  assert.equal(isolated.hashes.size, 2);
  assert.equal(isolated.summary().uncertain_commits, 2);
  report.cases.push('conflicting identities remain failed while both cleanup hashes are retained');
  assert.equal(tracking.summary().identities_from_headers, 0);
  assert.equal(tracking.summary().identities_from_browser_cookie_only, 2);
  report.cases.push('cookie-only evidence remains distinct from header evidence');
  report.outcome = 'passed';
} catch (error) {
  report.safe_failure = error.code === 'ERR_ASSERTION' ? 'REGRESSION_ASSERTION_FAILED' : 'REGRESSION_DEPENDENCY_FAILED';
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  report.helper_hashes = {};
  for (const name of ['session-reconciliation-check.mjs', 'session-tracking.mjs', 'original-responses.mjs', 'qualify.ts', 'qualify.mjs']) {
    report.helper_hashes[name] = sha(await readFile(`deployment/finals/preview/${name}`));
  }
  await mkdir(output, {recursive: true});
  await exclusive(`${output}/regression.json`, report);
  process.stdout.write(JSON.stringify({outcome: report.outcome, cases: report.cases.length, contexts: report.contexts.length}) + '\n');
  process.exitCode = report.outcome === 'passed' ? 0 : 1;
}
