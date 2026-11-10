import { test, expect } from '@playwright/test';
import { PUBLIC_PROOF as proof } from '../../apps/web/src/lib/public-proof.js';

const base = process.env.UI_BASE_URL ?? 'http://127.0.0.1:3017';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
test.use({ launchOptions: executablePath ? { executablePath } : {} });

test('recorded proof exposes real amounts and refuses before submission without financial calls', async ({ page }) => {
  const mutations: string[] = [];
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) mutations.push(request.url()); });
  await page.goto(base);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await page.getByRole('link', { name: 'Explore the verified proof' }).click();
  await expect(page.locator('.amount')).toContainText('0.03');
  await expect(page.locator('.cap-label')).toContainText('0.10 XLM');
  await expect(page.locator('.policy-expiry')).toContainText('Historical policy expired');
  await expect(page.locator('.instrument-bottom')).toContainText('Not a completed autonomous model purchase');
  await page.getByRole('tab', { name: 'Over-cap refusal' }).click();
  await expect(page.locator('.amount')).toContainText('0.12');
  await expect(page.locator('.decision-title')).toHaveText('No payment submitted.');
  await page.getByRole('button', { name: 'Inspect Intent boundary' }).click();
  await expect(page.locator('.boundary-copy')).toContainText('0.12 Testnet XLM');
  await page.getByRole('button', { name: 'Inspect Velo boundary' }).click();
  await expect(page.locator('.boundary-copy')).toContainText('Nothing was signed, sponsored or submitted');
  await expect(page.getByRole('button', { name: 'Inspect Velo boundary' })).toBeFocused();
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Over-cap refusal' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'Inspect Velo boundary' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.boundary-copy')).toContainText('Nothing was signed, sponsored or submitted');
  expect(mutations).toEqual([]);
});

test('tabs support keyboard navigation and recovery never offers another payment', async ({ page }) => {
  await page.goto(base);
  await page.getByRole('tab', { name: 'Authorization', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Over-cap refusal' })).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Over-cap refusal' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Recovery rule' })).toBeFocused();
  await expect(page.locator('.trace-caption')).toContainText('not executed');
  await expect(page.locator('.decision-description')).toContainText('No recovery run is claimed');
  await page.getByRole('button', { name: 'Read recovery rule' }).click();
  await expect(page.locator('#recovery-detail')).toContainText('no live status observation');
  await expect(page.getByRole('button', { name: /pay again|retry payment|buy now/i })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Recovery rule' })).toHaveAttribute('aria-selected', 'true');
  expect(new URL(page.url()).searchParams.get('proof')).toBe('recovery');
  await page.goto(base);
  await expect(page.getByRole('tab', { name: 'Authorization', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.record-label')).toContainText('Recorded Testnet');
});

test('receipt opens from its action, maps hashes independently and announces clipboard results', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(base);
  await page.getByRole('link', { name: 'Inspect full receipt', exact: true }).click();
  await expect(page.locator('#receipt')).toHaveAttribute('open', '');
  await expect(page.getByRole('link', { name: 'Open Inner Noir authorization in explorer' })).toHaveAttribute('href', proof.txs.inner.url);
  await expect(page.getByRole('link', { name: 'Open Outer fee-bump and event transaction in explorer' })).toHaveAttribute('href', proof.txs.outer.url);
  await expect(page.getByRole('link', { name: 'Open Separate merchant claim in explorer' })).toHaveAttribute('href', proof.txs.claim.url);
  await page.getByRole('button', { name: 'Copy Inner Noir authorization', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Inner Noir authorization copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(proof.txs.inner.hash);
  await page.evaluate(() => { Object.defineProperty(navigator.clipboard, 'writeText', { value: () => Promise.reject(new Error('Denied')) }); });
  await page.getByRole('button', { name: 'Copy Separate merchant claim', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Copy unavailable' })).toBeVisible();
  await page.locator('.technical-details > summary').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('.receipt-facts')).toContainText('82496 stroops');
  await expect(page.locator('.receipt-facts')).toContainText('not a general cost');
});

test('public proof fits all requested viewports and reduced motion disables the trace animation', async ({ page }) => {
  for (const [width, height] of [[1440,1000],[1280,720],[768,1024],[390,844],[320,740]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto(base);
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 1280) expect(await page.locator('.instrument').evaluate(el => el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(height);
    for (const tab of await page.getByRole('tab').all()) expect((await tab.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    for (const name of ['Over-cap refusal', 'Recovery rule', 'Authorization']) {
      await page.getByRole('tab', { name, exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('tab', { name: 'Over-cap refusal' }).click();
  expect(await page.locator('.flow-active').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
});

test('private access preserves request contract and shows integration handoff instead of missing app route', async ({ page }) => {
  let accepted = false;
  const submitted: unknown[] = [];
  await page.route('**/api/session', async route => {
    submitted.push(route.request().postDataJSON());
    await route.fulfill({ status: accepted ? 201 : 403, contentType: 'application/json', body: JSON.stringify(accepted ? { ok: true } : { error: { message: 'Access token not accepted' } }) });
  });
  await page.goto(base + '/login');
  await page.getByRole('combobox', { name: 'Role', exact: true }).selectOption('merchant');
  await page.getByLabel('Demo access token').fill('synthetic-ui-test-token');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('.login-error')).toHaveText('Access token not accepted');
  accepted = true;
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Session established');
  await expect(page.getByRole('status')).toContainText('still awaiting integration');
  expect(new URL(page.url()).pathname).toBe('/login');
  expect(submitted).toEqual([{ role: 'merchant', token: 'synthetic-ui-test-token' }, { role: 'merchant', token: 'synthetic-ui-test-token' }]);
});
