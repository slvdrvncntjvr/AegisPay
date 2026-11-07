import assert from 'node:assert/strict';
import fs, { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { test, mock } from 'node:test';
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
    await journal.saveEnvelope('synthetic-envelope');
    await journal.saveReservation({ requestId: 'synthetic-request', transactionHash: 'aa'.repeat(32) });
    await writeFile(join(dir, 'handoff.json'), '{"at":');
    await assert.rejects(journal.load(), /JOURNAL_CORRUPT_OR_UNREADABLE/);
    await assert.rejects(journal.commitHandoff(100000), /JOURNAL_CORRUPT_OR_UNREADABLE/);
    await assert.rejects(journal.refuseBeforeHandoff('POLICY_REFUSED'), /JOURNAL_CORRUPT_OR_UNREADABLE/);
    assert.equal((await readdir(dir)).includes('envelope.json'), true);
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

test('TC-019/TC-029: restart cleans an interrupted refusal and retains its immutable decision', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aegispay-journal-'));
  try {
    const key = Buffer.alloc(32, 7);
    const journal = await SpikeJournal.open(dir, key, {
      operationId: 'synthetic-operation', nonce: '17', expiresAt: 200000, intentHash: 'cc'.repeat(32),
    });
    await journal.saveEnvelope('synthetic-secret-xdr-sentinel');
    // Crash after the durable terminal record, before unlink.
    const decision = JSON.stringify({ terminalCode: 'POLICY_REFUSED', at: 100000 });
    await writeFile(join(dir, 'handoff.json'), decision);
    const resumed = await SpikeJournal.open(dir, key);
    await assert.rejects(resumed.load(), /TERMINAL_PRE_HANDOFF_POLICY_REFUSED/);
    assert.equal((await readdir(dir)).includes('envelope.json'), false);
    await resumed.refuseBeforeHandoff('POLICY_REFUSED');
    await resumed.refuseBeforeHandoff('POLICY_REFUSED');
    await assert.rejects(resumed.refuseBeforeHandoff('QUOTE_EXPIRED'), /HANDOFF_DECISION_ALREADY_SAVED/);
    await assert.rejects(resumed.readEnvelope(), /TERMINAL_PRE_HANDOFF_POLICY_REFUSED/);
    await assert.rejects(resumed.saveEnvelope('replacement'), /TERMINAL_PRE_HANDOFF_POLICY_REFUSED/);
    await assert.rejects(resumed.saveReservation({ requestId: 'replacement', transactionHash: 'aa'.repeat(32) }), /TERMINAL_PRE_HANDOFF_POLICY_REFUSED/);
    await assert.rejects(resumed.commitHandoff(100000), /TERMINAL_PRE_HANDOFF_POLICY_REFUSED/);
    await assert.rejects(handoffOnce({ journal: resumed, operationId: journal.operation.operationId, signedEnvelope: '',
      expected: { innerHash: 'aa'.repeat(32), agent: 'synthetic-agent', escrow: 'synthetic-escrow', expiresAt: 200000 },
      gas: {
        async sponsor() { assert.fail('terminal refusal must not sponsor'); },
        async submit() { assert.fail('terminal refusal must not send'); },
        async getStatus() { assert.fail('terminal refusal has no execution to observe'); },
      },
    }), /TERMINAL_PRE_HANDOFF_POLICY_REFUSED/);
    assert.equal(await readFile(join(dir, 'handoff.json'), 'utf8'), decision);
    assert.equal((await readdir(dir)).includes('reservation.json'), false);
  } finally { await cleanup(dir); }
});

