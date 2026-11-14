// Pinned deployment per role. Saved request identity prevents automatic retry.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { api, DIR, read, save, receipt, owned } from './common.mjs';
const action = process.argv[2], role = process.argv[3];
if (process.argv.length !== 4 || !['deploy','observe'].includes(action) || !['web','worker'].includes(role)) {
  console.log(JSON.stringify({ status: 'not_run', code: 'EXPLICIT_PINNED_DEPLOYMENT_REQUIRED' })); process.exitCode = 2;
} else {
  try {
    const service = await owned(role), config = read(DIR + '/configured.json');
    const marker = DIR + '/deploy-' + role + '.json';
    if (action === 'deploy') {
      assert(!existsSync(marker));
      save(marker, { serviceId: service.id, sourceCommit: config.commit, deployMayOccur: true, requestedAt: new Date().toISOString() });
      const deploy = await api('/services/' + service.id + '/deploys', 'POST', { commitId: config.commit, clearCache: 'do_not_clear' });
      save(DIR + '/deploy-result-' + role + '.json', deploy);
    }
    const saved = read(DIR + '/deploy-result-' + role + '.json');
    const deploy = await api('/services/' + service.id + '/deploys/' + saved.id);
    assert.equal(deploy.commit.id, config.commit);
    const result = { status: deploy.status, role, observedAt: new Date().toISOString(), sourceCommit: config.commit, serviceName: service.name };
    receipt('deployment-' + role + '-' + Date.now(), result); console.log(JSON.stringify(result));
    if (['build_failed','update_failed','canceled','deactivated'].includes(deploy.status)) process.exitCode = 1;
  } catch (error) { console.log(JSON.stringify({ status: 'failed-or-uncertain', role, code: /^PROVIDER_HTTP_/.test(error?.message ?? '') ? error.message : 'OBSERVE_SAVED_DEPLOYMENT_REQUIRED' })); process.exitCode = 1; }
}
