import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { DomainError, deny } from '../domain/purchases.js';
import { SpikeGuardError } from '../integrations/noir.js';

export function checkOrigin(request: Request, origin: string) {
  if (request.headers.get('origin') !== origin || request.headers.get('sec-fetch-site') === 'cross-site') deny('ORIGIN_DENIED');
}
export async function jsonBody(request: Request, limit = 16384): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json') deny('INVALID_INPUT');
  const declared = request.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || BigInt(declared) > BigInt(limit))) deny('BODY_TOO_LARGE');
  const reader = request.body?.getReader();
  if (!reader) deny('INVALID_INPUT');
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > limit) { await reader.cancel(); deny('BODY_TOO_LARGE'); }
      chunks.push(next.value);
    }
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
    catch { deny('INVALID_INPUT'); }
  } finally { reader.releaseLock(); }
}
export function json(value: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(value, (_key, v: unknown) => typeof v === 'bigint' ? v.toString() : v), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers },
  });
}
const statuses: Record<string, number> = {
  AUTH_INVALID: 401, FORBIDDEN: 403, ORIGIN_DENIED: 403, NOT_FOUND: 404, INVALID_INPUT: 400, BODY_TOO_LARGE: 413,
  RATE_LIMITED: 429, IDEMPOTENCY_CONFLICT: 409, RUN_ACTIVE: 409, OPERATION_ACTIVE: 409, QUOTE_EXPIRED: 410,
  POLICY_REFUSED: 422, POLICY_NOT_READY: 422, BUDGET_EXCEEDED: 422, CONTRACT_MISMATCH: 422,
  RECEIPT_INVALID: 403, ENTITLEMENT_EXPIRED: 403, RESOURCE_MISMATCH: 403,
};
export function safeError(error: unknown) {
  const code = error instanceof ZodError ? 'INVALID_INPUT' : error instanceof DomainError ? error.code :
    error instanceof SpikeGuardError ? (error.code === 'MISSING_CONFIGURATION' ? 'DEPENDENCY_UNAVAILABLE' : 'INTEGRATION_NOT_VERIFIED') : 'DEPENDENCY_UNAVAILABLE';
  const status = statuses[code] ?? 503;
  return json({ error: { code, message: code.replaceAll('_', ' ').toLowerCase(), correlationId: randomUUID() } }, status,
    status === 429 ? { 'Retry-After': '60' } : {});
}
