// Exact two Free services in verified Finals workspace; initial build fails closed.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { api, context, DIR, names, BRANCH, save, receipt, owned } from './common.mjs';
const operation = process.argv[2], role = process.argv[3];
if (process.argv.length !== 4 || !['create','recover','observe'].includes(operation) || !['web','worker'].includes(role)) {
  console.log(JSON.stringify({ status: 'not_run', code: 'EXPLICIT_SERVICE_OPERATION_REQUIRED' })); process.exitCode = 2;
} else {
  try {
    const { workspace } = context(); let service;
    if (operation === 'create') {
      assert(!existsSync(DIR + '/create-' + role + '.json'));
      const inventory = await api('/services?ownerId=' + encodeURIComponent(workspace.ownerId) + '&limit=100');
      assert(Array.isArray(inventory) && inventory.length <= 1);
      assert(inventory.every(row => [names.web,names.worker].includes((row.service ?? row).name)));
      assert(!inventory.some(row => (row.service ?? row).name === names[role]));
      const request = { type: 'web_service', name: names[role], ownerId: workspace.ownerId, repo: 'https://github.com/slvdrvncntjvr/AegisPay', branch: BRANCH,
        rootDir: '', autoDeployTrigger: 'off', envVars: [{ key: 'NODE_VERSION', value: '24.22.1' }, { key: 'AEGIS_RELEASE_ENABLED', value: '0' }],
        serviceDetails: { runtime: 'node', plan: 'free', region: 'singapore', numInstances: 1, previews: { generation: 'off' },
          healthCheckPath: role === 'web' ? '/api/health' : '/health', envSpecificDetails: {
            buildCommand: 'node docs/evidence/demo-readiness-2026-11-14/hosted/build.mjs ' + role,
            startCommand: 'node deployment/finals/demo-release/start.mjs ' + role } } };
      save(DIR + '/create-' + role + '.json', { request, at: new Date().toISOString(), createMayOccur: true });
      const created = await api('/services', 'POST', request);
      save(DIR + '/created-' + role + '.json', created);
      service = created.service ?? created;
      save(DIR + '/service-' + role + '.json', { id: service.id, role });
    } else if (operation === 'recover') {
      const saved = (await import('./common.mjs')).read(DIR + '/created-' + role + '.json');
      service = saved.service ?? saved;
      assert(service.name === names[role] && service.ownerId === workspace.ownerId);
      save(DIR + '/service-' + role + '.json', { id: service.id, role }, !existsSync(DIR + '/service-' + role + '.json'));
    }
    service = await owned(role);
    const result = { status: 'passed', role, scope: 'exact-free-demo-service-' + operation, observedAt: new Date().toISOString(), name: service.name,
      plan: service.serviceDetails.plan, region: service.serviceDetails.region, autoDeploy: service.autoDeployTrigger, initialBuild: 'fails-closed-until-explicit-configured-deploy', providerCreates: operation === 'create' ? 1 : 0 };
    receipt('service-' + role + '-' + operation + '-' + Date.now(), result); console.log(JSON.stringify(result));
  } catch (error) { console.log(JSON.stringify({ status: 'failed-or-uncertain', code: /^PROVIDER_HTTP_/.test(error?.message ?? '') ? error.message : 'SERVICE_OPERATION_MUST_OBSERVE_SAVED_IDENTITY', role })); process.exitCode = 1; }
}