test('TC-019/TC-029: unlink failure retains refusal, and later recovery retries cleanup', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aegispay-journal-'));
  let unlinkMock: ReturnType<typeof mock.method> | undefined;
  try {
    const journal = await SpikeJournal.open(dir, Buffer.alloc(32, 7), {
      operationId: 'synthetic-operation', nonce: '17', expiresAt: 200000, intentHash: 'cc'.repeat(32),
    });
    await journal.saveEnvelope('synthetic-secret-xdr-sentinel');
    unlinkMock = mock.method(fs, 'unlink', async () => { throw Object.assign(new Error('synthetic-unlink-denied'), { code: 'EACCES' }); });
    syncBuiltinESMExports();
    await assert.rejects(journal.refuseBeforeHandoff('QUOTE_EXPIRED'), /ENVELOPE_DELETE_FAILED/);
    const decision = await readFile(join(dir, 'handoff.json'), 'utf8');
    assert.equal((await readdir(dir)).includes('envelope.json'), true);
    await assert.rejects(journal.load(), /ENVELOPE_DELETE_FAILED/);
    unlinkMock.mock.restore(); syncBuiltinESMExports();
    const resumed = await SpikeJournal.open(dir, Buffer.alloc(32, 7));
    await resumed.refuseBeforeHandoff('QUOTE_EXPIRED');
    await assert.rejects(resumed.load(), /TERMINAL_PRE_HANDOFF_QUOTE_EXPIRED/);
    assert.equal((await readdir(dir)).includes('envelope.json'), false);
    assert.equal(await readFile(join(dir, 'handoff.json'), 'utf8'), decision);
  } finally { unlinkMock?.mock.restore(); syncBuiltinESMExports(); await cleanup(dir); }
});

test('TC-029: refusal winning during an envelope save cleans the late write', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aegispay-journal-'));
  try {
    const journal = await SpikeJournal.open(dir, Buffer.alloc(32, 7), {
      operationId: 'synthetic-operation', nonce: '17', expiresAt: 200000, intentHash: 'cc'.repeat(32),
    });
    const competing = await SpikeJournal.open(dir, Buffer.alloc(32, 7));
    const load = journal.load.bind(journal);
    let first = true;
    mock.method(journal, 'load', async () => {
      const saved = await load();
      if (first) { first = false; await competing.refuseBeforeHandoff('POLICY_REFUSED'); }
      return saved;
    });
    await assert.rejects(journal.saveEnvelope('synthetic-late-envelope'), /TERMINAL_PRE_HANDOFF_POLICY_REFUSED/);
    assert.equal((await readdir(dir)).includes('envelope.json'), false);
    await assert.rejects(competing.readEnvelope(), /TERMINAL_PRE_HANDOFF_POLICY_REFUSED/);
  } finally { await cleanup(dir); }
});

test('TC-029: concurrent handoff and terminal refusal preserve exactly one immutable decision', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aegispay-journal-'));
  try {
    const journal = await SpikeJournal.open(dir, Buffer.alloc(32, 7), {
      operationId: 'synthetic-operation', nonce: '17', expiresAt: 200000, intentHash: 'cc'.repeat(32),
    });
    await journal.saveEnvelope('synthetic-envelope');
    await journal.saveReservation({ requestId: 'synthetic-request', transactionHash: 'aa'.repeat(32) });
    const competing = await SpikeJournal.open(dir, Buffer.alloc(32, 7));
    await Promise.allSettled([journal.commitHandoff(100000), competing.refuseBeforeHandoff('POLICY_REFUSED')]);
    const decision = await readFile(join(dir, 'handoff.json'), 'utf8');
    if ('terminalCode' in JSON.parse(decision)) {
      await assert.rejects(journal.commitHandoff(100000), /TERMINAL_PRE_HANDOFF_POLICY_REFUSED/);
      await competing.refuseBeforeHandoff('POLICY_REFUSED');
      assert.equal((await readdir(dir)).includes('envelope.json'), false);
    } else {
      assert.equal(await journal.commitHandoff(100000), false);
      await assert.rejects(competing.refuseBeforeHandoff('POLICY_REFUSED'), /HANDOFF_DECISION_ALREADY_SAVED/);
      assert.equal((await readdir(dir)).includes('envelope.json'), true);
    }
    assert.equal(await readFile(join(dir, 'handoff.json'), 'utf8'), decision);
  } finally { await cleanup(dir); }
});

