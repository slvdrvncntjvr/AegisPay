// Starts only the prepared, confirmed, unprovisioned LOCAL wallet setup.
// No transaction, account funding, task or wallet API is invoked here.
import { openSync, closeSync, existsSync, writeFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import net from 'node:net';
import { OUT, privateEnv, publicContext, localCustody, isolatedEnvironment, writePrivate } from './context.mjs';

if (process.argv.length !== 3 || process.argv[2] !== '--start-confirmed-setup') {
  console.log(JSON.stringify({ status: 'not_run', code: 'EXPLICIT_LOCAL_SETUP_START_REQUIRED' }));
  process.exitCode = 2;
} else {
  let local;
  const children = [], descriptors = [];
  let stage = 'local-custody';
  try {
    local = await localCustody();
    const web = privateEnv('.env.release.web.local'), worker = privateEnv('.env.release.worker.local'), proposal = publicContext();
    if ([web, worker].some(env => env.DATABASE_URL !== local.custody.DATABASE_URL || env.APP_ORIGIN !== 'http://127.0.0.1:3019' ||
      env.DEMO_OWNER_PUBLIC_KEY !== proposal.ownerPublicKey || env.DEMO_MERCHANT_PUBLIC_KEY !== proposal.merchantPublicKey ||
      env.DEMO_AGENT_PUBLIC_KEY !== proposal.agentPublicKey || env.DEMO_DEVICE_HASH !== proposal.deviceHash || env.DEMO_ESCROW_FUNDING_CEILING_STROOPS !== '1000000') ||
      worker.RUN_TESTNET !== '0' || worker.PORT !== '3020' || worker.WORKER_HOST !== '127.0.0.1' ||
      web.WORKER_WAKE_URL !== 'http://127.0.0.1:3020/wake' || web.WORKER_WAKE_TOKEN !== worker.WORKER_WAKE_TOKEN ||
      ['AGENT_SECRET', 'GEMINI_API_KEY', 'VELO_GAS_API_KEY', 'ENVELOPE_ENCRYPTION_KEY'].some(name => web[name]) ||
      ['DEMO_OWNER_LOGIN_TOKEN', 'DEMO_MERCHANT_LOGIN_TOKEN'].some(name => worker[name])) throw Error('CONTEXT_OR_ENVIRONMENT_MISMATCH');
    if (readdirSync('apps/web').some(name => /^\.env(?:\.|$)/.test(name)) || !existsSync('apps/web/.next/BUILD_ID')) throw Error('PRODUCTION_BUILD_REQUIRED');
    const rows = (await local.pool.query('SELECT public_key,device_hash,status,last_nonce::text,policy_max_stroops::text FROM agent')).rows;
    if (rows.length !== 1 || rows[0].public_key !== proposal.agentPublicKey || rows[0].device_hash !== proposal.deviceHash ||
      rows[0].status !== 'unprovisioned' || rows[0].last_nonce !== '0' || rows[0].policy_max_stroops !== '0') throw Error('INITIAL_SETUP_ONLY');
    for (const table of ['agent_run','quote','payment_attempt','payment_evidence','entitlement','wallet_operation','merchant_claim','job']) {
      if (Number((await local.pool.query(`SELECT count(*)::int AS n FROM "${table}"`)).rows[0].n) !== 0) throw Error('EXISTING_EXECUTION_OBSERVE_ONLY');
    }
    for (const port of [3019, 3020]) await new Promise((done, reject) => {
      const server = net.createServer(); server.once('error', reject);
      server.listen(port, '127.0.0.1', () => server.close(error => error ? reject(error) : done()));
    });
    // Exclusive marker is never erased after an uncertain startup. Inspect its
    // exact saved processes before any future start or recovery.
    const marker = '.fmd-work/release-setup/processes.json';
    writePrivate(marker, JSON.stringify({ state: 'starting', recordedAt: new Date().toISOString() }) + '\n', true);
    stage = 'owned-process-start';
    const specs = [
      { role: 'web', cwd: resolve('apps/web'), env: web, args: [createRequire(import.meta.url).resolve('next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '3019'] },
      { role: 'worker', cwd: process.cwd(), env: worker, args: ['--import', 'tsx', 'apps/server/src/index.ts'] },
    ];
    for (const spec of specs) {
      const log = `.fmd-work/release-setup/${spec.role}.log`;
      writePrivate(log, '', true);
      const fd = openSync(log, 'a'); descriptors.push(fd);
      const child = spawn(process.execPath, spec.args, { cwd: spec.cwd, env: isolatedEnvironment(spec.env), detached: true,
        windowsHide: true, stdio: ['ignore', fd, fd] });
      await new Promise((done, reject) => { child.once('spawn', done); child.once('error', reject); });
      children.push(child); child.unref();
      writePrivate(marker, JSON.stringify({ state: 'starting', recordedAt: new Date().toISOString(), processes: children.map((process, index) => ({ pid: process.pid, role: specs[index].role, cwd: specs[index].cwd, args: specs[index].args })) }) + '\n');
    }
    for (const origin of ['http://127.0.0.1:3019/api/health', 'http://127.0.0.1:3020/health']) {
      let ready = false;
      for (let count = 0; count < 40; count++) {
        if (children.some(child => child.exitCode !== null || child.signalCode !== null)) throw Error('OWNED_PROCESS_EXITED');
        try { const response = await fetch(origin, { redirect: 'error', signal: AbortSignal.timeout(1000) }); ready = response.status === 200; await response.body?.cancel(); } catch { /* Local readiness only. */ }
        if (ready) break;
        await new Promise(done => setTimeout(done, 250));
      }
      if (!ready) throw Error('LOCAL_STARTUP_INCOMPLETE');
    }
    writePrivate(marker, JSON.stringify({ state: 'ready-for-human-wallet-setup', recordedAt: new Date().toISOString(), processes: children.map((process, index) => ({ pid: process.pid, role: specs[index].role, cwd: specs[index].cwd, args: specs[index].args })) }) + '\n');
    const result = { status: 'passed', scope: 'actual-loopback-wallet-setup-startup', observedAt: new Date().toISOString(), origin: web.APP_ORIGIN,
      ownerAndMerchant: 'user-confirmed-historical', policy: 'unprovisioned-zero', fundingLifetimeCeilingStroops: '1000000',
      persistentRunTestnet: '0', financialActions: 0, purchaseExecutionReady: false, processesLeftRunningForHuman: true,
      privateAccessFile: '.fmd-work/release-setup/access.md', fullLiveRelease: false };
    writeFileSync(OUT + '/setup-startup.json', JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result));
  } catch {
    // Only PIDs created by this invocation may be stopped on failed startup.
    for (const child of children) if (child.exitCode === null) child.kill();
    console.log(JSON.stringify({ status: 'failed', code: 'LOCAL_SETUP_START_INCOMPLETE', stage, financialActions: 0 }));
    process.exitCode = 1;
  } finally { for (const fd of descriptors) closeSync(fd); await local?.pool.end(); }
}
