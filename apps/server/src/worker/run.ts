import { and, eq, sql } from 'drizzle-orm';
import { RUN_LIMITS, finalRunAnswer, reserveModelTurn } from '@aegispay/agent';
import type { Store } from '../../../../src/server/db/connection.ts';
import * as s from '../../../../src/server/db/schema.ts';
import { databaseTime, lockScope } from '../../../../src/server/domain/purchases.ts';
import { createGeminiClient, GEMINI_TOOLS, GeminiModelError, toolResponsesContent, userTaskContent, type GeminiClient, type GeminiStep } from '../../../../src/server/integrations/model.ts';
import { runEventSchemas, safeRunCode, type RunEventKind } from '../../../../src/server/agent/events.ts';
import { checkedCall, readCheckpoint } from '../../../../src/server/agent/state.ts';
import { publicChoiceSummary } from '../../../../src/server/agent/choice-summary.ts';
import { trustedTool } from '../../../../src/server/agent/tools.ts';
import { claimJob, finishJob } from './queue.ts';

type RunJob = typeof s.job.$inferSelect;
type Run = typeof s.agentRun.$inferSelect;

// Job ownership is separate from the payment executor's agent lease. Holding the
// job row through each short SQL tool transaction prevents lease theft midway;
// checking DB time again before commit rolls back an action that exhausted it.
async function fenced<T>(store: Store, job: RunJob, work: (store: Store, run: Run, event: (kind: RunEventKind, payload: Record<string, unknown>) => Promise<void>) => Promise<T>) {
  return store.transaction(async db => {
    await db.execute(sql`set local statement_timeout = '10s'`);
    const [owned] = await db.select().from(s.job).where(and(eq(s.job.id, job.id), eq(s.job.kind, 'run'), eq(s.job.entityId, job.entityId), eq(s.job.status, 'leased'), eq(s.job.leaseOwner, job.leaseOwner ?? ''))).for('update');
    if (!owned?.leaseUntil || owned.leaseUntil <= await databaseTime(db)) throw new Error('LEASE_LOST');
    const [snapshot] = await db.select().from(s.agentRun).where(eq(s.agentRun.id, job.entityId));
    if (!snapshot) throw new Error('RUN_NOT_FOUND');
    const { run } = await lockScope(db, { ownerId: snapshot.ownerId, agentId: snapshot.agentId, runId: snapshot.id });
    const scoped = { ...store, db, transaction: async <R>(action: Parameters<Store['transaction']>[0]) => action(db) as Promise<R> } as Store;
    const event = async (kind: RunEventKind, payload: Record<string, unknown>) => {
      await db.insert(s.runEvent).values({ runId: run.id, kind, safePayload: runEventSchemas[kind].parse(payload) });
    };
    const result = await work(scoped, run, event);
    if (owned.leaseUntil <= await databaseTime(db)) throw new Error('LEASE_LOST');
    return result;
  });
}

