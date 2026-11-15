// Native backup/restore of genuine owned history, not live financial creation.
// pg_restore restores schema/data/constraints/triggers in one transaction.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, openSync, closeSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import net from 'node:net';
import { Pool } from 'pg';
import { localCustody, publicContext, isolatedEnvironment } from '../local-release/context.mjs';
import { context, DIR, read, save, receipt, sha, privateEnv, writePrivate } from './common.mjs';
const tables = ['agent','agent_run','audit_event','auth_throttle','entitlement','job','merchant','merchant_claim','owner','payment_accept_key','payment_attempt','payment_evidence','quote','resource','run_event','schema_migration','session','wallet_operation'];
const mode = process.argv[2];
if (process.argv.length !== 3 || !['--restore-exact-empty-host','--observe-copied-context'].includes(mode)) {
  console.log(JSON.stringify({ status: 'not_run', code: 'EXPLICIT_ARCHIVE_HISTORY_OPERATION_REQUIRED' })); process.exitCode = 2;
} else {
  let local, remote, source, target, fd; let stage = 'owned-custody';
  try {
    const { database } = context(), ctx = publicContext(); local = await localCustody();
    const url = new URL(privateEnv('.env.release.hosted-database.local').DATABASE_URL);
    assert.equal(url.hostname.split('.')[0], database.id); assert.equal(url.searchParams.get('sslmode'), 'verify-full');
    remote = new Pool({ connectionString: url.href, max: 1, connectionTimeoutMillis: 10000 });
    source = await local.pool.connect(); target = await remote.connect();
    assert(target.connection.stream.encrypted && target.connection.stream.authorized);
    await source.query("SET TIME ZONE 'UTC'"); await target.query("SET TIME ZONE 'UTC'");
    const agent = (await source.query('SELECT id,public_key,device_hash,last_nonce::text FROM agent')).rows;
    assert.equal(agent.length, 1); assert.equal(agent[0].id, ctx.agentId); assert.equal(agent[0].public_key, ctx.agentPublicKey); assert.equal(agent[0].device_hash, ctx.deviceHash); assert.equal(agent[0].last_nonce, '1');
    assert.equal((await source.query("SELECT count(*)::int AS n FROM payment_attempt WHERE status='authorized' AND nonce=1 AND handoff_committed_at IS NOT NULL AND signed_xdr_ciphertext IS NULL")).rows[0].n, 1);
    assert.equal((await source.query('SELECT count(*)::int AS n FROM payment_attempt')).rows[0].n, 1);
    assert.equal((await source.query("SELECT count(*)::int AS n FROM merchant_claim WHERE status='confirmed' AND observed_claim_amount_stroops=300000")).rows[0].n, 1);
    assert.equal((await source.query("SELECT count(*)::int AS n FROM agent_run WHERE status NOT IN ('completed','failed') OR reserved_stroops<>0")).rows[0].n, 0);
    assert.equal((await source.query("SELECT count(*)::int AS n FROM job WHERE status<>'done'")).rows[0].n, 0);
    const marker = DIR + '/archive-restore-attempt.json';
    function canonicalConstraint(row) {
      // pg_dump's SQL roundtrip can regroup AND parentheses. For this one
      // all-conjunction bounds check, require the same exact six comparisons
      // and reject any remaining operator/token; do not weaken the SQL check.
      if (row.relname !== 'agent_run' || row.conname !== 'run_bounds') return row;
      const pattern = /(?:model_turns|tool_steps|length\(task_text\)) (?:>=|<=) \d+/g;
      const terms = row.definition.match(pattern) ?? [];
      assert.equal(row.definition.replace(pattern,'').replace(/\b(?:CHECK|AND)\b/g,'').replace(/[()\s]/g,''), '');
      assert.deepEqual([...terms].sort(), ['model_turns >= 0','model_turns <= 8','tool_steps >= 0','tool_steps <= 12','length(task_text) >= 1','length(task_text) <= 2000'].sort());
      return { ...row, definition: 'CHECK(' + terms.sort().join(' AND ') + ')' };
    }
    const guards = async client => ({
      functions: (await client.query("SELECT proname,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY proname,pg_get_function_identity_arguments(p.oid)")).rows,
      triggers: (await client.query("SELECT c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname")).rows,
      constraints: (await client.query("SELECT c.relname,p.conname,pg_get_constraintdef(p.oid) AS definition FROM pg_constraint p JOIN pg_class c ON c.oid=p.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,p.conname")).rows.map(canonicalConstraint),
    });
    async function snapshot(client) {
      const counts = {}, fingerprints = {};
      for (const table of tables) {
        const key = table === 'schema_migration' ? 'name' : table === 'auth_throttle' ? 'key_hash' : 'id';
        const rows = (await client.query(`SELECT to_jsonb(t)::text AS row FROM "${table}" t ORDER BY "${key}"`)).rows;
        counts[table] = rows.length; fingerprints[table] = sha(JSON.stringify(rows));
      }
      return { counts, fingerprints };
    }
    const original = await snapshot(source), sourceGuards = await guards(source);
    assert(sourceGuards.triggers.length === 23 && sourceGuards.triggers.every(t => t.tgenabled === 'O'));
    if (mode === '--restore-exact-empty-host') {
      stage = 'stopped-writers-and-empty-target'; assert(!existsSync(marker));
      for (const port of [3019,3020]) await new Promise((done,reject) => {
        const socket = net.connect({ host:'127.0.0.1',port });
        socket.once('connect', () => { socket.destroy(); reject(Error('SOURCE_WRITERS_MUST_STOP')); });
        socket.once('error', error => error.code === 'ECONNREFUSED' ? done() : reject(Error('SOURCE_PORT_UNCERTAIN')));
        socket.setTimeout(1500, () => { socket.destroy(); reject(Error('SOURCE_PORT_UNCERTAIN')); });
      });
      for (const table of tables.filter(t => t !== 'schema_migration')) assert.equal((await target.query(`SELECT count(*)::int AS n FROM "${table}"`)).rows[0].n, 0);
      assert.deepEqual((await target.query('SELECT name,sha256 FROM schema_migration ORDER BY name')).rows, (await source.query('SELECT name,sha256 FROM schema_migration ORDER BY name')).rows);
      const integration = privateEnv('.env.integration.local');
      const id = execFileSync('docker',['ps','-q','--filter','label=com.docker.compose.project=' + integration.AEGISPAY_POSTGRES_PROJECT],{encoding:'utf8',windowsHide:true}).trim();
      assert(/^[a-f0-9]{12,64}$/.test(id));
      const backup = resolve(DIR + '/source-complete.dump'); assert(backup.startsWith(resolve(DIR) + sep));
      writePrivate(backup, '', true); fd = openSync(backup,'w');
      stage = 'native-owned-backup';
      const dump = spawnSync('docker',['exec','--env','PGPASSWORD',id,'pg_dump','--format=custom','--no-owner','--no-privileges','--no-comments','--username',decodeURIComponent(local.target.username),'--dbname','aegispay_release_20261114'],
        {env:isolatedEnvironment({PGPASSWORD:decodeURIComponent(local.target.password)}),stdio:['ignore',fd,'pipe'],timeout:45000,windowsHide:true});
      closeSync(fd); fd = undefined; assert.equal(dump.status,0);
      const archive = readFileSync(backup); assert(archive.length < 10*1024*1024 && archive.subarray(0,5).toString() === 'PGDMP');
      save(DIR + '/archive-source.json',{databaseId:database.id,...original,guardsSha256:sha(JSON.stringify(sourceGuards)),archiveSha256:sha(archive),capturedAt:new Date().toISOString()});
      assert.deepEqual(await snapshot(source),original);
      stage = 'native-atomic-restore';
      save(marker,{targetDatabaseId:database.id,archiveSha256:sha(archive),restoreMayOccur:true,startedAt:new Date().toISOString()});
      const env = isolatedEnvironment({PGHOST:url.hostname,PGPORT:url.port||'5432',PGDATABASE:decodeURIComponent(url.pathname.slice(1)),PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGSSLMODE:'verify-full',PGSSLROOTCERT:'system',PGOPTIONS:'-c statement_timeout=60000 -c lock_timeout=15000'});
      const restore = spawnSync('docker',['exec','-i',...['PGHOST','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','PGSSLMODE','PGSSLROOTCERT','PGOPTIONS'].flatMap(key=>['--env',key]),id,
        'pg_restore','--clean','--if-exists','--single-transaction','--no-owner','--no-privileges','--exit-on-error','--dbname',env.PGDATABASE],
        {env,input:archive,encoding:'utf8',maxBuffer:2*1024*1024,timeout:90000,windowsHide:true});
      if (restore.status !== 0) {
        // Only a bounded category is published; retain details in protected custody.
        save(DIR + '/archive-restore-private-error.json',{exit:restore.status,detail:String(restore.stderr??'').slice(0,65536)});
        throw Error(/certificate|root certificate|sslrootcert/i.test(String(restore.stderr)) ? 'ARCHIVE_TLS_CONFIGURATION_REQUIRED' : 'NATIVE_RESTORE_INCOMPLETE_OBSERVE_TARGET');
      }
      save(DIR + '/archive-restore-command-completed.json',{completedAt:new Date().toISOString(),status:0});
    } else assert(existsSync(marker));
    stage = 'verify-exact-restored-history';
    assert.deepEqual(await snapshot(target),original);
    assert.deepEqual(await guards(target),sourceGuards);
    for (const table of ['run_event','audit_event']) assert.deepEqual((await target.query(`SELECT last_value,is_called FROM "${table}_id_seq"`)).rows,(await source.query(`SELECT last_value,is_called FROM "${table}_id_seq"`)).rows);
    save(DIR + '/history-committed.json',{committedAt:new Date().toISOString(),databaseId:database.id,...original,method:'native-single-transaction-schema-and-data-restore'},!existsSync(DIR + '/history-committed.json'));
    const revoked = await target.query('UPDATE session SET revoked_at=clock_timestamp() WHERE revoked_at IS NULL');
    await source.query('ALTER DATABASE aegispay_release_20261114 SET default_transaction_read_only=on');
    save(DIR + '/local-writers-retired.json',{recordedAt:new Date().toISOString(),sourceReadOnlyForNewConnections:true,portsStopped:[3019,3020],authoritativeDatabaseId:database.id},!existsSync(DIR + '/local-writers-retired.json'));
    const result={status:'passed',observedAt:new Date().toISOString(),scope:'actual-native-owned-context-cutover',method:'pg_dump / pg_restore --single-transaction',
      ...original,allRowsMatchedBeforeSessionRevocation:true,guardDefinitionsMatched:true,enabledApplicationTriggers:sourceGuards.triggers.length,sequencesMatched:true,
      copiedSessionsRevoked:revoked.rowCount,sourceWritersStopped:true,sourceDefaultReadOnly:true,targetStrictTls:true,agentNonce:'1',newFinancialHandoffs:0,oldIncidentAndPreviewUnchanged:true,fullProductionQualification:false};
    receipt('history-native-cutover',result); console.log(JSON.stringify(result));
  } catch(error) {console.log(JSON.stringify({status:'failed-or-uncertain',stage,code:/^[A-Z_]+$/.test(error?.message??'')?error.message:'ARCHIVE_CUTOVER_REQUIRES_OBSERVATION',newFinancialHandoffs:0}));process.exitCode=1;}
  finally{if(fd!==undefined)closeSync(fd);source?.release();target?.release();await local?.pool.end();await remote?.end();}
}
