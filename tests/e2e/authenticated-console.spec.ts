import { test, expect, type Page, type Route } from '@playwright/test';

// All identities, amounts, entitlement and report content below are controlled
// browser test transport. They never seed application SQL or live evidence.
const base = process.env.UI_BASE_URL ?? 'http://127.0.0.1:3017';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
test.use({ launchOptions: executablePath ? { executablePath } : {} });
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const hash = 'b'.repeat(64), outer = 'c'.repeat(64);
const wallet = 'G' + 'A'.repeat(55), asset = 'C' + 'B'.repeat(55);
const ceiling = '170141183460469231731687303715884105727';
const offer = { id: id(1), resourceKey: 'quick-signal:demo-parser:v1', description: 'Synthetic catalog metadata for browser transport tests.', priceStroops: '300000', enabled: true, isDemo: true };
const run = { id: id(2), task: 'SYNTHETIC_PRIVATE_OWNER_TASK', status: 'queued', finalAnswer: null, errorCode: null, reservedStroops: '300000', spentStroops: '0' };
const attempt = { attemptId: id(3), quoteId: id(4), operationId: id(5), status: 'unknown', innerHash: hash, outerHash: null, veloRequestId: 'synthetic-reservation-' + hash, veloStatus: 'unknown', errorCode: 'PAYMENT_STATUS_UNKNOWN', receiptId: null };
const owner = () => ({ role: 'owner', network: 'testnet', walletAddress: wallet, agent: { id: id(6), publicKey: wallet, deviceHash: hash, status: 'active', policyMaxStroops: '1000000', policyExpiresAt: '2020-01-01T00:00:00Z', policyObservedLedger: '1234', deviceContractId: asset, agentContractId: asset, escrowContractId: asset, assetContractId: asset }, offers: [offer], runs: [run], attempts: [attempt], walletOperations: [] });
const merchant = () => ({ role: 'merchant', network: 'testnet', walletAddress: wallet, offers: [offer], claims: [], walletOperations: [] });
const response = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
const unavailable = { error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Unavailable', correlationId: id(99) } };

async function transport(page: Page, handlers: (route: Route, path: string) => Promise<boolean>) {
  const unhandled: string[] = [], seen: { path: string; method: string; body: unknown; key: string | undefined }[] = [];
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    seen.push({ path: url.pathname, method: request.method(), body: request.postData() ? JSON.parse(request.postData()!) : null, key: request.headers()['idempotency-key'] });
    if (await handlers(route, url.pathname)) return;
    unhandled.push(`${request.method()} ${url.pathname}`);
    await route.abort('blockedbyclient');
  });
  return { seen, unhandled, assertHandled: () => expect(unhandled, 'No unhandled protected request may reach the real API').toEqual([]) };
}
async function ownerTransport(page: Page, extra: (route: Route, path: string) => Promise<boolean> = async () => false) {
  return transport(page, async (route, path) => {
    if (await extra(route,path)) return true;
    if (path === '/api/v1/state') { await response(route, owner()); return true; }
    if (path === `/api/v1/runs/${run.id}`) { await response(route, { ...run, runId: run.id }); return true; }
    if (path.endsWith('/events')) { await response(route, { events: [], nextCursor: null }); return true; }
    return false;
  });
}
async function stamp(page: Page) {
  await page.evaluate(() => { const badge = document.createElement('div'); badge.textContent = 'BROWSER TEST TRANSPORT · SYNTHETIC FIXTURES · NO LIVE PURCHASE'; badge.style.cssText = 'background:#763722;color:white;padding:8px 12px;font:bold 10px/1.5 Arial;text-align:center;pointer-events:none'; document.body.prepend(badge); });
}

