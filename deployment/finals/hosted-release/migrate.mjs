// Checksum migrations only on the exact newly created empty hosted database.
// No actors, wallet operations, jobs, financial fixtures or existing DB writes.
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { checkServerIdentity } from 'node:tls';
import { createStore } from '../../../src/server/db/connection.ts';
import { migrate } from '../../../src/server/db/migrate.ts';
import { privateEnv, writePrivate } from '../local-release/context.mjs';
const marker = '.fmd-work/release-setup/hosted-migration-attempt.json';
const observe = process.argv[2] === '--observe-migrated-schema';
if (process.argv.length !== 3 || !['--migrate-exact-new-database', '--observe-migrated-schema'].includes(process.argv[2])) {
  console.log(JSON.stringify({ status: 'not_run', code: 'EXPLICIT_NEW_EMPTY_DATABASE_MIGRATION_REQUIRED' })); process.exitCode = 2;
} else {
  let store;
  const report = { observedAt: new Date().toISOString(), scope: 'exact-new-hosted-schema-only', actorsSeeded: false, financialRecordsSeeded: false, oldDatabasesChanged: false };
  try {
    if (observe ? !existsSync(marker) : existsSync(marker)) throw Error('PRIOR_MIGRATION_MUST_BE_RECONCILED');
    const saved = JSON.parse(readFileSync('.fmd-work/release-setup/database-create-response.json', 'utf8'));
    const url = new URL(privateEnv('.env.release.hosted-database.local').DATABASE_URL);
    if (createHash('sha256').update(saved.id).digest('hex') !== '78ef7162df9c523cab7d0fb7316b9e7a700271b83d0e4ec72d1ac8bd81bd6e7f' ||
      saved.name !== 'aegispay-finals-release' || saved.plan !== 'free' || url.hostname.split('.')[0] !== saved.id || !url.hostname.endsWith('.singapore-postgres.render.com') ||
      decodeURIComponent(url.pathname.slice(1)) !== saved.databaseName || decodeURIComponent(url.username) !== saved.databaseUser || url.searchParams.get('sslmode') !== 'verify-full') throw Error('EXACT_NEW_TLS_DATABASE_REQUIRED');
    store = createStore(url.href, 'public', 1);
    const client = await store.pool.connect();
    try {
      const stream = client.connection.stream;
      if (!stream.encrypted || !stream.authorized || checkServerIdentity(url.hostname, stream.getPeerCertificate())) throw Error('APPLICATION_POOL_TLS_NOT_VERIFIED');
      report.actualApplicationPoolTls = { authorized: true, hostnameVerified: true, protocol: stream.getProtocol() };
      if (!observe) {
        const tables = (await client.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")).rows[0].n;
        if (Number(tables) !== 0) throw Error('EMPTY_NEW_HOSTED_SCHEMA_REQUIRED');
        writePrivate(marker, JSON.stringify({ databaseId: saved.id, startedAt: new Date().toISOString(), emptyPublicTablesObserved: true }) + '\n', true);
      } else if (JSON.parse(readFileSync(marker, 'utf8')).databaseId !== saved.id) throw Error('SAVED_MIGRATION_TARGET_MISMATCH');
    } finally { client.release(); }
    if (!observe) await migrate(store);
    report.migrationExecutionsThisInvocation = observe ? 0 : 1;
    const history = (await store.pool.query('SELECT name,sha256 FROM schema_migration ORDER BY name')).rows;
    const expected = readdirSync('src/server/db/migrations').filter(name => /^\d{4}_[a-z0-9_]+\.sql$/.test(name)).sort().map(name => ({ name,
      sha256: createHash('sha256').update(readFileSync('src/server/db/migrations/' + name, 'utf8').replaceAll('\r\n','\n')).digest('hex') }));
    if (history.length !== 5 || JSON.stringify(history) !== JSON.stringify(expected)) throw Error('CANONICAL_MIGRATION_HISTORY_MISMATCH');
    const tables = (await store.pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'schema_migration' ORDER BY tablename")).rows;
    const counts = {};
    for (const { tablename } of tables) { if (!/^[a-z_]+$/.test(tablename)) throw Error('FIXED_SCHEMA_TABLE_REQUIRED'); counts[tablename] = Number((await store.pool.query(`SELECT count(*)::int AS n FROM "${tablename}"`)).rows[0].n); }
    const expectedTables = ['agent','agent_run','audit_event','auth_throttle','entitlement','job','merchant','merchant_claim','owner','payment_accept_key','payment_attempt','payment_evidence','quote','resource','run_event','session','wallet_operation'];
    if (JSON.stringify(tables.map(row => row.tablename)) !== JSON.stringify(expectedTables) || Object.values(counts).some(count => count !== 0)) throw Error('EMPTY_MIGRATED_APPLICATION_REQUIRED');
    Object.assign(report, { status: 'passed', migrationCount: history.length, migrations: history, counts, fullLiveRelease: false });
  } catch (error) { Object.assign(report, { status: 'not_completed_or_uncertain', code: /^[A-Z_0-9]+$/.test(error?.message ?? '') ? error.message : 'NEW_DATABASE_MIGRATION_INCOMPLETE' }); process.exitCode = 1; }
  finally { await store?.close(); writeFileSync('docs/evidence/hosted-release-2026-11-14/' + (observe ? 'database-schema-observation.json' : 'database-migrations.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify({ status: report.status, migrationCount: report.migrationCount ?? null, emptyApplicationTables: report.counts ? Object.keys(report.counts).length : null, actualTls: report.actualApplicationPoolTls ?? null, code: report.code ?? null })); }
}
