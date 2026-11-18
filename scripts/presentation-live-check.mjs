// Anonymous GET-only presentation checks; optional existing candidate bypass is memory/origin scoped.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { Buffer } from 'node:buffer';
import { URL } from 'node:url';
import process from 'node:process';
import console from 'node:console';
import { chromium, expect } from '@playwright/test';
import { vercel, PROJECT, OUT } from './presentation-provider.mjs';
const [mode, supplied] = process.argv.slice(2);
assert(['--candidate', '--proof-alias', '--app', '--local-proof'].includes(mode));
const base = mode === '--app' ? 'https://aegispay-finals-app.onrender.com' : mode === '--proof-alias' ? 'https://aegispay-live.vercel.app' : supplied;
const origin = new URL(base).origin;
assert(mode === '--local-proof' ? origin === 'http://127.0.0.1:3035' : mode === '--candidate' ? /^https:\/\/aegispay-live-[a-z0-9-]+\.vercel\.app$/.test(origin) : true);
const headers = {};
if (mode === '--candidate') {
  const project = await vercel('/v9/projects/' + PROJECT);
  const bypass = Object.entries(project.protectionBypass ?? {}).find(([, value]) => value.scope === 'automation-bypass');
  assert(bypass, 'EXISTING_SUPPORTED_AUTOMATION_BYPASS_REQUIRED');
  headers['x-vercel-protection-bypass'] = bypass[0];
}
const secretFiles = ['.env.deploy.local', '.env.release.hosted-web.local', '.env.release.hosted-worker.local'];
const secrets = secretFiles.flatMap(file => Object.entries(parseEnv(readFileSync(file, 'utf8')))
  .filter(([key, value]) => /SECRET|TOKEN|DATABASE_URL|API_KEY|ENCRYPTION_KEY|SIGNING_KEY/.test(key) && value.length > 16).map(([, value]) => value));
if (headers['x-vercel-protection-bypass']) secrets.push(headers['x-vercel-protection-bypass']);
function safe(text) {
  assert(!secrets.some(value => text.includes(value)), 'PUBLIC_CREDENTIAL_LEAK');
  assert(!/(?<![A-Z2-7])S[A-Z2-7]{55}(?![A-Z2-7])/.test(text), 'PUBLIC_SECRET_KEY');
  assert(!/AEGIS_PRIVATE_QUICKSIGNAL_V1|AEGIS_PRIVATE_DEEPTRACE_V1/.test(text), 'PRIVATE_FIXTURE_LEAK');
}
const checks = [], assets = new Set(), errors = [], nonGet = [], external = [];
async function get(path, expected = 200) {
  const response = await globalThis.fetch(origin + path, { headers, redirect: 'manual', signal: globalThis.AbortSignal.timeout(60000) });
  assert.equal(response.status, expected, path);
  const text = await response.text(); safe(text);
  checks.push({ path, status: response.status, bytes: Buffer.byteLength(text), sha256: createHash('sha256').update(text).digest('hex') });
  return text;
}
const home = await get('/');
assert(home.includes('Gemini bought QuickSignal') && home.includes('https://aegispay-finals-app.onrender.com/login'));
assert(!home.includes('Review the fictional <strong>fictional parser'));
const health = JSON.parse(await get('/api/health')); assert.equal(health.network, 'testnet');
const login = await get('/login', mode === '--app' ? 200 : 404);
if (mode === '--app') {
  assert(login.includes('Access token') && !login.includes('Demo access token'));
  await get('/api/v1/state', 401);
} else {
  await get('/app', 404); await get('/api/session', 404);
}
for (const html of mode === '--app' ? [home, login] : [home]) {
  for (const match of html.matchAll(/(?:src|href)="([^" ]+\.js(?:\?[^" ]*)?)"/g)) {
    const url = new URL(match[1].replaceAll('&amp;', '&'), origin);
    assert.equal(url.origin, origin); assert(url.pathname.startsWith('/_next/static/')); assets.add(url.pathname + url.search);
  }
}
assert(assets.size > 0 && assets.size < 60);
for (const path of assets) await get(path);
const browser = await chromium.launch({ executablePath: join(process.env.LOCALAPPDATA, 'ms-playwright/chromium-1248/chrome-win64/chrome.exe') });
const views = [];
try {
  const context = await browser.newContext();
  await context.route('**/*', route => {
    const request = route.request();
    if (request.method() !== 'GET') { nonGet.push(request.method()); return route.abort(); }
    if (new URL(request.url()).origin !== origin) { external.push(new URL(request.url()).origin); return route.abort(); }
    return route.continue({ headers: { ...request.headers(), ...headers } });
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  for (const [width, height] of [[1440, 1000], [390, 844], [320, 740]]) {
    await page.setViewportSize({ width, height });
    await page.goto(origin);
    await page.evaluate(() => globalThis.document.fonts.ready);
    await expect(page.locator('h1')).toHaveText(/Useful data/);
    assert(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth));
    for (const tab of ['Over-cap refusal', 'Recovery rule', 'Authorization']) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      assert(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth));
    }
    await expect(page.locator('.record-label')).toContainText('7 Nov 2026');
    const shot = OUT + '/publish-' + mode.slice(2) + '-' + width + '.png';
    await page.screenshot({ path: shot, fullPage: true });
    views.push({ width, height, screenshot: shot });
  }
  const links = await page.locator('a[href]').evaluateAll(items => items.map(item => item.getAttribute('href')));
  for (const hash of ['1d39c3e3d7f400475aa2686f173a943346c5870635731fbd62fa41f1f912fa7a', '6e898ad830e866f0831577849361739cea7ad03cfbfcee9febf0fc057633d381', '94cea8bb561576ab71d4419571b92bd2fe7d8eada1273ff16960a716160c9a18']) assert(links.includes('https://stellar.expert/explorer/testnet/tx/' + hash));
  if (mode === '--app') {
    await page.goto(origin + '/login');
    await expect(page.getByLabel('Access token')).toBeVisible();
    assert(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth));
    await page.screenshot({ path: OUT + '/publish-app-login.png', fullPage: true });
  }
  assert.deepEqual(errors, []); assert.deepEqual(nonGet, []); assert.deepEqual(external, []);
  const result = { observedAt: new Date().toISOString(), status: 'passed', mode, origin, checks, clientAssets: assets.size, views,
    pageErrors: errors, nonGetRequests: nonGet, externalRuntimeRequests: external, credentialsLeaked: false,
    applicationSessionsCreated: 0, financialHandoffs: 0 };
  writeFileSync(OUT + '/publish-' + mode.slice(2) + '-checks.json', JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: 'passed', mode, checks: checks.length, assets: assets.size, views: views.length, nonGetRequests: 0 }));
} finally { await browser.close(); }
