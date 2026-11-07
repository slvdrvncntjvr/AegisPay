import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handoffOnce, type SpikeHandoffJournal } from '../../src/server/integrations/velo.js';
import type { GasApi, GasExecutionIdentity } from '@carts1024/velo-sdk';

function fixture() {
  let identity: GasExecutionIdentity | null = null;
  let handoffCommittedAt: number | null = null;
  const calls: string[] = [];
  const result = { object: 'gas_submit_result' as const, requestId: 'synthetic-request', transactionHash: 'aa'.repeat(32),
    outerTransactionHash: null, status: 'submitted' as const, reservedStroops: '100', actualFeeStroops: null,
    expiresAt: new Date(200000).toISOString(), reconciliationRequired: true };
  const expected = { innerHash: result.transactionHash, agent: 'synthetic-agent', escrow: 'synthetic-escrow', expiresAt: 200000 };
  const journal: SpikeHandoffJournal = {
    async load() { return { identity, handoffCommittedAt }; },
    async saveReservation(value) { calls.push('persist-reservation'); identity = value; },
    async commitHandoff(at) { if (handoffCommittedAt !== null) return false; calls.push('persist-handoff'); handoffCommittedAt = at; return true; },
    async deleteEncryptedEnvelope() { calls.push('delete-envelope'); },
  };
  const gas: Pick<GasApi, 'sponsor' | 'submit' | 'getStatus'> = {
    async sponsor(_envelope, options) { calls.push('sponsor'); assert.equal(options.idempotencyKey, 'aegispay:synthetic-operation');
      return { object: 'gas_sponsor_reservation', requestId: result.requestId, replayed: false, decision: 'reserved',
        transactionHash: expected.innerHash, sourceWallet: expected.agent, targetContractIds: [expected.escrow],
        innerMaxFeeStroops: '100', reservedStroops: '100', expiresAt: result.expiresAt };
    },
    async submit(_params, options) { calls.push('submit'); assert.equal(options?.maxRetries, 0); return result; },
    async getStatus(value) { calls.push('observe'); assert.equal(Object.keys(value).length, 2); return result; },
  };
  return { journal, gas, expected, calls, operationId: 'synthetic-operation', signedEnvelope: 'synthetic-never-network-xdr', now: () => 100000 };
}
test('TC-029: reservation and handoff are persisted before the sole financial dispatch', async () => {
  const f = fixture();
  await handoffOnce(f);
  await handoffOnce(f);
  assert.deepEqual(f.calls, ['sponsor', 'persist-reservation', 'persist-handoff', 'delete-envelope', 'submit', 'observe']);
});
test('TC-012: timeout after handoff recovers by identity even when quote later expires', async () => {
  const f = fixture();
  f.gas.submit = async () => { f.calls.push('submit-unknown'); throw new Error('synthetic-disconnect'); };
  await assert.rejects(handoffOnce(f));
  await handoffOnce({ ...f, now: () => 300000 });
  assert.equal(f.calls.filter(call => call === 'sponsor').length, 1);
  assert.equal(f.calls.filter(call => call === 'submit-unknown').length, 1);
  assert.equal(f.calls.at(-1), 'observe');
});
test('TC-029: crash after marker but before send conservatively observes without sending', async () => {
  const f = fixture();
  f.journal.deleteEncryptedEnvelope = async () => { throw new Error('synthetic-crash'); };
  await assert.rejects(handoffOnce(f));
  await handoffOnce(f);
  assert.equal(f.calls.includes('submit'), false);
  assert.equal(f.calls.at(-1), 'observe');
});
test('TC-017: reservation mismatch prevents persistence and financial dispatch', async () => {
  const f = fixture();
  await assert.rejects(handoffOnce({ ...f, expected: { ...f.expected, innerHash: 'bb'.repeat(32) } }));
  assert.deepEqual(f.calls, ['sponsor']);
});
for (const delayAt of ['commitHandoff', 'deleteEncryptedEnvelope'] as const) {
  test(`TC-019: expiry during ${delayAt} preserves the marker and refuses dispatch`, async () => {
    const f = fixture();
    let time = 100000;
    f.now = () => time;
    if (delayAt === 'commitHandoff') {
      const commit = f.journal.commitHandoff.bind(f.journal);
      f.journal.commitHandoff = async at => { const saved = await commit(at); time = 200000; return saved; };
    } else {
      const remove = f.journal.deleteEncryptedEnvelope.bind(f.journal);
      f.journal.deleteEncryptedEnvelope = async () => { await remove(); time = 200000; };
    }
    await assert.rejects(handoffOnce(f), /QUOTE_EXPIRED_AFTER_HANDOFF_MARKER/);
    assert.equal(f.calls.includes('submit'), false);
    assert.notEqual((await f.journal.load()).handoffCommittedAt, null);
    await handoffOnce(f);
    assert.equal(f.calls.at(-1), 'observe');
    assert.equal(f.calls.filter(call => call === 'sponsor').length, 1);
  });
}
