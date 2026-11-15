// Enable one authoritative hosted worker after verified history cutover.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { Pool } from 'pg';
import { serialize, writePrivate } from '../local-release/context.mjs';
import { api, DIR, read, save, receipt, owned, privateEnv, context } from './common.mjs';
const mode = process.argv[2];
if (process.argv.length !== 3 || !['--enable-hosted-worker','--observe-activation'].includes(mode)) {
  console.log(JSON.stringify({ status: 'not_run', code: 'EXPLICIT_HOSTED_ACTIVATION_REQUIRED' })); process.exitCode = 2;
} else {
  let pool;
  try {
    const { database } = context(), config = read(DIR + '/configured.json'), worker = await owned('worker');
    assert.equal(read(DIR + '/history-committed.json').databaseId, database.id);
    assert.equal(read(DIR + '/local-writers-retired.json').authoritativeDatabaseId, database.id);
    pool = new Pool({ connectionString: privateEnv('.env.release.hosted-database.local').DATABASE_URL, max: 1 });
    assert.equal((await pool.query('SELECT last_nonce::text FROM agent')).rows[0].last_nonce, '1');
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM job WHERE status<>'done'")).rows[0].n, 0);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM payment_attempt WHERE status='authorized' AND nonce=1")).rows[0].n, 1);
    const marker = DIR + '/activation-request.json';
    if (mode === '--enable-hosted-worker') {
      assert(!existsSync(marker));
      const env = privateEnv('.env.release.hosted-worker.local'); assert.equal(env.AEGIS_RELEASE_COMMIT, config.commit); assert.equal(env.RUN_TESTNET, '0');
      env.RUN_TESTNET = '1';
      save(marker, { serviceId: worker.id, sourceCommit: config.commit, requestedAt: new Date().toISOString(), activationMayOccur: true });
      await api('/services/' + worker.id + '/env-vars', 'PUT', Object.entries(env).map(([key,value])=>({key,value})));
      const observed = await api('/services/' + worker.id + '/env-vars?limit=100');
      assert(observed.some(row => (row.envVar??row).key === 'RUN_TESTNET' && (row.envVar??row).value === '1'));
      writePrivate('.env.release.hosted-worker.local', serialize(env));
      const deployed = await api('/services/' + worker.id + '/deploys','POST',{deployMode:'deploy_only'});
      save(DIR + '/activation-deploy.json',deployed);
    }
    const saved = read(DIR + '/activation-deploy.json');
    const deployed = await api('/services/' + worker.id + '/deploys/' + saved.id);
    assert.equal(deployed.commit.id,config.commit);
    const result={status:deployed.status,observedAt:new Date().toISOString(),scope:'single-authoritative-hosted-worker-activation',sourceCommit:config.commit,runTestnet:'1',sourceLocalRetired:true,newFinancialHandoffs:0};
    receipt('activation-'+Date.now(),result);console.log(JSON.stringify(result));
    if(['build_failed','update_failed','canceled'].includes(deployed.status))process.exitCode=1;
  }catch(error){console.log(JSON.stringify({status:'failed-or-uncertain',code:/^PROVIDER_HTTP_/.test(error?.message??'')?error.message:'OBSERVE_SAVED_ACTIVATION_REQUIRED'}));process.exitCode=1;}
  finally{await pool?.end();}
}
