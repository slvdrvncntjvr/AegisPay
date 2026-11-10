// This helper is invoked only with exact newly-created-resource credentials in memory.
// It never loads any environment file, app module, payment adapter, or local database.
import pg from 'pg';
import { checkServerIdentity } from 'node:tls';

const allowedCodes = new Set([
  'ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN',
  'CERT_HAS_EXPIRED', 'CERT_NOT_YET_VALID', 'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'ERR_TLS_CERT_ALTNAME_INVALID',
  '28P01', '28000', '3D000', '53300', '57P03', '57014',
]);
const out = { outcome: 'failed', sql_statements: 0, tls_required: true, certificate_validation: true, hostname_validation: true };
let client;
try {
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' || process.env.PGSSLMODE === 'no-verify') throw new Error('UNSAFE_TLS_ENVIRONMENT');
  const u = new URL(process.env.AEGIS_STAGING_EXTERNAL_URL);
  const id = process.env.AEGIS_STAGING_EXPECTED_ID;
  if (u.protocol !== 'postgresql:' && u.protocol !== 'postgres:') throw new Error('INVALID_POSTGRES_PROTOCOL');
  if (!id || u.hostname.split('.')[0] !== id || !u.hostname.endsWith('.singapore-postgres.render.com')) throw new Error('RESOURCE_HOST_MISMATCH');
  const database = decodeURIComponent(u.pathname.slice(1));
  const user = decodeURIComponent(u.username);
  if (database !== process.env.AEGIS_STAGING_EXPECTED_DATABASE || user !== process.env.AEGIS_STAGING_EXPECTED_USER) throw new Error('DATABASE_IDENTITY_MISMATCH');
  if ((u.port && u.port !== '5432') || !u.password) throw new Error('INVALID_CONNECTION_PARAMETERS');
  // Parse fields explicitly: pg connection-string SSL parameters cannot replace this TLS config.
  client = new pg.Client({
    host: u.hostname, port: 5432, database, user, password: decodeURIComponent(u.password),
    application_name: 'aegispay-finals-staging-prerequisite',
    connectionTimeoutMillis: 10000, query_timeout: 7000, statement_timeout: 5000,
    options: '-c default_transaction_read_only=on',
    ssl: { rejectUnauthorized: true, servername: u.hostname, minVersion: 'TLSv1.2', checkServerIdentity },
  });
  client.on('error', () => {}); // No asynchronous error object is printed.
  await client.connect();
  const stream = client.connection.stream;
  if (!stream.encrypted || !stream.authorized || checkServerIdentity(u.hostname, stream.getPeerCertificate())) throw new Error('TLS_NOT_VERIFIED');
  out.tls_encrypted = true;
  out.tls_authorized = true;
  out.tls_protocol = stream.getProtocol();
  out.sql_statements++;
  const one = await client.query('SELECT 1 AS one');
  if (one.rows.length !== 1 || one.rows[0].one !== 1) throw new Error('SELECT_ONE_FAILED');
  out.select_one = 1;
  out.sql_statements++;
  const version = await client.query('SHOW server_version');
  const value = version.rows[0]?.server_version;
  if (typeof value !== 'string' || !/^17\.\d+(?:[ .(].*)?$/.test(value) || value.length > 150) throw new Error('POSTGRES_17_REQUIRED');
  // Only server-version syntax is retained; no arbitrary server response/error text.
  out.server_version = value;
  out.outcome = 'passed';
} catch (error) {
  const localCodes = new Set(['UNSAFE_TLS_ENVIRONMENT', 'INVALID_POSTGRES_PROTOCOL', 'RESOURCE_HOST_MISMATCH', 'DATABASE_IDENTITY_MISMATCH', 'INVALID_CONNECTION_PARAMETERS', 'TLS_NOT_VERIFIED', 'SELECT_ONE_FAILED', 'POSTGRES_17_REQUIRED']);
  out.safe_code = localCodes.has(error?.message) ? error.message : allowedCodes.has(error?.code) ? error.code : 'STAGING_CONNECTIVITY_FAILED';
} finally {
  if (client) await client.end().catch(() => {});
}
process.stdout.write(JSON.stringify(out) + '\n');
process.exitCode = out.outcome === 'passed' ? 0 : 1;
