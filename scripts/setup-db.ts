import { setupLocalPostgres } from './db/local.ts';
try { await setupLocalPostgres(); }
catch (error) { console.error(error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : 'LOCAL_DB_SETUP_FAILED'); process.exitCode = 1; }
