import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { selectedEnv, privateEnv, writePrivate } from '../local-release/context.mjs';
export { privateEnv, writePrivate };
export const DIR = '.fmd-work/release-setup/demo-delivery';
export const OUT = 'docs/evidence/demo-delivery-2026-11-15';
export const BRANCH = 'task/TASK-009-demo-readiness';
export const names = { web: 'aegispay-finals-app', worker: 'aegispay-finals-worker' };
export const sha = value => createHash('sha256').update(value).digest('hex');
export const read = path => JSON.parse(readFileSync(path, 'utf8'));
export function context() {
  const workspace = read('.fmd-work/release-setup/hosted-workspace.json');
  const database = read('.fmd-work/release-setup/hosted-database.json');
  assert.equal(sha(workspace.ownerId), '7511972d690f6a542e309a172b838073226f635dbc5c0cdf125d382f990d19eb');
  assert.equal(sha(database.id), '78ef7162df9c523cab7d0fb7316b9e7a700271b83d0e4ec72d1ac8bd81bd6e7f');
  assert.equal(database.ownerId, workspace.ownerId);
  return { workspace, database };
}
export function save(path, value, exclusive = true) { writePrivate(path, JSON.stringify(value) + '\n', exclusive); }
export function receipt(name, value) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(OUT + '/' + name + '.json', JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
}
export async function api(path, method = 'GET', body) {
  assert(path.startsWith('/') && !path.includes('://'));
  const key = selectedEnv('.env.deploy.local', ['RENDER_API_KEY']).RENDER_API_KEY; assert(key);
  const response = await fetch('https://api.render.com/v1' + path, { method, redirect: 'error', signal: AbortSignal.timeout(30000),
    headers: { authorization: 'Bearer ' + key, accept: 'application/json', ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  let size = 0; const chunks = [];
  for await (const chunk of response.body ?? []) { size += chunk.length; assert(size <= 2 * 1024 * 1024); chunks.push(chunk); }
  let value; try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { value = null; }
  if (!response.ok) {
    const text = JSON.stringify(value ?? '').toLowerCase();
    throw Error('PROVIDER_HTTP_' + response.status + (/billing|payment|credit.card/.test(text) ? '_BILLING_REQUIRED' : /limit|maximum|capacity/.test(text) ? '_CAPACITY' : ''));
  }
  return value;
}
export async function owned(role) {
  assert(['web','worker'].includes(role)); const { workspace } = context();
  const saved = read(DIR + '/service-' + role + '.json');
  const service = await api('/services/' + encodeURIComponent(saved.id));
  assert.equal(service.id, saved.id); assert.equal(service.ownerId, workspace.ownerId); assert.equal(service.name, names[role]);
  assert.equal(service.type, 'web_service'); assert.equal(service.serviceDetails.plan, 'free'); assert.equal(service.serviceDetails.region, 'singapore');
  assert.equal(service.branch, BRANCH); assert.equal(service.autoDeployTrigger, 'off');
  return service;
}
export function savedService(role) { return existsSync(DIR + '/service-' + role + '.json'); }
