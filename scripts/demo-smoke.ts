// Default is deliberately inert. Explicit offline gates mutate only invocation-
// owned guarded local integration schemas; model-only cannot reach financial code.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createGeminiClient, GEMINI_TOOLS, GeminiModelError, userTaskContent } from '../src/server/integrations/model.ts';

const args = new Set(process.argv.slice(2));
const offline = args.has('--offline'), modelOnly = args.has('--model-only');
const emit = (value: unknown) => console.info(JSON.stringify(value));
if ([...args].some(a => !['--offline', '--model-only'].includes(a)) || !offline && !modelOnly) {
  emit({ gate: 'demo-smoke', status: 'not_run', missing: ['EXPLICIT_OFFLINE_OR_MODEL_ONLY_MODE', 'LIVE_SAME_INVOCATION_NOIR_VELO_VERIFICATION', 'INDEPENDENT_CHAIN_EVIDENCE', 'REAL_MODEL_PURCHASE_ACCEPTANCE'], financialActions: 0 });
  process.exitCode = 1;
} else {
  // Build an allowlisted child environment, never inherit funded DB/provider keys.
  // The existing test harness privately loads only .env.integration.local, checks
  // localhost /aegispay_integration, and proves UUID schema ownership for cleanup.
  const childEnv: NodeJS.ProcessEnv = { NODE_ENV: 'test', CI: '1' };
  for (const name of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP', 'USERPROFILE', 'HOME', 'APPDATA', 'LOCALAPPDATA', 'TEST_DATABASE_URL']) if (process.env[name]) childEnv[name] = process.env[name];
  const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'tests/unit/model-run.test.ts', 'tests/unit/model.test.ts', 'tests/integration/model-run.test.ts', 'tests/integration/run-events.test.ts'], { env: childEnv, stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) {
    emit({ gate: 'offline-model-tools', status: 'failed', code: 'OFFLINE_GATES_FAILED', livePaymentProof: false }); process.exitCode = 1;
  } else {
    emit({ gate: 'offline-model-tools', status: 'passed', provider: 'synthetic', chain: 'synthetic', database: 'guarded-local-integration-only', livePaymentProof: false, financialActions: 0 });
    if (modelOnly) {
      // Read just these two names privately; never load the file into process.env.
      const privateConfig = existsSync('.env.worker.local') ? parseEnv(readFileSync('.env.worker.local', 'utf8')) : {};
      const apiKey = process.env.GEMINI_API_KEY ?? privateConfig.GEMINI_API_KEY;
      const model = process.env.AGENT_MODEL ?? privateConfig.AGENT_MODEL;
      const missing = [!apiKey && 'GEMINI_API_KEY', !model && 'AGENT_MODEL'].filter(Boolean);
      let report: Record<string, unknown>;
      if (missing.length) { report = { status: 'unavailable', missing }; process.exitCode = 1; }
      else {
        try {
          const client = createGeminiClient({ apiKey: apiKey!, model: model!, functionCallingMode: 'ANY' });
          const task = userTaskContent('Choose the cheapest eligible fictional demo-parser offer within the given finite budget. Propose request_quote only; do not purchase.');
          task.parts.push({ text: JSON.stringify({ stubEnvironment: true, budgetStroops: '1000000', offers: [
            { resourceKey: 'quick-signal:demo-parser:v1', priceStroops: '300000', isDemo: true },
            { resourceKey: 'deep-trace:demo-parser:v1', priceStroops: '1200000', isDemo: true },
          ] }) });
          // One generation only, no tool implementation, no app store/entrypoint.
          const step = await client.generateStep([task], [GEMINI_TOOLS[1]!], AbortSignal.timeout(35000));
          const choice = step.calls[0]?.intent;
          const passed = step.calls.length === 1 && choice?.tool === 'request_quote' && choice.resourceKey === 'quick-signal:demo-parser:v1';
          report = { status: passed ? 'passed' : 'failed', model: model!.replace(/^models\//, ''), responseShape: { publicText: typeof step.text, calls: step.calls.length, providerRole: step.providerContent.role, providerParts: step.providerContent.parts.length },
            choice: choice?.tool === 'request_quote' ? choice.resourceKey : null, generationCalls: 1, toolsExecuted: 0 };
          if (!passed) process.exitCode = 1;
        } catch (error) {
          report = { status: 'unavailable', model: model!.replace(/^models\//, ''), code: error instanceof GeminiModelError ? error.code : 'MODEL_PROBE_UNAVAILABLE', generationCalls: 'at_most_one', toolsExecuted: 0 };
          process.exitCode = 1;
        }
      }
      const evidence = { observedAt: new Date().toISOString(), classification: 'model-only-stub-offer-choice', ...report, actualPurchase: false, financialActions: 0, livePaymentProof: false, limit: 'No application DB, signing, sponsorship, submission, RPC or protected fixture access; not TASK007 live purchase acceptance.' };
      mkdirSync('docs/evidence/finals-model', { recursive: true });
      writeFileSync(`docs/evidence/finals-model/model-only-${Date.now()}.json`, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
      emit(evidence);
    }
  }
}
