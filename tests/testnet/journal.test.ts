import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { SpikeJournal } from '../../src/server/integrations/spike-journal.js';
import { handoffOnce } from '../../src/server/integrations/velo.js';

async function cleanup(directory: string) {
  assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
  assert.equal(basename(directory).startsWith('aegispay-journal-'), true);
  await rm(directory, { recursive: true, force: true });
}

test('TC-029: process restart retains exact encrypted envelope, nonce and reservation; handoff is exclusive', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aegispay-journal-'));
  try {
    const key = Buffer.alloc(32, 7);
    const journal = await SpikeJournal.open(dir, key, { operationId: 'synthetic-operation', nonce: '17', expiresAt: 200000, intentHash: 'cc'.repeat(32) });
    await journal.saveEnvelope('synthetic-secret-xdr-sentinel');
    const identity = { requestId: 'synthetic-request', transactionHash: 'aa'.repeat(32) };
    await journal.saveReservation(identity);
    const child = await promisify(execFile)(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      import { SpikeJournal } from './src/server/integrations/spike-journal.ts';
      const journal = await SpikeJournal.open(process.argv[1], Buffer.alloc(32, 7));
      assert.equal(await journal.readEnvelope(), 'synthetic-secret-xdr-sentinel');
      console.log(JSON.stringify({ nonce: journal.operation.nonce, identity: (await journal.load()).identity }));
    `, dir]);
    assert.deepEqual(JSON.parse(child.stdout), { nonce: '17', identity });
    const resumed = await SpikeJournal.open(dir, key);
    assert.equal(resumed.operation.nonce, '17');
    assert.equal(await resumed.readEnvelope(), 'synthetic-secret-xdr-sentinel');
    assert.deepEqual((await resumed.load()).identity, identity);
    const outcomes = await Promise.all([journal.commitHandoff(100000), resumed.commitHandoff(100000)]);
    assert.equal(outcomes.filter(Boolean).length, 1);
    await resumed.deleteEncryptedEnvelope();
    for (const file of await readdir(dir)) assert.equal((await readFile(join(dir, file), 'utf8')).includes('synthetic-secret-xdr-sentinel'), false);
    let observes = 0;
    await handoffOnce({ journal: resumed, operationId: 'synthetic-operation', signedEnvelope: '',
      expected: { innerHash: identity.transactionHash, agent: 'synthetic-agent', escrow: 'synthetic-escrow', expiresAt: 200000 },
      now: () => 300000, gas: {
        async sponsor() { throw new Error('must never sponsor'); },
        async submit() { throw new Error('must never submit'); },
        async getStatus(saved) { observes++; assert.deepEqual(saved, identity); throw new Error('synthetic-observation-unavailable'); },
      },
    }).catch(error => assert.match(String(error), /synthetic-observation-unavailable/));
    assert.equal(observes, 1);
  } finally { await cleanup(dir); }
});

test('TC-029: wrong key, envelope substitution and reservation substitution fail closed', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aegispay-journal-'));
  try {
    const journal = await SpikeJournal.open(dir, Buffer.alloc(32, 7), { operationId: 'synthetic-operation', nonce: '17', expiresAt: 200000, intentHash: 'cc'.repeat(32) });
    await journal.saveEnvelope('synthetic-secret-xdr-sentinel');
    await assert.rejects(journal.saveEnvelope('different-envelope'), /ENVELOPE_ALREADY_SAVED/);
    await assert.rejects(journal.deleteEncryptedEnvelope(), /HANDOFF_NOT_COMMITTED/);
    const wrongKey = await SpikeJournal.open(dir, Buffer.alloc(32, 8));
    await assert.rejects(wrongKey.readEnvelope(), /ENVELOPE_DECRYPTION_FAILED/);
    await journal.saveReservation({ requestId: 'synthetic-request', transactionHash: 'aa'.repeat(32) });
    await assert.rejects(journal.saveReservation({ requestId: 'different-request', transactionHash: 'aa'.repeat(32) }), /RESERVATION_ALREADY_SAVED/);
    await assert.rejects(SpikeJournal.open(dir, Buffer.alloc(32, 7), { operationId: 'replacement-operation', nonce: '18', expiresAt: 300000, intentHash: 'cc'.repeat(32) }), /OPERATION_ALREADY_SAVED/);
  } finally { await cleanup(dir); }
});

test('TC-029: partial handoff marker after a crash cannot authorize another financial dispatch', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aegispay-journal-'));
  try {
    const journal = await SpikeJournal.open(dir, Buffer.alloc(32, 7), {
      operationId: 'synthetic-operation', nonce: '17', expiresAt: 200000, intentHash: 'cc'.repeat(32),
    });
    await journal.saveReservation({ requestId: 'synthetic-request', transactionHash: 'aa'.repeat(32) });
    await writeFile(join(dir, 'handoff.json'), '{"at":');
    await assert.rejects(journal.load(), /JOURNAL_CORRUPT_OR_UNREADABLE/);
    await assert.rejects(journal.commitHandoff(100000), /JOURNAL_CORRUPT_OR_UNREADABLE/);
    assert.equal(await readFile(join(dir, 'handoff.json'), 'utf8'), '{"at":');
  } finally { await cleanup(dir); }
});

test('TC-015: encrypted envelopes are authenticated to their original operation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aegispay-journal-'));
  try {
    const journal = await SpikeJournal.open(dir, Buffer.alloc(32, 7), {
      operationId: 'synthetic-operation', nonce: '17', expiresAt: 200000, intentHash: 'cc'.repeat(32),
    });
    await journal.saveEnvelope('synthetic-secret-xdr-sentinel');
    // Offline corruption is never repaired by accepting another operation's envelope.
    const file = join(dir, 'operation.json');
    const record = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
    record.operationId = 'different-operation';
    await writeFile(file, JSON.stringify(record));
    const altered = await SpikeJournal.open(dir, Buffer.alloc(32, 7));
    await assert.rejects(altered.readEnvelope(), /ENVELOPE_DECRYPTION_FAILED/);
  } finally { await cleanup(dir); }
});

test('TC-019: terminal pre-handoff expiry destroys ciphertext and forbids signing or dispatch on restart', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aegispay-journal-'));
  try {
    const journal = await SpikeJournal.open(dir, Buffer.alloc(32, 7), {
      operationId: 'synthetic-operation', nonce: '17', expiresAt: 200000, intentHash: 'cc'.repeat(32),
    });
    await journal.saveEnvelope('synthetic-secret-xdr-sentinel');
    await journal.refuseBeforeHandoff('QUOTE_EXPIRED');
    assert.equal((await readdir(dir)).includes('envelope.json'), false);
    await assert.rejects(journal.load(), /TERMINAL_PRE_HANDOFF_QUOTE_EXPIRED/);
    await assert.rejects(journal.commitHandoff(100000), /TERMINAL_PRE_HANDOFF_QUOTE_EXPIRED/);
    await assert.rejects(journal.saveEnvelope('replacement'), /TERMINAL_PRE_HANDOFF_QUOTE_EXPIRED/);
  } finally { await cleanup(dir); }
});
