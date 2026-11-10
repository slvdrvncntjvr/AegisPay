import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { afterAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDatabase } from './support/database.ts';
import { acceptInput, fixture } from './support/fixtures.ts';
import { assertOwnedPid, events, hash, installProcessTables, provider, stages, startPaymentChild, syntheticKey,
  type DeathStage, type OwnedChild } from './support/process-death.ts';
import { acceptQuote } from '../../src/server/domain/purchases.ts';
import { decryptEnvelope, paymentSnapshot } from '../../apps/server/src/worker/payment.ts';
import * as s from '../../src/server/db/schema.ts';

describe('TASK-017 / TC-007/012/019/029 actual OS death and fresh-process recovery (synthetic transport)', () => {
  const evidence: Record<string, unknown>[] = [];
  afterAll(async () => {
    if (process.env.AEGISPAY_PROCESS_DEATH_EVIDENCE !== '1') return;
    // Fixed task-local destination. No DB URL, envelope, key or live proof.
    await mkdir('docs/evidence/finals-process-recovery', { recursive: true });
    await writeFile('docs/evidence/finals-process-recovery/synthetic-process-assertions.json', JSON.stringify({
      format: 'aegispay-synthetic-process-death/1', synthetic: true, generatedAt: new Date().toISOString(),
      platform: process.platform, node: process.version, quoteTtlMs: 120000,
      acceleration: 'After proven OS exit and durable active lease, isolated-schema CAS expires only the exact killed owner lease; production 120-second lease unchanged.',
      cases: evidence,
    }, null, 2) + '\n');
  });

  async function qualify(stage: DeathStage, expireBeforeRecovery = false) {
    const started = Date.now(), db = await createTestDatabase(), invocation = randomUUID();
    const children: OwnedChild[] = [];
    const childExits: Record<string, unknown>[] = [];
    try {
      await installProcessTables(db.first, invocation);
      const f = await fixture(db.first, { quoteTtlMs: expireBeforeRecovery ? 10000 : 120000 });
      const attempt = await acceptQuote(db.first, acceptInput(f));
      const original = await paymentSnapshot(db.second, attempt.id);
      const parentBackend = (await db.second.pool.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
      function spawn(stopAt: DeathStage | null) {
        const child = startPaymentChild(db.schemaName, { invocation, attemptId: attempt.id, actor: randomUUID(), stopAt });
        children.push(child); return child;
      }
      async function recover() {
        const child = spawn(null);
        const ready = await child.wait('ready');
        expect(ready.actor).toBe(child.input.actor); assertOwnedPid(child.child, ready.pid);
        expect(ready.pid).not.toBe(killed.child.pid); expect(ready.backendPid).not.toBe(blocked.backendPid);
        expect(ready.backendPid).not.toBe(parentBackend);
        await child.wait('done');
        const exit = await child.exit;
        expect(exit).toEqual({ code: 0, signal: null }); expect(child.outputBytes()).toBe(0);
        childExits.push({ actor: child.input.actor, pid: ready.pid, backendPid: ready.backendPid, ...exit });
        const snapshot = await paymentSnapshot(db.second, attempt.id);
        expect(snapshot.agent.leaseOwner).toBeNull(); expect(snapshot.agent.leaseUntil).toBeNull();
        const log = await events(db.second);
        expect(log.filter(e => e.actor === child.input.actor && e.kind === 'finally')).toHaveLength(1);
      }

      const killed = spawn(stage), ready = await killed.wait('ready'), blocked = await killed.wait('blocked');
      assertOwnedPid(killed.child, blocked.pid);
      expect(ready.pid).toBe(blocked.pid); expect(blocked.stage).toBe(stage);
      expect(blocked.backendPid).not.toBe(parentBackend);
      const atHook = await paymentSnapshot(db.second, attempt.id);
      expect(atHook.agent.leaseOwner).not.toBeNull(); expect(atHook.agent.leaseUntil).not.toBeNull();
      const activeBefore = await db.second.pool.query<{ active: boolean; lease_text: string }>(
        'SELECT lease_until > clock_timestamp() AS active, lease_until::text AS lease_text FROM agent WHERE id=$1 AND lease_owner=$2', [f.agent.id, atHook.agent.leaseOwner]);
      expect(activeBefore.rows[0]!.active).toBe(true);
      expect((await events(db.second)).filter(e => e.actor === killed.input.actor && e.kind === 'finally')).toHaveLength(0);

      // Node maps this to TerminateProcess on Windows; it does not inject an
      // exception into JavaScript or execute the executor's catch/finally.
      const exit = await killed.stop();
      expect(exit).toEqual({ code: null, signal: 'SIGKILL' }); expect(killed.outputBytes()).toBe(0);
      childExits.push({ actor: killed.input.actor, pid: blocked.pid, backendPid: blocked.backendPid, ...exit });
      const afterDeath = await paymentSnapshot(db.second, attempt.id);
      expect(afterDeath.attempt).toEqual(atHook.attempt);
      expect(afterDeath.agent.leaseOwner).toBe(atHook.agent.leaseOwner);
      expect(afterDeath.agent.leaseUntil).toEqual(atHook.agent.leaseUntil);
      expect((await events(db.second)).filter(e => e.actor === killed.input.actor && ['finally', 'done'].includes(e.kind))).toHaveLength(0);
      const p = await provider(db.second, attempt.id);
      expect(afterDeath.attempt.nonce).toBe(original.attempt.nonce);
      expect(afterDeath.agent.lastNonce).toBe(original.agent.lastNonce);
      expect(afterDeath.quote).toEqual(original.quote);
      const grantsBefore = await db.second.db.select().from(s.entitlement).where(eq(s.entitlement.quoteId, f.quote.id));
      expect(grantsBefore).toHaveLength(0);
      const evidenceBefore = await db.second.db.select().from(s.paymentEvidence).where(eq(s.paymentEvidence.attemptId, attempt.id));
      expect(evidenceBefore).toHaveLength(0);
      const [heldBefore] = await db.second.db.select().from(s.agentRun).where(eq(s.agentRun.id, f.run.id));
      expect(heldBefore!.reservedStroops).toBe('300000'); expect(heldBefore!.spentStroops).toBe('0');

      const hasMarker = ['after_handoff_before_send', 'after_submit', 'before_grant'].includes(stage);
      expect(Boolean(afterDeath.attempt.handoffCommittedAt)).toBe(hasMarker);
      if (hasMarker) {
        expect(afterDeath.attempt.handoffCommittedAt!.getTime()).toBeLessThan(f.quote.expiresAt.getTime());
        expect(afterDeath.attempt.signedXdrCiphertext).toBeNull();
        expect(afterDeath.attempt.cipherIv).toBeNull(); expect(afterDeath.attempt.cipherTag).toBeNull();
        expect(afterDeath.attempt.encryptionKeyVersion).toBeNull();
      } else if (stage !== 'after_sign_before_persist') {
        expect(afterDeath.attempt.signedXdrCiphertext).not.toBeNull();
        expect(hash(decryptEnvelope(afterDeath.attempt, syntheticKey))).toBe(p.fingerprint);
        expect(afterDeath.attempt.signedXdrFingerprint).toBe(p.fingerprint);
      } else {
        expect(afterDeath.attempt.status).toBe('preparing'); expect(afterDeath.attempt.innerHash).toBeNull();
        expect(afterDeath.attempt.signedXdrCiphertext).toBeNull();
      }
      if (afterDeath.attempt.veloRequestId) expect(afterDeath.attempt.veloRequestId).toBe(p.request_id);
      if (afterDeath.attempt.innerHash) expect(afterDeath.attempt.innerHash).toBe(p.inner_hash);
      if (stage === 'after_submit') {
        expect(p.outer_hash).not.toBeNull(); expect(afterDeath.attempt.status).toBe('submitting');
        expect(afterDeath.attempt.outerHash).toBeNull(); // Provider returned, local save never ran.
      }

      // An early fresh process is denied by the still-durable production lease.
      // It must not sign/sponsor/submit/observe or clear the killed owner's lease.
      const denied = spawn(null);
      await denied.wait('ready'); await denied.wait('done');
      const deniedExit = await denied.exit;
      expect(deniedExit).toEqual({ code: 0, signal: null }); expect(denied.outputBytes()).toBe(0);
      const deniedEvents = (await events(db.second)).filter(e => e.actor === denied.input.actor);
      expect(deniedEvents.map(e => e.kind)).toEqual(['start', 'finally', 'done']);
      childExits.push({ actor: denied.input.actor, pid: denied.child.pid, role: 'lease-denied', ...deniedExit });
      expect((await paymentSnapshot(db.second, attempt.id)).agent.leaseOwner).toBe(atHook.agent.leaseOwner);

      // Fenced acceleration only after OS exit + durable active lease proof.
      const leaseExpired = await db.second.pool.query(`UPDATE agent SET lease_until=clock_timestamp()-interval '1 second'
        WHERE id=$1 AND lease_owner=$2 AND lease_until=$3 AND lease_until > clock_timestamp() RETURNING id`,
        [f.agent.id, atHook.agent.leaseOwner, activeBefore.rows[0]!.lease_text]);
      // Keep PostgreSQL's full microsecond value for the exact lease CAS.
      expect(leaseExpired.rowCount).toBe(1);
      if (expireBeforeRecovery) {
        await db.second.pool.query('SELECT pg_sleep(greatest(0,extract(epoch FROM $1::timestamptz-clock_timestamp()))+0.01)', [f.quote.expiresAt]);
        const expired = await db.second.pool.query<{ expired: boolean }>('SELECT clock_timestamp() > $1::timestamptz AS expired', [f.quote.expiresAt]);
        expect(expired.rows[0]!.expired).toBe(true);
      }
      await recover(); await recover();
      // A third independent observation of the post-marker/no-send case still
      // cannot turn the marker into a financial retry.
      if (stage === 'after_handoff_before_send') await recover();
      const final = await paymentSnapshot(db.second, attempt.id), log = await events(db.second);
      const counts = Object.fromEntries(['sign', 'sponsor', 'submit', 'observe', 'verify'].map(kind => [kind, log.filter(e => e.kind === kind).length]));
      const unresolved = ['after_sign_before_persist', 'after_handoff_before_send'].includes(stage);
      expect(counts).toEqual({ sign: 1, sponsor: stage === 'after_sign_before_persist' ? 0 : stage === 'after_reserve_before_persist' ? 2 : 1,
        submit: unresolved ? 0 : 1, observe: stage === 'after_sign_before_persist' ? 0 : stage === 'after_handoff_before_send' ? 3 : stage === 'before_grant' ? 2 : 1,
        verify: stage === 'after_sign_before_persist' || stage === 'after_handoff_before_send' ? 0 : stage === 'before_grant' ? 2 : 1 });
      expect(final.attempt.status).toBe(stage === 'after_sign_before_persist' ? 'manual_review' : stage === 'after_handoff_before_send' ? 'unknown' : 'authorized');
      if (stage === 'after_sign_before_persist') expect(final.attempt.errorCode).toBe('PREPARATION_INTERRUPTED');
      expect(final.attempt.operationId).toBe(original.attempt.operationId);
      expect(final.attempt.idempotencyKey).toBe(original.attempt.idempotencyKey);
      expect(final.attempt.nonce).toBe(original.attempt.nonce); expect(final.agent.lastNonce).toBe(original.agent.lastNonce);
      expect(final.quote.termsHash).toBe(original.quote.termsHash); expect(final.quote.amountStroops).toBe(original.quote.amountStroops);
      expect(final.quote.expiresAt).toEqual(original.quote.expiresAt); expect(final.quote.acceptedAt).toEqual(original.quote.acceptedAt);
      if (hasMarker) expect(final.attempt.handoffCommittedAt).toEqual(afterDeath.attempt.handoffCommittedAt);
      if (afterDeath.attempt.innerHash) expect(final.attempt.innerHash).toBe(afterDeath.attempt.innerHash);
      if (p.request_id) expect(final.attempt.veloRequestId).toBe(p.request_id);
      if (stage !== 'after_sign_before_persist') expect(final.attempt.signedXdrFingerprint).toBe(p.fingerprint);
      expect(final.attempt.signedXdrCiphertext).toBeNull(); expect(final.attempt.cipherIv).toBeNull();
      expect(final.attempt.cipherTag).toBeNull(); expect(final.attempt.encryptionKeyVersion).toBeNull();
      const submits = log.filter(e => e.kind === 'submit');
      for (const e of submits) {
        expect(e.detail.fingerprint).toBe(p.fingerprint); expect(e.detail.requestId).toBe(final.attempt.veloRequestId);
        expect(e.detail.innerHash).toBe(final.attempt.innerHash); expect(e.detail.maxRetries).toBe(0);
      }
      for (const e of log.filter(e => e.kind === 'observe')) {
        expect(e.detail.requestId).toBe(final.attempt.veloRequestId); expect(e.detail.innerHash).toBe(final.attempt.innerHash);
      }
      const grants = await db.second.db.select().from(s.entitlement).where(eq(s.entitlement.quoteId, f.quote.id));
      const proofs = await db.second.db.select().from(s.paymentEvidence).where(eq(s.paymentEvidence.attemptId, attempt.id));
      expect(grants).toHaveLength(unresolved ? 0 : 1); expect(proofs).toHaveLength(unresolved ? 0 : 1);
      if (!unresolved) {
        expect(grants[0]!.evidenceId).toBe(proofs[0]!.id); expect(proofs[0]!.nonce).toBe(attempt.nonce);
        expect(proofs[0]!.innerHash).toBe(final.attempt.innerHash); expect(proofs[0]!.outerHash).toBe(final.attempt.outerHash);
        expect(proofs[0]!.noirEventId).toMatch(/^synthetic-process-event-/);
      }
      const audit = await db.second.db.select().from(s.auditEvent).where(eq(s.auditEvent.entityId, attempt.id));
      expect(audit.filter(e => e.kind === 'authorization_verified')).toHaveLength(unresolved ? 0 : 1);
      const [run] = await db.second.db.select().from(s.agentRun).where(eq(s.agentRun.id, f.run.id));
      expect(run!.reservedStroops).toBe(unresolved ? '300000' : '0'); expect(run!.spentStroops).toBe(unresolved ? '0' : '300000');
      evidence.push({ stage, expireBeforeRecovery, invocation, schema: db.schemaName, attemptId: attempt.id,
        operationId: attempt.operationId, nonce: attempt.nonce, termsHash: original.quote.termsHash,
        syntheticRequestId: final.attempt.veloRequestId, syntheticInnerHash: final.attempt.innerHash,
        syntheticOuterHash: final.attempt.outerHash, envelopeFingerprint: p.fingerprint,
        handoffCommittedAt: final.attempt.handoffCommittedAt, childExits, counts,
        finallyForKilledProcess: 0, durableLeaseSurvivedDeath: true, leaseDeniedProcessDidNoProviderWork: true,
        leaseAcceleration: 'isolated exact-owner CAS after verified SIGKILL exit', quoteTtlMs: expireBeforeRecovery ? 10000 : 120000,
        status: final.attempt.status, evidenceRows: proofs.length, grants: grants.length,
        reservedStroops: run!.reservedStroops, spentStroops: run!.spentStroops,
        ciphertextWiped: true, identityTermsAndNoncePreserved: true,
        elapsedMs: Date.now() - started, events: log.map(e => ({ ...e, at: e.at.toISOString() })) });
    } finally {
      // No process-name searches or broad kills; schemas are dropped only by
      // createTestDatabase's exact UUID + ownership-comment cleanup guard.
      await Promise.all(children.map(child => child.stop()));
      await db.cleanup();
    }
  }
  for (const stage of stages) it(`SIGKILL at ${stage}, then fresh-process recovery preserves one handoff`, () => qualify(stage), 60000);
  it('post-submit death recovers persisted synthetic success after immutable quote expiry', () => qualify('after_submit', true), 60000);
});