test('401 redirects before private data and login safely clears tokens on non-JSON and successful responses', async ({ page }) => {
  let loggedIn = false, nonJson = true;
  const t = await transport(page, async (route,path) => {
    if (path === '/api/v1/state') { await response(route, loggedIn ? merchant() : { error: { code: 'AUTH_INVALID' } }, loggedIn ? 200 : 401); return true; }
    if (path === '/api/session') {
      if (nonJson) { nonJson = false; await route.fulfill({ status: 502, contentType: 'text/html', body: '<html>upstream stack must never render</html>' }); }
      else { loggedIn = true; await route.fulfill({ status: 204 }); }
      return true;
    }
    return false;
  });
  const html = await page.goto(base + '/app');
  expect(await html!.text()).not.toContain('SYNTHETIC_PRIVATE_OWNER_TASK');
  await expect(page).toHaveURL(/\/login\?expired=1$/);
  await expect(page.locator('.login-error')).toContainText('session expired');
  await page.getByRole('combobox', { name: 'Role', exact: true }).selectOption('merchant');
  await page.getByLabel('Demo access token').fill('synthetic-token-only');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('.login-error')).toContainText('Sign in unavailable');
  await expect(page.getByLabel('Demo access token')).toHaveValue('');
  await expect(page.locator('body')).not.toContainText('upstream stack');
  await page.getByLabel('Demo access token').fill('synthetic-token-only');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(base + '/app');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your terms. Your claim.');
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('synthetic-token-only');
  expect(t.seen.filter(r => r.path === '/api/session').map(r => r.body)).toEqual([{ role: 'merchant', token: 'synthetic-token-only' }, { role: 'merchant', token: 'synthetic-token-only' }]);
  t.assertHandled();
});

test('owner sees queued and unresolved states with original-identity GET observation only', async ({ page }) => {
  const t = await ownerTransport(page, async (route,path) => {
    if (path === `/api/v1/payment-attempts/${attempt.attemptId}`) { await response(route, { ...attempt, status: 'manual_review', errorCode: 'PAYMENT_EVIDENCE_CONTRADICTION' }); return true; }
    if (path.endsWith('/events')) { await response(route, { error: { code: 'NOT_FOUND' } }, 404); return true; }
    return false;
  });
  await page.goto(base + '/app');
  await expect(page.getByText('Queued · not executed', { exact: true })).toBeVisible();
  await expect(page.getByText(/Run trace unavailable:/)).toBeVisible();
  await expect(page.getByText(/No accepted quote snapshot returned/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save future price' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Final answer', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /pay again|retry payment|buy now/i })).toHaveCount(0);
  await page.getByRole('button', { name: 'Observe saved operation', exact: true }).click();
  await expect(page.getByText('Manual review', { exact: true })).toBeVisible();
  await expect(page.getByText('PAYMENT_EVIDENCE_CONTRADICTION', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /View receipt|Read entitled/ })).toHaveCount(0);
  expect(t.seen.every(r => r.method === 'GET')).toBe(true);
  expect(t.seen.some(r => r.path.includes('/receipts'))).toBe(false);
  t.assertHandled();
});

test('run creation recovers an ambiguous intent with one stable key and guards double activation', async ({ page }) => {
  let posts = 0;
  const empty = { ...owner(), runs: [], attempts: [] };
  const t = await transport(page, async (route,path) => {
    if (path === '/api/v1/state') { await response(route, empty); return true; }
    if (path === '/api/v1/runs') { posts++; await new Promise(resolve => setTimeout(resolve,150)); await response(route, posts === 1 ? unavailable : { runId: run.id, status: 'queued' }, posts === 1 ? 503 : 202); return true; }
    if (path === `/api/v1/runs/${run.id}`) { await response(route, { ...run, runId: run.id }); return true; }
    if (path.endsWith('/events')) { await response(route, { events: [], nextCursor: null }); return true; }
    return false;
  });
  await page.goto(base + '/app');
  await page.getByLabel('Task for the demo dependency').fill('Synthetic idempotent intent');
  await page.getByRole('button', { name: 'Start task', exact: true }).dblclick();
  await expect(page.getByRole('button', { name: 'Recover run request' })).toBeEnabled();
  expect(posts).toBe(1);
  await expect(page.getByLabel('Task for the demo dependency')).toBeDisabled();
  await page.getByRole('button', { name: 'Recover run request' }).click();
  await expect(page.getByText('Queued · not executed', { exact: true })).toBeVisible();
  const requests = t.seen.filter(r => r.path === '/api/v1/runs');
  expect(requests).toHaveLength(2);
  expect(requests[0]!.key).toMatch(/^[a-f0-9-]{36}$/);
  expect(requests[1]!.key).toBe(requests[0]!.key);
  expect(requests.map(r => r.body)).toEqual([{ task: 'Synthetic idempotent intent' }, { task: 'Synthetic idempotent intent' }]);
  expect(await page.evaluate(() => JSON.stringify({ ...sessionStorage }))).not.toContain('Synthetic idempotent intent');
  t.assertHandled();
});

