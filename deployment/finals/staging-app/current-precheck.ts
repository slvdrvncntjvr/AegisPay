/** One current exact-staging connection and natural login budget observation. */
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';
import https from 'node:https';
import { checkServerIdentity } from 'node:tls';
import { createStore } from '../../../src/server/db/connection.ts';
import { exclusive } from './evidence-terminal.ts';
import { FOLLOWUP } from './continuation.ts';

const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const env = parseEnv(await readFile('.env.staging.local', 'utf8'));
const url = new URL(env.DATABASE_URL!);
if (hash(env.RENDER_STAGING_POSTGRES_ID!) !== 'feaa345c7d4172d22feb6dd8c92794128061a2f357b2e5372c0739138b6f8f85' ||
    url.hostname !== env.RENDER_STAGING_POSTGRES_ID + '.singapore-postgres.render.com' ||
    url.pathname !== '/aegispay_finals_staging' || [...url.searchParams].length !== 1 || url.searchParams.get('sslmode') !== 'verify-full') throw Error('EXACT_CUSTODY_MISMATCH');
if (Object.keys(process.env).some(k => /^(https?_proxy|all_proxy|node_options|node_extra_ca_certs|node_tls_reject_unauthorized|pg.*)$/i.test(k))) throw Error('UNSAFE_ENV');
const safe = (e: any) => {
  if (['ETIMEDOUT','ECONNRESET','ECONNREFUSED','ENOTFOUND','EAI_AGAIN','ENETUNREACH','EHOSTUNREACH','ERR_TLS_CERT_ALTNAME_INVALID','UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','CERT_HAS_EXPIRED','28P01','28000','3D000','53300','57P03','57014','42601','42703','42P01','42501'].includes(e?.code)) return e.code;
  if (e?.message === 'Connection terminated unexpectedly' || e?.message === 'Connection terminated') return 'CONNECTION_TERMINATED';
  if (/timeout/i.test(String(e?.message))) return 'CONNECTION_TIMEOUT';
  return /^[A-Z_]+$/.test(e?.message) ? e.message : 'UNCLASSIFIED_DEPENDENCY_FAILURE';
};
const report: Record<string, any> = { started_at: new Date().toISOString(), outcome: 'failed', read_only: true, connection_attempts: 1, provider_mutations: 0, login_attempts: 0 };
const store = createStore(env.DATABASE_URL!, 'public', 1);
store.pool.on('error', () => {});
let stage = 'connect';
try {
  const client: any = await store.pool.connect();
  try {
    stage = 'tls';
    const stream = client.connection.stream;
    if (!stream.encrypted || !stream.authorized || checkServerIdentity(url.hostname, stream.getPeerCertificate()) ||
        checkServerIdentity('qualification.invalid', stream.getPeerCertificate())?.code !== 'ERR_TLS_CERT_ALTNAME_INVALID') throw Error('STRICT_TLS_FAILED');
    report.tls = { real_createStore: true, encrypted: true, authorized: true, hostname_verified: true, wrong_hostname_rejected: true, protocol: stream.getProtocol() };
    stage = 'clock-and-budget';
    await client.query('BEGIN READ ONLY');
    await client.query("SET LOCAL statement_timeout='5s'");
    const identity = (await client.query('SELECT current_database() AS db, current_user AS usr, current_schema() AS schema, clock_timestamp() AS now')).rows[0];
    if (identity.db !== decodeURIComponent(url.pathname.slice(1)) || identity.usr !== decodeURIComponent(url.username) || identity.schema !== 'public') throw Error('EXACT_DATABASE_IDENTITY_FAILED');
    const now = identity.now as Date;
    report.database_time = now.toISOString(); report.roles = {}; report.sufficient = true;
    for (const [role, key, limit, required] of [['owner','login:untrusted-proxy:owner',5,3],['merchant','login:untrusted-proxy:merchant',5,3],['global','login:global',50,6]] as const) {
      const row = (await client.query('SELECT attempts, expires_at FROM auth_throttle WHERE key_hash=$1', [hash(key)])).rows[0];
      const active = !!row && row.expires_at.getTime() > now.getTime();
      const remaining = active ? limit - row.attempts : limit;
      report.roles[role] = { attempts: row?.attempts ?? 0, window_active: active, expires_at: row?.expires_at?.toISOString() ?? null, remaining, required };
      if (remaining < required) report.sufficient = false;
    }
    await client.query('COMMIT');
    if (!report.sufficient) throw Error('REAL_LOGIN_THROTTLE_BUDGET_INSUFFICIENT');
    report.outcome = 'passed';
  } finally { client.release(); }
} catch (e) {
  report.failed_stage = stage; report.safe_code = safe(e);
  if (stage === 'connect') {
    try {
      const current = await new Promise<string>((resolve, reject) => {
        const q = https.get('https://api.ipify.org', { family: 4, timeout: 8000 }, r => {
          let body = ''; r.on('data', b => { body += b; if (body.length > 64) q.destroy(); });
          r.on('end', () => /^(?:\d{1,3}\.){3}\d{1,3}$/.test(body.trim()) ? resolve(body.trim()) : reject(Error('IP_SHAPE')));
        });
        q.on('error', reject); q.on('timeout', () => q.destroy(Error('IP_CHECK_TIMEOUT')));
      });
      const permit = JSON.parse(await readFile('.fmd-work/staging-ip-rotation-permit-2026-11-11.json', 'utf8'));
      report.current_client_matches_latest_rule = current === String(permit.newRule.cidrBlock).split('/')[0];
    } catch (ipError) { report.ip_check_safe_code = safe(ipError); }
  }
} finally { await store.close(); }
report.finished_at = new Date().toISOString();
await exclusive(FOLLOWUP + '/current-precheck.json', JSON.stringify(report, null, 2) + '\n');
process.stdout.write(JSON.stringify(report) + '\n');
process.exitCode = report.outcome === 'passed' ? 0 : 1;
