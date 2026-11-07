import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import type { Store } from './connection.ts';

const directory = new URL('./migrations/', import.meta.url);
export async function migrate(store: Store) {
  const client = await store.pool.connect();
  try {
    await client.query('BEGIN');
    // A transaction lock serializes every migration runner on this database/schema.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended(current_database() || $1, 0))', [store.schemaName]);
    await client.query('CREATE TABLE IF NOT EXISTS schema_migration (name text PRIMARY KEY, sha256 char(64) NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    const files = (await readdir(directory)).filter(f => /^\d{4}_[a-z0-9_]+\.sql$/.test(f)).sort();
    if (!files.length) throw new Error('MIGRATIONS_MISSING');
    const history = await client.query<{ name: string }>('SELECT name FROM schema_migration');
    if (history.rows.some(row => !files.includes(row.name))) throw new Error('UNKNOWN_APPLIED_MIGRATION');
    for (const name of files) {
      const contents = await readFile(new URL(name, directory), 'utf8');
      const digest = createHash('sha256').update(contents.replaceAll('\r\n', '\n')).digest('hex');
      const prior = await client.query<{ sha256: string }>('SELECT sha256 FROM schema_migration WHERE name = $1', [name]);
      if (prior.rows.length) {
        if (prior.rows[0]!.sha256 !== digest) throw new Error('MIGRATION_CHECKSUM_MISMATCH');
        continue;
      }
      // Drizzle emits explicit public FK targets; bind those static references to
      // the validated target schema for isolated integration runs as well.
      await client.query(contents.replaceAll('"public".', `"${store.schemaName}".`));
      await client.query('INSERT INTO schema_migration(name, sha256) VALUES ($1, $2)', [name, digest]);
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
