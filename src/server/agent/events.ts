import { z } from 'zod';
import { amountSchema, attemptStatusSchema, accountSchema, contractSchema, resourceKeySchema, uuidSchema } from '@aegispay/shared';

export const runErrorCodes = ['MODEL_MISSING_API_KEY', 'MODEL_MISSING_MODEL', 'MODEL_INVALID_CONFIG', 'MODEL_UNAVAILABLE', 'MODEL_AUTH_FAILED', 'MODEL_RATE_LIMITED', 'MODEL_TIMEOUT', 'MODEL_ABORTED', 'MODEL_BLOCKED', 'MODEL_REFUSED', 'MODEL_INVALID_TOOL_CALL', 'MODEL_INVALID_RESPONSE', 'MODEL_REQUEST_TOO_LARGE', 'MODEL_TURN_LIMIT', 'TOOL_STEP_LIMIT', 'ACTIVE_TIME_LIMIT', 'MODEL_DEPENDENCY_UNAVAILABLE', 'RUN_CHECKPOINT_INVALID', 'PAYMENT_UNRESOLVED'] as const;
export const safeRunCode = (value: unknown): typeof runErrorCodes[number] => runErrorCodes.includes(value as typeof runErrorCodes[number]) ? value as typeof runErrorCodes[number] : 'MODEL_DEPENDENCY_UNAVAILABLE';
const identity = { quoteId: uuidSchema, attemptId: uuidSchema, operationId: uuidSchema };
const quoteFields = { quoteId: uuidSchema, resourceKey: resourceKeySchema, amountStroops: amountSchema, assetContractId: contractSchema, merchantAddress: accountSchema, expiresAt: z.iso.datetime() };
export const runEventSchemas = {
  run_started: z.object({}),
  model_turn: z.object({ turn: z.number().int().min(1).max(8) }),
  tool_selected: z.object({ tool: z.enum(['discover_offers', 'request_quote', 'purchase_quote', 'read_purchase']) }),
  quote_received: z.object(quoteFields),
  payment_accepted: z.object({ ...quoteFields, ...identity }),
  payment_observed: z.object({ ...identity, status: attemptStatusSchema, receiptId: uuidSchema.nullable() }),
  resource_delivered: z.object({ quoteId: uuidSchema, receiptId: uuidSchema, resourceKey: resourceKeySchema }),
  run_completed: z.object({ receiptId: uuidSchema.optional() }),
  run_stopped: z.object({ code: z.enum(runErrorCodes) }),
} as const;
export type RunEventKind = keyof typeof runEventSchemas;
// Zod object projection strips all unlisted fields; unknown kinds/invalid payloads
// are omitted. Never serialize arbitrary stored JSON, even for an owning session.
export function projectRunEvent(row: { id: bigint; kind: string; safePayload: unknown; createdAt: Date }) {
  if (!Object.hasOwn(runEventSchemas, row.kind)) return null;
  const parsed = runEventSchemas[row.kind as RunEventKind].safeParse(row.safePayload);
  if (!parsed.success) return null;
  return { id: row.id.toString(), kind: row.kind, safePayload: parsed.data, createdAt: row.createdAt.toISOString() };
}
