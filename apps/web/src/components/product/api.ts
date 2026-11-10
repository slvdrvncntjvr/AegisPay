'use client';

export type Role = 'owner' | 'merchant';
export interface Offer { id: string; resourceKey: string; description: string; priceStroops: string; enabled: boolean; isDemo: boolean }
export interface Run { id: string; task: string; status: string; finalAnswer: string | null; errorCode: string | null; reservedStroops?: string; spentStroops?: string }
export interface Attempt { attemptId: string; quoteId: string; operationId: string; status: string; innerHash: string | null; outerHash: string | null; veloRequestId?: string | null; veloStatus: string | null; errorCode: string | null; receiptId?: string | null }
export interface WalletOperation { operationId: string; kind: string; status: string; txHash?: string | null; expiresAt: string }
export interface Agent { id: string; publicKey: string; deviceHash: string; status: string; policyMaxStroops: string; policyExpiresAt: string; policyObservedLedger: string | null; deviceContractId: string; agentContractId: string; escrowContractId: string; assetContractId: string }
export interface Claim { id: string; status: string; txHash: string | null; observedClaimAmountStroops: string | null; confirmedAt: string | null }
export interface ConsoleState { role: Role; network: string; walletAddress?: string; agent?: Agent; offers: Offer[]; runs?: Run[]; attempts?: Attempt[]; walletOperations: WalletOperation[]; claims?: Claim[] }
export interface WalletState { policy?: { maxAmountStroops: string; expiresAt: string } | null; escrowStroops?: string; pendingStroops?: string; deviceOwner?: string | null; deviceAgent?: string | null; assetContractId: string | null; observedAt: string; observedLedger: string | number }
export interface Prepared { operationId: string; unsignedXdr: string; networkPassphrase: string; signerAddress: string; expiresAt: string }
export interface Receipt { receiptId: string; quoteId: string; resourceKey: string; fixtureVersion: string; validUntil: string; evidence: Record<string, unknown> }
export interface Report { isDemo: boolean; resourceKey: string; receiptId: string; report: { title: string; label: string; findings: unknown[] } }
export interface RunEvent { id: string; kind: string; safePayload: Record<string, unknown>; createdAt: string }

export class ApiError extends Error {
  constructor(public code: string, public status = 0) { super(code); }
}
export function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
export function safeCode(value: unknown): string { return typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(value) ? value : 'REQUEST_UNAVAILABLE'; }
export function errorText(error: unknown): string {
  const code = error instanceof ApiError ? error.code : 'NETWORK_UNAVAILABLE';
  if (code === 'SESSION_EXPIRED') return 'Session expired. Returning to private access…';
  return `Request unavailable · ${code}. No new payment was requested.`;
}

// Only same-origin application paths are accepted. No bearer, receipt token or key
// is stored in browser storage, and SDK/provider messages never enter the UI.
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!path.startsWith('/api/')) throw new ApiError('INVALID_ROUTE');
  const response = await fetch(path, { ...init, credentials: 'same-origin', cache: 'no-store', signal: init.signal ?? AbortSignal.timeout(15000) });
  if (response.status === 401) {
    window.dispatchEvent(new Event('aegis-session-expired'));
    throw new ApiError('SESSION_EXPIRED', 401);
  }
  if (response.status === 204 && response.ok) return undefined as T;
  let body: unknown;
  try { body = await response.json(); } catch { throw new ApiError('INVALID_RESPONSE', response.status); }
  if (!response.ok) throw new ApiError(record(body) && record(body.error) ? safeCode(body.error.code) : 'REQUEST_UNAVAILABLE', response.status);
  if (!record(body)) throw new ApiError('INVALID_RESPONSE', response.status);
  return body as T;
}
export function jsonMutation(method: string, body: unknown): RequestInit { return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }; }
export function validateState(state: ConsoleState): ConsoleState {
  const strings = (value: unknown, fields: string[]) => record(value) && fields.every(field => typeof value[field] === 'string');
  if (!['owner', 'merchant'].includes(state.role) || state.network !== 'testnet' || !Array.isArray(state.offers) || !Array.isArray(state.walletOperations)
    || state.offers.some(o => !strings(o, ['id','priceStroops','resourceKey','description']) || typeof o.enabled !== 'boolean' || typeof o.isDemo !== 'boolean')
    || state.walletOperations.some(o => !strings(o, ['operationId','kind','status','expiresAt']))
    || state.role === 'owner' && (!Array.isArray(state.runs) || !Array.isArray(state.attempts)
      || state.runs.some(r => !strings(r, ['id','task','status']))
      || state.attempts.some(a => !strings(a, ['attemptId','quoteId','operationId','status']))
      || state.agent != null && !strings(state.agent, ['id','publicKey','deviceHash','status','policyMaxStroops','policyExpiresAt','deviceContractId','agentContractId','escrowContractId','assetContractId']))
    || state.role === 'merchant' && (!Array.isArray(state.claims) || state.claims.some(c => !strings(c,['id','status'])))) throw new ApiError('INVALID_STATE_RESPONSE');
  return state;
}
export function amount(value: unknown): string {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,38})$/.test(value)) return 'Unavailable';
  const n = BigInt(value);
  return `${n / 10000000n}.${(n % 10000000n).toString().padStart(7, '0')} XLM`;
}
export function time(value: unknown): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return 'Unavailable';
  return new Date(value).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
}
export function positiveInteger(value: string, maximum = (1n << 127n) - 1n): boolean {
  return /^[1-9][0-9]{0,38}$/.test(value) && BigInt(value) <= maximum;
}
export const activeRun = (run: Run) => ['queued', 'running', 'waiting_payment'].includes(run.status);
export const pendingWallet = (op: WalletOperation) => ['prepared', 'submitting', 'unknown'].includes(op.status) && !(op.status === 'prepared' && Date.parse(op.expiresAt) <= Date.now());
