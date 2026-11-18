// TASK-034 narrowly scoped provider operations; no application sessions/DB/model/payment access.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { api, owned, context, writePrivate } from '../deployment/finals/demo-release/common.mjs';
export const DIR = '.fmd-work/presentation-publish-20261118';
export const OUT = 'docs/evidence/product-presentation-2026-11-18';
export const PROJECT = 'prj_87hFYLDrQpbUsSlAgoFMsTIE7aTq';
const read = name => JSON.parse(readFileSync(name, 'utf8'));
export function receipt(name, value) {
  writeFileSync(OUT + '/' + name + '.json', JSON.stringify({ observedAt: new Date().toISOString(), ...value }, null, 2) + '\n', { flag: 'wx' });
}
const privateSave = (name, value) => writePrivate(DIR + '/' + name + '.json', JSON.stringify(value) + '\n', true);
const sorted = obj => Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
async function env(serviceId) {
  const rows = await api('/services/' + serviceId + '/env-vars?limit=100');
  assert(rows.length < 100);
  return sorted(Object.fromEntries(rows.map(row => { const v = row.envVar ?? row; return [v.key, v.value]; })));
}
async function deploys(id) { return (await api('/services/' + id + '/deploys?limit=5')).map(row => row.deploy ?? row); }
function dbFacts(db) { return Object.fromEntries(['id', 'ownerId', 'plan', 'region', 'version', 'status', 'expiresAt', 'ipAllowList'].filter(k => k in db).map(k => [k, db[k]])); }
function serviceConfig(s) {
  return Object.fromEntries(['id', 'name', 'ownerId', 'type', 'repo', 'branch', 'rootDir', 'autoDeployTrigger', 'serviceDetails'].map(k => [k, s[k]]));
}
export function vercelCredentials() {
  const dir = join(process.env.APPDATA, 'com.vercel.cli/Data');
  const { token } = read(join(dir, 'auth.json'));
  const { currentTeam } = read(join(dir, 'config.json'));
  assert(token && currentTeam);
  return { token, team: currentTeam };
}
export async function vercel(path) {
  const { token, team } = vercelCredentials();
  const response = await globalThis.fetch('https://api.vercel.com' + path + (path.includes('?') ? '&' : '?') + 'teamId=' + encodeURIComponent(team), {
    headers: { authorization: 'Bearer ' + token }, redirect: 'error', signal: globalThis.AbortSignal.timeout(30000),
  });
  assert(response.ok, 'VERCEL_HTTP_' + response.status);
  return response.json();
}
async function snapshot() {
  const web = await owned('web'), worker = await owned('worker'), { database } = context();
  const db = await api('/postgres/' + database.id);
  assert.equal(db.id, database.id); assert.equal(db.plan, 'free');
  const webDeploys = await deploys(web.id), workerDeploys = await deploys(worker.id);
  assert.equal(workerDeploys[0].status, 'live');
  return { web: serviceConfig(web), worker: serviceConfig(worker), db: dbFacts(db),
    webEnv: await env(web.id), workerEnv: await env(worker.id), webDeploys, workerDeploys };
}
export async function unchanged(before, commit) {
  const current = await snapshot();
  assert.deepEqual(current.worker, before.worker, 'WORKER_CONFIG_CHANGED');
  assert.deepEqual(current.workerEnv, before.workerEnv, 'WORKER_ENV_CHANGED');
  assert.equal(current.workerDeploys[0].id, before.workerDeploys[0].id, 'WORKER_DEPLOYMENT_CHANGED');
  assert.equal(current.workerDeploys[0].commit.id, before.workerDeploys[0].commit.id);
  assert.deepEqual(current.db, before.db, 'DATABASE_CONFIG_CHANGED');
  assert.deepEqual(current.web, before.web, 'WEB_CONFIG_CHANGED');
  assert.deepEqual(current.webEnv, sorted({ ...before.webEnv, AEGIS_RELEASE_COMMIT: commit }), 'OTHER_WEB_ENV_CHANGED');
  return current;
}
const action = process.argv[2];
if (action && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    mkdirSync(DIR, { recursive: true });
    if (action === '--preflight' && process.argv.length === 3) {
      const saved = await snapshot();
      assert.equal(saved.webDeploys[0].status, 'live');
      const project = await vercel('/v9/projects/' + PROJECT), alias = await vercel('/v4/aliases/aegispay-live.vercel.app');
      const vars = await vercel('/v9/projects/' + PROJECT + '/env');
      assert.equal(project.id, PROJECT); assert.equal(project.name, 'aegispay-live');
      assert.equal(project.accountId, vercelCredentials().team); assert(!project.link, 'UNREVIEWED_GIT_AUTODEPLOY_LINK');
      assert.equal(vars.envs.length, 0); assert.equal(alias.projectId, PROJECT);
      privateSave('baseline', saved);
      receipt('publish-provider-preflight', { status: 'passed', webId: saved.web.id, webName: saved.web.name,
        webDeployId: saved.webDeploys[0].id, webCommit: saved.webDeploys[0].commit.id,
        workerId: saved.worker.id, workerDeployId: saved.workerDeploys[0].id, workerCommit: saved.workerDeploys[0].commit.id,
        database: saved.db, webWorkerFree: true, autoDeploy: 'off', vercelProject: PROJECT, vercelAlias: alias.alias,
        vercelPriorDeployId: alias.deploymentId, proofEnvCount: 0, proofGitAutodeploy: false });
      console.log(JSON.stringify({ status: 'passed', web: saved.web.name, worker: saved.worker.name, workerLive: true, proofEnvCount: 0 }));
    } else if (action === '--deploy-web' && process.argv.length === 4) {
      const commit = process.argv[3]; assert(/^[a-f0-9]{40}$/.test(commit));
      assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), commit);
      const before = read(DIR + '/baseline.json');
      assert(!existsSync(DIR + '/web-pin-request.json')); assert(!existsSync(DIR + '/web-deploy-request.json'));
      await unchanged(before, before.webEnv.AEGIS_RELEASE_COMMIT);
      privateSave('web-pin-request', { serviceId: before.web.id, commit, requestedAt: new Date().toISOString() });
      await api('/services/' + before.web.id + '/env-vars/AEGIS_RELEASE_COMMIT', 'PUT', { value: commit });
      await unchanged(before, commit);
      privateSave('web-deploy-request', { serviceId: before.web.id, commit, requestedAt: new Date().toISOString() });
      const deploy = await api('/services/' + before.web.id + '/deploys', 'POST', { commitId: commit, clearCache: 'do_not_clear' });
      assert(deploy.id); privateSave('web-deploy-result', { id: deploy.id, serviceId: before.web.id, commit });
      receipt('publish-web-request', { status: 'requested', serviceId: before.web.id, deployId: deploy.id, commit,
        onlyUpdatedEnvironmentKey: 'AEGIS_RELEASE_COMMIT', otherWebConfigUnchanged: true, workerAndDatabaseUnchanged: true });
      console.log(JSON.stringify({ status: 'requested', deployId: deploy.id, commit }));
    } else if (action === '--observe-web' && process.argv.length === 3) {
      const before = read(DIR + '/baseline.json'), saved = read(DIR + '/web-deploy-result.json');
      const deployment = await api('/services/' + saved.serviceId + '/deploys/' + saved.id);
      assert.equal(deployment.commit.id, saved.commit);
      const current = await unchanged(before, saved.commit);
      const result = { status: deployment.status, serviceId: saved.serviceId, deployId: saved.id, commit: saved.commit,
        workerId: before.worker.id, workerDeployId: current.workerDeploys[0].id, workerCommit: current.workerDeploys[0].commit.id,
        workerConfigurationUnchanged: true, databaseConfigurationUnchanged: true, otherWebConfigUnchanged: true,
        applicationDatabaseAccess: false, financialHandoffs: 0 };
      receipt('publish-web-observation-' + Date.now(), result); console.log(JSON.stringify(result));
      if (['build_failed', 'update_failed', 'canceled', 'deactivated'].includes(deployment.status)) process.exitCode = 1;
    } else throw Error('EXPLICIT_PROVIDER_ACTION_REQUIRED');
  } catch (error) {
    const allowed = /^(?:PROVIDER_HTTP_|VERCEL_HTTP_|WORKER_|DATABASE_|WEB_|OTHER_WEB_|UNREVIEWED_)[A-Z0-9_]*$/;
    console.log(JSON.stringify({ status: 'failed-or-uncertain', action, code: allowed.test(error.message) ? error.message : 'OBSERVE_SAVED_OPERATION_REQUIRED' }));
    process.exitCode = 1;
  }
}
