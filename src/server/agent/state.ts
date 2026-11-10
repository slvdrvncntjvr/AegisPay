import { z } from 'zod';
import { quoteChallengeSchema, toolIntentSchema, uuidSchema } from '@aegispay/shared';
import type { GeminiContent, GeminiToolCall, JsonValue } from '../integrations/model.ts';

const call = z.strictObject({ name: z.enum(['discover_offers', 'request_quote', 'purchase_quote', 'read_purchase']), args: z.record(z.string(), z.string()), id: z.string().optional(), intent: toolIntentSchema })
  .refine(c => c.name === c.intent.tool && JSON.stringify({ tool: c.name, ...c.args }) === JSON.stringify(c.intent))
  .transform(c => c as GeminiToolCall);
// Provider contents stay private; the adapter independently validates their exact
// schemas, ordering, signatures and aggregate bytes before any provider request.
const content = z.custom<GeminiContent>(v => !!v && typeof v === 'object' && 'role' in v && typeof v.role === 'string' && ['model', 'user'].includes(v.role) && 'parts' in v && Array.isArray(v.parts));
const report = z.object({ call, response: z.record(z.string(), z.custom<JsonValue>()) });
export const checkpointSchema = z.strictObject({
  version: z.literal(1), activeMs: z.number().min(0).max(90000), discovered: z.boolean(),
  contents: z.array(content).max(32), quotes: z.record(z.string(), quoteChallengeSchema),
  pending: z.object({ content, calls: z.array(call).min(1).max(12), index: z.number().int().min(0).max(12), counted: z.boolean(), reports: z.array(report).max(12) }).nullable(),
  purchase: z.object({ quoteId: uuidSchema, clientKey: uuidSchema, attemptId: uuidSchema, operationId: uuidSchema }).nullable(),
  delivered: z.object({ quoteId: uuidSchema, receiptId: uuidSchema }).nullable(),
});
export type RunCheckpoint = z.infer<typeof checkpointSchema>;
export function readCheckpoint(raw: Record<string, unknown> | null, initial: GeminiContent): RunCheckpoint {
  if (!raw) return { version: 1, activeMs: 0, discovered: false, contents: [initial], quotes: {}, pending: null, purchase: null, delivered: null };
  const parsed = checkpointSchema.safeParse(raw);
  if (!parsed.success || Buffer.byteLength(JSON.stringify(raw)) > 512 * 1024) throw new Error('RUN_CHECKPOINT_INVALID');
  if (parsed.data.pending && (parsed.data.pending.index >= parsed.data.pending.calls.length || parsed.data.pending.reports.length !== parsed.data.pending.index)) throw new Error('RUN_CHECKPOINT_INVALID');
  return parsed.data;
}
export function checkedCall(value: unknown): GeminiToolCall {
  const parsed = call.safeParse(value);
  if (!parsed.success) throw new Error('MODEL_INVALID_TOOL_CALL');
  return parsed.data as GeminiToolCall;
}
