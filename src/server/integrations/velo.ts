import { Velo, type GasApi, type GasExecutionIdentity, type GasSponsorReservation, type GasSubmitResult } from '@carts1024/velo-sdk';
import { SpikeGuardError } from './noir.js';

export function createVelo(env: NodeJS.ProcessEnv = process.env) {
  if (!env.VELO_GAS_API_KEY?.trim()) throw new SpikeGuardError('MISSING_CONFIGURATION', ['VELO_GAS_API_KEY']);
  if (!env.VELO_GAS_BASE_URL?.trim()) throw new SpikeGuardError('MISSING_CONFIGURATION', ['VELO_GAS_BASE_URL']);
  return new Velo({ apiKey: env.VELO_GAS_API_KEY, baseUrl: env.VELO_GAS_BASE_URL,
    environment: 'testnet', timeoutMs: 10000, maxRetries: 0 });
}
export function validateReservation(reservation: GasSponsorReservation,
  expected: { innerHash: string; agent: string; escrow: string; expiresAt: number }, now = Date.now()): GasExecutionIdentity {
  if (now >= expected.expiresAt || reservation.decision !== 'reserved' || !reservation.requestId ||
      reservation.transactionHash !== expected.innerHash || reservation.sourceWallet !== expected.agent ||
      reservation.targetContractIds.length !== 1 || reservation.targetContractIds[0] !== expected.escrow ||
      !Number.isFinite(Date.parse(reservation.expiresAt)) || Date.parse(reservation.expiresAt) <= now) {
    throw new SpikeGuardError('RESERVATION_MISMATCH');
  }
  return { requestId: reservation.requestId, transactionHash: reservation.transactionHash };
}
// This proves only the Velo half; independent RPC verification is still mandatory.
export function validateExecution(result: GasSubmitResult, identity: GasExecutionIdentity) {
  if (result.requestId !== identity.requestId || result.transactionHash !== identity.transactionHash ||
      result.status !== 'succeeded' || !result.outerTransactionHash || result.reconciliationRequired) {
    throw new SpikeGuardError('VELO_SUCCESS_NOT_VERIFIED');
  }
  return result;
}

export interface SpikeHandoffJournal {
  // Implementations must exclusively claim an operation and durably flush each
  // write before returning. A process restart after a handoff observes only.
  load(): Promise<{ identity: GasExecutionIdentity | null; handoffCommittedAt: number | null }>;
  saveReservation(identity: GasExecutionIdentity): Promise<void>;
  commitHandoff(at: number): Promise<boolean>;
  deleteEncryptedEnvelope(): Promise<void>;
}
export async function handoffOnce(params: {
  gas: Pick<GasApi, 'sponsor' | 'submit' | 'getStatus'>;
  journal: SpikeHandoffJournal;
  operationId: string;
  signedEnvelope: string;
  expected: { innerHash: string; agent: string; escrow: string; expiresAt: number };
  now?: () => number;
}) {
  const now = params.now ?? Date.now;
  const snapshot = await params.journal.load();
  if (snapshot.handoffCommittedAt !== null) {
    if (!snapshot.identity) throw new SpikeGuardError('HANDOFF_IDENTITY_MISSING');
    // No signing, sponsorship or submission on recovery, including after expiry.
    return params.gas.getStatus(snapshot.identity);
  }
  if (now() >= params.expected.expiresAt) throw new SpikeGuardError('QUOTE_EXPIRED');
  let identity = snapshot.identity;
  if (!identity) {
    const reservation = await params.gas.sponsor(params.signedEnvelope, { idempotencyKey: `aegispay:${params.operationId}` });
    identity = validateReservation(reservation, params.expected, now());
    await params.journal.saveReservation(identity);
  }
  if (identity.transactionHash !== params.expected.innerHash || now() >= params.expected.expiresAt) throw new SpikeGuardError('PRE_HANDOFF_IDENTITY_OR_EXPIRY_MISMATCH');
  if (!(await params.journal.commitHandoff(now()))) return params.gas.getStatus(identity);
  // Delete ciphertext before dispatch. If deletion or dispatch fails, retain
  // the marker and observe by identity; availability cannot justify redispatch.
  await params.journal.deleteEncryptedEnvelope();
  if (now() >= params.expected.expiresAt) throw new SpikeGuardError('QUOTE_EXPIRED_AFTER_HANDOFF_MARKER');
  return params.gas.submit({ ...identity, transactionXdr: params.signedEnvelope }, { maxRetries: 0 });
}
