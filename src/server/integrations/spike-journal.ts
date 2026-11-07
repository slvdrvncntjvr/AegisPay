// A single-operation, append-only local spike journal. The application worker
// will use PostgreSQL (TASK-003), not this harness-specific storage.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { GasExecutionIdentity } from '@carts1024/velo-sdk';
import { SpikeGuardError } from './noir.js';
import type { SpikeHandoffJournal } from './velo.js';

const operationSchema = z.object({ operationId: z.string().min(1).max(128), nonce: z.string().regex(/^[1-9]\d*$/),
  expiresAt: z.number().int().positive(), intentHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const identitySchema = z.object({ requestId: z.string().min(1).max(256), transactionHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const markerSchema = z.object({ at: z.number().int().positive(), identity: identitySchema }).strict();
const terminalSchema = z.object({ terminalCode: z.enum(['QUOTE_EXPIRED', 'POLICY_REFUSED']), at: z.number().int().positive() }).strict();
const cipherSchema = z.object({ iv: z.string().regex(/^[a-f0-9]{24}$/), tag: z.string().regex(/^[a-f0-9]{32}$/),
  ciphertext: z.string().regex(/^[a-f0-9]+$/), fingerprint: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
type Operation = z.infer<typeof operationSchema>;

function isMissing(error: unknown) { return (error as NodeJS.ErrnoException)?.code === 'ENOENT'; }
async function readJson(file: string): Promise<unknown | null> {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (isMissing(error)) return null; throw new SpikeGuardError('JOURNAL_CORRUPT_OR_UNREADABLE'); }
}
// The existence of a partial file after a crash is a stop, never permission to
// overwrite it. File data is flushed before any financial handoff can continue.
async function createRecord(file: string, value: unknown) {
  let handle;
  try { handle = await open(file, 'wx', 0o600); }
  catch (error) { if ((error as NodeJS.ErrnoException)?.code === 'EEXIST') return false; throw new SpikeGuardError('JOURNAL_WRITE_FAILED'); }
  try { await handle.writeFile(JSON.stringify(value) + '\n'); await handle.sync(); }
  catch { throw new SpikeGuardError('JOURNAL_WRITE_FAILED'); }
  finally { await handle.close(); }
  return true;
}

export { readJson as readSpikeRecord, createRecord as writeSpikeRecord };

export class SpikeJournal implements SpikeHandoffJournal {
  private constructor(readonly directory: string, private readonly key: Buffer, readonly operation: Readonly<Operation>) {}
  static async open(directory: string, key: Buffer, initial?: Operation) {
    if (key.length !== 32) throw new SpikeGuardError('INVALID_ENVELOPE_ENCRYPTION_KEY');
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const file = join(directory, 'operation.json');
    if (initial) {
      const parsed = operationSchema.parse(initial);
      if (BigInt(parsed.nonce) >= 1n << 64n) throw new SpikeGuardError('INVALID_FINANCIAL_INTEGER');
      await createRecord(file, parsed);
    }
    const value = operationSchema.safeParse(await readJson(file));
    if (!value.success) throw new SpikeGuardError('JOURNAL_OPERATION_MISSING_OR_INVALID');
    if (initial && JSON.stringify(value.data) !== JSON.stringify(operationSchema.parse(initial))) throw new SpikeGuardError('OPERATION_ALREADY_SAVED');
    return new SpikeJournal(directory, Buffer.from(key), Object.freeze(value.data));
  }
  async load() {
    const handoff = await readJson(join(this.directory, 'handoff.json'));
    const terminal = terminalSchema.safeParse(handoff);
    if (terminal.success) {
      // A crash or failed unlink can leave ciphertext after the immutable
      // refusal. Retry cleanup before refusing every recovery path; never
      // interpret this terminal decision as an uncommitted financial handoff.
      await this.removeEncryptedEnvelope();
      throw new SpikeGuardError(`TERMINAL_PRE_HANDOFF_${terminal.data.terminalCode}`);
    }
    const reservation = await readJson(join(this.directory, 'reservation.json'));
    const identity = reservation === null ? null : identitySchema.parse(reservation);
    const marker = handoff === null ? null : markerSchema.parse(handoff);
    if (marker && (!identity || JSON.stringify(marker.identity) !== JSON.stringify(identity))) throw new SpikeGuardError('HANDOFF_IDENTITY_MISSING');
    return { identity, handoffCommittedAt: marker?.at ?? null };
  }
  async saveEnvelope(envelope: string) {
    if ((await this.load()).handoffCommittedAt !== null) throw new SpikeGuardError('HANDOFF_ALREADY_COMMITTED');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(this.operation.operationId));
    const ciphertext = Buffer.concat([cipher.update(envelope, 'utf8'), cipher.final()]);
    const record = { iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex'), ciphertext: ciphertext.toString('hex'),
      fingerprint: createHash('sha256').update(envelope).digest('hex') };
    if (!(await createRecord(join(this.directory, 'envelope.json'), record))) throw new SpikeGuardError('ENVELOPE_ALREADY_SAVED');
    // Another process can commit between our first check and the file write.
    if ((await this.load()).handoffCommittedAt !== null) {
      await this.deleteEncryptedEnvelope();
      throw new SpikeGuardError('HANDOFF_ALREADY_COMMITTED');
    }
  }
  async readEnvelope() {
    if ((await this.load()).handoffCommittedAt !== null) throw new SpikeGuardError('HANDOFF_ALREADY_COMMITTED');
    const record = cipherSchema.safeParse(await readJson(join(this.directory, 'envelope.json')));
    // The decision may have changed during the asynchronous envelope read.
    // Recheck before decrypting, even when the envelope read itself was invalid.
    if ((await this.load()).handoffCommittedAt !== null) throw new SpikeGuardError('HANDOFF_ALREADY_COMMITTED');
    if (!record.success) throw new SpikeGuardError('ENVELOPE_MISSING_OR_INVALID');
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(record.data.iv, 'hex'));
      decipher.setAAD(Buffer.from(this.operation.operationId));
      decipher.setAuthTag(Buffer.from(record.data.tag, 'hex'));
      const envelope = Buffer.concat([decipher.update(Buffer.from(record.data.ciphertext, 'hex')), decipher.final()]).toString('utf8');
      if (createHash('sha256').update(envelope).digest('hex') !== record.data.fingerprint) throw new Error('mismatch');
      return envelope;
    } catch { throw new SpikeGuardError('ENVELOPE_DECRYPTION_FAILED'); }
  }
  async saveReservation(identity: GasExecutionIdentity) {
    await this.load();
    const value = identitySchema.parse(identity);
    if (!(await createRecord(join(this.directory, 'reservation.json'), value))) {
      if (JSON.stringify((await this.load()).identity) !== JSON.stringify(value)) throw new SpikeGuardError('RESERVATION_ALREADY_SAVED');
    }
    await this.load();
  }
  async commitHandoff(at: number) {
    const { identity, handoffCommittedAt } = await this.load();
    if (handoffCommittedAt !== null) return false;
    if (!identity) throw new SpikeGuardError('HANDOFF_IDENTITY_MISSING');
    if (!Number.isSafeInteger(at) || at <= 0 || at >= this.operation.expiresAt) throw new SpikeGuardError('QUOTE_EXPIRED');
    const committed = await createRecord(join(this.directory, 'handoff.json'), markerSchema.parse({ at, identity }));
    // An exclusive-create loser may be a refusal, not another dispatcher.
    if (!committed) await this.load();
    return committed;
  }
  async deleteEncryptedEnvelope() {
    if ((await this.load()).handoffCommittedAt === null) throw new SpikeGuardError('HANDOFF_NOT_COMMITTED');
    await this.removeEncryptedEnvelope();
  }
  private async removeEncryptedEnvelope() {
    try { await unlink(join(this.directory, 'envelope.json')); }
    catch (error) { if (!isMissing(error)) throw new SpikeGuardError('ENVELOPE_DELETE_FAILED'); }
  }
  async refuseBeforeHandoff(code: 'QUOTE_EXPIRED' | 'POLICY_REFUSED') {
    // Terminal refusal and financial dispatch compete for the same exclusive
    // decision record. A refusal cannot race a committed send into a retry.
    const file = join(this.directory, 'handoff.json');
    if (!(await createRecord(file, terminalSchema.parse({ terminalCode: code, at: Date.now() })))) {
      const saved = terminalSchema.safeParse(await readJson(file));
      // Never delete based on a partial/invalid or financial handoff marker,
      // and never replace its original code or timestamp to repair cleanup.
      if (!saved.success) throw new SpikeGuardError('HANDOFF_DECISION_ALREADY_SAVED');
      await this.removeEncryptedEnvelope();
      if (saved.data.terminalCode !== code) throw new SpikeGuardError('HANDOFF_DECISION_ALREADY_SAVED');
      return;
    }
    await this.removeEncryptedEnvelope();
  }
}
