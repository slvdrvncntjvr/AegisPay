// Local presenter/notes check only: no app, credentials, network or financial tools.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';
import console from 'node:console';
const packagePath = resolve('node_modules/@playwright/test/package.json');
const pkg = JSON.parse(await readFile(packagePath, 'utf8'));
assert.equal(pkg.version, '1.65.0');
const { chromium, expect } = createRequire(packagePath)('@playwright/test');
const browser = await chromium.launch(process.env.DECK_BROWSER_EXECUTABLE ? { executablePath: process.env.DECK_BROWSER_EXECUTABLE } : {});
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [], externalRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    if (route.request().url().startsWith('file:')) return route.continue();
    externalRequests.push(route.request().url());
    return route.abort();
  });
  await page.goto(pathToFileURL(resolve('docs/submission/deck.html')).href);
  const notes = await page.locator('.notes p').allTextContents();
  const markdown = await readFile('docs/submission/pitch-deck.md', 'utf8');
  assert.equal(notes.length, 8);
  for (const note of notes) assert(markdown.includes(note), 'HTML / Markdown presenter notes differ');
  const seconds = await page.locator('.notes').evaluateAll(items => items.map(item => Number(item.dataset.seconds)));
  assert.equal(seconds.reduce((a, b) => a + b, 0), 300);
  await expect(page.locator('.notes').first()).toBeHidden();
  await page.keyboard.press('n');
  await expect(page.locator('.notes').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.notes').first()).toBeHidden();
  await page.locator('#qa-toggle').click();
  await expect(page.locator('#qa')).toBeVisible();
  await expect(page.locator('#qa')).toContainText('Yes: the Nov14 application run bought QuickSignal');
  await page.locator('#qa-close').click();
  await expect(page.locator('#qa')).toBeHidden();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => globalThis.scrollY)).toBeGreaterThan(500);
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => page.evaluate(() => globalThis.scrollY)).toBeLessThan(100);
  await page.locator('#notes-toggle').click();
  await page.locator('#qa-toggle').click();
  await page.emulateMedia({ media: 'print' });
  for (const locator of [page.locator('.notes').first(), page.locator('#qa'), page.locator('#notes-toggle')]) await expect(locator).toBeHidden();
  assert.deepEqual(errors, []);
  assert.deepEqual(externalRequests, []);
  const result = { status: 'passed', scope: 'local presenter controls and synchronized notes', playwright: pkg.version,
    browser: browser.version(), slides: 8, notesWords: notes.join(' ').split(/\s+/).length, scheduledSeconds: 300,
    controls: ['N', 'Escape', 'Q&A open/close', 'arrows', 'notes button', 'print exclusion'],
    pageErrors: errors, externalRequests, financialActions: 0 };
  await writeFile('docs/evidence/product-presentation-2026-11-18/presenter-validation.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
