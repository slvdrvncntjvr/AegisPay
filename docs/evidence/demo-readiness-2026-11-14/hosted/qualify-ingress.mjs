// Bounded anonymous HTTP qualification only. No environment/credential/DB reads,
// valid wake token, login, task, wallet, payment, provider or retry operation.
const args = process.argv.slice(2);
if (!args.length) {
  console.log(JSON.stringify({ status: 'not_run', scope: 'anonymous-ingress-only', financialActions: 0, missing: ['EXPLICIT_APP_OR_WORKER_HTTPS_ORIGIN'] }));
  process.exitCode = 2;
} else {
  try {
    if (args.length % 2 || args.length > 4) throw Error('INVALID_ARGUMENTS');
    const targets = new Map();
    for (let i = 0; i < args.length; i += 2) {
      const kind = args[i];
      if (!['--app-url', '--worker-url'].includes(kind) || targets.has(kind)) throw Error('INVALID_ARGUMENTS');
      const url = new URL(args[i + 1]);
      if (url.protocol !== 'https:' || url.origin !== args[i + 1] || !url.hostname.endsWith('.onrender.com')) throw Error('EXACT_RENDER_HTTPS_ORIGIN_REQUIRED');
      targets.set(kind, url.origin);
    }
    const checks = [];
    async function check(origin, name, path, expected, init = {}, expectedJson) {
      const started = performance.now();
      const response = await fetch(origin + path, { ...init, redirect: 'error', signal: AbortSignal.timeout(60000) });
      const reader = response.body?.getReader();
      let size = 0;
      const chunks = [];
      try {
        if (!reader) throw Error('BODY_REQUIRED');
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          if ((size += chunk.value.byteLength) > 1024 * 1024) throw Error('BODY_TOO_LARGE');
          chunks.push(chunk.value);
        }
      } finally { await reader?.cancel(); }
      const body = Buffer.concat(chunks).toString('utf8');
      let jsonMatches = true;
      if (expectedJson) {
        try { jsonMatches = JSON.stringify(JSON.parse(body)) === JSON.stringify(expectedJson); }
        catch { jsonMatches = false; }
      }
      const passed = response.status === expected && jsonMatches;
      checks.push({ name, expectedStatus: expected, observedStatus: response.status, passed, elapsedMs: Math.round(performance.now() - started) });
      if (!passed) throw Error('INGRESS_CHECK_FAILED');
    }
    const app = targets.get('--app-url'), worker = targets.get('--worker-url');
    if (app) {
      await check(app, 'app-health', '/api/health', 200, {}, { status: 'ok', network: 'testnet' });
      await check(app, 'app-login', '/login', 200);
      await check(app, 'app-console-shell', '/app', 200);
      for (const path of ['/api/v1/state', '/api/v1/catalog', '/api/v1/runs']) await check(app, `anonymous:${path}`, path, 401);
    }
    if (worker) {
      await check(worker, 'worker-health', '/health', 200, {}, { status: 'ok', network: 'testnet' });
      await check(worker, 'worker-root-closed', '/', 404);
      await check(worker, 'worker-wake-read-closed', '/wake', 404);
      await check(worker, 'worker-wake-no-auth', '/wake', 401, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      await check(worker, 'worker-wake-invalid-auth', '/wake', 401, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer INVALID_NON_CREDENTIAL' }, body: '{}' });
      await check(worker, 'worker-webhook-closed', '/webhook', 404, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    }
    console.log(JSON.stringify({ status: 'passed', scope: 'anonymous-ingress-only-not-live-release', checks, financialActions: 0,
      remaining: ['SOURCE_ENVIRONMENT_TLS_ATTESTATION', 'AUTHENTICATED_OWNER_MERCHANT_AND_WAKE', 'BODY_ORIGIN_OWNERSHIP', 'COLD_START_AND_RESTART', 'ASSET_REPORT_SECRET_LEAKS', 'ALL_LIVE_PAYMENT_WALLET_MODEL_RECOVERY_MEDIA_GATES'] }));
  } catch {
    // Never expose native errors, raw responses, headers, secrets or URLs.
    console.log(JSON.stringify({ status: 'failed', code: 'HOSTED_INGRESS_INCOMPLETE', scope: 'anonymous-ingress-only', financialActions: 0 }));
    process.exitCode = 1;
  }
}
