import { defineConfig } from 'drizzle-kit';

// Generation only. Apply SQL exclusively through our locked, checksum-checked runner.
export default defineConfig({ dialect: 'postgresql', schema: './src/server/db/schema.ts', out: './src/server/db/migrations', strict: true });