// Recovery entries are unresolved transport intents, never a cache of old runs.
for (const terminalStatus of ['completed', 'failed']) {
  test(`acknowledged ${terminalStatus} task then reload and identical Start creates a fresh run/key`, async ({ page }) => {
    const saved = new Map<string, string>();
    let current: typeof run | null = null;
    let modelRevision = 1;
    const revisions = new Map<string, number>();
    const task = 'Synthetic repeated explicit task';
    const t = await transport(page, async (route, path) => {
      if (path === '/api/v1/state') { await response(route, { ...owner(), runs: current ? [current] : [], attempts: [] }); return true; }
      if (path === '/api/v1/runs') {
        const key = route.request().headers()['idempotency-key']!;
        if (revisions.has(key) && revisions.get(key) !== modelRevision) { await response(route, { error: { code: 'IDEMPOTENCY_CONFLICT' } }, 409); return true; }
        if (!saved.has(key)) { saved.set(key, id(30 + saved.size)); revisions.set(key, modelRevision); }
        const runId = saved.get(key)!;
        current = { ...run, id: runId, task, status: terminalStatus };
        await response(route, { runId, status: terminalStatus }, 202); return true;
      }
      if (path.startsWith('/api/v1/runs/') && !path.endsWith('/events')) { await response(route, { ...current, runId: current!.id }); return true; }
      if (path.endsWith('/events')) { await response(route, { events: [], nextCursor: null }); return true; }
      return false;
    });
    await page.goto(base + '/app');
    await page.getByLabel('Task for the demo dependency').fill(task);
    await page.getByRole('button', { name: 'Start task', exact: true }).dblclick();
    await expect(page.getByRole('button', { name: 'Run saved' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Compose a new task' })).toBeVisible();
    expect(t.seen.filter(r => r.path === '/api/v1/runs')).toHaveLength(1);
    expect(await page.evaluate(() => Object.keys(sessionStorage).filter(k => k.startsWith('aegis-run-intent:')))).toEqual([]);
    // Simulated operator model revision: a new explicit intent must not conflict
    // with a historical key. No actual provider configuration is changed.
    modelRevision++;
    await page.reload();
    await page.getByLabel('Task for the demo dependency').fill(task);
    await page.getByRole('button', { name: 'Start task', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Run saved' })).toBeDisabled();
    const requests = t.seen.filter(r => r.path === '/api/v1/runs');
    expect(requests).toHaveLength(2);
    expect(requests[1]!.key).not.toBe(requests[0]!.key);
    expect(saved.size).toBe(2);
    await expect(page.locator('.pc-run-observation')).toContainText(id(31));
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(task);
    t.assertHandled();
  });
}

test('lost acknowledgement then reload recovers the original key even with a saved active run', async ({ page }) => {
  const saved = new Map<string, string>();
  let posts = 0;
  const task = 'Synthetic ambiguous reload intent';
  const t = await transport(page, async (route, path) => {
    if (path === '/api/v1/state') { await response(route, { ...owner(), runs: saved.size ? [run] : [], attempts: [] }); return true; }
    if (path === '/api/v1/runs') {
      posts++;
      const key = route.request().headers()['idempotency-key']!;
      if (!saved.has(key)) saved.set(key, run.id);
      if (posts === 1) await route.abort('failed');
      else await response(route, { runId: saved.get(key), status: 'queued' }, 202);
      return true;
    }
    if (path === `/api/v1/runs/${run.id}`) { await response(route, { ...run, runId: run.id }); return true; }
    if (path.endsWith('/events')) { await response(route, { events: [], nextCursor: null }); return true; }
    return false;
  });
  await page.goto(base + '/app');
  await page.getByLabel('Task for the demo dependency').fill(task);
  await page.getByRole('button', { name: 'Start task', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Recover run request' })).toBeEnabled();
  const before = await page.evaluate(() => ({ ...sessionStorage }));
  expect(Object.keys(before)).toHaveLength(1); expect(JSON.stringify(before)).not.toContain(task);
  await page.reload();
  await page.getByLabel('Task for the demo dependency').fill(task);
  await expect(page.getByRole('button', { name: 'Recover run request' })).toBeEnabled();
  await page.getByRole('button', { name: 'Recover run request' }).dblclick();
  await expect(page.getByRole('button', { name: 'Run saved' })).toBeDisabled();
  const requests = t.seen.filter(r => r.path === '/api/v1/runs');
  expect(requests).toHaveLength(2); expect(requests[1]!.key).toBe(requests[0]!.key); expect(saved.size).toBe(1);
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(k => k.startsWith('aegis-run-intent:')))).toEqual([]);
  t.assertHandled();
});

test('authenticated trace displays only public untrusted choice commentary and precise unavailable states', async ({ page }) => {
  const choices = [
    { turn: 1, decision: 'tools_proposed', summaryStatus: 'provided', summary: "QuickSignal's brief coverage fits this task." },
    { turn: 2, decision: 'no_tool', summaryStatus: 'provided', summary: 'Neither report fits, so I will decline.' },
    { turn: 3, decision: 'tools_proposed', summaryStatus: 'missing', summary: null },
    { turn: 4, decision: 'no_tool', summaryStatus: 'withheld', summary: null },
  ];
  const t = await ownerTransport(page, async (route, path) => {
    if (path.endsWith('/events')) { await response(route, { events: choices.map((safePayload, i) => ({ id: String(i + 1), kind: 'model_choice', safePayload, createdAt: '2026-11-10T00:00:00Z' })), nextCursor: '4' }); return true; }
    return false;
  });
  for (const [width, height] of [[1280, 900], [390, 844]] as const) {
    await page.setViewportSize({ width, height }); await page.goto(base + '/app');
    await expect(page.locator('.pc-choice')).toHaveCount(4);
    await expect(page.locator('.pc-choice').nth(0)).toContainText("QuickSignal's brief coverage fits this task.");
    await expect(page.locator('.pc-choice').nth(1)).toContainText('Neither report fits, so I will decline.');
    await expect(page.locator('.pc-choice').nth(2)).toContainText('Public choice summary unavailable: the model supplied none.');
    await expect(page.locator('.pc-choice').nth(3)).toContainText('Public choice summary withheld by display rules.');
    await expect(page.locator('.pc-choice').first()).toContainText('Untrusted model commentary');
    await expect(page.locator('.pc-choice').first()).toContainText('Commentary is not financial authority or payment evidence.');
    expect(await page.locator('.pc-choice').locator('a,script,b').count()).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await stamp(page); await page.locator('#run').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/demo-readiness-captures/synthetic-choice-${width}.png`, fullPage: true });
  }
  expect(t.seen.every(r => r.method === 'GET')).toBe(true); t.assertHandled();
});

test('trusted accepted quote events keep original terms separate from a changed current offer', async ({ page }) => {
  const t = await ownerTransport(page, async (route,path) => {
    if (path === '/api/v1/state') { await response(route, { ...owner(), offers: [{ ...offer, priceStroops: '900000' }] }); return true; }
    if (path.endsWith('/events')) { await response(route, { events: [{ id: '1', kind: 'payment_accepted', createdAt: '2026-11-10T00:00:00Z', safePayload: { quoteId: attempt.quoteId, resourceKey: offer.resourceKey, amountStroops: '300000', assetContractId: asset, merchantAddress: wallet, expiresAt: '2026-11-10T00:02:00Z', attemptId: attempt.attemptId, operationId: attempt.operationId } }], nextCursor: '1' }); return true; }
    return false;
  });
  await page.goto(base + '/app');
  await expect(page.locator('.pc-offers')).toContainText('0.0900000 XLM');
  await expect(page.locator('.pc-quote')).toContainText('0.0300000 XLM');
  await expect(page.locator('.pc-quote')).not.toContainText('0.0900000 XLM');
  expect(t.seen.some(r => r.method !== 'GET')).toBe(false);
  t.assertHandled();
});

test('receipt metadata precedes a separately gated synthetic report and session expiry removes protected UI', async ({ page }) => {
  let resourceReads = 0;
  const receiptId = id(7);
  const t = await ownerTransport(page, async (route,path) => {
    if (path === `/api/v1/payment-attempts/${attempt.attemptId}`) { await response(route, { ...attempt, status: 'authorized', outerHash: outer, receiptId }); return true; }
    if (path === `/api/v1/receipts/${receiptId}`) { await response(route, { receiptId, quoteId: attempt.quoteId, resourceKey: offer.resourceKey, fixtureVersion: 'v1', validUntil: '2099-01-01T00:00:00Z', evidence: { innerHash: hash, outerHash: outer, observedEventTxHash: outer, noirEventId: 'synthetic-event-only', ledgerSequence: '777', nonce: '42', amountStroops: '300000', actualFeeStroops: null, feeProvenance: 'unavailable', merchantAddress: wallet, assetContractId: asset, evidenceDigest: hash }, aegisReceipt: 'SYNTHETIC_TOKEN_MUST_NOT_RENDER_OR_STORE' }); return true; }
    if (path.endsWith('/resource')) { resourceReads++; await response(route, resourceReads === 1 ? { isDemo: true, resourceKey: offer.resourceKey, receiptId, report: { title: 'Synthetic browser report', label: 'TEST TRANSPORT ONLY — no live purchase', findings: ['SYNTHETIC_REPORT_BODY_NOT_LIVE'] } } : { error: { code: 'AUTH_INVALID' } }, resourceReads === 1 ? 200 : 401); return true; }
    return false;
  });
  await page.goto(base + '/app');
  await expect(page.locator('body')).not.toContainText('SYNTHETIC_REPORT_BODY_NOT_LIVE');
  await page.getByRole('button', { name: 'Observe saved operation' }).click();
  await page.getByRole('button', { name: 'View receipt metadata' }).click();
  expect(resourceReads).toBe(0);
  await expect(page.locator('body')).not.toContainText('SYNTHETIC_TOKEN_MUST_NOT_RENDER_OR_STORE');
  await page.getByRole('button', { name: 'Read entitled demo report' }).click();
  await expect(page.getByText('SYNTHETIC_REPORT_BODY_NOT_LIVE')).toBeVisible();
  await stamp(page);
  await page.screenshot({ path: 'test-results/demo-readiness-captures/synthetic-receipt-desktop.png', fullPage: true });
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('SYNTHETIC_TOKEN');
  await page.getByRole('button', { name: 'Read entitled demo report' }).click();
  await expect(page).toHaveURL(/\/login\?expired=1$/);
  await expect(page.locator('body')).not.toContainText('SYNTHETIC_REPORT_BODY_NOT_LIVE');
  t.assertHandled();
});

test('expired entitlement refuses content without a second purchase and stale console disables mutations', async ({ page }) => {
  let stale = false;
  const receiptId = id(7);
  const t = await ownerTransport(page, async (route,path) => {
    if (path === '/api/v1/state' && stale) { await response(route, unavailable, 503); return true; }
    if (path === `/api/v1/payment-attempts/${attempt.attemptId}`) { await response(route, { ...attempt, status: 'authorized', receiptId }); return true; }
    if (path === `/api/v1/receipts/${receiptId}`) { await response(route, { receiptId, quoteId: attempt.quoteId, resourceKey: offer.resourceKey, fixtureVersion: 'v1', validUntil: '2099-01-01T00:00:00Z', evidence: {} }); return true; }
    if (path.endsWith('/resource')) { await response(route, { error: { code: 'ENTITLEMENT_EXPIRED' } },403); return true; }
    return false;
  });
  await page.goto(base + '/app');
  await page.getByRole('button', { name: 'Observe saved operation' }).click();
  await page.getByRole('button', { name: 'View receipt metadata' }).click();
  await page.getByRole('button', { name: 'Read entitled demo report' }).click();
  await expect(page.locator('.product-console').getByRole('alert')).toContainText('ENTITLEMENT_EXPIRED');
  await expect(page.locator('.pc-report')).toHaveCount(0);
  stale = true;
  await page.getByRole('button', { name: 'Refresh console state' }).click();
  await expect(page.getByText(/Stale snapshot/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Prepare register device' })).toBeDisabled();
  expect(t.seen.some(r => r.method !== 'GET')).toBe(false);
  t.assertHandled();
});

test('merchant edits exact integer future metadata and prepares a separate consent-bound claim', async ({ page }) => {
  let state = merchant();
  const t = await transport(page, async (route,path) => {
    if (path === '/api/v1/state') { await response(route, state); return true; }
    if (path === `/api/v1/merchant/resources/${offer.id}`) { state = { ...state, offers: [{ ...offer, priceStroops: ceiling }] }; await response(route,state.offers[0]); return true; }
    if (path === '/api/v1/wallet-state') { await response(route, { pendingStroops: ceiling, observedAt: '2026-11-10T00:00:00Z', observedLedger: 999, assetContractId: asset }); return true; }
    if (path === '/api/v1/wallet-operations') { await response(route, { operationId: id(8), unsignedXdr: 'SYNTHETIC_UNSIGNED_REVIEW_ONLY', networkPassphrase: 'Test SDF Network ; September 2015', signerAddress: wallet, expiresAt: '2099-01-01T00:00:00Z' },201); return true; }
    return false;
  });
  await page.goto(base + '/app');
  await expect(page.getByLabel('Task for the demo dependency')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Observe saved operation' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Merchant pending', exact: true })).toBeVisible();
  const price = page.getByLabel('Future price in integer stroops');
  await price.fill('1.5'); await expect(page.getByRole('button', { name: 'Save future price' })).toBeDisabled();
  await price.fill(ceiling); await page.getByRole('button', { name: 'Save future price' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Future offer metadata saved' })).toBeVisible();
  expect(t.seen.find(r => r.method === 'PATCH')!.body).toEqual({ priceStroops: ceiling, enabled: true });
  await page.getByRole('button', { name: 'Refresh chain observation' }).click();
  await expect(page.locator('.pc-balance')).toContainText('170141183460469231731687303715884105727 integer stroops');
  expect(t.seen.filter(r => r.method === 'POST')).toHaveLength(0);
  await page.getByRole('button', { name: 'Prepare claim merchant pending' }).click();
  await expect(page.getByRole('button', { name: 'Review & sign in Freighter' })).toBeDisabled();
  await expect(page.locator('body')).not.toContainText('SYNTHETIC_UNSIGNED_REVIEW_ONLY');
  await expect(page.getByText(/no merchant report preview/i)).toBeVisible();
  expect(t.seen.filter(r => r.method === 'POST').map(r => r.body)).toEqual([{ kind: 'claim' }]);
  await page.getByRole('checkbox', { name: /I reviewed this action/ }).check();
  await expect(page.getByRole('button', { name: 'Review & sign in Freighter' })).toBeEnabled();
  await stamp(page); await page.screenshot({ path: 'test-results/demo-readiness-captures/synthetic-merchant-desktop.png', fullPage: true });
  t.assertHandled();
});

test('owner wallet balances remain unknown until explicit observation and policy form enforces finite bounds', async ({ page }) => {
  const t = await ownerTransport(page, async (route,path) => {
    if (path === '/api/v1/wallet-state') { await response(route, unavailable,503); return true; }
    return false;
  });
  await page.goto(base + '/app');
  await expect(page.locator('.pc-balance')).toContainText('Unknown');
  expect(t.seen.some(r => r.path.includes('wallet-state') || r.method === 'POST')).toBe(false);
  await page.getByRole('button', { name: 'Refresh chain observation' }).click();
  await expect(page.locator('.product-console').getByRole('alert')).toContainText('Current chain observation unavailable');
  await page.getByLabel('Wallet action').selectOption('registerAgent');
  await page.getByLabel('Per-payment cap in integer stroops (max 1000000)', { exact: true }).fill('1000001');
  await expect(page.getByRole('button', { name: 'Prepare set finite policy' })).toBeDisabled();
  await page.getByLabel('Per-payment cap in integer stroops (max 1000000)', { exact: true }).fill('0');
  await expect(page.getByRole('button', { name: 'Prepare set finite policy' })).toBeDisabled();
  t.assertHandled();
});

test('identity mismatch never exposes a receipt and malformed state fails closed', async ({ page }) => {
  const t = await ownerTransport(page, async (route,path) => {
    if (path === `/api/v1/payment-attempts/${attempt.attemptId}`) { await response(route, { ...attempt, operationId: id(88), status: 'authorized', receiptId: id(7) }); return true; }
    return false;
  });
  await page.goto(base + '/app');
  await page.getByRole('button', { name: 'Observe saved operation' }).click();
  await expect(page.locator('.product-console').getByRole('alert')).toContainText('ATTEMPT_IDENTITY_MISMATCH');
  await expect(page.getByRole('button', { name: 'View receipt metadata' })).toHaveCount(0);
  await page.route('**/api/v1/state', route => response(route, { role: 'worker', network: 'testnet' }));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Console unavailable' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('INVALID_STATE_RESPONSE');
  t.assertHandled();
});

test('unresolved purchase blocks owner reclaim while original-identity observation stays available', async ({ page }) => {
  const t = await ownerTransport(page);
  await page.goto(base + '/app');
  await page.getByLabel('Wallet action').selectOption('sweepOnRevoke');
  await expect(page.getByRole('button', { name: 'Prepare reclaim after revocation' })).toBeDisabled();
  await expect(page.getByText(/An unresolved purchase blocks reclaim/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Observe saved operation', exact: true })).toBeEnabled();
  expect(t.seen.every(r => r.method === 'GET')).toBe(true); t.assertHandled();
});

test('saved unknown wallet handoff permits observation only and never opens another preparation', async ({ page }) => {
  const operation = { operationId: id(80), kind: 'revokeAgent', status: 'unknown', expiresAt: '2020-01-01T00:00:00Z', txHash: hash };
  const t = await ownerTransport(page, async (route, path) => {
    if (path === '/api/v1/state') { await response(route, { ...owner(), walletOperations: [operation] }); return true; }
    if (path === `/api/v1/wallet-operations/${operation.operationId}`) { await response(route, operation); return true; }
    return false;
  });
  await page.goto(base + '/app');
  await expect(page.getByRole('button', { name: 'Prepare register device' })).toBeDisabled();
  await page.getByText('Saved human wallet operations (1)').click();
  await page.getByRole('button', { name: 'Observe wallet operation' }).click();
  await expect(page.getByRole('button', { name: 'Prepare register device' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Review & sign in Freighter' })).toHaveCount(0);
  expect(t.seen.every(r => r.method === 'GET')).toBe(true); t.assertHandled();
});

test('console fits mobile and projector with long identities and supports visible keyboard focus', async ({ page }) => {
  const t = await ownerTransport(page, async (route,path) => {
    if (path === '/api/v1/state') { await response(route, { ...owner(), offers: [{ ...offer, priceStroops: ceiling }], attempts: [attempt, { ...attempt, attemptId: id(88), status: 'manual_review', errorCode: 'PAYMENT_EVIDENCE_CONTRADICTION' }] }); return true; }
    return false;
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [width,height] of [[320,740],[390,844],[768,1024],[1280,720],[1440,1000]] as const) {
    await page.setViewportSize({ width,height }); await page.goto(base + '/app');
    await expect(page.getByText('Manual review', { exact: true })).toBeVisible();
    await page.locator('summary').filter({ hasText: 'Payment identities' }).first().click();
    await page.locator('summary').filter({ hasText: 'Configured policy snapshot' }).click();
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(() => Array.from(document.querySelectorAll('.product-console *')).filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0,10).map(el => ({ tag: el.tagName, className: el.className, right: el.getBoundingClientRect().right })));
    expect(overflow, `${width}px overflowing elements`).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px document overflow`).toBe(true);
    if (width === 320 || width === 1280) { await stamp(page); await page.screenshot({ path: `test-results/demo-readiness-captures/synthetic-owner-${width}.png`, fullPage: true }); }
  }
  await page.keyboard.press('Control+Home'); await page.keyboard.press('Tab');
  await page.getByRole('link', { name: 'Policy', exact: true }).focus();
  expect(await page.getByRole('link', { name: 'Policy', exact: true }).evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
  await page.keyboard.press('Tab'); await expect(page.getByRole('link', { name: 'Run', exact: true })).toBeFocused();
  await page.keyboard.press('Enter'); expect(new URL(page.url()).hash).toBe('#run');
  expect(await page.locator('.pc-button').first().evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
  t.assertHandled();
});
