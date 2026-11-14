// Arm only the isolated, funded setup. This creates no run, quote or payment.
// Fresh purchase intent still comes from the owner submitting a task in /app.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, openSync, closeSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import net from 'node:net';
import { localCustody, privateEnv, publicContext, isolatedEnvironment, writePrivate } from './context.mjs';
import { createStore } from '../../../src/server/db/connection.ts';
import { createNoir } from '../../../src/server/integrations/noir.ts';
import { createWalletGateway } from '../../../src/server/integrations/wallet-gateway.ts';
import { assertNonceContinuity } from '../../../apps/server/src/worker/continuity.ts';
import { createLivePaymentAdapter } from '../../../apps/server/src/worker/live-adapter.ts';
import * as schema from '../../../src/server/db/schema.ts';

const phase = process.argv[2];
if (process.argv.length !== 3 || !['--preflight-funded-setup', '--arm-funded-worker'].includes(phase)) {
  console.log(JSON.stringify({ status: 'not_run', code: 'EXPLICIT_FUNDED_SETUP_PHASE_REQUIRED' })); process.exitCode = 2;
} else {
  let local, store, child, descriptor;
  let stage = 'custody';
  try {
    local = await localCustody();
    const env = privateEnv('.env.release.worker.local'), web = privateEnv('.env.release.web.local'), ctx = publicContext();
    assert.equal(env.DATABASE_URL, local.custody.DATABASE_URL); assert.equal(web.DATABASE_URL, env.DATABASE_URL);
    assert.equal(env.RUN_TESTNET, '0'); assert.equal(env.PORT, '3020'); assert.equal(env.WORKER_HOST, '127.0.0.1');
    assert.equal(env.APP_ORIGIN, 'http://127.0.0.1:3019'); assert.equal(web.WORKER_WAKE_URL, 'http://127.0.0.1:3020/wake');
    assert.equal(web.WORKER_WAKE_TOKEN, env.WORKER_WAKE_TOKEN);
    for (const [name, value] of [['DEMO_OWNER_PUBLIC_KEY', ctx.ownerPublicKey], ['DEMO_MERCHANT_PUBLIC_KEY', ctx.merchantPublicKey],
      ['DEMO_AGENT_PUBLIC_KEY', ctx.agentPublicKey], ['DEMO_DEVICE_HASH', ctx.deviceHash], ['DEMO_ESCROW_FUNDING_CEILING_STROOPS', '1000000']]) assert.equal(env[name], value);
    for (const name of ['DEMO_OWNER_LOGIN_TOKEN','DEMO_MERCHANT_LOGIN_TOKEN']) assert(!env[name]);
    stage = 'empty-execution-and-complete-setup';
    for (const table of ['agent_run','quote','payment_attempt','payment_evidence','entitlement','merchant_claim'])
      assert.equal((await local.pool.query(`SELECT count(*)::int AS n FROM "${table}"`)).rows[0].n, 0);
    const jobs = (await local.pool.query('SELECT kind,status FROM job')).rows;
    assert.equal(jobs.length, 3); assert(jobs.every(row => row.kind === 'wallet_observe' && row.status === 'done'));
    store = createStore(env.DATABASE_URL);
    const agents = await store.db.select().from(schema.agent);
    assert.equal(agents.length, 1); const agent = agents[0];
    assert.equal(agent.id, ctx.agentId); assert.equal(agent.status, 'active'); assert.equal(agent.lastNonce, '0');
    assert.equal(agent.policyMaxStroops, '1000000'); assert(agent.policyExpiresAt.getTime() > Date.now() + 300000);
    await assertNonceContinuity(store, agent);
    const rows = (await local.pool.query(`SELECT operation_kind,status,actor_address,tx_hash FROM wallet_operation WHERE handoff_committed_at IS NOT NULL ORDER BY created_at`)).rows;
    assert.deepEqual(rows.map(row => row.operation_kind), ['registerDevice','registerAgent','fundEscrow']);
    assert(rows.every(row => row.status === 'confirmed' && row.actor_address === ctx.ownerPublicKey));
    stage = 'independent-chain-readback';
    const gateway = await createWalletGateway(env), noir = createNoir(gateway.config);
    const [owner, key, policy, escrow, pending, token] = await Promise.all([noir.getDeviceOwner(ctx.deviceHash), noir.getDeviceAgent(ctx.deviceHash),
      noir.getPolicy(ctx.deviceHash), noir.getEscrowBalance(ctx.deviceHash), noir.getPendingBalance(ctx.merchantPublicKey), noir.getEscrowToken(ctx.deviceHash)]);
    assert.equal(owner, ctx.ownerPublicKey); assert.equal(key, ctx.agentPublicKey);
    assert.equal(policy?.agent, ctx.agentPublicKey); assert.equal(policy?.asset, gateway.config.asset);
    assert.equal(policy?.maxAmount, 1000000n); assert.equal(policy?.expiresAt?.getTime(), agent.policyExpiresAt.getTime());
    assert.equal(escrow, 1000000n); assert.equal(pending, 0n); assert.equal(token, gateway.config.asset);
    const inclusion = [];
    for (const row of rows) {
      const chain = await gateway.getTransaction(row.tx_hash);
      assert.equal(chain.status, 'SUCCESS'); assert.equal(chain.txHash, row.tx_hash); assert.equal(chain.resultXdr.result().switch().name, 'txSuccess');
      const response = await fetch('https://horizon-testnet.stellar.org/transactions/' + row.tx_hash, { redirect: 'error', signal: AbortSignal.timeout(20000) });
      assert.equal(response.status, 200); const horizon = await response.json();
      assert.equal(horizon.hash, row.tx_hash); assert.equal(horizon.successful, true); assert.equal(horizon.ledger, chain.ledger);
      inclusion.push({ kind: row.operation_kind, transactionHash: row.tx_hash, ledger: chain.ledger, includedAt: horizon.created_at });
    }
    // Constructing the adapter checks config/key/contracts only. Never invoke
    // prepare, sponsor or submit; normal future run jobs own those boundaries.
    await createLivePaymentAdapter({ ...env, RUN_TESTNET: '1' }, store);
    const report = { status: 'passed', phase, observedAt: new Date().toISOString(), scope: 'actual-independent-funded-local-setup',
      inclusion, policyMaxStroops: '1000000', policyExpiresAt: agent.policyExpiresAt.toISOString(), escrowStroops: escrow.toString(),
      merchantPendingStroops: pending.toString(), agentNonce: '0', executionTablesEmpty: true, setupJobsComplete: true,
      newRuns: 0, newQuotes: 0, newPaymentHandoffs: 0, fullLiveRelease: false };
    const out = 'docs/evidence/wallet-setup-2026-11-14'; mkdirSync(out, { recursive: true });
    if (phase === '--arm-funded-worker') {
      stage = 'exclusive-owned-worker-start';
      assert.equal((await local.pool.query('SELECT count(*)::int AS n FROM agent_run')).rows[0].n, 0);
      await new Promise((done, reject) => { const server = net.createServer(); server.once('error', reject); server.listen(3020, '127.0.0.1', () => server.close(error => error ? reject(error) : done())); });
      const marker = '.fmd-work/release-setup/processes-funded-worker.json', log = '.fmd-work/release-setup/worker-funded.log';
      assert(!existsSync(marker));
      writePrivate(marker, JSON.stringify({ state: 'starting', recordedAt: new Date().toISOString() }) + '\n', true);
      writePrivate(log, '', true); descriptor = openSync(log, 'a');
      const args = ['--import', 'tsx', 'apps/server/src/index.ts'];
      child = spawn(process.execPath, args, { cwd: process.cwd(), env: isolatedEnvironment({ ...env, RUN_TESTNET: '1' }), detached: true, windowsHide: true, stdio: ['ignore', descriptor, descriptor] });
      await new Promise((done, reject) => { child.once('spawn', done); child.once('error', reject); }); child.unref();
      const recordedAt = new Date().toISOString();
      const processes = [{ pid: child.pid, role: 'worker', cwd: resolve('.'), args }];
      writePrivate(marker, JSON.stringify({ state: 'starting', recordedAt, processes }) + '\n');
      let ready = false;
      for (let count = 0; count < 40; count++) {
        assert(child.exitCode === null && child.signalCode === null);
        try { const response = await fetch('http://127.0.0.1:3020/health', { signal: AbortSignal.timeout(1000) }); ready = response.status === 200; await response.body?.cancel(); } catch { /* bounded local readiness */ }
        if (ready) break; await new Promise(done => setTimeout(done, 250));
      }
      assert(ready);
      writePrivate(marker, JSON.stringify({ state: 'funded-worker-awaiting-human-task', recordedAt, processes, runtimeRunTestnet: '1', persistentRunTestnet: '0' }) + '\n');
      report.workerArmed = true; report.awaitingHumanTask = true;
    }
    writeFileSync(out + (phase === '--arm-funded-worker' ? '/worker-armed.json' : '/setup-preflight.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify(report));
  } catch {
    if (child && child.exitCode === null) child.kill();
    console.log(JSON.stringify({ status: 'failed', code: 'FUNDED_SETUP_NOT_READY', stage, newPaymentHandoffs: 0 })); process.exitCode = 1;
  } finally { if (descriptor !== undefined) closeSync(descriptor); await store?.close(); await local?.pool.end(); }
}
