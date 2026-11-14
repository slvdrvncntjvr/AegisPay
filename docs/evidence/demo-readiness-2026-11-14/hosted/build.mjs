// Reviewed host build only; no provider mutation or environment-file reads.
// Default is inert. Private service configuration never reaches install/Next.
import { spawnSync } from 'node:child_process';
const kind = process.argv[2];
if (process.argv.length !== 3 || !['web', 'worker'].includes(kind)) {
  console.log(JSON.stringify({ status: 'not_run', code: 'EXPLICIT_REVIEWED_HOST_SERVICE_REQUIRED' }));
  process.exitCode = 2;
} else {
  try {
    if (process.version !== 'v24.22.1' || process.env.AEGIS_RELEASE_ENABLED !== '1' ||
      !/^[a-f0-9]{40}$/.test(process.env.AEGIS_RELEASE_COMMIT ?? '') ||
      process.env.RENDER_GIT_COMMIT !== process.env.AEGIS_RELEASE_COMMIT) throw Error('HOST_SOURCE_FENCED');
    const clean = { NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' };
    for (const name of ['PATH', 'Path', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot']) {
      if (process.env[name]) clean[name] = process.env[name];
    }
    // All child arguments are fixed. No values from service secrets enter argv.
    const commands = [['pnpm', 'install', '--frozen-lockfile', '--prod=false']];
    if (kind === 'web') commands.push(['pnpm', 'build']);
    for (const args of commands) {
      const result = spawnSync(process.platform === 'win32' ? 'corepack.cmd' : 'corepack', args,
        { env: clean, stdio: 'inherit', windowsHide: true, shell: process.platform === 'win32' });
      if (result.status !== 0) throw Error('HOST_BUILD_FAILED');
    }
    if (kind === 'worker') {
      const result = spawnSync(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts', '--check'], { env: clean, stdio: 'inherit', windowsHide: true });
      if (result.status !== 0) throw Error('WORKER_IMPORT_CHECK_FAILED');
    }
    console.log(JSON.stringify({ status: 'passed', scope: 'sanitized-host-build-only', service: kind, commit: process.env.AEGIS_RELEASE_COMMIT, privateEnvironmentForwarded: false }));
  } catch {
    console.log(JSON.stringify({ status: 'failed', code: 'RELEASE_BUILD_FENCED_OR_FAILED' }));
    process.exitCode = 1;
  }
}
