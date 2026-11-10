// Local QA helper. Uses actual app source and the pinned installed Next CLI.
// Stop the owned preview before pnpm build; never stops another worker's server.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const mode = process.argv.includes('--production') ? 'start' : 'dev';
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), mode, 'apps/web', '--port', '3017', '--hostname', '127.0.0.1'], { stdio: 'inherit' });
child.on('exit', code => process.exit(code ?? 1));
