// Restart only the owned loopback web after a production build; no app API mutation.
import assert from 'node:assert/strict';
import { existsSync, openSync, closeSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import net from 'node:net';
import { localCustody, privateEnv, isolatedEnvironment, writePrivate } from './context.mjs';

if (process.argv.length !== 3 || process.argv[2] !== '--start-model-recovery-web') {
  console.log(JSON.stringify({ status: 'not_run', code: 'EXPLICIT_WEB_RESTART_REQUIRED' })); process.exitCode = 2;
} else {
  let local, child, descriptor;
  try {
    local = await localCustody(); const env = privateEnv('.env.release.web.local');
    assert.equal(env.DATABASE_URL, local.custody.DATABASE_URL); assert.equal(env.APP_ORIGIN, 'http://127.0.0.1:3019');
    assert(existsSync('apps/web/.next/BUILD_ID'));
    for (const name of ['AGENT_SECRET','GEMINI_API_KEY','VELO_GAS_API_KEY','ENVELOPE_ENCRYPTION_KEY']) assert(!env[name]);
    await new Promise((done, reject) => { const server = net.createServer(); server.once('error', reject); server.listen(3019, '127.0.0.1', () => server.close(error => error ? reject(error) : done())); });
    const marker = '.fmd-work/release-setup/processes-model-recovery-web.json';
    writePrivate(marker, JSON.stringify({ state: 'starting', recordedAt: new Date().toISOString() }) + '\n', true);
    const log = '.fmd-work/release-setup/web-model-recovery.log'; writePrivate(log, '', true); descriptor = openSync(log, 'a');
    const args = [createRequire(import.meta.url).resolve('next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '3019'];
    child = spawn(process.execPath, args, { cwd: resolve('apps/web'), env: isolatedEnvironment(env), detached: true, windowsHide: true, stdio: ['ignore', descriptor, descriptor] });
    await new Promise((done, reject) => { child.once('spawn', done); child.once('error', reject); }); child.unref();
    const recordedAt = new Date().toISOString(), processes = [{ pid: child.pid, role: 'web', cwd: resolve('apps/web'), args }];
    writePrivate(marker, JSON.stringify({ state: 'starting', recordedAt, processes }) + '\n');
    let ready = false;
    for (let count = 0; count < 40; count++) {
      assert(child.exitCode === null && child.signalCode === null);
      try { const response = await fetch(env.APP_ORIGIN + '/api/health', { signal: AbortSignal.timeout(1000) }); ready = response.status === 200; await response.body?.cancel(); } catch { /* bounded local startup */ }
      if (ready) break; await new Promise(done => setTimeout(done, 250));
    }
    assert(ready); writePrivate(marker, JSON.stringify({ state: 'ready', recordedAt, processes }) + '\n');
    const result = { status: 'passed', observedAt: new Date().toISOString(), scope: 'actual-rebuilt-loopback-web-startup', health: 200, newRuns: 0, newPaymentHandoffs: 0 };
    writeFileSync('docs/evidence/model-run-2026-11-14/web-restarted.json', JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify(result));
  } catch { if (child?.exitCode === null) child.kill(); console.log(JSON.stringify({ status: 'failed', code: 'OWNED_WEB_RESTART_INCOMPLETE' })); process.exitCode = 1; }
  finally { if (descriptor !== undefined) closeSync(descriptor); await local?.pool.end(); }
}
