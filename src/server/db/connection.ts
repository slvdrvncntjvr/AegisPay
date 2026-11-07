import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.ts';

export type Database = ReturnType<typeof databaseFor>;
function databaseFor(client: Pool | import('pg').PoolClient) { return drizzle(client, { schema }); }
export type Store = ReturnType<typeof createStore>;

export function createStore(connectionString: string, schemaName = 'public', max = 10) {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(schemaName)) throw new Error('INVALID_DB_SCHEMA');
  const pool = new Pool({ connectionString, max, options: `-c search_path=${schemaName},pg_catalog`, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000 });
  const db = databaseFor(pool);
  return {
    pool, db, schemaName,
    async transaction<T>(work: (db: Database) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SET LOCAL lock_timeout = '10s'");
        const result = await work(databaseFor(client));
        await client.query('COMMIT');
        return result;
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
    close: () => pool.end(),
  };
}

export function configuredStore(env: NodeJS.ProcessEnv = process.env) {
  if (!env.DATABASE_URL) throw new Error('MISSING_DATABASE_URL');
  return createStore(env.DATABASE_URL);
}
