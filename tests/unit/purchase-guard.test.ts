import { describe, expect, it } from 'vitest';
import { createIntentGate } from '../../apps/server/src/intent-gate.js';

const quoteId = '8c75951c-220c-4bea-8891-8e128df24c26';
describe('bounded untrusted tool intents (TC-014)', () => {
  it('rejects arbitrary tools, URLs and model amounts', () => {
    const gate = createIntentGate();
    for (const input of [
      { tool: 'fundEscrow', amount: '1' },
      { tool: 'request_quote', resourceKey: 'https://evil.test' },
      { tool: 'purchase_quote', quoteId, amountStroops: '1' },
    ]) expect(() => gate.accept(input)).toThrow();
  });
  it('holds unknown purchase identity and forbids fresh purchase intents', () => {
    const gate = createIntentGate();
    expect(gate.accept({ tool: 'purchase_quote', quoteId })).toMatchObject({ quoteId });
    expect(() => gate.accept({ tool: 'purchase_quote', quoteId })).toThrow('PAYMENT_UNRESOLVED');
    expect(gate.accept({ tool: 'read_purchase', quoteId }).tool).toBe('read_purchase');
  });
  it('enforces finite steps, turns and elapsed active time', () => {
    let now = 0;
    const gate = createIntentGate(() => now);
    for (let i = 0; i < 8; i++) gate.nextTurn();
    expect(() => gate.nextTurn()).toThrow('MODEL_TURN_LIMIT');
    const steps = createIntentGate();
    for (let i = 0; i < 12; i++) steps.accept({ tool: 'discover_offers' });
    expect(() => steps.accept({ tool: 'discover_offers' })).toThrow('TOOL_STEP_LIMIT');
    const time = createIntentGate(() => now);
    now = 90000;
    expect(() => time.accept({ tool: 'discover_offers' })).toThrow('ACTIVE_TIME_LIMIT');
  });
});