test('TC-029: a refusal between handoff check and exclusive create cannot become an observation or send', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aegispay-journal-'));
  try {
    const journal = await SpikeJournal.open(dir, Buffer.alloc(32, 7), {
      operationId: 'synthetic-operation', nonce: '17', expiresAt: 200000, intentHash: 'cc'.repeat(32),
    });
    await journal.saveEnvelope('synthetic-envelope');
    await journal.saveReservation({ requestId: 'synthetic-request', transactionHash: 'aa'.repeat(32) });
    const competing = await SpikeJournal.open(dir, Buffer.alloc(32, 7));
    const load = journal.load.bind(journal);
    let reads = 0;
    mock.method(journal, 'load', async () => {
      const saved = await load();
      if (++reads === 2) await competing.refuseBeforeHandoff('POLICY_REFUSED');
      return saved;
    });
    await assert.rejects(handoffOnce({ journal, operationId: journal.operation.operationId, signedEnvelope: 'synthetic-envelope',
      expected: { innerHash: 'aa'.repeat(32), agent: 'synthetic-agent', escrow: 'synthetic-escrow', expiresAt: 200000 }, now: () => 100000,
      gas: {
        async sponsor() { assert.fail('reservation already exists'); },
        async submit() { assert.fail('refusal won the handoff race'); },
        async getStatus() { assert.fail('refusal is not a financial handoff'); },
      },
    }), /TERMINAL_PRE_HANDOFF_POLICY_REFUSED/);
    const decision = await readFile(join(dir, 'handoff.json'), 'utf8');
    await competing.refuseBeforeHandoff('POLICY_REFUSED');
    assert.equal(await readFile(join(dir, 'handoff.json'), 'utf8'), decision);
    assert.equal((await readdir(dir)).includes('envelope.json'), false);
  } finally { await cleanup(dir); }
});

test('TC-029: handoff winning during an envelope save cleans the late write', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aegispay-journal-'));
  try {
    const journal = await SpikeJournal.open(dir, Buffer.alloc(32, 7), {
      operationId: 'synthetic-operation', nonce: '17', expiresAt: 200000, intentHash: 'cc'.repeat(32),
    });
    await journal.saveReservation({ requestId: 'synthetic-request', transactionHash: 'aa'.repeat(32) });
    const competing = await SpikeJournal.open(dir, Buffer.alloc(32, 7));
    const load = journal.load.bind(journal);
    let first = true;
    mock.method(journal, 'load', async () => {
      const saved = await load();
      if (first) { first = false; assert.equal(await competing.commitHandoff(100000), true); await competing.deleteEncryptedEnvelope(); }
      return saved;
    });
    await assert.rejects(journal.saveEnvelope('synthetic-late-envelope'), /HANDOFF_ALREADY_COMMITTED/);
    assert.equal((await readdir(dir)).includes('envelope.json'), false);
    await assert.rejects(competing.readEnvelope(), /HANDOFF_ALREADY_COMMITTED/);
  } finally { await cleanup(dir); }
});

test('TC-029: terminal decision during an envelope read blocks decryption of a late writer', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aegispay-journal-'));
  try {
    const journal = await SpikeJournal.open(dir, Buffer.alloc(32, 7), {
      operationId: 'synthetic-operation', nonce: '17', expiresAt: 200000, intentHash: 'cc'.repeat(32),
    });
    await journal.saveEnvelope('synthetic-secret-xdr-sentinel');
    const encrypted = await readFile(join(dir, 'envelope.json'), 'utf8');
    const competing = await SpikeJournal.open(dir, Buffer.alloc(32, 7));
    const load = journal.load.bind(journal);
    let first = true;
    mock.method(journal, 'load', async () => {
      const saved = await load();
      if (first) {
        first = false;
        await competing.refuseBeforeHandoff('POLICY_REFUSED');
        // A pre-existing writer finishes after the first refusal cleanup.
        await writeFile(join(dir, 'envelope.json'), encrypted);
      }
      return saved;
    });
    await assert.rejects(journal.readEnvelope(), /TERMINAL_PRE_HANDOFF_POLICY_REFUSED/);
    assert.equal((await readdir(dir)).includes('envelope.json'), false);
  } finally { await cleanup(dir); }
});
