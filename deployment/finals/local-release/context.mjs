// Private local custody helper. Never prints configuration or native errors.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Pool } from 'pg';

export const OUT = 'docs/evidence/live-setup-2026-11-14';
export const PUBLIC_PROPOSAL = 'docs/evidence/demo-readiness-2026-11-14/hosted/context-proposal.json';
export const publicContext = () => JSON.parse(readFileSync(PUBLIC_PROPOSAL, 'utf8'));
export const privateEnv = path => {
  const content = readFileSync(path, 'utf8');
  if (Buffer.byteLength(content) > 65536) throw Error('PRIVATE_FILE_BOUND');
  return parseEnv(content);
};
export function selectedEnv(path, names) {
  const content = readFileSync(path, 'utf8');
  if (Buffer.byteLength(content) > 65536) throw Error('PRIVATE_FILE_BOUND');
  return parseEnv(content.split(/\r?\n/).filter(line => names.some(name => new RegExp('^\\s*(?:export\\s+)?' + name + '\\s*=').test(line))).join('\n'));
}
export const serialize = env => '# Isolated LOCAL release only; private credentials, never copy to web/preview.\n' +
  Object.entries(env).filter(([, value]) => value !== undefined).map(([name, value]) => name + '=' + JSON.stringify(value)).join('\n') + '\n';
export function protectFile(path) {
  if (process.platform !== 'win32') return;
  const literal = "'" + resolve(path).replaceAll("'", "''") + "'";
  const command = "$ErrorActionPreference='Stop';$releaseSid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User;$releaseAcl=Get-Acl -LiteralPath " + literal + ";if($releaseAcl.AreAccessRulesProtected -and @($releaseAcl.Access).Count -eq 1 -and $releaseAcl.Access[0].IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -eq $releaseSid.Value){exit 0};$releaseAcl.SetAccessRuleProtection($true,$false);foreach($r in @($releaseAcl.Access)){[void]$releaseAcl.RemoveAccessRuleSpecific($r)};$releaseAcl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($releaseSid,'FullControl','Allow')));Set-Acl -LiteralPath " + literal + " -AclObject $releaseAcl;$a=Get-Acl -LiteralPath " + literal + ";if(-not $a.AreAccessRulesProtected -or @($a.Access).Count -ne 1 -or $a.Access[0].IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -ne $releaseSid.Value){exit 1}";
  const env = { ...process.env }; delete env.PSModulePath;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { env, windowsHide: true, stdio: 'ignore' });
  if (result.status !== 0) throw Error('PRIVATE_ACL_REQUIRED');
}
export function writePrivate(path, value, create = false) {
  mkdirSync(dirname(path), { recursive: true });
  if (create) writeFileSync(path, '', { flag: 'wx', mode: 0o600 });
  if (!existsSync(path)) throw Error('EXACT_PRIVATE_CUSTODY_REQUIRED');
  protectFile(path); writeFileSync(path, value);
}
export function isolatedEnvironment(config) {
  const env = {};
  for (const name of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TMPDIR', 'TMP', 'TEMP']) if (process.env[name]) env[name] = process.env[name];
  return { ...env, ...config };
}
export async function localCustody() {
  const custody = privateEnv('.env.release.database.local'), local = privateEnv('.env.integration.local');
  const target = new URL(custody.DATABASE_URL), integration = new URL(local.TEST_DATABASE_URL);
  if (target.pathname !== '/aegispay_release_20261114' || target.hostname !== '127.0.0.1' ||
    target.host !== integration.host || target.username !== integration.username || target.password !== integration.password ||
    !/^aegispay-foundation-[a-f0-9]{12}$/.test(local.AEGISPAY_POSTGRES_PROJECT ?? '')) throw Error('OWNED_LOCAL_TARGET_REQUIRED');
  const docker = args => {
    const result = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true });
    if (result.status !== 0) throw Error('OWNED_DOCKER_UNAVAILABLE');
    return result.stdout.trim();
  };
  const ids = docker(['ps', '-q', '--filter', `label=com.docker.compose.project=${local.AEGISPAY_POSTGRES_PROJECT}`]).split(/\r?\n/).filter(Boolean);
  if (ids.length !== 1) throw Error('ONE_OWNED_CONTAINER_REQUIRED');
  const [container] = JSON.parse(docker(['inspect', ids[0]]));
  const bindings = container.NetworkSettings.Ports['5432/tcp'];
  if (resolve(container.Config.Labels['com.docker.compose.project.working_dir']) !== resolve('deployment') || bindings?.length !== 1 ||
    bindings[0].HostIp !== '127.0.0.1' || Number(bindings[0].HostPort) !== Number(target.port || 5432)) throw Error('OWNED_ENDPOINT_BINDING_REQUIRED');
  const pool = new Pool({ connectionString: target.href, max: 1, connectionTimeoutMillis: 5000 });
  try {
    const comment = (await pool.query("SELECT shobj_description(oid,'pg_database') AS comment FROM pg_database WHERE datname=current_database()")).rows[0]?.comment;
    if (comment !== 'aegispay-release-owned:' + custody.AEGIS_RELEASE_DB_OWNERSHIP) throw Error('OWNED_DATABASE_COMMENT_REQUIRED');
    return { custody, pool, target, endpointMatched: true };
  } catch (error) { await pool.end(); throw error; }
}
