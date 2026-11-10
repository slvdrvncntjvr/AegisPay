// Scoped local validation harness: no worker/app/private environment is inherited.
import { spawn } from 'node:child_process';
import { createWriteStream, appendFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
const folder = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const evidence = decodeURIComponent(folder);
const gates = {
  targeted: ['exec', 'vitest', 'run', 'tests/unit/model-run.test.ts', 'tests/integration/model-run.test.ts', 'tests/integration/run-events.test.ts'],
  integration: ['test:integration'], unit: ['test:unit'], spike: ['test:spike'], types: ['typecheck'], lint: ['lint'], build: ['build'],
  browser: ['exec', 'playwright', 'test', 'tests/e2e', '--workers=1', '--reporter=line', `--output=${resolve(evidence, 'playwright-output')}`],
};
const name = process.argv[2];
if (!Object.hasOwn(gates, name)) throw new Error('UNKNOWN_GATE');
const allowed = ['PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA', 'PROGRAMFILES', 'PROGRAMFILES(X86)', 'PROGRAMDATA', 'SYSTEMDRIVE', 'HOMEDRIVE', 'HOMEPATH'];
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => allowed.includes(key.toUpperCase())));
const pathKey = Object.keys(env).find(key => key.toUpperCase() === 'PATH');
env[pathKey ?? 'PATH'] = `${resolve('.fmd-work/pnpm-bin')};${env[pathKey] ?? ''}`;
Object.assign(env, { COREPACK_ENABLE_NETWORK: '0', COREPACK_ENABLE_DOWNLOAD_PROMPT: '0', PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1', NEXT_TELEMETRY_DISABLED: '1', UI_BASE_URL: 'http://127.0.0.1:3033', PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: resolve(env.LOCALAPPDATA ?? process.env.LOCALAPPDATA, 'ms-playwright/chromium-1248/chrome-win64/chrome.exe') });
const startedAt = new Date().toISOString();
const log = createWriteStream(resolve(evidence, `${name}.txt`), { flags: 'a' });
log.write(`\nSTART ${startedAt} corepack pnpm ${gates[name].join(' ')}\n`);
const child = spawn(process.execPath, [resolve(dirname(process.execPath), 'node_modules/corepack/dist/pnpm.js'), ...gates[name]], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
child.on('error', error => { log.write(String(error)); });
child.on('exit', (exit, signal) => {
  const record = { gate: name, command: `corepack pnpm ${gates[name].join(' ')}`, startedAt, finishedAt: new Date().toISOString(), exit, signal, environment: 'allowlisted OS only; no private env file or application env inherited', transport: 'synthetic/local only' };
  appendFileSync(resolve(evidence, 'gates.jsonl'), `${JSON.stringify(record)}\n`);
  log.end(`\nEXIT ${exit} SIGNAL ${signal}\n`); console.log(JSON.stringify(record)); process.exitCode = exit ?? 1;
});
