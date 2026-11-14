// Pinned runtime entry. Build children receive sanitized env via reviewed build.mjs.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const role = process.argv[2];
if (process.argv.length !== 3 || !['web','worker'].includes(role) || process.env.AEGIS_RELEASE_ENABLED !== '1' ||
    !/^[a-f0-9]{40}$/.test(process.env.AEGIS_RELEASE_COMMIT ?? '') || process.env.RENDER_GIT_COMMIT !== process.env.AEGIS_RELEASE_COMMIT ||
    process.version !== 'v24.22.1' || !/^\d+$/.test(process.env.PORT ?? '')) {
  console.log(JSON.stringify({ status: 'failed', code: 'PINNED_DEMO_RUNTIME_REQUIRED' })); process.exitCode = 1;
} else {
  const args = role === 'web' ? [createRequire(import.meta.url).resolve('next/dist/bin/next'), 'start', '--hostname', '0.0.0.0', '--port', process.env.PORT] : ['--import','tsx','apps/server/src/index.ts'];
  const child = spawn(process.execPath, args, { cwd: role === 'web' ? resolve('apps/web') : process.cwd(), env: process.env, stdio: 'inherit' });
  child.once('error', () => { console.log(JSON.stringify({ code: 'DEMO_RUNTIME_START_FAILED' })); process.exitCode = 1; });
  for (const signal of ['SIGTERM','SIGINT']) process.once(signal, () => child.kill(signal));
  child.once('exit', code => { process.exitCode = code ?? 1; });
}
