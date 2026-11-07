/* global process, console, document, getComputedStyle */
// Export only local deck content. No app, provider, environment-file or payment access.
// Requires existing pinned @playwright/test 1.65.0; never installs dependencies.
// If absent locally, set PLAYWRIGHT_PACKAGE_PATH to an existing package.json.
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packagePath = process.env.PLAYWRIGHT_PACKAGE_PATH
  ? resolve(process.env.PLAYWRIGHT_PACKAGE_PATH)
  : resolve(root, 'node_modules/@playwright/test/package.json');
const pkg = JSON.parse(await readFile(packagePath, 'utf8'));
if (pkg.name !== '@playwright/test' || pkg.version !== '1.65.0') throw new Error('Requires exact @playwright/test 1.65.0');
const { chromium } = createRequire(packagePath)('@playwright/test');
const browser = await chromium.launch(process.env.DECK_BROWSER_EXECUTABLE
  ? { executablePath: process.env.DECK_BROWSER_EXECUTABLE }
  : {});
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  // The deck is self-contained. Prevent accidental external subresource requests.
  await page.route('**/*', route => route.request().url().startsWith('file:') ? route.continue() : route.abort());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(resolve(root, 'docs/submission/deck.html')).href);
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ media: 'print' });
  const layout = await page.evaluate(() => [...document.querySelectorAll('.slide')].map((slide, index) => {
    const box = slide.getBoundingClientRect();
    const footer = slide.querySelector('.footer').getBoundingClientRect();
    const violations = [];
    for (const el of slide.querySelectorAll('*')) {
      if (el.closest('.notes') || getComputedStyle(el).display === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.left < box.left - 1 || r.right > box.right + 1 || r.top < box.top - 1 || r.bottom > box.bottom + 1) violations.push(`outside: ${el.tagName} ${el.textContent.slice(0, 50)}`);
      if (!el.closest('.footer') && !el.matches('svg,svg *,.brand-mark') && r.bottom > footer.top - 5) violations.push(`footer overlap: ${el.tagName} ${el.textContent.slice(0, 50)}`);
    }
    return { page: index + 1, width: box.width, height: box.height, violations };
  }));
  if (layout.length !== 8 || layout.some(s => s.violations.length || s.width !== 1280 || s.height !== 720) || errors.length) throw new Error(JSON.stringify({ layout, errors }, null, 2));
  const links = await page.locator('main a').evaluateAll(anchors => anchors.map(a => ({ text: a.textContent, href: a.href })));
  if (links.some(link => !link.href.startsWith('https://'))) throw new Error('All PDF links must be external HTTPS');
  const out = resolve(root, 'docs/submission/AegisPay-pitch-draft.pdf');
  await page.pdf({ path: out, preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false, tagged: true });
  const validation = { browser: browser.version(), playwright: pkg.version, slides: layout, links, pageErrors: errors };
  if (process.env.DECK_CHECK_DIR) {
    const checkDir = resolve(process.env.DECK_CHECK_DIR);
    await mkdir(checkDir, { recursive: true });
    await writeFile(resolve(checkDir, 'html-layout.json'), JSON.stringify(validation, null, 2));
  }
  console.log(JSON.stringify({ pdf: out, browser: validation.browser, playwright: pkg.version, slides: layout.length, layoutViolations: layout.flatMap(s => s.violations), externalLinks: links.length, pageErrors: errors }, null, 2));
} finally { await browser.close(); }