export async function processRun(input: { store: Store; job: RunJob; env: NodeJS.ProcessEnv; client?: GeminiClient }) {
  const { store, job, env } = input;
  if (job.kind !== 'run' || !job.leaseOwner) throw new Error('RUN_JOB_REQUIRED');
  const invocationEnd = performance.now() + RUN_LIMITS.activeMs;
  let client = input.client;
  try {
    for (let transition = 0; transition < 40; transition++) {
      const action = await fenced(store, job, async (scoped, run, event) => {
        if (['completed', 'failed'].includes(run.status)) return { kind: 'done' as const };
        const state = readCheckpoint(run.toolCheckpoint, userTaskContent(run.taskText));
        const existing = await scoped.db.select({ attemptId: s.paymentAttempt.id, quoteId: s.paymentAttempt.quoteId, operationId: s.paymentAttempt.operationId }).from(s.paymentAttempt)
          .innerJoin(s.quote, eq(s.quote.id, s.paymentAttempt.quoteId)).where(eq(s.quote.runId, run.id));
        // Historical CLI/externally accepted purchases have no model checkpoint.
        // Quarantine their model job without changing the payment, run or hold.
        // Valid model acceptances commit this exact mapping with their checkpoint.
        if (existing.length && (existing.length !== 1 || !state.purchase || existing[0]!.attemptId !== state.purchase.attemptId || existing[0]!.quoteId !== state.purchase.quoteId || existing[0]!.operationId !== state.purchase.operationId)) {
          await event('run_stopped', { code: 'PAYMENT_UNRESOLVED' });
          return { kind: 'done' as const };
        }
        if (state.purchase && !existing.length) throw new Error('RUN_CHECKPOINT_INVALID');
        if (!run.startedAt) {
          await scoped.db.update(s.agentRun).set({ startedAt: sql`clock_timestamp()`, status: 'running' }).where(eq(s.agentRun.id, run.id));
          await event('run_started', {});
        }
        if (state.pending) {
          const pending = state.pending;
          const call = checkedCall(pending.calls[pending.index]);
          let steps = run.toolSteps;
          if (!pending.counted) {
            if (steps >= RUN_LIMITS.toolSteps) throw new Error('TOOL_STEP_LIMIT');
            steps++; pending.counted = true;
            await event('tool_selected', { tool: call.name });
          }
          const result = await trustedTool({ store: scoped, env, run, state, call, event });
          if (!result.waiting) {
            pending.reports.push({ call, response: result.response });
            pending.index++; pending.counted = false;
            if (pending.index === pending.calls.length) {
              state.contents.push(pending.content, toolResponsesContent(pending.reports)); state.pending = null;
            }
          }
          // Bound stored provider material before committing a tool action.
          if (Buffer.byteLength(JSON.stringify(state)) > 512 * 1024) throw new Error('RUN_CHECKPOINT_INVALID');
          await scoped.db.update(s.agentRun).set({ toolCheckpoint: state, toolSteps: steps, status: result.waiting ? 'waiting_payment' : 'running', errorCode: result.waiting ? 'PAYMENT_UNRESOLVED' : null }).where(eq(s.agentRun.id, run.id));
          if (result.waiting) return { kind: 'wait' as const };
          return { kind: 'continue' as const };
        }
        if (performance.now() >= invocationEnd) throw new Error('ACTIVE_TIME_LIMIT');
        const reservation = reserveModelTurn(run.modelTurns, state.activeMs);
        state.activeMs = reservation.activeMs;
        await scoped.db.update(s.agentRun).set({ toolCheckpoint: state, modelTurns: reservation.turns, status: 'running', errorCode: null }).where(eq(s.agentRun.id, run.id));
        await event('model_turn', { turn: reservation.turns });
        return { kind: 'generate' as const, state, reservation, modelId: run.modelId, turns: reservation.turns };
      });
      if (action.kind === 'done') return true;
      if (action.kind === 'wait') return false;
      if (action.kind === 'continue') continue;
      // No signing/Velo/encryption/DB credentials enter client or model contents.
      client ??= createGeminiClient({ apiKey: env.GEMINI_API_KEY ?? '', model: action.modelId });
      const controller = new AbortController();
      const timeout = Math.max(1, Math.min(action.reservation.allowanceMs, invocationEnd - performance.now()));
      const started = performance.now();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let step: GeminiStep;
      try {
        // Race even an injected transport that ignores cancellation. Late provider
        // completions have no continuation capable of writing state or tools.
        step = await Promise.race([client.generateStep(action.state.contents, GEMINI_TOOLS, controller.signal), new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new Error('MODEL_TIMEOUT')); }, timeout);
        })]);
      } finally { if (timer) clearTimeout(timer); controller.abort(); }
      const elapsed = Math.min(action.reservation.allowanceMs, Math.max(1, performance.now() - started));
      const done = await fenced(store, job, async (scoped, run, event) => {
        if (run.modelTurns !== action.turns || ['completed', 'failed'].includes(run.status)) throw new Error('LEASE_LOST');
        const state = readCheckpoint(run.toolCheckpoint, userTaskContent(run.taskText));
        state.activeMs = Math.min(RUN_LIMITS.activeMs, state.activeMs - action.reservation.allowanceMs + elapsed);
        if (step.calls.length) {
          // Validate the complete batch before accepting even its first tool.
          const calls = step.calls.map(checkedCall);
          if (calls.length > RUN_LIMITS.toolSteps - run.toolSteps) throw new Error('TOOL_STEP_LIMIT');
          if (!state.delivered) await event('model_choice', { turn: run.modelTurns, decision: 'tools_proposed', ...publicChoiceSummary(step.text) });
          state.pending = { content: step.providerContent, calls, index: 0, counted: false, reports: [] };
          readCheckpoint(state, userTaskContent(run.taskText));
          await scoped.db.update(s.agentRun).set({ toolCheckpoint: state }).where(eq(s.agentRun.id, run.id));
          return false;
        }
        if (!state.delivered) await event('model_choice', { turn: run.modelTurns, decision: 'no_tool', ...publicChoiceSummary(step.text) });
        const finalAnswer = finalRunAnswer(step.text, state.delivered?.receiptId);
        await scoped.db.update(s.agentRun).set({ toolCheckpoint: state, finalAnswer, status: 'completed', finishedAt: sql`clock_timestamp()`, errorCode: null }).where(eq(s.agentRun.id, run.id));
        await event('run_completed', state.delivered ? { receiptId: state.delivered.receiptId } : {});
        return true;
      });
      if (done) return true;
    }
    throw new Error('ACTIVE_TIME_LIMIT');
  } catch (error) {
    if (error instanceof Error && error.message === 'LEASE_LOST') throw error;
    const code = safeRunCode(error instanceof GeminiModelError ? error.code : error instanceof Error ? error.message : undefined);
    return fenced(store, job, async (scoped, run, event) => {
      if (['completed', 'failed'].includes(run.status)) return true;
      // The payment consumer keeps its own job and original held operation.
      // Model failures/timeout cannot release funds or cancel reconciliation.
      const held = BigInt(run.reservedStroops) > 0n;
      await scoped.db.update(s.agentRun).set({ status: held ? 'waiting_payment' : 'failed', errorCode: code,
        ...(held ? {} : { finishedAt: sql`clock_timestamp()`, finalAnswer: 'Run stopped before a final answer. Any existing receipt remains recoverable.' }) }).where(eq(s.agentRun.id, run.id));
      await event('run_stopped', { code });
      return !held;
    });
  }
}

export function runConsumer(input: { store: Store; env: NodeJS.ProcessEnv; client?: GeminiClient }) {
  let active: Promise<void> | undefined;
  let stopping = false;
  async function drain() {
    for (let count = 0; count < 5 && !stopping; count++) {
      const job = await claimJob(input.store, ['run']);
      if (!job) return;
      let done = false;
      try { done = await processRun({ ...input, job }); }
      finally { await finishJob(input.store, job, done); }
    }
  }
  return {
    idle: () => active ?? Promise.resolve(),
    stop: async () => { stopping = true; await active; },
    wake(): Promise<void> {
      if (stopping) return Promise.resolve();
      active ??= drain().finally(() => { active = undefined; });
      return active;
    },
  };
}
