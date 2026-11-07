// Opt-in Gemini-only connectivity smoke: no financial SDK, catalog, DB or payment imports.
// node --env-file-if-exists=.env.worker.local --import tsx scripts/model-smoke.ts
// A child worktree may instead pass --worker-env-file <root/.env.worker.local>;
// only GEMINI_API_KEY and AGENT_MODEL are parsed, and existing process values win.
import { open } from 'node:fs/promises';
import { argv, env } from 'node:process';
import { parseEnv } from 'node:util';
import {
  createGeminiClient, GEMINI_TOOLS, GeminiModelError,
  listAvailableGeminiModels, toolResponsesContent, userTaskContent,
} from '../src/server/integrations/model.ts';

async function modelEnvironmentFile(path: string): Promise<Record<string, string | undefined>> {
  const file = await open(path, 'r');
  try {
    const maxBytes = 64 * 1024;
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > maxBytes) throw new Error('MODEL_SMOKE_ENV_INVALID');
    const buffer = Buffer.alloc(maxBytes + 1);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    if (bytesRead > maxBytes) throw new Error('MODEL_SMOKE_ENV_INVALID');
    // Never parse, export or inspect financial key values from the shared worker file.
    const lines = buffer.subarray(0, bytesRead).toString('utf8').split(/\r?\n/)
      .filter(line => /^\s*(?:export\s+)?(?:GEMINI_API_KEY|AGENT_MODEL)\s*=/.test(line));
    return parseEnv(lines.join('\n'));
  } finally { await file.close(); }
}

async function main(): Promise<void> {
  const args = argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--worker-env-file' || !args[1])) throw new Error('MODEL_SMOKE_INVALID_ARGUMENT');
  const file = args[1] ? await modelEnvironmentFile(args[1]) : {};
  const apiKey = env.GEMINI_API_KEY ?? file.GEMINI_API_KEY;
  const model = env.AGENT_MODEL ?? file.AGENT_MODEL;
  if (!apiKey?.trim()) {
    console.log(JSON.stringify({ status: 'not_run', missing: ['GEMINI_API_KEY', ...(!model?.trim() ? ['AGENT_MODEL'] : [])] }));
    process.exitCode = 2;
    return;
  }
  const models = await listAvailableGeminiModels({ apiKey });
  // Only validated model identifiers leave the discovery boundary, never raw provider output.
  console.log(JSON.stringify({ discovery: 'observed', generateContentModels: models.map(value => value.name), quotaVerified: false }));
  if (!model?.trim()) {
    console.log(JSON.stringify({ status: 'not_run', missing: ['AGENT_MODEL'] }));
    process.exitCode = 2;
    return;
  }
  const client = createGeminiClient({ apiKey, model, functionCallingMode: 'ANY' });
  const initial = userTaskContent('Connectivity test only. Call discover_offers exactly once with no arguments. After receiving the tool result, reply with exactly GEMINI_SMOKE_OK and nothing else.');
  const first = await client.generateStep([initial], [GEMINI_TOOLS[0]!]);
  if (first.calls.length !== 1 || first.calls[0]?.name !== 'discover_offers') throw new Error('MODEL_SMOKE_UNEXPECTED_CALL');
  // Synthetic tool data belongs only to this non-financial smoke, never live evidence.
  const reply = toolResponsesContent([{ call: first.calls[0], response: { status: 'ok', marker: 'GEMINI_SMOKE_OK', offers: [] } }]);
  const final = await client.generateStep([initial, first.providerContent, reply], []);
  if (final.calls.length || final.text !== 'GEMINI_SMOKE_OK') throw new Error('MODEL_SMOKE_ROUNDTRIP_FAILED');
  console.log(JSON.stringify({
    status: 'passed', model: model.startsWith('models/') ? model : `models/${model}`,
    expectedCall: 'discover_offers', toolCalls: 1, roundtrip: 'matched',
    callIdPreserved: first.calls[0].id !== undefined,
    thoughtSignaturePreserved: first.providerContent.parts.some(part => 'thoughtSignature' in part),
    financialActions: 0,
  }));
}

void main().catch((error: unknown) => {
  const localCodes = new Set(['MODEL_SMOKE_ENV_INVALID', 'MODEL_SMOKE_INVALID_ARGUMENT', 'MODEL_SMOKE_UNEXPECTED_CALL', 'MODEL_SMOKE_ROUNDTRIP_FAILED']);
  const code = error instanceof GeminiModelError ? error.code
    : error instanceof Error && localCodes.has(error.message) ? error.message : 'MODEL_SMOKE_FAILED';
  console.log(JSON.stringify({ status: 'failed', code }));
  process.exitCode = 1;
});
