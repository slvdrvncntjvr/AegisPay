import type { ToolIntent } from '@aegispay/shared';

export const RUN_LIMITS = Object.freeze({ modelTurns: 8, toolSteps: 12, activeMs: 90000 });

// Pure bounds/intent guard. It cannot grant evidence, change policy or make payments.
export class BoundedIntentGuard {
  private turns = 0;
  private steps = 0;
  private unresolvedQuote: string | undefined;
  private readonly started: number;
  constructor(private readonly clock: () => number = () => performance.now()) { this.started = clock(); }
  private assertTime() {
    if (this.clock() - this.started >= RUN_LIMITS.activeMs) throw new Error('ACTIVE_TIME_LIMIT');
  }
  nextTurn() {
    this.assertTime();
    if (this.turns >= RUN_LIMITS.modelTurns) throw new Error('MODEL_TURN_LIMIT');
    this.turns++;
  }
  accept(intent: ToolIntent) {
    this.assertTime();
    if (this.steps >= RUN_LIMITS.toolSteps) throw new Error('TOOL_STEP_LIMIT');
    if (intent.tool === 'purchase_quote') {
      if (this.unresolvedQuote) throw new Error('PAYMENT_UNRESOLVED');
      this.unresolvedQuote = intent.quoteId;
    }
    if (intent.tool === 'read_purchase' && intent.quoteId !== this.unresolvedQuote) throw new Error('PURCHASE_IDENTITY_MISMATCH');
    this.steps++;
  }
}

// Durable consumers reserve a turn before contacting the provider. A process
// death therefore consumes its reserved allowance rather than resetting bounds.
export function reserveModelTurn(turns: number, activeMs: number) {
  if (!Number.isInteger(turns) || turns < 0 || turns >= RUN_LIMITS.modelTurns) throw new Error('MODEL_TURN_LIMIT');
  if (!Number.isFinite(activeMs) || activeMs < 0 || activeMs >= RUN_LIMITS.activeMs) throw new Error('ACTIVE_TIME_LIMIT');
  const allowanceMs = Math.min(30000, RUN_LIMITS.activeMs - activeMs);
  return { turns: turns + 1, activeMs: activeMs + allowanceMs, allowanceMs };
}

// A final payment citation comes from a delivered, entitlement-checked receipt.
// Raw provider text is never a success flag or an externally actionable URL.
export function finalRunAnswer(text: string, receiptId?: string): string {
  if (!receiptId) return 'Run ended without a verified purchase. No protected report was delivered.';
  const summary = text.trim().slice(0, 1200);
  // Conservative display hardening, not a factuality validator. Financial state
  // is supplied separately by trusted evidence; retain useful report summaries.
  if (!summary || /[a-z][a-z0-9+.-]*:\/\/|www\.|javascript:|data:|mailto:|[<>]/i.test(summary) ||
    /\b(pay(?:ment|ments|ing|s)?|paid|purchased?|buy|bought|fees?|costs?|spent|spend|budget|stroops?|xlm|settle(?:d|ment)?|claim(?:ed|ing|s)?|refund(?:ed)?|escrow|balance|authoriz(?:ed|ation)|confirm(?:ed|ation))\b/i.test(summary) ||
    [...summary].some(c => c.charCodeAt(0) < 32) ||
    [...summary.matchAll(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi)].some(m => m[0] !== receiptId)) {
    return `Retrieved the fictional demo report. Receipt: ${receiptId}.`;
  }
  return `${summary}\nVerified demo report receipt: ${receiptId}. Merchant claim is separate.`;
}
