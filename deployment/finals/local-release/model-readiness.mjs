// Bounded fictional model transport only. No store, worker, wallet or payment API.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { selectedEnv } from './context.mjs';
import { createGeminiClient, listAvailableGeminiModels, GEMINI_TOOLS, userTaskContent } from '../../../src/server/integrations/model.ts';

if (process.argv[2] !== '--probe' || process.argv.length > 4) {
  console.log(JSON.stringify({ status: 'not_run', code: 'EXPLICIT_MODEL_PROBE_REQUIRED' })); process.exitCode = 2;
} else {
  const report = { observedAt: new Date().toISOString(), scope: 'actual-model-provider-fictional-tool-proposal-only', calls: [], financialActions: 0, toolsExecuted: 0 };
  let output = 'configured';
  try {
    const env = selectedEnv('.env.release.worker.local', ['GEMINI_API_KEY','AGENT_MODEL']);
    const name = process.argv[3] ?? env.AGENT_MODEL;
    assert(/^(?:models\/)?[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(name));
    output = process.argv[3] ? name.replace(/^models\//, '') : 'configured';
    const model = name.startsWith('models/') ? name : 'models/' + name;
    report.configuredModel = env.AGENT_MODEL; report.testedModel = model;
    let gets = 0, posts = 0;
    const transport = async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.origin, 'https://generativelanguage.googleapis.com'); assert.equal(init.redirect, 'error');
      assert(init.method === 'GET' ? ++gets <= 20 : init.method === 'POST' && ++posts <= 1);
      const response = await fetch(input, init);
      const call = { method: init.method, path: url.pathname, status: response.status };
      if (!response.ok && response.headers.get('content-type')?.includes('application/json')) {
        const reader = response.clone().body.getReader(); let bytes = 0; const chunks = [];
        try {
          for (;;) { const chunk = await reader.read(); if (chunk.done) break; bytes += chunk.value.byteLength; if (bytes > 262144) break; chunks.push(chunk.value); }
          if (bytes <= 262144) {
            const raw = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            call.providerCode = Number.isInteger(raw?.error?.code) ? raw.error.code : null;
            call.providerStatus = ['UNAVAILABLE','NOT_FOUND','INVALID_ARGUMENT','RESOURCE_EXHAUSTED','PERMISSION_DENIED','UNAUTHENTICATED','INTERNAL'].includes(raw?.error?.status) ? raw.error.status : null;
            const text = String(raw?.error?.message ?? '').toLowerCase();
            call.category = /high demand|overload|unavailable/.test(text) ? 'provider-unavailable' : /not found|not supported/.test(text) ? 'model-unsupported' : /quota|rate/.test(text) ? 'quota' : 'other';
          }
        } catch { call.errorDetail = 'unparsed'; } finally { void reader.cancel().catch(() => {}); reader.releaseLock(); }
      }
      report.calls.push(call); return response;
    };
    const models = await listAvailableGeminiModels({ apiKey: env.GEMINI_API_KEY, fetch: transport }, AbortSignal.timeout(35000));
    report.advertisedFlashModels = models.filter(m => /flash/.test(m.name) && !/image|audio|tts|live|vision/.test(m.name)).map(m => m.name).slice(0, 20);
    report.testedModelAdvertised = models.some(m => m.name === model);
    const client = createGeminiClient({ apiKey: env.GEMINI_API_KEY, model, fetch: transport });
    const task = userTaskContent('List the trusted fictional demo-parser offers using discover_offers. Do not request a purchase. This is a transport check only.');
    const step = await client.generateStep([task], GEMINI_TOOLS, AbortSignal.timeout(35000));
    report.status = 'passed'; report.adapterParsed = true; report.proposedTools = step.calls.map(call => call.name);
    report.toolProposalVerified = step.calls.length === 1 && step.calls[0].name === 'discover_offers';
  } catch (error) {
    report.status = 'failed'; report.code = typeof error?.code === 'string' && /^MODEL_[A-Z_]+$/.test(error.code) ? error.code : 'MODEL_DIAGNOSTIC_INCOMPLETE';
  }
  mkdirSync('docs/evidence/model-run-2026-11-14', { recursive: true });
  writeFileSync('docs/evidence/model-run-2026-11-14/probe-' + output + '.json', JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(report));
  if (report.status !== 'passed') process.exitCode = 1;
}
