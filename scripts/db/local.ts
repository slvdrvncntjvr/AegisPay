import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import net from 'node:net';
import { parseEnv } from 'node:util';
import { Pool } from 'pg';

const filename = resolve('.env.integration.local');
export function loadIntegrationEnvironment() {
  if (existsSync(filename)) {
    const local = parseEnv(readFileSync(filename, 'utf8'));
    for (const [key, value] of Object.entries(local)) if (process.env[key] === undefined) process.env[key] = value;
  }
}
function docker(args: string[], capture = false): string {
  const result = spawnSync('docker', args, { encoding: 'utf8', env: process.env, windowsHide: true, stdio: capture ? 'pipe' : ['ignore', 'pipe', 'pipe'] });
  // Never surface Compose interpolation/provider output: it may contain credentials.
  if (result.status !== 0) throw new Error('LOCAL_DOCKER_COMMAND_FAILED');
  return result.stdout?.trim() ?? '';
}
async function unusedPort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') { server.close(); reject(new Error('PORT_ALLOCATION_FAILED')); return; }
      server.close(() => resolvePort(address.port));
    });
  });
}
export async function setupLocalPostgres() {
  if (!existsSync(filename)) {
    const project = `aegispay-foundation-${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    const existingContainers = docker(['ps', '-aq', '--filter', `label=com.docker.compose.project=${project}`], true);
    const existingVolumes = docker(['volume', 'ls', '-q', '--filter', `label=com.docker.compose.project=${project}`], true);
    if (existingContainers || existingVolumes) throw new Error('LOCAL_PROJECT_COLLISION');
    const password = randomBytes(32).toString('hex');
    const port = await unusedPort();
    const base = `postgresql://aegispay:${password}@127.0.0.1:${port}`;
    writeFileSync(filename, [
      '# Private local PostgreSQL only. No spike, model or signing credentials.',
      `AEGISPAY_POSTGRES_PROJECT=${project}`, `AEGISPAY_POSTGRES_PASSWORD=${password}`, `AEGISPAY_POSTGRES_PORT=${port}`,
      `DATABASE_URL=${base}/aegispay`, `TEST_DATABASE_URL=${base}/aegispay_integration`, '',
    ].join('\n'), { flag: 'wx', mode: 0o600 });
  }
  loadIntegrationEnvironment();
  const project = process.env.AEGISPAY_POSTGRES_PROJECT;
  if (!project || !/^aegispay-foundation-[a-f0-9]{12}$/.test(project)) throw new Error('INVALID_LOCAL_PROJECT');
  // Existing resources must belong to this workspace, never adopt unrelated DBs.
  const ids = docker(['ps', '-aq', '--filter', `label=com.docker.compose.project=${project}`], true).split(/\r?\n/).filter(Boolean);
  for (const id of ids) {
    const [entry] = JSON.parse(docker(['inspect', id], true)) as { Config: { Labels: Record<string, string> } }[];
    const workingDirectory = entry?.Config.Labels['com.docker.compose.project.working_dir'];
    if (!workingDirectory || resolve(workingDirectory) !== resolve('deployment')) throw new Error('LOCAL_RESOURCE_OWNERSHIP_MISMATCH');
  }
  const compose = ['compose', '--project-name', project, '-f', 'deployment/compose.postgres.yaml'];
  docker([...compose, 'config', '--quiet']);
  docker([...compose, 'up', '-d', '--wait', 'db']);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  try {
    const version = await pool.query<{ server_version: string }>('SHOW server_version');
    if (!version.rows[0]!.server_version.startsWith('17.')) throw new Error('POSTGRES_17_REQUIRED');
    const found = await pool.query("SELECT 1 FROM pg_database WHERE datname = 'aegispay_integration'");
    if (!found.rowCount) await pool.query('CREATE DATABASE aegispay_integration');
    console.info(JSON.stringify({ gate: 'local-postgres', project, version: version.rows[0]!.server_version, credentials: 'ignored .env.integration.local', liveAccess: false }));
  } finally { await pool.end(); }
}
